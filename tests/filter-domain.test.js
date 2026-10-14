import test from 'node:test';
test('canonical legacy retains filter context while normal Perks stays lean', () => {
  assert.equal(filters.getFilterContext('character/meg-thomas/perks/legacy')?.characterId, 'meg-thomas');
  assert.equal(filters.getFilterContext('character/meg-thomas/perks'), null);
});
import assert from 'node:assert/strict';
import { perks, perkById } from '../data/catalog.js';
import { freshSave, ownedUnlockSource } from '../src/model.js';
import * as filters from '../src/perk-filters.js';

const manager = () => filters.getFilterContext('manage/ash-williams/legacy');
const library = () => filters.getFilterContext('survivor-perks');
const sample = ['kindred', 'resilience', 'camaraderie', 'unbreakable', 'flip-flop', 'adrenaline', 'surge'].map(id => perkById[id]);
const ids = (save, context, state, list = sample) => list.filter(p => filters.matchesPerkFilterState(save, p, context, state)).map(p => p.id).sort();

test('character quick views use effective tiers and eligibility without a target ownership gate', () => {
  const save = freshSave();
  save.characters['ash-williams'].perks.resilience = 3;
  save.characters['ash-williams'].perks.camaraderie = 2;
  assert.equal(save.characters['ash-williams'].owned, false);
  const expected = {
    all: ['adrenaline', 'camaraderie', 'flip-flop', 'kindred', 'resilience', 'unbreakable'],
    'bloodweb-available': ['flip-flop', 'kindred'],
    owned: ['camaraderie', 'flip-flop', 'resilience'],
    missing: ['adrenaline', 'kindred', 'unbreakable'],
    'needs-upgrade': ['flip-flop'],
  };
  for (const [quick, result] of Object.entries(expected)) assert.deepEqual(ids(save, manager(), { quick }), result, quick);
  save.characters['steve-harrington'].prestige = 1;
  assert.deepEqual(ids(save, manager(), { quick: 'needs-upgrade' }), ['camaraderie', 'flip-flop']);
  save.characters['steve-harrington'].prestige = 3;
  assert.deepEqual(ids(save, manager(), { quick: 'bloodweb-available' }), ['flip-flop', 'kindred']);
  assert.equal(save.characters['ash-williams'].perks.camaraderie, 2);
});

test('historical unknown, explicit zero and retained positive records stay distinct', () => {
  const save = freshSave(), before = structuredClone(save);
  save.characters['ash-williams'].perks.camaraderie = 0;
  const historical = [perkById.camaraderie, perkById.unbreakable];
  assert.deepEqual(ids(save, manager(), { quick: 'missing' }, historical), ['camaraderie', 'unbreakable']);
  assert.equal(ownedUnlockSource(save, 'ash-williams', perkById.camaraderie), 'Not owned');
  assert.equal(ownedUnlockSource(save, 'ash-williams', perkById.unbreakable), 'Not confirmed');
  assert.equal(Object.hasOwn(save.characters['ash-williams'].perks, 'unbreakable'), false);
  save.characters['bill-overbeck'].prestige = 1;
  assert.deepEqual(ids(save, manager(), { quick: 'owned' }, historical), ['unbreakable']);
  assert.deepEqual(ids(save, manager(), { quick: 'missing' }, historical), ['camaraderie']);
  assert.equal(before.characters['ash-williams'].perks.camaraderie, undefined);
});

test('account quick views count only owned same-role characters and include automatic minima', () => {
  const save = freshSave();
  save.characters['meg-thomas'].prestige = 3;
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.characters['the-doctor'].owned = true;
  save.characters['the-doctor'].perks.surge = 3;
  assert.deepEqual(ids(save, library(), { quick: 'owned-by-my-characters' }), []);
  assert.deepEqual(ids(save, library(), { quick: 'globally-available' }), ['adrenaline', 'kindred', 'resilience']);
  assert.deepEqual(ids(save, library(), { quick: 'globally-locked' }), ['camaraderie', 'flip-flop', 'unbreakable']);
  save.characters['ash-williams'].owned = true;
  assert.deepEqual(ids(save, library(), { quick: 'owned-by-my-characters' }), ['adrenaline', 'camaraderie', 'flip-flop']);
  assert.deepEqual(ids(save, filters.getFilterContext('killer-perks'), { quick: 'owned-by-my-characters' }), ['surge']);
});

