export const ROSTER_PAGE_SIZE = 6;

const roles = ['survivor', 'killer'];
const resultKeys = ['search', 'status', 'prestige', 'favorite', 'sort'];
const emptyRosterState = () => ({
  search: '', status: 'all', prestige: 'all', favorite: false, sort: 'name', page: 0,
  originCharacterId: null, scrollY: 0,
});

function requireRole(role) {
  if (!roles.includes(role)) throw new RangeError(`Unknown roster role: ${role}`);
}

export function paginateRoster(results, requestedPage = 0) {
  if (!Array.isArray(results)) throw new TypeError('Roster results must be an array');
  const total = results.length;
  const pageCount = Math.max(1, Math.ceil(total / ROSTER_PAGE_SIZE));
  const requested = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  const page = Math.min(requested, pageCount - 1);
  const offset = page * ROSTER_PAGE_SIZE;
  return {
    page, pageCount, pageSize: ROSTER_PAGE_SIZE, total,
    start: total ? offset + 1 : 0,
    end: Math.min(offset + ROSTER_PAGE_SIZE, total),
    results: results.slice(offset, offset + ROSTER_PAGE_SIZE),
  };
}

export function createRosterStateMemory() {
  const states = { survivor: emptyRosterState(), killer: emptyRosterState() };
  const read = role => {
    requireRole(role);
    return { ...states[role] };
  };
  return {
    read,
    update(role, patch = {}) {
      requireRole(role);
      const current = states[role];
      const changedResults = resultKeys.some(key => Object.hasOwn(patch, key) && patch[key] !== current[key]);
      const next = { ...current, ...patch };
      if (changedResults && !Object.hasOwn(patch, 'page')) next.page = 0;
      if (!Number.isSafeInteger(next.page) || next.page < 0) next.page = 0;
      if (typeof next.originCharacterId !== 'string' || !next.originCharacterId.trim()) next.originCharacterId = null;
      if (!Number.isFinite(next.scrollY) || next.scrollY < 0) next.scrollY = 0;
      states[role] = next;
      return read(role);
    },
  };
}
