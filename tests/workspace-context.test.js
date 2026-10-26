import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryEntities } from '../data/inventory-catalog.js';
import { createWorkspaceContextMemory } from '../src/workspace-context.js';

test('workspace context retains only safe role-local browse state', () => {
  const memory = createWorkspaceContextMemory();
  const item = inventoryEntities.find(entity => entity.map === 'items');
  memory.update('survivor', {
    section: 'items-addons',
    perks: { search: 'adrenaline', category: 'personal', onlyUnrecorded: true, allRole: true, sort: 'tier', density: 'large' },
    survivorInventory: { familyId: item.familyId, selectedItemId: item.id, search: 'flashlight', map: 'addons', rarity: 'Rare', inStock: true },
    selectedPerkId: 'borrowed-time', correctionDraft: { tier: 1 }, pendingQuantity: { [item.id]: '3' }, errors: ['stale'], changedCount: 4,
  });

  const survivor = memory.read('survivor');
  assert.equal(survivor.section, 'items-addons');
  assert.equal(survivor.perks.search, 'adrenaline');
  assert.equal(survivor.perks.sort, 'tier');
  assert.equal(survivor.perks.density, 'large');
  assert.equal(survivor.survivorInventory.selectedItemId, item.id);
  assert.equal(survivor.survivorInventory.inStock, true);
  for (const transient of ['selectedPerkId', 'correctionDraft', 'pendingQuantity', 'errors', 'changedCount']) {
    assert.equal(Object.hasOwn(survivor, transient), false, transient + ' must not enter transferable context');
  }
  assert.equal(memory.read('killer').section, 'overview');
  assert.equal(memory.read('killer').perks.search, '');

  survivor.perks.search = 'mutated outside memory';
  assert.equal(memory.read('survivor').perks.search, 'adrenaline', 'reads return an isolated snapshot');
});

test('workspace sections and perk modes stay role-correct and ordinary tabs clear Update mode', () => {
  const memory = createWorkspaceContextMemory();
  memory.update('killer', { section: 'power-addons', mode: 'update' });
  assert.equal(memory.read('killer').section, 'power-addons');
  assert.equal(memory.read('killer').mode, null, 'non-Perks sections cannot retain an editing mode');

  memory.update('killer', { section: 'perks', mode: 'update' });
  assert.deepEqual([memory.read('killer').section, memory.read('killer').mode], ['perks', 'update']);
  memory.update('killer', { section: 'overview' });
  assert.deepEqual([memory.read('killer').section, memory.read('killer').mode], ['overview', null]);

  memory.update('survivor', { section: 'power-addons', mode: 'update' });
  assert.equal(memory.read('survivor').section, 'overview', 'Killer-only sections are rejected for Survivors');
  assert.equal(memory.read('survivor').mode, null);
});

test('invalid Survivor family or cross-family selected Item falls back safely', () => {
  const memory = createWorkspaceContextMemory();
  const items = inventoryEntities.filter(entity => entity.map === 'items');
  const [first, otherFamilyItem] = [items[0], items.find(item => item.familyId !== items[0].familyId)];

  memory.update('survivor', { survivorInventory: { familyId: first.familyId, selectedItemId: otherFamilyItem.id } });
  assert.equal(memory.read('survivor').survivorInventory.familyId, first.familyId);
  assert.equal(memory.read('survivor').survivorInventory.selectedItemId, '', 'selected Item is cleared when it does not belong to the selected family');

  memory.update('survivor', { survivorInventory: { familyId: '__unknown__', selectedItemId: otherFamilyItem.id } });
  assert.equal(memory.read('survivor').survivorInventory.familyId, first.familyId, 'unknown family falls back to the first catalog family');
  assert.equal(memory.read('survivor').survivorInventory.selectedItemId, '', 'invalid Item is not carried into the fallback family');

  memory.update('survivor', { survivorInventory: { familyId: first.familyId, selectedItemId: first.id } });
  memory.update('survivor', { survivorInventory: { familyId: otherFamilyItem.familyId } });
  assert.equal(memory.read('survivor').survivorInventory.selectedItemId, '', 'changing family without an explicit compatible selection clears the previous Item');
});
