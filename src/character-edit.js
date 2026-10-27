import { characterById } from '../data/catalog.js';
import { validateSave } from './model.js';
import { parseQuantityInput } from './inventory-quantities.js';

const characterTaskFields = {
  progression: ['prestige', 'bloodwebLevel'],
  notes: ['notes'],
  owned: ['owned'],
  favorite: ['favorite'],
};

export function createCharacterTaskSession(save, id, task) {
  const fields = characterTaskFields[task];
  if (!fields || !Object.hasOwn(characterById, id) || !Object.hasOwn(save.characters, id)) {
    throw new Error('Select a valid character task.');
  }
  const baseline = Object.fromEntries(fields.map(field => [field, structuredClone(save.characters[id][field])]));
  return {
    characterId: id,
    task,
    baseFingerprint: JSON.stringify(save),
    baseline,
    draft: structuredClone(baseline),
    rawInputs: task === 'progression' ? { prestige: String(baseline.prestige), bloodwebLevel: String(baseline.bloodwebLevel) } : {},
    errors: [],
    dirty: false,
    conflicted: false,
  };
}

export function updateCharacterTaskSession(session, change) {
  const fields = characterTaskFields[session?.task];
  if (!fields?.includes(change?.field)) throw new Error('Field is outside this character task.');
  const next = structuredClone(session);
  const { field, value } = change;
  next.errors = next.errors.filter(error => error.field !== field);
  try {
    if (session.task === 'progression') {
      const raw = String(value);
      next.rawInputs[field] = raw;
      const number = parseQuantityInput(raw);
      if (field === 'bloodwebLevel' && (number < 1 || number > 50)) throw new Error('Bloodweb level must be 1–50.');
      next.draft[field] = number;
    } else if (session.task === 'notes') {
      if (typeof value !== 'string') throw new Error('Notes must be text.');
      next.draft.notes = value;
    } else {
      if (typeof value !== 'boolean') throw new Error('Select true or false.');
      next.draft[field] = value;
    }
  } catch (error) {
    next.errors.push({ field, message: error.message });
  }
  next.dirty = next.errors.length > 0 || JSON.stringify(next.draft) !== JSON.stringify(next.baseline);
  return next;
}

export function buildCharacterTaskCandidate(save, session) {
  if (session.conflicted || JSON.stringify(save) !== session.baseFingerprint) {
    return { candidate: null, changed: false, errors: [{ field: 'session', message: 'Underlying save changed. Discard/reload before saving.' }], conflict: true };
  }
  if (session.errors.length) return { candidate: null, changed: false, errors: structuredClone(session.errors), conflict: false };
  const candidate = structuredClone(save);
  for (const field of characterTaskFields[session.task]) candidate.characters[session.characterId][field] = structuredClone(session.draft[field]);
  try {
    const validated = validateSave(candidate).save;
    const changed = characterTaskFields[session.task].some(field =>
      JSON.stringify(validated.characters[session.characterId][field]) !== JSON.stringify(save.characters[session.characterId][field]));
    return { candidate: validated, changed, errors: [], conflict: false };
  } catch (error) {
    return { candidate: null, changed: false, errors: [{ field: 'session', message: error.message }], conflict: false };
  }
}
