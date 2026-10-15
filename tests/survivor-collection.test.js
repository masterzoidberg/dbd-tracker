import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/model.js';
import { inventoryEntities } from '../data/inventory-catalog.js';
import { survivorInventoryCounts } from '../src/survivor-collection.js';

const items = inventoryEntities.filter(entity => entity.kind === 'survivor-item');
const addons = inventoryEntities.filter(entity => entity.kind === 'survivor-addon');

test('counts distinct positive verified Item and Add-on types, regardless of quantity', () => {
  const save = freshSave();
  const inventory = save.characters['meg-thomas'].inventory;
  inventory.items[items[0].id] = 20;
  inventory.items[items[1].id] = 1;
  inventory.addons[addons[0].id] = 18;
  inventory.addons[addons[1].id] = 4;

  assert.deepEqual(survivorInventoryCounts(save, 'meg-thomas'), { items: 2, addons: 2 });
});

test('does not count zero quantities or entities recorded in the wrong map', () => {
  const save = freshSave();
  const inventory = save.characters['meg-thomas'].inventory;
  inventory.items[items[0].id] = 0;
  inventory.addons[addons[0].id] = 0;
  inventory.items[addons[1].id] = 3;
  inventory.addons[items[1].id] = 5;

  assert.deepEqual(survivorInventoryCounts(save, 'meg-thomas'), { items: 0, addons: 0 });
});

test('does not count unresolved imported inventory IDs as verified types', () => {
  const save = freshSave();
  const inventory = save.characters['meg-thomas'].inventory;
  inventory.items['survivor-item-future-family-future-item'] = 7;
  inventory.addons['survivor-addon-future-family-future-addon'] = 12;

  assert.deepEqual(survivorInventoryCounts(save, 'meg-thomas'), { items: 0, addons: 0 });
});

test('returns zero counts for empty sparse inventory maps', () => {
  const save = freshSave();

  assert.deepEqual(survivorInventoryCounts(save, 'meg-thomas'), { items: 0, addons: 0 });
});

test('calculating the summary does not mutate inventory quantities', () => {
  const save = freshSave();
  const inventory = save.characters['meg-thomas'].inventory;
  inventory.items[items[0].id] = 4;
  inventory.addons[addons[0].id] = 9;
  const before = structuredClone(inventory);

  survivorInventoryCounts(save, 'meg-thomas');

  assert.deepEqual(inventory, before);
});
