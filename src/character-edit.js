import { characterById, perkById } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';
import { validateSave, automaticTier, correctPersonalPerkTier, setHistoricalPerkTier } from './model.js';
import { setCharacterPersonalTier } from './character-inventory.js';
import { assertQuantityEntity, parseQuantityInput } from './inventory-quantities.js';

export function createCharacterEditSession(save, id, returnRoute = null) {
  if (!Object.hasOwn(characterById, id) || !Object.hasOwn(save.characters, id)) throw new Error('Select a resolved character.');
  return { characterId: id, baseFingerprint: JSON.stringify(save), baseline: structuredClone(save.characters[id]),
    draft: structuredClone(save.characters[id]), rawInputs: { prestige: String(save.characters[id].prestige),
      bloodwebLevel: String(save.characters[id].bloodwebLevel) }, perkModes: {}, errors: [], dirty: false, returnRoute, conflicted: false };
}

export function characterEditPreview(save, session) {
  const preview = structuredClone(save);
  preview.characters[session.characterId] = structuredClone(session.draft);
  return preview;
}

export function updateCharacterEditSession(session, change, save, { entityById = inventoryEntityById } = {}) {
  const next = structuredClone(session), { field, id, value } = change;
  const key = field + (id ? ':' + (change.map || '') + ':' + id : '');
  next.errors = next.errors.filter(error => error.key && error.key !== key);
  try {
    if (field === 'prestige' || field === 'bloodwebLevel') {
      next.rawInputs[field] = String(value);
      const number = parseQuantityInput(next.rawInputs[field]);
      if (field === 'bloodwebLevel' && (number < 1 || number > 50)) throw new Error('Bloodweb level must be 1–50.');
      next.draft[field] = number;
    } else if (field === 'owned' || field === 'favorite') {
      if (typeof value !== 'boolean') throw new Error('Select true or false.');
      next.draft[field] = value;
    } else if (field === 'notes') {
      if (typeof value !== 'string') throw new Error('Notes must be text.');
      next.draft.notes = value;
    } else if (field === 'perk') {
      if (!Object.hasOwn(perkById, id) || perkById[id].role !== characterById[session.characterId].role) throw new Error('Select a same-role perk.');
      const preview = characterEditPreview(save, next);
      if (change.mode === 'historical') {
        // Acquisition floors are saved records, not a previous unsaved selection.
        preview.characters[session.characterId].perks = structuredClone(next.baseline.perks);
        setHistoricalPerkTier(preview, session.characterId, id, value);
      } else if (change.mode === 'correction') correctPersonalPerkTier(preview, session.characterId, id, value);
      else setCharacterPersonalTier(preview, session.characterId, id, value);
      if (Object.hasOwn(preview.characters[session.characterId].perks, id)) next.draft.perks[id] = preview.characters[session.characterId].perks[id];
      else delete next.draft.perks[id];
      next.perkModes[id] = change.mode || 'personal';
    } else if (field === 'quantity') {
      next.rawInputs[key] = change.text;
      assertQuantityEntity(session.characterId, change.map, id, entityById);
      const quantity = parseQuantityInput(change.text);
      if (quantity > 0) next.draft.inventory[change.map][id] = quantity;
      else delete next.draft.inventory[change.map][id];
    } else throw new Error('Unknown character edit field.');
  } catch (error) { next.errors.push({ key, field, id, message: error.message }); }
  next.dirty = next.errors.length > 0 || JSON.stringify(next.draft) !== JSON.stringify(next.baseline);
  return next;
}

export function buildCharacterEditCandidate(save, session, { entityById = inventoryEntityById } = {}) {
  if (session.conflicted || JSON.stringify(save) !== session.baseFingerprint) {
    return { candidate: null, changed: false, errors: [{ field: 'session', message: 'Underlying save changed. Discard/reload before saving.' }], conflict: true };
  }
  const errors = structuredClone(session.errors), preview = characterEditPreview(save, session);
  for (const [id, mode] of Object.entries(session.perkModes)) {
    const tier = session.draft.perks[id];
    if (tier === session.baseline.perks[id] && Object.hasOwn(session.draft.perks, id) === Object.hasOwn(session.baseline.perks, id)) continue;
    if (mode === 'personal' && tier !== undefined && tier < automaticTier(preview, session.characterId, perkById[id])) {
      errors.push({ field: 'perk', id, message: 'Selected personal tier is below the final automatic minimum.' });
    }
  }
  if (errors.length) return { candidate: null, changed: false, errors, conflict: false };
  try {
    const candidate = validateSave(preview, { inventoryCatalog: entityById }).save;
    return { candidate, changed: JSON.stringify(candidate.characters[session.characterId]) !== JSON.stringify(save.characters[session.characterId]), errors: [], conflict: false };
  } catch (error) {
    return { candidate: null, changed: false, errors: [{ field: 'session', message: error.message }], conflict: false };
  }
}
