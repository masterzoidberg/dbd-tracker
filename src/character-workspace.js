import { characterById } from '../data/catalog.js';
import { roleCharacters } from './model.js';

export function characterWorkspaceHref(id, section = 'overview', mode = null) {
  if (!Object.hasOwn(characterById, id)) throw new Error('Unknown character.');
  const sections = ['overview', 'perks', 'setup',
    characterById[id].role === 'survivor' ? 'items-addons' : 'power-addons'];
  if (!sections.includes(section) || (mode !== null && (section !== 'perks' || mode !== 'legacy'))) {
    throw new Error('Unavailable character section.');
  }
  return '#character/' + id + '/' + section + (mode ? '/' + mode : '');
}

export function characterWorkspaceNeighbors(id, section = 'overview', mode = null) {
  const character = characterById[id];
  if (!character) throw new Error('Unknown character.');
  const roster = roleCharacters(character.role), index = roster.findIndex(entry => entry.id === id);
  const normalizedMode = mode === 'update' ? null : mode;
  const routeFor = target => {
    try { return characterWorkspaceHref(target.id, section, normalizedMode); }
    catch { return characterWorkspaceHref(target.id); }
  };
  const entry = target => target ? { id: target.id, name: target.name, href: routeFor(target) } : null;
  return { previous: entry(roster[index - 1]), next: entry(roster[index + 1]) };
}

export function parseCharacterWorkspaceRoute(hash) {
  if (typeof hash !== 'string') return null;
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!/^(character|manage|experiment)(?:\/|$)/.test(value)) return null;
  const parts = value.split('/'), source = parts[0], id = parts[1] ?? null;
  const unavailable = reason => ({ kind: 'character', status: 'unavailable', reason, characterId: id });
  if (!id || !Object.hasOwn(characterById, id)) return unavailable('unknown-character');
  let section, mode = null, legacyEdit = false, normalizeUpdate = false;
  if (source === 'character') {
    if (parts.length > 4) return unavailable('invalid-path');
    section = parts.length === 2 ? 'overview' : parts[2];
    if (parts.length === 4) mode = parts[3];
    if (section === 'perks' && mode === 'update') { mode = null; normalizeUpdate = true; }
    if (section === 'edit') { section = 'overview'; legacyEdit = true; }
  } else {
    if (parts.length > 3) return unavailable('invalid-path');
    section = 'perks';
    if (parts.length === 3) {
      mode = parts[2];
      if (mode === 'update') { mode = null; normalizeUpdate = true; }
      else if (mode !== 'legacy' || (source === 'experiment' && mode === 'legacy')) return unavailable('invalid-path');
    }
  }
  if ((section === 'items-addons' && characterById[id].role !== 'survivor')
    || (section === 'power-addons' && characterById[id].role !== 'killer')) return unavailable('wrong-role');
  try {
    return { kind: 'character', status: 'valid', characterId: id, section, mode,
      source: legacyEdit ? 'legacy-edit' : source === 'character' ? 'canonical' : source,
      canonicalRoute: characterWorkspaceHref(id, section, mode), ...(normalizeUpdate ? { normalizeUpdate: true } : {}) };
  } catch { return unavailable('invalid-path'); }
}
