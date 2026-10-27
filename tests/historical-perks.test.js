import test from 'node:test';
import assert from 'node:assert/strict';
import { characters, perks, perkById, perkAliases, strangerThingsNames, perkSearchText, perkName, slug } from '../data/catalog.js';
import { freshSave, globalTier, inventoryTier, ownedUnlockSource, bloodwebEligible, bloodwebNextTier, setHistoricalPerkTier, completeCharacterSetup, parseSave, exportSave, syncGlobalInventories } from '../src/model.js';
import { characterSetupView } from '../src/character-setup.js';
import { historicalOwnershipControl } from '../src/historical-perks.js';
import { TrackerStorage } from '../src/storage.js';

const ids = ['borrowed-time', 'unbreakable', 'left-behind'];
const draft = id => ({ id, step: 'perks', perks: {}, search: '' });

test('Stranger Things historical perks appear on every same-role setup without automatic ownership', () => {
  const save = freshSave();
  for (const c of characters) {
    const view = characterSetupView(save, draft(c.id));
    for (const id of Object.keys(strangerThingsNames)) {
      const perk = perkById[id];
      assert.equal(perk.historicalAvailability.type, 'former_stranger_things_general');
      assert.equal(perk.general, false);
      assert.equal(view.includes(`data-historical-ownership="${id}"`), c.role === perk.role);
      assert.equal(globalTier(save, perk), 0);
      assert.equal(inventoryTier(save, c.id, id), c.id === perk.sourceCharacterId ? 1 : 0);
      if (c.role === perk.role) assert.ok(historicalOwnershipControl(save, c.id, perk).includes('value="" selected'));
    }
  }
});

test('Ash Camaraderie II stays local while Steve P1 and P3 establish independent minimums', () => {
  const save = freshSave(), perk = perkById.camaraderie;
  setHistoricalPerkTier(save, 'ash-williams', perk.id, 2);
  setHistoricalPerkTier(save, 'meg-thomas', perk.id, 0);
  assert.equal(inventoryTier(save, 'ash-williams', perk.id), 2);
  assert.equal(inventoryTier(save, 'meg-thomas', perk.id), 0);
  assert.equal(ownedUnlockSource(save, 'ace-visconti', perk), 'Not confirmed');
  assert.equal(globalTier(save, perk), 0);
  assert.equal(save.characters['steve-harrington'].prestige, 0);
  assert.deepEqual(save.perkOverrides, {});
  assert.equal(bloodwebEligible(save, 'ash-williams', perk), false);
  save.characters['steve-harrington'].prestige = 1;
  assert.equal(globalTier(save, perk), 1);
  assert.equal(inventoryTier(save, 'ash-williams', perk.id), 2);
  assert.equal(inventoryTier(save, 'meg-thomas', perk.id), 1);
  assert.equal(bloodwebNextTier(save, 'ash-williams', perk), 3);
  save.characters['steve-harrington'].prestige = 3;
  for (const c of characters.filter(c => c.role === 'survivor')) assert.equal(inventoryTier(save, c.id, perk.id), 3);
  assert.equal(save.characters['ash-williams'].perks.camaraderie, 2);
  assert.equal(save.characters['meg-thomas'].perks.camaraderie, 0);
});

test('Doctor Surge III stays local; Demogorgon P1 grants Wraith I without changing Doctor records', () => {
  const save = freshSave(), perk = perkById.surge;
  setHistoricalPerkTier(save, 'the-doctor', perk.id, 3);
  assert.equal(inventoryTier(save, 'the-doctor', perk.id), 3);
  assert.equal(inventoryTier(save, 'the-wraith', perk.id), 0);
  assert.equal(ownedUnlockSource(save, 'the-wraith', perk), 'Not confirmed');
  assert.equal(globalTier(save, perk), 0);
  assert.equal(save.characters['the-demogorgon'].prestige, 0);
  assert.deepEqual(save.perkOverrides, {});
  assert.throws(() => setHistoricalPerkTier(save, 'ash-williams', perk.id, 1), /same-role/);
  save.characters['the-demogorgon'].prestige = 1;
  assert.equal(globalTier(save, perk), 1);
  assert.equal(inventoryTier(save, 'the-doctor', perk.id), 3);
  assert.equal(inventoryTier(save, 'the-wraith', perk.id), 1);
  assert.equal(save.characters['the-doctor'].perks.surge, 3);
  assert.equal(Object.hasOwn(save.characters['the-wraith'].perks, perk.id), false);
});

