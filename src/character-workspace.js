import { characterById } from '../data/catalog.js';

export function characterWorkspaceHref(id, section = 'overview', mode = null) {
  if (!Object.hasOwn(characterById, id)) throw new Error('Unknown character.');
  const sections = ['overview', 'perks', 'edit', 'setup',
    characterById[id].role === 'survivor' ? 'items-addons' : 'power-addons'];
  if (!sections.includes(section) || (mode !== null && (section !== 'perks' || !['update', 'legacy'].includes(mode)))) {
    throw new Error('Unavailable character section.');
  }
  return '#character/' + id + '/' + section + (mode ? '/' + mode : '');
}

export function parseCharacterWorkspaceRoute(hash) {
  if (typeof hash !== 'string') return null;
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!/^(character|manage|experiment)(?:\/|$)/.test(value)) return null;
  const parts = value.split('/'), source = parts[0], id = parts[1] ?? null;
  const unavailable = reason => ({ kind: 'character', status: 'unavailable', reason, characterId: id });
  if (!id || !Object.hasOwn(characterById, id)) return unavailable('unknown-character');
  let section, mode = null;
  if (source === 'character') {
    if (parts.length > 4) return unavailable('invalid-path');
    section = parts.length === 2 ? 'overview' : parts[2];
    if (parts.length === 4) mode = parts[3];
  } else {
    if (parts.length > 3) return unavailable('invalid-path');
    section = 'perks';
    if (parts.length === 3) {
      mode = parts[2];
      if (!['update', 'legacy'].includes(mode) || (source === 'experiment' && mode === 'legacy')) return unavailable('invalid-path');
    }
  }
  if ((section === 'items-addons' && characterById[id].role !== 'survivor')
    || (section === 'power-addons' && characterById[id].role !== 'killer')) return unavailable('wrong-role');
  try {
    return { kind: 'character', status: 'valid', characterId: id, section, mode,
      source: source === 'character' ? 'canonical' : source,
      canonicalRoute: characterWorkspaceHref(id, section, mode) };
  } catch { return unavailable('invalid-path'); }
}
