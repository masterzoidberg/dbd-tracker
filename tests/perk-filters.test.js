import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/model.js';
import { perkById } from '../data/catalog.js';
import { matchesPerkFilters } from '../src/perk-filters.js';

test('All unlocked includes every owned source but excludes availability without ownership', () => {
  const save = freshSave();
  save.characters['ash-williams'].owned = true;
  save.characters['meg-thomas'].prestige = 1;
  save.perkOverrides.bond = { shrineTier: 1 };
  save.perkOverrides.technician = { shrineTier: 0, legacyTier: 1 };
  save.perkOverrides['iron-will'] = { shrineTier: 0, manualTier: 1 };
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.characters['ash-williams'].perks.resilience = 1;
  save.characters['ash-williams'].perks.unbreakable = 0;
  const matches = (id, character = 'ash-williams') => matchesPerkFilters(save, perkById[id], character, ['all-unlocked']);
  for (const id of ['adrenaline', 'bond', 'technician', 'iron-will', 'camaraderie', 'resilience', 'flip-flop']) {
    assert.equal(matches(id), true, id);
    assert.equal(matchesPerkFilters(save, perkById[id], undefined, ['all-unlocked']), true, id);
  }
  for (const id of ['unbreakable', 'borrowed-time', 'kindred']) assert.equal(matches(id), false, id);
  assert.equal(matches('camaraderie', 'ace-visconti'), false);
  assert.equal(matchesPerkFilters(save, perkById.camaraderie, undefined, ['all-unlocked']), true);
  assert.equal(matchesPerkFilters(save, perkById.kindred, undefined, ['all-unlocked']), false);
});

test('historical, personal tier and availability filters combine without confusing global Legacy unlocks', () => {
  const save = freshSave();
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.perkOverrides.bond = { shrineTier: 0, legacyTier: 1 };
  const matches = (id, filters) => matchesPerkFilters(save, perkById[id], 'ash-williams', filters);
  assert.equal(matches('camaraderie', ['historical', 'owned', 'global-locked']), true);
  assert.equal(matches('camaraderie', ['historical', 'missing']), false);
  assert.equal(matches('unbreakable', ['historical', 'missing']), true);
  assert.equal(matches('bond', ['legacy', 'historical']), true);
  assert.equal(matches('bond', ['legacy', 'owned', 'global-unlocked']), true);
  assert.equal(matches('camaraderie', ['1', '2', 'historical']), true);
  assert.equal(matches('unbreakable', ['1', '2', 'historical']), false);
  assert.equal(matches('resilience', ['general', 'historical', 'missing']), true);
  assert.equal(matches('unbreakable', ['general', 'historical', 'missing']), true);
  assert.equal(matches('camaraderie', []), true);
});

test('library combinations respect source ownership, role inventory and former-name search', () => {
  const save = freshSave();
  save.characters['steve-harrington'].owned = true;
  const check = (id, selected, search = '') => matchesPerkFilters(save, perkById[id], undefined, selected, search);
  assert.equal(check('camaraderie', ['historical', 'source-owned'], 'Kinship'), true);
  assert.equal(check('surge', ['historical', 'source-owned'], 'Jolt'), false);
  assert.equal(check('surge', ['historical', 'source-owned', 'source-locked'], 'Jolt'), true);
  assert.equal(check('camaraderie', ['historical', 'global-unlocked']), true);
  save.characters['steve-harrington'].prestige = 1;
  assert.equal(check('camaraderie', ['historical', 'global-unlocked', 'global-1']), true);
  assert.equal(check('camaraderie', ['historical', 'global-2', 'global-3']), true);
  assert.equal(check('bond', ['historical', 'global-2', 'global-3']), false);
});

test('missing perks in Legacy OR globally available categories include both, never require their intersection', () => {
  const save = freshSave();
  save.characters['ash-williams'].perks.camaraderie = 2;
  save.characters['meg-thomas'].prestige = 1;
  save.perkOverrides.bond = { shrineTier: 0, legacyTier: 1 };
  const matches = (id, selected) => matchesPerkFilters(save, perkById[id], 'ash-williams', selected);
  const discovery = ['missing', 'historical', 'global-unlocked'];
  assert.equal(matches('unbreakable', discovery), true);
  assert.equal(matches('kindred', discovery), true);
  assert.equal(matches('camaraderie', discovery), false);
  assert.equal(matches('adrenaline', discovery), false);
  assert.equal(matches('iron-will', discovery), false);
  for (const id of ['unbreakable', 'kindred']) assert.equal(matches(id, ['missing', 'available']), true);
  assert.equal(matches('camaraderie', ['missing', 'available']), false);
  assert.equal(matches('iron-will', ['missing', 'available']), false);
  for (const id of ['bond', 'kindred']) assert.equal(matches(id, ['legacy', 'global-unlocked']), true);
  assert.equal(save.characters['ash-williams'].perks.unbreakable, undefined);
});