test('Stranger Things former names search and import into single canonical personal records', () => {
  const save = freshSave();
  for (const [id, names] of Object.entries(strangerThingsNames)) {
    const alias = slug(names[1]), perk = perkById[id];
    const characterId = perk.role === 'survivor' ? 'ash-williams' : 'the-doctor';
    assert.equal(perkAliases[alias], id);
    assert.equal(perkById[alias], perk);
    assert.equal(perks.filter(p => p.id === id || p.id === alias).length, 1);
    assert.ok(perkSearchText(perk).includes(names[1]));
    assert.ok(characterSetupView(save, { ...draft(characterId), search: names[1] }).includes(`data-historical-ownership="${id}"`));
    save.characters[perk.sourceCharacterId].owned = true;
    assert.equal(perkName(save, perk), names[0]);
    save.characters[characterId].perks[id] = 1;
    save.characters[characterId].perks[alias] = 2;
  }
  const memory = new Map();
  const storage = new TrackerStorage({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, () => {});
  const imported = storage.replace(freshSave(), parseSave(exportSave(save)).save, 'Before alias import');
  for (const [id, names] of Object.entries(strangerThingsNames)) {
    const characterId = perkById[id].role === 'survivor' ? 'ash-williams' : 'the-doctor';
    assert.equal(imported.characters[characterId].perks[id], 2);
    assert.equal(Object.hasOwn(imported.characters[characterId].perks, slug(names[1])), false);
    assert.equal(globalTier(imported, perkById[id]), 0);
  }
  assert.deepEqual(parseSave(exportSave(imported)).save, imported);
  assert.deepEqual(storage.load().save, imported);
  assert.throws(() => {
    const invalid = freshSave();
    invalid.characters['ash-williams'].perks.jolt = 2;
    parseSave(exportSave(invalid));
  }, /wrong role/);
});

test('confirmed Stranger Things ownership saves through setup and export without changing other characters', () => {
  const save = freshSave();
  save.characters['ash-williams'].owned = true;
  setHistoricalPerkTier(save, 'ash-williams', 'camaraderie', 2);
  completeCharacterSetup(save, 'ash-williams', 20, { camaraderie: 3, babysitter: 0 });
  const imported = parseSave(exportSave(save)).save;
  assert.deepEqual(imported.characters['ash-williams'].perks, { camaraderie: 3, babysitter: 0 });
  assert.equal(inventoryTier(imported, 'meg-thomas', 'camaraderie'), 0);
  assert.deepEqual(imported.perkOverrides, {});
  assert.equal(globalTier(imported, perkById.camaraderie), 0);
  assert.ok(historicalOwnershipControl(imported, 'ash-williams', perkById.camaraderie).includes('value="3" selected'));
});

test('historical markers show unconfirmed perks on every Survivor without granting tiers or availability', () => {
  const save = freshSave();
  for (const character of characters.filter(c => c.role === 'survivor')) {
    const view = characterSetupView(save, draft(character.id));
    for (const id of ids) {
      const perk = perkById[id];
      assert.equal(perk.general, false);
      assert.equal(globalTier(save, perk), 0);
      assert.ok(view.includes(`data-historical-ownership="${id}"`));
      assert.ok(view.includes('Legacy General Perk'));
      assert.ok(historicalOwnershipControl(save, character.id, perk).includes('value="" selected'));
      if (character.id !== 'bill-overbeck') assert.equal(ownedUnlockSource(save, character.id, perk), 'Not confirmed');
      assert.equal(inventoryTier(save, character.id, id), character.id === 'bill-overbeck' ? 1 : 0);
    }
  }
  const killerView = characterSetupView(save, draft('the-trapper'));
  for (const id of ids) assert.equal(killerView.includes(`data-historical-ownership="${id}"`), false);
  assert.equal(perkById.resilience.historicalAvailability, undefined);
  assert.equal(bloodwebEligible(save, 'ace-visconti', perkById.resilience), true);
});

test('personal historical tiers stay local; P0 blocks upgrades, P1 restores them, P3 maxes everyone', () => {
  const save = freshSave(), perk = perkById.unbreakable;
  setHistoricalPerkTier(save, 'ace-visconti', perk.id, 2);
  assert.equal(inventoryTier(save, 'ace-visconti', perk.id), 2);
  assert.equal(inventoryTier(save, 'kate-denson', perk.id), 0);
  assert.equal(globalTier(save, perk), 0);
  assert.deepEqual(save.perkOverrides, {});
  assert.equal(save.characters['bill-overbeck'].prestige, 0);
  assert.equal(bloodwebEligible(save, 'ace-visconti', perk), false);
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), null);
  save.characters['bill-overbeck'].prestige = 1;
  assert.equal(globalTier(save, perk), 1);
  assert.equal(inventoryTier(save, 'ace-visconti', perk.id), 2);
  assert.equal(inventoryTier(save, 'kate-denson', perk.id), 1);
  assert.equal(bloodwebEligible(save, 'ace-visconti', perk), true);
  assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), 3);
  save.characters['bill-overbeck'].prestige = 3;
  for (const c of characters.filter(c => c.role === 'survivor')) {
    assert.equal(inventoryTier(save, c.id, perk.id), 3);
    assert.equal(bloodwebEligible(save, c.id, perk), false);
    assert.equal(bloodwebNextTier(save, c.id, perk), null);
  }
  assert.equal(save.characters['ace-visconti'].perks.unbreakable, 2);
  assert.deepEqual(save.characters['kate-denson'].perks, {});
});

