import test from 'node:test';
import assert from 'node:assert/strict';
import { characterWorkspaceHref, parseCharacterWorkspaceRoute } from '../src/character-workspace.js';
import { createCharacterInventorySession, syncCharacterInventorySession } from '../src/character-inventory.js';

test('canonical routes and bare alias use one explicit descriptor', () => {
  for (const [id, sections] of [
    ['meg-thomas', ['overview', 'perks', 'items-addons', 'edit', 'setup']],
    ['the-doctor', ['overview', 'perks', 'power-addons', 'edit', 'setup']],
  ]) for (const section of sections) {
    const href = '#character/' + id + '/' + section;
    assert.equal(characterWorkspaceHref(id, section), href);
    assert.equal(parseCharacterWorkspaceRoute(href).canonicalRoute, href);
    assert.equal(parseCharacterWorkspaceRoute(href.slice(1)).status, 'valid');
  }
  assert.equal(parseCharacterWorkspaceRoute('#character/meg-thomas').canonicalRoute, '#character/meg-thomas/overview');
  for (const mode of ['update', 'legacy']) {
    assert.equal(characterWorkspaceHref('meg-thomas', 'perks', mode), '#character/meg-thomas/perks/' + mode);
  }
});

test('five old aliases keep Perks meaning without inventing legacy experiment', () => {
  for (const [old, target] of [
    ['manage/meg-thomas', 'perks'], ['manage/meg-thomas/update', 'perks/update'],
    ['manage/meg-thomas/legacy', 'perks/legacy'], ['experiment/meg-thomas', 'perks'],
    ['experiment/meg-thomas/update', 'perks/update'],
  ]) assert.equal(parseCharacterWorkspaceRoute('#' + old).canonicalRoute, '#character/meg-thomas/' + target);
  assert.equal(parseCharacterWorkspaceRoute('#experiment/meg-thomas/legacy').status, 'unavailable');
});

test('recognized invalid hashes remain unavailable instead of top-level fallback', () => {
  for (const route of [
    '#character', '#character/unknown/overview', '#character/constructor/perks',
    '#character/meg-thomas/perks/update/extra', '#character/meg-thomas/',
    '#character/the-doctor/items-addons', '#character/meg-thomas/power-addons',
    '#manage/unknown', '#manage/meg-thomas/extra', '#experiment/meg-thomas/update/extra',
  ]) assert.equal(parseCharacterWorkspaceRoute(route).status, 'unavailable', route);
  for (const route of ['', '#dashboard', '#survivors', null]) assert.equal(parseCharacterWorkspaceRoute(route), null);
  assert.throws(() => characterWorkspaceHref('unknown'));
  assert.throws(() => characterWorkspaceHref('meg-thomas', 'power-addons'));
  assert.throws(() => characterWorkspaceHref('meg-thomas', 'edit', 'legacy'));
});

test('equivalent update aliases retain canonical session identity and draft selection', () => {
  const session = createCharacterInventorySession('#manage/meg-thomas/update');
  session.search = 'kindred';
  session.selectedPerkId = 'kindred';
  for (const href of ['#experiment/meg-thomas/update', '#character/meg-thomas/perks/update']) {
    assert.equal(syncCharacterInventorySession(session, href), session);
  }
  assert.notEqual(syncCharacterInventorySession(session, '#character/the-doctor/perks/update'), session);
});
