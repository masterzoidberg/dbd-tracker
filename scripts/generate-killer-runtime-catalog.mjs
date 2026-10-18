import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { characters, characterById } from '../data/catalog.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const rarityCounts = { Common: 4, Uncommon: 5, Rare: 5, 'Very Rare': 4, 'Ultra Rare': 2 };
const detailFields = {
  components: ['name', 'type', 'description'],
  mechanics: ['name', 'value', 'unit', 'conditions', 'description'],
  resources: ['name', 'type', 'description'],
  survivorInteractions: ['name', 'description'],
  powerStates: ['name', 'description'],
  complexRules: ['name', 'description'],
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const scalar = value => value === null || typeof value === 'string' || typeof value === 'boolean'
  || typeof value === 'number' && Number.isFinite(value);
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(value)?.[0] === value;
const check = (condition, message) => { if (!condition) throw new Error(message); };

function projectArtwork(artwork, allowMissing) {
  check(object(artwork), 'Missing artwork metadata.');
  check(allowMissing && artwork.path === null && artwork.confidence === 'MISSING'
    || text(artwork.path) && ['EXACT', 'REVIEW'].includes(artwork.confidence), 'Invalid artwork path/confidence.');
  return { path: artwork.path, confidence: artwork.confidence };
}

function projectPower(power) {
  check(object(power) && power.researchStatus === 'VERIFIED' && text(power.powerName)
    && text(power.shortSummary), 'Invalid or unverified Power.');
  const result = { powerName: power.powerName, shortSummary: power.shortSummary };
  if (Object.hasOwn(power, 'fullExplanation')) {
    check(text(power.fullExplanation), 'Invalid Power explanation.');
    result.fullExplanation = power.fullExplanation;
  }
  for (const field of ['components', 'mechanics', 'resources', 'survivorInteractions', 'powerStates', 'addonRelevantMechanics', 'complexRules']) {
    if (!Object.hasOwn(power, field)) continue;
    check(Array.isArray(power[field]), `Invalid Power ${field}.`);
    result[field] = power[field].map(row => {
      if (field === 'addonRelevantMechanics') {
        check(text(row), 'Invalid Add-on-relevant mechanic.');
        return row;
      }
      check(object(row) && text(row.name) && text(row.description), `Invalid Power ${field} entry.`);
      return Object.fromEntries(detailFields[field].filter(key => Object.hasOwn(row, key)).map(key => {
        const value = row[key];
        check(key === 'value' ? scalar(value) || Array.isArray(value) && value.every(scalar)
          : typeof value === 'string' || key === 'unit' && value === null, `Invalid Power ${field} ${key}.`);
        return [key, structuredClone(value)];
      }));
    });
  }
  result.artwork = projectArtwork(power.artwork, true);
  return result;
}

export function projectKillerRuntimeCatalog(source) {
  const expectedKillers = characters.filter(character => character.role === 'killer');
  check(object(source) && text(source.dataset) && text(source.gameVersion)
    && Array.isArray(source.killers) && source.killers.length === expectedKillers.length, 'Invalid Killer catalog structure/count.');
  const owners = new Set(), killerIds = new Set(), ids = new Set(), researchIds = new Set();
  const killers = source.killers.map(killer => {
    check(object(killer) && slug(killer.characterId) && Object.hasOwn(characterById, killer.characterId)
      && characterById[killer.characterId].role === 'killer' && characterById[killer.characterId].name === killer.killerName
      && !owners.has(killer.characterId), 'Invalid or duplicate Killer owner.');
    check(slug(killer.killerId) && !killerIds.has(killer.killerId), 'Invalid or duplicate Killer identity.');
    owners.add(killer.characterId); killerIds.add(killer.killerId);
    check(object(killer.power) && killer.power.killerName === killer.killerName
      && killer.power.powerName === killer.powerName, 'Invalid Power owner/identity.');
    check(Array.isArray(killer.addons) && killer.addons.length === 20, 'Invalid Add-on count.');
    const counts = Object.fromEntries(Object.keys(rarityCounts).map(rarity => [rarity, 0]));
    const addons = killer.addons.map((addon, order) => {
      check(object(addon) && slug(addon.id) && addon.id.startsWith('killer-addon-' + killer.killerId + '-')
        && addon.id.length > ('killer-addon-' + killer.killerId + '-').length && !ids.has(addon.id), 'Invalid or duplicate Add-on identity.');
      check(typeof addon.researchId === 'string' && addon.researchId.split('/').length === 2
        && addon.researchId.split('/').every(slug) && !researchIds.has(addon.researchId), 'Invalid or duplicate Add-on research identity.');
      check(addon.characterId === killer.characterId && addon.killerId === killer.killerId
        && addon.killerName === killer.killerName, 'Invalid Add-on owner.');
      check(text(addon.name) && text(addon.effect) && addon.researchStatus === 'VERIFIED', 'Invalid or unverified Add-on metadata.');
      check(Object.hasOwn(rarityCounts, addon.rarity), 'Invalid Add-on rarity.');
      counts[addon.rarity]++;
      ids.add(addon.id); researchIds.add(addon.researchId);
      return { id: addon.id, characterId: addon.characterId, name: addon.name, order, rarity: addon.rarity,
        effect: addon.effect, artwork: projectArtwork(addon.artwork, false) };
    });
    check(Object.entries(rarityCounts).every(([rarity, count]) => counts[rarity] === count), 'Invalid Add-on rarity counts.');
    return { characterId: killer.characterId, power: projectPower(killer.power), addons };
  });
  return { dataset: source.dataset, gameVersion: source.gameVersion, killers };
}

export async function generateKillerRuntimeCatalog(root = PROJECT_ROOT) {
  const source = JSON.parse(await readFile(resolve(root, 'data/dbd-killers-live-10.2.1.json'), 'utf8'));
  return projectKillerRuntimeCatalog(source);
}

export async function writeKillerRuntimeCatalog(root = PROJECT_ROOT) {
  root = resolve(root);
  const catalog = await generateKillerRuntimeCatalog(root);
  await mkdir(resolve(root, 'data'), { recursive: true });
  await writeFile(resolve(root, 'data/killer-runtime-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  return catalog;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const catalog = await writeKillerRuntimeCatalog();
    console.log(`Killer runtime catalog: ${catalog.killers.length} Powers, ${catalog.killers.reduce((count, killer) => count + killer.addons.length, 0)} Add-ons.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