test('later personal upgrades and explicit absence do not propagate or replace automatic minimums', () => {
  const save = freshSave();
  save.characters['ace-visconti'].owned = true;
  setHistoricalPerkTier(save, 'ace-visconti', 'unbreakable', 2);
  completeCharacterSetup(save, 'ace-visconti', 20, { unbreakable: 3, 'borrowed-time': 0 });
  assert.equal(inventoryTier(save, 'ace-visconti', 'unbreakable'), 3);
  assert.equal(inventoryTier(save, 'meg-thomas', 'unbreakable'), 0);
  assert.equal(globalTier(save, perkById.unbreakable), 0);
  assert.ok(historicalOwnershipControl(save, 'ace-visconti', perkById['borrowed-time']).includes('value="0" selected'));
  save.characters['bill-overbeck'].prestige = 1;
  assert.equal(inventoryTier(save, 'ace-visconti', 'borrowed-time'), 1);
  assert.equal(save.characters['ace-visconti'].perks['borrowed-time'], 0);
  assert.throws(() => setHistoricalPerkTier(save, 'ace-visconti', 'unbreakable', 1), /downgraded/);
  completeCharacterSetup(save, 'ace-visconti', 25, { unbreakable: 1 });
  assert.equal(save.characters['ace-visconti'].perks.unbreakable, 3);
  assert.throws(() => setHistoricalPerkTier(save, 'the-trapper', 'unbreakable', 1), /same-role/);
  assert.throws(() => setHistoricalPerkTier(save, 'ace-visconti', 'unbreakable', 4), /Tier/);
});

test('another catalog perk can opt into historical controls without perk-specific logic', () => {
  const perk = perkById['iron-will'], save = freshSave();
  try {
    perk.historicalAvailability = { type: 'historical', label: 'Legacy General Perk', manualOwnership: true, note: 'Historical example' };
    assert.ok(characterSetupView(save, draft('ace-visconti')).includes('data-historical-ownership="iron-will"'));
    setHistoricalPerkTier(save, 'ace-visconti', perk.id, 2);
    assert.equal(globalTier(save, perk), 0);
    assert.equal(inventoryTier(save, 'meg-thomas', perk.id), 0);
    assert.equal(bloodwebEligible(save, 'ace-visconti', perk), false);
  } finally {
    delete perk.historicalAvailability;
  }
});

test('Shrine, Legacy account and unspecified account unlocks restore historical Bloodweb upgrades', () => {
  for (const field of ['shrineTier', 'legacyTier', 'manualTier']) {
    const save = freshSave(), perk = perkById.unbreakable;
    setHistoricalPerkTier(save, 'ace-visconti', perk.id, 2);
    save.perkOverrides[perk.id] = { shrineTier: 0, [field]: 1 };
    assert.equal(globalTier(save, perk), 1);
    assert.equal(bloodwebNextTier(save, 'ace-visconti', perk), 3);
    assert.equal(inventoryTier(save, 'kate-denson', perk.id), 1);
  }
});

test('JSON, storage reload and aliases preserve confirmed zeroes, missing records and existing personal tiers', () => {
  const save = freshSave();
  save.characters['ace-visconti'].perks.unbreakable = 2;
  setHistoricalPerkTier(save, 'meg-thomas', 'unbreakable', 0);
  save.characters['ace-visconti'].perks['will-to-live'] = 2;
  save.characters['ace-visconti'].perks['decisive-strike'] = 1;
  syncGlobalInventories(save);
  assert.equal(save.characters['ace-visconti'].perks['decisive-strike'], 2);
  assert.equal(Object.hasOwn(save.characters['ace-visconti'].perks, 'will-to-live'), false);
  assert.deepEqual(parseSave(exportSave(save)).save, save);
  const memory = new Map();
  const storage = new TrackerStorage({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, () => {});
  storage.save(save);
  assert.deepEqual(storage.load().save, save);
  storage.replace(save, parseSave(exportSave(save)).save, 'Test import');
  const loaded = storage.load().save;
  assert.equal(loaded.characters['ace-visconti'].perks.unbreakable, 2);
  assert.equal(loaded.characters['meg-thomas'].perks.unbreakable, 0);
  assert.equal(Object.hasOwn(loaded.characters['kate-denson'].perks, 'unbreakable'), false);
  assert.ok(historicalOwnershipControl(loaded, 'ace-visconti', perkById.unbreakable).includes('value="2" selected'));
  assert.equal(loaded.schemaVersion, 3);
  assert.deepEqual(loaded.planning.prestigeQueues, { survivor: [], killer: [] });
  assert.deepEqual(loaded.characters['ace-visconti'].inventory, { items: {}, addons: {} });
});