test('advanced groups OR their options and AND with other groups, quick and search', () => {
  const save = freshSave();
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.perkOverrides.camaraderie = { shrineTier: 1, legacyTier: 3 };
  save.perkOverrides.bond = { shrineTier: 0, legacyTier: 1 };
  const list = [perkById.camaraderie, perkById.bond, perkById.kindred, perkById['flip-flop']];
  assert.deepEqual(ids(save, manager(), { groups: { origin: ['general', 'historical'] } }, list), ['camaraderie', 'kindred']);
  assert.deepEqual(ids(save, manager(), { groups: { origin: ['historical'], unlockRecord: ['shrine'] } }, list), ['camaraderie']);
  assert.deepEqual(ids(save, manager(), { groups: { unlockRecord: ['shrine', 'legacy'] } }, list), ['bond', 'camaraderie']);
  assert.deepEqual(ids(save, manager(), { quick: 'owned', search: 'Kinship', groups: { origin: ['historical'], unlockRecord: ['shrine'] } }, list), ['camaraderie']);
  assert.deepEqual(ids(save, manager(), { quick: 'missing', groups: { origin: ['historical'], unlockRecord: ['shrine'] } }, list), []);
});

test('Native and General can overlap; source-less perks match neither source option', () => {
  const save = freshSave(), context = filters.getFilterContext('manage/laurie-strode/legacy');
  const list = [perkById['decisive-strike'], perkById.kindred];
  assert.deepEqual(ids(save, context, { groups: { origin: ['native'] } }, list), ['decisive-strike']);
  assert.deepEqual(ids(save, context, { groups: { origin: ['general'] } }, list), ['decisive-strike', 'kindred']);
  assert.deepEqual(ids(save, context, { groups: { source: ['owned', 'locked'] } }, list), ['decisive-strike']);
  assert.deepEqual(ids(save, context, { groups: { source: ['owned'] } }, list), []);
  save.characters['laurie-strode'].owned = true;
  assert.deepEqual(ids(save, context, { groups: { source: ['owned'] } }, list), ['decisive-strike']);
});

test('Native uses catalog nativePerkIds rather than source-character equality', () => {
  const save = freshSave();
  const sourcedNonNative = { ...perkById.kindred, sourceCharacterId: 'ash-williams' };
  const nativeWithDifferentSource = { ...perkById['flip-flop'], sourceCharacterId: null };
  assert.deepEqual(ids(save, manager(), { groups: { origin: ['native'] } }, [sourcedNonNative, nativeWithDifferentSource]), ['flip-flop']);
});

test('effective zero can be owned through automatic floors and global zero is not an automatic tier', () => {
  const save = freshSave();
  save.characters['ash-williams'].perks.adrenaline = 0;
  save.characters['meg-thomas'].prestige = 3;
  assert.deepEqual(ids(save, manager(), { groups: { effectiveTier: ['0'] } }), ['kindred', 'resilience', 'unbreakable', 'camaraderie'].sort());
  assert.deepEqual(ids(save, manager(), { groups: { effectiveTier: ['3'] } }), ['adrenaline']);
  assert.deepEqual(ids(save, library(), { groups: { globalTier: ['1', '2', '3'] } }), ['adrenaline']);
  assert.equal(save.characters['ash-williams'].perks.adrenaline, 0);
});

test('definitions and normalization expose only context-allowed controls', () => {
  const character = filters.perkFilterDefinitions(manager()), account = filters.perkFilterDefinitions(library());
  assert.deepEqual(character.quickViews.map(v => v.id), ['all', 'bloodweb-available', 'owned', 'missing', 'needs-upgrade']);
  assert.deepEqual(account.quickViews.map(v => v.id), ['all', 'globally-available', 'owned-by-my-characters', 'globally-locked']);
  assert.deepEqual(character.groups.map(g => g.id), ['globalAvailability', 'effectiveTier', 'origin', 'unlockRecord', 'source']);
  assert.deepEqual(account.groups.map(g => g.id), ['globalAvailability', 'origin', 'unlockRecord', 'source', 'globalTier']);
  assert.equal(account.groups.find(g => g.id === 'origin').options.some(o => o.id === 'native'), false);
  assert.match(character.quickViews.find(v => v.id === 'bloodweb-available').help, /appearances are random/);
  assert.match(account.quickViews.find(v => v.id === 'owned-by-my-characters').help, /same role/);
  const state = filters.normalizeFilterState(library(), { quick: 'missing', search: 4, sort: 'tier', groups: { effectiveTier: ['1'], origin: ['native', 'general', 'general', 'invalid'], globalTier: ['0'], invalid: ['anything'] } });
  assert.deepEqual(state, { search: '', quick: 'all', sort: 'name', groups: { origin: ['general'] } });
});

