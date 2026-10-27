import { characterById } from '../data/catalog.js';
import { characterWorkspaceHref, parseCharacterWorkspaceRoute } from './character-workspace.js';

export const CONTINUE_KEY = 'dbdTrackerContinue';

const stableSections = new Set(['overview', 'perks', 'items-addons', 'power-addons']);

function validateRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some(key => !['version', 'characterId', 'role', 'section', 'visitedAt'].includes(key))) return null;
  const { version, characterId, role, section, visitedAt } = value;
  const character = typeof characterId === 'string' && Object.hasOwn(characterById, characterId)
    ? characterById[characterId] : null;
  if (version !== 1 || !character || role !== character.role || !stableSections.has(section)
    || (section === 'items-addons' && role !== 'survivor')
    || (section === 'power-addons' && role !== 'killer')
    || typeof visitedAt !== 'string' || !Number.isFinite(Date.parse(visitedAt))) return null;
  return { version, characterId, role, section, visitedAt };
}

export function normalizeContinueRoute(route, visitedAt = new Date().toISOString()) {
  const descriptor = parseCharacterWorkspaceRoute(route);
  if (descriptor?.status !== 'valid') return null;
  const character = characterById[descriptor.characterId];
  let section = descriptor.section;
  if (section === 'setup') section = 'overview';
  if (section === 'perks') section = 'perks';
  if (!stableSections.has(section)
    || (section === 'items-addons' && character.role !== 'survivor')
    || (section === 'power-addons' && character.role !== 'killer')) return null;
  return validateRecord({ version: 1, characterId: character.id, role: character.role, section, visitedAt });
}

export function continueIsValidForSave(value, save) {
  const record = validateRecord(value);
  return Boolean(record && save?.characters && Object.hasOwn(save.characters, record.characterId));
}

export function readContinue(storage, save) {
  try {
    const raw = storage.getItem(CONTINUE_KEY);
    if (raw === null) return null;
    const record = validateRecord(JSON.parse(raw));
    return continueIsValidForSave(record, save)
      ? { ...record, route: characterWorkspaceHref(record.characterId, record.section) }
      : null;
  } catch { return null; }
}

export function writeContinue(storage, route, { now = new Date().toISOString() } = {}) {
  const record = normalizeContinueRoute(route, now);
  if (!record) return null;
  try { storage.setItem(CONTINUE_KEY, JSON.stringify(record)); return record; }
  catch { return null; }
}

export function clearContinue(storage) {
  try { storage.removeItem(CONTINUE_KEY); return true; }
  catch { return false; }
}

export function invalidateContinueForSave(storage, save) {
  try {
    const raw=storage.getItem(CONTINUE_KEY);
    if(raw===null) return false;
    const record=validateRecord(JSON.parse(raw));
    if(!record||continueIsValidForSave(record,save)) return false;
    storage.removeItem(CONTINUE_KEY);
    return true;
  } catch { return false; }
}
