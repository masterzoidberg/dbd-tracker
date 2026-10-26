import test from 'node:test';
import assert from 'node:assert/strict';

import { characterById, perkById } from '../data/catalog.js';
import { characterNormalInventory } from '../src/character-inventory.js';
import { bloodwebEligible, exportSave, freshSave, isAvailable, parseSave } from '../src/model.js';

test('export includes the same effective perk inventory shown by the character UI without changing raw perks', () => {
  const save = freshSave();
  const characterId = 'the-dark-lord';
  const progress = save.characters[characterId];
  progress.owned = true;
  progress.prestige = 0;
  progress.bloodwebLevel = 16;
  progress.perks = {
    dominance: 2,
    'human-greed': 2,
    bamboozle: 2,
  };

  // Prestige, Shrine, Legacy and manual account-wide sources.
  save.characters[perkById.bamboozle.sourceCharacterId].prestige = 1;
  save.characters[perkById['lethal-pursuer'].sourceCharacterId].prestige = 1;
  save.perkOverrides['grim-embrace'] = { shrineTier: 1 };
  save.perkOverrides['monitor-abuse'] = { shrineTier: 0, legacyTier: 2 };
  save.perkOverrides.overcharge = { shrineTier: 2, legacyTier: 1, manualTier: 3 };

  const rawPerksBefore = structuredClone(progress.perks);
  const uiRows = characterNormalInventory(save, characterId);
  const payload = JSON.parse(exportSave(save));
  const exported = payload.characters[characterId];

  assert.deepEqual(exported.perks, rawPerksBefore, 'raw character Bloodweb records remain unchanged');
  assert.ok(exported.effectivePerks, 'export includes a derived effective inventory');
  assert.equal(Object.keys(exported.effectivePerks).length, uiRows.length,
    'export and UI contain the same number of effective perks');
  for (const row of uiRows) {
    assert.equal(exported.effectivePerks[row.perk.id], row.effectiveTier,
      `${row.perk.id} uses the same effective tier as the UI`);
  }

  for (const perkId of characterById[characterId].nativePerkIds) {
    assert.ok(exported.effectivePerks[perkId] >= 1, `native perk ${perkId} is exported even without a raw record`);
  }
  assert.equal(exported.effectivePerks['hex-wretched-fate'], 1);
  assert.equal(exported.effectivePerks.bamboozle, 2, 'higher personal tier wins over Prestige Tier I');
  assert.equal(exported.effectivePerks['lethal-pursuer'], 1, 'Prestige unlock is included');
  assert.equal(exported.effectivePerks['grim-embrace'], 1, 'Shrine unlock is included');
  assert.equal(exported.effectivePerks['monitor-abuse'], 2, 'Legacy unlock is included');
  assert.equal(exported.effectivePerks.overcharge, 3, 'highest account-wide source tier wins');
  assert.equal(isAvailable(save, perkById.deerstalker), true, 'General access is available at global Tier zero');
  assert.equal(exported.effectivePerks.deerstalker, undefined,
    'General availability alone does not create an automatic Tier');

  const expectedSummary = {
    tracked: uiRows.length,
    maxed: uiRows.filter(row => row.effectiveTier === 3).length,
    upgradeable: uiRows.filter(row => bloodwebEligible(save, characterId, row.perk)).length,
  };
  assert.deepEqual(exported.perkInventorySummary, expectedSummary,
    'export summary matches the effective inventory summary shown by the UI');
  assert.deepEqual(progress.perks, rawPerksBefore, 'export is non-mutating');
});

test('effective export data is derived-only and does not become personal Bloodweb state on import', () => {
  const save = freshSave();
  const characterId = 'the-dark-lord';
  save.characters[characterId].owned = true;
  save.characters[characterId].perks = { dominance: 2 };
  save.characters[perkById['lethal-pursuer'].sourceCharacterId].prestige = 1;
  save.perkOverrides['grim-embrace'] = { shrineTier: 1 };

  const rawPerksBefore = structuredClone(save.characters[characterId].perks);
  const exportedText = exportSave(save);
  const exported = JSON.parse(exportedText);
  assert.ok(exported.characters[characterId].effectivePerks['lethal-pursuer'] > 0);
  assert.ok(exported.characters[characterId].effectivePerks['grim-embrace'] > 0);

  const tampered = structuredClone(exported);
  tampered.characters[characterId].effectivePerks = {
    dominance: 0,
    'lethal-pursuer': 3,
    'grim-embrace': 3,
    'future-perk': 3,
  };
  tampered.characters[characterId].perkInventorySummary = {
    tracked: 999,
    maxed: 999,
    upgradeable: 999,
  };
  const imported = parseSave(JSON.stringify(tampered)).save;
  assert.deepEqual(imported.characters[characterId].perks, rawPerksBefore);
  assert.equal(Object.hasOwn(imported.characters[characterId], 'effectivePerks'), false);
  assert.equal(Object.hasOwn(imported.characters[characterId], 'perkInventorySummary'), false);
  assert.equal(Object.hasOwn(imported.characters[characterId].perks, 'lethal-pursuer'), false);
  assert.equal(Object.hasOwn(imported.characters[characterId].perks, 'grim-embrace'), false);

  const reexported = JSON.parse(exportSave(imported));
  assert.deepEqual(reexported.characters[characterId].effectivePerks, exported.characters[characterId].effectivePerks,
    'round trip recomputes the same effective inventory from canonical account state');
  assert.deepEqual(reexported.characters[characterId].perkInventorySummary, exported.characters[characterId].perkInventorySummary,
    'tampered summaries are recomputed from canonical account state');
});

test('existing schema v2 exports without derived perk fields still import', () => {
  const save = freshSave();
  save.characters['the-dark-lord'].perks = { dominance: 2 };
  const oldStyleExport = JSON.stringify({ ...save, exportedAt: new Date().toISOString() });
  const imported = parseSave(oldStyleExport).save;
  assert.deepEqual(imported.characters['the-dark-lord'].perks, { dominance: 2 });
});