test('quick changes clear groups and preserve search/sort; refinements and clears retain quick', () => {
  const context = manager(), original = { search: 'Kinship', quick: 'owned', sort: 'tier', groups: { origin: ['historical'], effectiveTier: ['1', '2'] } };
  const before = structuredClone(original);
  const selected = filters.selectQuickView(context, original, 'needs-upgrade');
  assert.deepEqual(selected, { search: 'Kinship', quick: 'needs-upgrade', sort: 'tier', groups: {} });
  const refined = filters.toggleAdvancedOption(context, selected, 'effectiveTier', '2');
  assert.equal(refined.quick, 'needs-upgrade');
  assert.deepEqual(refined.groups, { effectiveTier: ['2'] });
  assert.equal(filters.activeAdvancedGroupCount(refined), 1);
  assert.deepEqual(filters.clearAdvancedFilters(context, refined), selected);
  assert.deepEqual(filters.clearAdvancedFilters(context, refined, 'effectiveTier'), selected);
  assert.deepEqual(filters.toggleAdvancedOption(context, refined, 'invalid-group', '2'), refined);
  assert.deepEqual(filters.toggleAdvancedOption(context, refined, 'effectiveTier', 'invalid-option'), refined);
  assert.deepEqual(original, before);
  assert.deepEqual(filters.toggleAdvancedOption(context, refined, 'effectiveTier', '2'), selected);
});

test('selected all-covering groups stay explicit/countable and zero results are not repaired', () => {
  const context = manager(), save = freshSave();
  const state = filters.normalizeFilterState(context, { quick: 'missing', groups: { globalAvailability: ['available', 'locked'], effectiveTier: ['0', '1', '2', '3'], source: ['owned', 'locked'] } });
  assert.equal(filters.activeAdvancedGroupCount(state), 3);
  assert.deepEqual(state.groups.source, ['owned', 'locked']);
  assert.deepEqual(ids(save, context, { quick: 'missing', groups: { effectiveTier: ['3'] } }), []);
  assert.deepEqual(filters.clearAdvancedFilters(context, state, 'source').groups, { globalAvailability: ['available', 'locked'], effectiveTier: ['0', '1', '2', '3'] });
});

test('facets retain quick/search/other groups and ignore every selection in their own group', () => {
  const save = freshSave(), context = manager();
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.perkOverrides.camaraderie = { shrineTier: 1, legacyTier: 1 };
  save.perkOverrides.unbreakable = { shrineTier: 1 };
  const state = { search: 'Kinship', quick: 'owned', sort: 'tier', groups: { effectiveTier: ['3'], origin: ['general'], unlockRecord: ['shrine'] } };
  const before = structuredClone(state), list = [perkById.camaraderie, perkById.unbreakable, perkById.kindred, perkById.camaraderie];
  const counts = filters.perkFacetCounts(save, context, { ...state, groups: { origin: ['general'], unlockRecord: ['shrine'] } }, list);
  assert.deepEqual(counts.origin, { native: 0, general: 0, historical: 1 });
  assert.deepEqual(filters.perkFacetCounts(save, context, { ...state, groups: { origin: ['native', 'general'], unlockRecord: ['shrine'] } }, list).origin, counts.origin);
  assert.deepEqual(counts.unlockRecord, { shrine: 0, legacy: 0 });
  const refined = { ...state, groups: { origin: ['historical'], unlockRecord: ['shrine'], effectiveTier: ['3'] } };
  assert.deepEqual(filters.perkFacetCounts(save, context, refined, list).effectiveTier, { '0': 0, '1': 0, '2': 1, '3': 0 });
  assert.deepEqual(filters.perkFacetCounts(save, context, { ...refined, sort: 'name' }, list), filters.perkFacetCounts(save, context, refined, list));
  assert.deepEqual(state, before);
});

test('facet overlap counts distinct perks; source facets exclude source-less General', () => {
  const save = freshSave(), context = filters.getFilterContext('manage/laurie-strode/legacy');
  save.perkOverrides['decisive-strike'] = { shrineTier: 1, legacyTier: 2 };
  const list = [perkById['decisive-strike'], perkById['decisive-strike'], perkById.kindred];
  const counts = filters.perkFacetCounts(save, context, {}, list);
  assert.deepEqual(counts.origin, { native: 1, general: 2, historical: 0 });
  assert.deepEqual(counts.unlockRecord, { shrine: 1, legacy: 1 });
  assert.deepEqual(counts.source, { owned: 0, locked: 1 });
});

