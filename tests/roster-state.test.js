import test from 'node:test';
import assert from 'node:assert/strict';
import { characters } from '../data/catalog.js';
import { freshSave } from '../src/model.js';
import { createRosterStateMemory, paginateRoster } from '../src/roster-state.js';

const roleList = role => characters.filter(character => character.role === role);

test('paginates the already filtered and sorted list in six-result pages for both roles', () => {
  const survivors = roleList('survivor').filter(character => character.name.length > 0).sort((a, b) => b.name.localeCompare(a.name));
  const killers = roleList('killer').filter(character => character.id !== 'unknown').sort((a, b) => a.name.localeCompare(b.name));

  assert.equal(survivors.length, 54);
  assert.equal(killers.length, 44);
  assert.equal(paginateRoster(survivors, 0).pageCount, 9);
  assert.equal(paginateRoster(killers, 0).pageCount, 8);
  assert.equal(paginateRoster(survivors, 0).results.length, 6);
  assert.deepEqual(paginateRoster(survivors, 1).results, survivors.slice(6, 12));
  assert.deepEqual(paginateRoster(killers, 1).results, killers.slice(6, 12));
});

test('handles empty, one-result, partial-final and stale or invalid pages', () => {
  assert.deepEqual(paginateRoster([], 8), {
    page: 0, pageCount: 1, pageSize: 6, total: 0, start: 0, end: 0, results: [],
  });

  const one = [{ id: 'only' }];
  assert.deepEqual(paginateRoster(one, 0).results, one);
  assert.deepEqual(paginateRoster(one, 50).results, one);
  assert.equal(paginateRoster(one, 50).page, 0);

  const eight = Array.from({ length: 8 }, (_, id) => ({ id }));
  const lastPage = paginateRoster(eight, 1);
  assert.equal(lastPage.pageCount, 2);
  assert.equal(lastPage.start, 7);
  assert.equal(lastPage.end, 8);
  assert.deepEqual(lastPage.results, eight.slice(6));
  assert.equal(paginateRoster(eight, 99).page, 1, 'external result shrink clamps to the last valid page');
  assert.equal(paginateRoster(eight, -1).page, 0);
  assert.equal(paginateRoster(eight, Number.NaN).page, 0);
});

test('search, filter and sort changes reset a role page while unchanged input does not', () => {
  const roster = createRosterStateMemory();
  roster.update('survivor', { page: 8 });
  assert.equal(roster.update('survivor', { search: 'Meg' }).page, 0);
  roster.update('survivor', { page: 3 });
  assert.equal(roster.update('survivor', { search: 'Meg' }).page, 3);
  assert.equal(roster.update('survivor', { status: 'owned' }).page, 0);
  roster.update('survivor', { page: 2 });
  assert.equal(roster.update('survivor', { sort: 'prestige-desc' }).page, 0);
});

test('role pages remain independent and paging never changes portable account data', () => {
  const roster = createRosterStateMemory();
  roster.update('survivor', { page: 4, search: 'Meg' });
  roster.update('killer', { page: 6, search: 'Trapper' });
  assert.deepEqual(roster.read('survivor'), {
    search: 'Meg', status: 'all', prestige: 'all', favorite: false, sort: 'name', page: 4,
    originCharacterId: null, scrollY: 0,
  });
  assert.deepEqual(roster.read('killer'), {
    search: 'Trapper', status: 'all', prestige: 'all', favorite: false, sort: 'name', page: 6,
    originCharacterId: null, scrollY: 0,
  });

  const save = freshSave();
  const before = JSON.stringify(save);
  const results = paginateRoster(roleList('survivor'), roster.read('survivor').page).results;
  assert.equal(results.length, 6);
  assert.equal(JSON.stringify(save), before);
  assert.equal(Object.hasOwn(save, 'rosters'), false);
});

test('keeps validated return origin and scroll per role in session memory', () => {
  const roster = createRosterStateMemory();
  roster.update('survivor', { page: 3, search: 'Ada', originCharacterId: 'ada-wong', scrollY: 412 });
  roster.update('killer', { page: 2, search: 'Trapper', originCharacterId: 'the-trapper', scrollY: 180 });

  assert.equal(roster.read('survivor').originCharacterId, 'ada-wong');
  assert.equal(roster.read('survivor').scrollY, 412);
  assert.equal(roster.read('killer').originCharacterId, 'the-trapper');
  assert.equal(roster.read('killer').scrollY, 180);
  assert.equal(roster.update('survivor', { originCharacterId: 42, scrollY: Number.NaN }).originCharacterId, null);
  assert.equal(roster.read('survivor').scrollY, 0);
});
