import survivorData from './dbd-survivor-perks-live-10.1.2a-2026-10-05-corrected.json' with { type: 'json' };
import killerData from './killer-perks-audited-10.1.2a-2026-10-05.json' with { type: 'json' };

export const slug = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Keep the original tracker IDs when catalog labels or file slugs differ.
const characterIds = { 'William "Bill" Overbeck': 'bill-overbeck', 'Lee Yun-Jin': 'yun-jin-lee' };
const characterNames = {
  'Aestri Yazar': 'Aestri Yazar & Baermar Uraz',
};

export const halloweenNames = {
  'save-the-best-for-last': ['Save the Best for Last', 'Keep Them Waiting'],
  'play-with-your-food': ['Play with Your Food', 'See How They Run'],
  'dying-light': ['Dying Light', 'Cull the Weak'],
  'sole-survivor': ['Sole Survivor', 'Down to the Last'],
  'object-of-obsession': ['Object of Obsession', 'Bound by Obsession'],
  'decisive-strike': ['Decisive Strike', 'Will to Live'],
};
export const hellraiserNames = {
  'deadlock': ['Deadlock', 'No Holds Barred'],
  'hex-plaything': ['Hex: Plaything', 'Hex: Fortune’s Fool'],
  'scourge-hook-gift-of-pain': ['Scourge Hook: Gift of Pain', 'Scourge Hook: Weeping Wounds'],
};
export const strangerThingsNames = {
  'better-together': ['Better Together', 'Situational Awareness'],
  'fixated': ['Fixated', 'Self-Aware'],
  'inner-strength': ['Inner Strength', 'Inner Healing'],
  'babysitter': ['Babysitter', 'Guardian'],
  'camaraderie': ['Camaraderie', 'Kinship'],
  'second-wind': ['Second Wind', 'Renewal'],
  'surge': ['Surge', 'Jolt'],
  'cruel-limits': ['Cruel Limits', 'Claustrophobia'],
  'mindbreaker': ['Mindbreaker', 'Fearmonger'],
};
export const perkAliases = {
  ...Object.fromEntries(Object.entries(strangerThingsNames).map(([id, names]) => [slug(names[1]), id])),
  'keep-them-waiting': 'save-the-best-for-last',
  'see-how-they-run': 'play-with-your-food',
  'cull-the-weak': 'dying-light',
  'no-holds-barred': 'deadlock',
  'hex-fortunes-fool': 'hex-plaything',
  'scourge-hook-weeping-wounds': 'scourge-hook-gift-of-pain',
  'down-to-the-last': 'sole-survivor',
  'bound-by-obsession': 'object-of-obsession',
  'will-to-live': 'decisive-strike',
};
export const perkName = (save, perk) => halloweenNames[perk.id]?.[save.characters[perk.sourceCharacterId]?.owned || save.settings?.halloweenNames !== 'generic' ? 0 : 1] ?? hellraiserNames[perk.id]?.[save.characters[perk.sourceCharacterId]?.owned || save.settings?.hellraiserNames !== 'generic' ? 0 : 1] ?? perk.name;
export const perkSearchText = perk => `${(halloweenNames[perk.id] ?? hellraiserNames[perk.id] ?? strangerThingsNames[perk.id] ?? [perk.name]).join(' ')} ${perk.sourceCharacterName}`.replace(/[’']/g, '');
const perkIds = {
  'barbecue-and-chilli': 'barbecue-chilli',
  'monitor-and-abuse': 'monitor-abuse',
  'down-to-the-last': 'sole-survivor',
  'bound-by-obsession': 'object-of-obsession',
  'will-to-live': 'decisive-strike',
};

export const characters = [];
export const perks = [];
const formerConsoleGeneral = {
  type: 'former_console_general',
  label: 'Legacy General Perk',
  manualOwnership: true,
  note: 'Formerly available as a General Survivor perk on console before Bill Overbeck was added. Older Survivors may retain a character-specific copy.',
};
const formerStrangerThingsGeneral = {
  type: 'former_stranger_things_general',
  label: 'Legacy General Perk',
  manualOwnership: true,
  note: 'Temporarily available as a General perk during the Stranger Things delisting period. Older characters may retain character-specific copies.',
};
const historicalAvailability = {
  ...Object.fromEntries(['borrowed-time', 'unbreakable', 'left-behind'].map(id => [id, formerConsoleGeneral])),
  ...Object.fromEntries(Object.keys(strangerThingsNames).map(id => [id, formerStrangerThingsGeneral])),
};
for (const [role, data] of [['survivor', survivorData], ['killer', killerData]]) {
  const sources = new Map();
  for (const row of data.perks) {
    // Renamed licensed perks are aliases of the original perk, not extra inventory slots.
    if (role === 'killer' && perkAliases[row.slug]) continue;
    const sourceName = row.source_character ?? row.source_killer;
    const name = characterNames[sourceName] ?? sourceName;
    const sourceId = row.is_general_perk ? null : characterIds[sourceName] ?? slug(sourceName);
    const id = perkIds[row.slug] ?? row.slug;
    perks.push({
      id, name: row.name, role, general: row.is_general_perk || !!halloweenNames[id] || !!hellraiserNames[id],
      sourceCharacterId: sourceId, sourceCharacterName: row.is_general_perk ? 'General' : name,
      description: row.current_effect, summary: row.plain_english_summary,
      ...(historicalAvailability[id] ? { historicalAvailability: historicalAvailability[id] } : {}),
    });
    if (sourceId) {
      if (!sources.has(sourceId)) sources.set(sourceId, { id: sourceId, name, role, nativePerkIds: [] });
      sources.get(sourceId).nativePerkIds.push(id);
    }
  }
  characters.push(...sources.values());
}

// The supplied catalog lists these licensed perks under their general names.
// Keep Laurie visible and preserve her progression, without duplicating perks.
characters.push({ id: 'laurie-strode', name: 'Laurie Strode', role: 'survivor', nativePerkIds: ['sole-survivor', 'object-of-obsession', 'decisive-strike'] });
for (const id of characters.find(c => c.id === 'laurie-strode').nativePerkIds) {
  const perk = perks.find(p => p.id === id);
  perk.sourceCharacterId = 'laurie-strode';
  perk.sourceCharacterName = 'Laurie Strode';
}
characters.sort((a, b) => a.name.localeCompare(b.name));
export const characterById = Object.fromEntries(characters.map(c => [c.id, c]));
export const perkById = Object.fromEntries(perks.map(p => [p.id, p]));
for (const [alias, id] of Object.entries(perkAliases)) perkById[alias] = perkById[id];
export const catalogInfo = {
  label: 'JSON catalog',
  patch: survivorData.verified_live_patch,
  date: survivorData.verified_date,
  detail: `${characters.filter(c => c.role === 'survivor').length} Survivors · ${characters.filter(c => c.role === 'killer').length} Killers · ${perks.length} perks. Supplied catalog · patch ${survivorData.verified_live_patch} · ${survivorData.verified_date}.`,
};
