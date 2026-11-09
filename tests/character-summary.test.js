import test from 'node:test';
import assert from 'node:assert/strict';
import { perkById } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';
import { characterExportSnapshot, formatCharacterExport } from '../src/character-export.js';
import { dredgeExportFixture, characterExportTime } from './fixtures/character-export.js';

test('summary consolidates personal tiers and inventory with descriptions and a focused header', () => {
  const save = dredgeExportFixture();
  save.characters['the-dredge'].perks['hex-plaything'] = 2;
  save.perkOverrides['hex-plaything'] = { shrineTier: 3 };
  const before = JSON.stringify(save);
  const data = characterExportSnapshot(save, 'the-dredge', characterExportTime);
  for (const format of ['md', 'txt']) {
    const output = formatCharacterExport(data, format);
    assert.ok(output.startsWith((format === 'md' ? '# ' : '') + 'The Dredge\n\nPrestige: 1\nBloodweb: 33\n'));
    assert.equal(output.split('Hex: Plaything | Tier 2').length - 1, 1);
    assert.match(output, /within 20 metres/);
    assert.match(output, /90 seconds/);
    assert.match(output, /Caffeine Tablets \| Common Add-On\n\nQuantity: 46\n\nHighlights the Auras of locked Lockers/);
    assert.equal(output.split('Caffeine Tablets').length - 1, 1);
    assert.doesNotMatch(output, /24\/20\/16|Owned:|Role:|Favorite:|Setup Complete|Exported|Planning|accountRules|killer-addon|\| ---/);
    assert.match(output, /Monitor & Abuse/);
    assert.doesNotMatch(output, /&amp;|\\&/);
    if (format === 'txt') assert.doesNotMatch(output, /^#+ /m);
  }
  assert.equal(JSON.stringify(save), before);
});

test('all three recorded Plaything tiers resolve range and retain fixed conditions', () => {
  for (const [tier, range] of [[1, 24], [2, 20], [3, 16]]) {
    const save = dredgeExportFixture();
    save.characters['the-dredge'].perks = { 'hex-plaything': tier };
    const output = formatCharacterExport(characterExportSnapshot(save, 'the-dredge'), 'md');
    assert.match(output, new RegExp('within ' + range + ' metres'));
    assert.match(output, /90 seconds/);
    assert.match(output, /If a Dull Totem remains/);
    assert.match(output, /ends when the Hex is cleansed or blessed/);
  }
});

test('unverified number sequences remain intact while verified decimal and multiple tier values resolve', () => {
  const save = dredgeExportFixture();
  save.characters['the-dredge'].perks = { thanatophobia: 2, 'hex-pentimento': 2, bamboozle: 2 };
  // The catalog disagrees with these sequences: do not invent corrections.
  const output = formatCharacterExport(characterExportSnapshot(save, 'the-dredge'), 'md');
  assert.match(output, /4\/6\/8/);
  assert.match(output, /24\/28\/32/);
  assert.doesNotMatch(output, /5\/10\/15|8\/12\/16/);
  assert.match(output, /10%/);
  assert.match(output, /12 seconds/);
  const original = perkById.bamboozle.description;
  try {
    perkById.bamboozle.description += ' Separate conditions: 1/2/4 and 5/10/15/20. Fixed: 90 seconds. Auras &amp; effects.';
    const fixed = formatCharacterExport(characterExportSnapshot(save, 'the-dredge'), 'md');
    assert.match(fixed, /1\/2\/4/);
    assert.match(fixed, /5\/10\/15\/20/);
    assert.match(fixed, /Fixed: 90 seconds/);
    assert.match(fixed, /Auras & effects/);
    assert.doesNotMatch(fixed, /&amp;/);
  } finally { perkById.bamboozle.description = original; }
});

test('survivor sections use catalog rarity/effects, omit empty notes and exclude zero records', () => {
  const save = dredgeExportFixture(), progress = save.characters['meg-thomas'];
  progress.notes = '  ';
  progress.inventory.items['survivor-item-med-kit-camping-aid-kit'] = 3;
  const addon = Object.values(inventoryEntityById).find(row => row.role === 'survivor' && row.map === 'addons');
  progress.inventory.addons[addon.id] = 4;
  const output = formatCharacterExport(characterExportSnapshot(save, 'meg-thomas'), 'md');
  assert.match(output, /## Items\n/);
  assert.match(output, /## Add-ons\n/);
  assert.match(output, /Quantity: 3/);
  assert.match(output, /Quantity: 4/);
  assert.doesNotMatch(output, /## Notes|## Perks|Planning/);
  assert.ok(output.includes(addon.effect));
});

test('decimal tier values resolve without altering fixed decimals or longer sequences', () => {
  const save = dredgeExportFixture();
  save.characters['meg-thomas'].perks = { 'come-and-get-me': 2, 'dead-hard': 2 };
  const output = formatCharacterExport(characterExportSnapshot(save, 'meg-thomas'), 'md');
  assert.match(output, /for 12\.5 seconds/);
  assert.match(output, /for 0\.5 seconds/);
  assert.match(output, /for 50 seconds/);
  assert.doesNotMatch(output, /10\/12\.5\/15|60\/50\/40/);
});
