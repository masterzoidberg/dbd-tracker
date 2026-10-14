import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshInventory,
  canonicalizeQuantityMaps,
  parseQuantityInput,
  assertQuantityEntity,
} from '../src/inventory-quantities.js';
import {
  inventoryEntities,
  inventoryEntityById,
  inventoryCatalogStatus,
  killerPowerByCharacterId,
} from '../data/inventory-catalog.js';
import { freshSave, validateSave, SCHEMA_VERSION } from '../src/model.js';

// Synthetic definitions are deliberately confined to this test file.
const itemId = 'survivor-item-test-family-test-item';
const addonId = 'survivor-addon-test-family-test-addon';
const killerId = 'killer-addon-the-doctor-test-addon';
const entities = {
  [itemId]: { id: itemId, kind: 'survivor-item', role: 'survivor', map: 'items', characterId: null },
  [addonId]: { id: addonId, kind: 'survivor-addon', role: 'survivor', map: 'addons', characterId: null },
  [killerId]: { id: killerId, kind: 'killer-addon', role: 'killer', map: 'addons', characterId: 'the-doctor' },
};
const unknownItem = 'survivor-item-future-family-future-item';
const unknownAddon = 'killer-addon-future-killer-future-addon';

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') deepFreeze(child);
  }
  return Object.freeze(value);
}

test('fresh inventory has independent empty maps', () => {
  const first = freshInventory(), second = freshInventory();
  assert.deepEqual(first, { items: {}, addons: {} });
  assert.notEqual(first.items, first.addons);
  first.items[itemId] = 1;
  assert.deepEqual(second, { items: {}, addons: {} });
});

test('reviewed Survivor registry activates while Killer remains unavailable and v2 defaults stay empty', () => {
  assert.equal(inventoryEntities.length,92);
  assert.equal(Object.keys(inventoryEntityById).length,92);
  assert.deepEqual(killerPowerByCharacterId, {});
  assert.deepEqual(inventoryCatalogStatus, {
    survivor: 'ready', killerAddons: 'unavailable', killerPowers: 'unavailable',
  });
  assert.equal(SCHEMA_VERSION, 2);
  const save = freshSave();
  assert.equal(save.schemaVersion, 2);
  assert.deepEqual(save.prestigeQueue, []);
  assert.deepEqual(save.characters['meg-thomas'].inventory, { items: {}, addons: {} });
});

test('quantity sparse canonicalization is separate from perk zero', () => {
  const input = deepFreeze({ items: { [itemId]: 0 }, addons: { [addonId]: Number.MAX_SAFE_INTEGER } });
  const result = canonicalizeQuantityMaps(input, 'meg-thomas', entities);
  assert.deepEqual(result, { inventory: { items: {}, addons: { [addonId]: Number.MAX_SAFE_INTEGER } }, warnings: [] });
  assert.deepEqual(input.items, { [itemId]: 0 });
  assert.notEqual(result.inventory, input);
  assert.notEqual(result.inventory.addons, input.addons);
  const save = freshSave();
  save.characters['meg-thomas'].perks.camaraderie = 0;
  assert.equal(validateSave(save).save.characters['meg-thomas'].perks.camaraderie, 0);
});

test('known applicable quantities validate for Survivor and Killer', () => {
  assert.deepEqual(canonicalizeQuantityMaps(
    { items: { [itemId]: 4 }, addons: { [addonId]: 12 } }, 'meg-thomas', entities,
  ), { inventory: { items: { [itemId]: 4 }, addons: { [addonId]: 12 } }, warnings: [] });
  assert.deepEqual(canonicalizeQuantityMaps(
    { items: {}, addons: { [killerId]: 2 } }, 'the-doctor', entities,
  ), { inventory: { items: {}, addons: { [killerId]: 2 } }, warnings: [] });
});

test('unknown slug quantities survive with deterministic entity warnings', () => {
  const input = deepFreeze({ items: { [unknownItem]: 5 }, addons: {} });
  const first = canonicalizeQuantityMaps(input, 'meg-thomas', inventoryEntityById);
  const second = canonicalizeQuantityMaps(input, 'meg-thomas', inventoryEntityById);
  assert.deepEqual(first.inventory, input);
  assert.deepEqual(first, second);
  assert.equal(first.warnings.length, 1);
  assert.ok(first.warnings[0].includes(unknownItem));
  assert.ok(first.warnings[0].includes('meg-thomas'));
  const zero = canonicalizeQuantityMaps({ items: { [unknownItem]: 0 }, addons: {} }, 'meg-thomas', {});
  assert.deepEqual(zero.inventory.items, {});
  assert.equal(zero.warnings.length, 1);
});

test('unknown characters retain valid maps without role or owner inference', () => {
  const input = deepFreeze({ items: { [itemId]: 1 }, addons: { [killerId]: 2, [unknownAddon]: 3 } });
  const result = canonicalizeQuantityMaps(input, 'future-character', entities);
  assert.deepEqual(result.inventory, input);
  assert.equal(result.warnings.length, 1);
});