test('account facets apply the owned same-role quick view, including an empty cohort', () => {
  const save = freshSave(), context = library(), state = { quick: 'owned-by-my-characters' };
  save.characters['the-doctor'].owned = true;
  save.characters['the-doctor'].perks.surge = 3;
  const empty = filters.perkFacetCounts(save, context, state, sample);
  for (const group of Object.values(empty)) assert.ok(Object.values(group).every(count => count === 0));
  save.characters['ash-williams'].owned = true;
  save.characters['meg-thomas'].prestige = 1;
  const counts = filters.perkFacetCounts(save, context, state, sample);
  assert.deepEqual(counts.globalTier, { '1': 1, '2': 0, '3': 0 });
  assert.deepEqual(counts.source, { owned: 1, locked: 1 });
  assert.deepEqual(counts.origin, { general: 0, historical: 0 });
});

test('canonical route memory isolates managers, collections and libraries with cloned snapshots', () => {
  const memory = filters.createFilterRouteMemory();
  const state = { search: 'Kinship', quick: 'owned', sort: 'tier', groups: { effectiveTier: ['2'] } };
  memory.write('manage/ash-williams/legacy', state);
  state.groups.effectiveTier.push('3');
  assert.deepEqual(memory.read('manage/ash-williams/legacy').groups, { effectiveTier: ['2'] });
  memory.write('manage/meg-thomas/legacy', { quick: 'missing' });
  memory.write('survivor-perks', { quick: 'owned-by-my-characters' });
  memory.write('killer-perks', { quick: 'globally-locked' });
  memory.write('survivors', { search: 'Meg', status: 'owned', prestige: '3', favorite: true, sort: 'bloodweb' });
  memory.write('killers', { search: 'Doctor', status: 'locked', sort: 'prestige-desc' });
  memory.read('dashboard'); memory.read('data');
  assert.equal(memory.read('manage/meg-thomas/legacy').quick, 'missing');
  assert.equal(memory.read('survivor-perks').quick, 'owned-by-my-characters');
  assert.equal(memory.read('killer-perks').quick, 'globally-locked');
  assert.deepEqual(memory.read('survivors'), { search: 'Meg', status: 'owned', prestige: '3', favorite: true, sort: 'bloodweb' });
  assert.equal(memory.read('killers').search, 'Doctor');
  const read = memory.read('manage/ash-williams/legacy'); read.groups.effectiveTier.push('3');
  assert.deepEqual(memory.read('manage/ash-williams/legacy').groups, { effectiveTier: ['2'] });
  assert.deepEqual(filters.createFilterRouteMemory().read('manage/ash-williams/legacy'), { search: '', quick: 'all', groups: {}, sort: 'name' });
});

test('invalid routes cannot create entries and invalid collection values use existing defaults', () => {
  const memory = filters.createFilterRouteMemory();
  for (const route of ['manage/unknown', 'manage/constructor', 'manage/meg-thomas/extra', '#survivors', 'Survivors', 'dashboard', 'data', '', null]) {
    assert.equal(filters.getFilterContext(route), null);
    assert.equal(memory.write(route, { search: 'bad' }), false);
    assert.equal(memory.read(route), null);
  }
  memory.write('survivors', { search: 'Meg', status: 'bad', prestige: 3, favorite: 'yes', sort: 'bad', groups: { source: ['owned'] } });
  assert.deepEqual(memory.read('survivors'), { search: 'Meg', status: 'all', prestige: 'all', favorite: false, sort: 'name' });
  assert.equal(memory.read('manage/meg-thomas/legacy').search, '');
});

test('new predicates preserve former-name search, role boundaries and progression bytes', () => {
  const save = freshSave(), bytes = JSON.stringify(save), context = manager();
  assert.deepEqual(ids(save, context, { search: 'Kinship' }, perks), ['camaraderie']);
  assert.deepEqual(ids(save, filters.getFilterContext('killer-perks'), { search: 'Jolt' }, perks), ['surge']);
  const memory = filters.createFilterRouteMemory();
  memory.write(context.route, { quick: 'bloodweb-available', groups: { effectiveTier: ['1'] } });
  filters.perkFacetCounts(save, context, memory.read(context.route));
  assert.equal(JSON.stringify(save), bytes);
});