test('known incompatible quantities reject even at zero without mutating inputs', () => {
  const cases = [
    ['the-doctor', 'items', itemId],
    ['the-doctor', 'items', unknownItem],
    ['the-doctor', 'addons', addonId],
    ['meg-thomas', 'addons', killerId],
    ['meg-thomas', 'addons', unknownAddon],
    ['the-trapper', 'addons', killerId],
    ['future-character', 'items', addonId],
    ['future-character', 'addons', itemId],
  ];
  for (const [character, map, id] of cases) {
    const input = deepFreeze({ items: {}, addons: {}, [map]: { [id]: 0 } });
    assert.throws(() => canonicalizeQuantityMaps(input, character, entities), error =>
      error.message.includes(character) && error.message.includes(map) && error.message.includes(id));
    assert.equal(input[map][id], 0);
  }
});

test('known definitions must match namespace role kind and map', () => {
  for (const change of [{ role: 'killer' }, { kind: 'killer-addon' }, { map: 'addons' }]) {
    const registry = deepFreeze({ ...entities, [itemId]: { ...entities[itemId], ...change } });
    assert.throws(() => canonicalizeQuantityMaps(
      { items: { [itemId]: 1 }, addons: {} }, 'meg-thomas', registry,
    ), new RegExp(itemId));
  }
});

test('unknown quantity resolving to another Killer rejects without pruning', () => {
  const input = deepFreeze({ items: {}, addons: { [unknownAddon]: 7 } });
  assert.deepEqual(canonicalizeQuantityMaps(input, 'the-doctor', {}).inventory, input);
  const registry = { [unknownAddon]: {
    id: unknownAddon, kind: 'killer-addon', role: 'killer', map: 'addons', characterId: 'the-trapper',
  } };
  assert.throws(() => canonicalizeQuantityMaps(input, 'the-doctor', registry), new RegExp(unknownAddon));
  assert.equal(input.addons[unknownAddon], 7);
});

test('invalid inventory and map shapes reject', () => {
  for (const input of [null, [], 'inventory', {}, { items: {} }, { addons: {} },
    { items: null, addons: {} }, { items: [], addons: {} }, { items: {}, addons: 'addons' }]) {
    assert.throws(() => canonicalizeQuantityMaps(input, 'meg-thomas', entities), /meg-thomas/);
  }
});

test('malformed IDs and wrong namespaces reject without broadening safeId', () => {
  for (const id of ['constructor', 'prototype', '__proto__', 'key/broken-key',
    'Survivor-item-test', 'survivor-item-', 'survivor-item--test',
    'survivor-item-test_', 'survivor-item-test\n', 'other-item-test', 'survivor-addon-test']) {
    const input = { items: Object.fromEntries([[id, 1]]), addons: {} };
    assert.throws(() => canonicalizeQuantityMaps(input, 'meg-thomas', {}), /meg-thomas/);
  }
  for (const id of ['survivor-addon-', 'killer-addon-', 'survivor-item-test']) {
    assert.throws(() => canonicalizeQuantityMaps({ items: {}, addons: { [id]: 1 } }, 'future-character', {}));
  }
});

test('malformed quantity values reject without coercion or mutation', () => {
  for (const value of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1,
    '4', '', null, true, false, undefined]) {
    const input = deepFreeze({ items: { [itemId]: value }, addons: {} });
    assert.throws(() => canonicalizeQuantityMaps(input, 'meg-thomas', entities), error =>
      error.message.includes('meg-thomas') && error.message.includes('items') && error.message.includes(itemId));
    assert.ok(Object.is(input.items[itemId], value));
  }
});

test('numeric text rejects blank fractional unsafe and non-decimal forms', () => {
  for (const [text, expected] of [['0', 0], ['12', 12], ['0004', 4], [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER]]) {
    assert.equal(parseQuantityInput(text), expected);
  }
  for (const text of ['', ' ', '\n', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992',
    '1e3', '0x10', '+1', ' 2 ', '2\n', null, true, 4]) {
    assert.throws(() => parseQuantityInput(text), /quantity|whole|integer/i);
  }
});

test('assertQuantityEntity requires resolved applicable entity for editing', () => {
  assert.equal(assertQuantityEntity('meg-thomas', 'items', itemId, entities), undefined);
  assert.equal(assertQuantityEntity('meg-thomas', 'addons', addonId, entities), undefined);
  assert.equal(assertQuantityEntity('the-doctor', 'addons', killerId, entities), undefined);
  for (const [character, map, id, registry] of [
    ['meg-thomas', 'items', unknownItem, entities],
    ['meg-thomas', 'items', itemId, {}],
    ['the-trapper', 'addons', killerId, entities],
    ['meg-thomas', 'addons', killerId, entities],
    ['meg-thomas', 'addons', itemId, entities],
    ['meg-thomas', 'perks', itemId, entities],
    ['future-character', 'items', itemId, entities],
  ]) assert.throws(() => assertQuantityEntity(character, map, id, registry));
});

test('inherited registry definitions do not resolve unknown IDs', () => {
  const inherited = Object.create(entities);
  const result = canonicalizeQuantityMaps({ items: { [itemId]: 1 }, addons: {} }, 'meg-thomas', inherited);
  assert.equal(result.warnings.length, 1);
  assert.throws(() => assertQuantityEntity('meg-thomas', 'items', itemId, inherited));
});
