import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/model.js';
import {
  CONTINUE_KEY,
  clearContinue,
  continueIsValidForSave,
  invalidateContinueForSave,
  normalizeContinueRoute,
  readContinue,
  writeContinue,
} from '../src/workspace-resume.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('Continue normalizes temporary routes to stable role-correct workspace destinations', () => {
  const now = '2026-10-27T12:00:00.000Z';
  for (const [route, characterId, role, section] of [
    ['#character/meg-thomas/overview', 'meg-thomas', 'survivor', 'overview'],
    ['#character/meg-thomas/edit', 'meg-thomas', 'survivor', 'overview'],
    ['#character/meg-thomas/setup', 'meg-thomas', 'survivor', 'overview'],
    ['#manage/meg-thomas/update', 'meg-thomas', 'survivor', 'perks'],
    ['#character/meg-thomas/perks/legacy', 'meg-thomas', 'survivor', 'perks'],
    ['#character/meg-thomas/items-addons', 'meg-thomas', 'survivor', 'items-addons'],
    ['#character/the-doctor/power-addons', 'the-doctor', 'killer', 'power-addons'],
    ['#character/the-doctor/setup', 'the-doctor', 'killer', 'overview'],
  ]) {
    assert.deepEqual(normalizeContinueRoute(route, now), {
      version: 1, characterId, role, section, visitedAt: now,
    }, route);
  }
});

test('Continue ignores routes outside the stable workspace allowlist and invalid routes', () => {
  for (const route of [
    '#dashboard', '#survivors', '#survivor-perks', '#data', '#character/meg-thomas/unknown',
    '#character/unknown/overview', '#character/the-doctor/items-addons', '#character/meg-thomas/power-addons',
  ]) assert.equal(normalizeContinueRoute(route), null, route);
});

test('Continue validates local records and resolves their canonical route from catalog identity', () => {
  const storage = memoryStorage();
  const save = freshSave();
  const record = writeContinue(storage, '#character/meg-thomas/perks/update', { now: '2026-10-27T12:00:00Z' });
  assert.equal(record.section, 'perks');
  assert.equal(readContinue(storage, save).route, '#character/meg-thomas/perks');
  assert.equal(JSON.parse(storage.getItem(CONTINUE_KEY)).role, 'survivor');

  for (const value of [
    '{', JSON.stringify({ ...record, characterId: 'unknown-character' }),
    JSON.stringify({ ...record, role: 'killer' }), JSON.stringify({ ...record, section: 'power-addons' }),
    JSON.stringify({ ...record, visitedAt: 'not-a-date' }), JSON.stringify({ ...record, telemetry: ['filter'] }),
  ]) {
    storage.setItem(CONTINUE_KEY, value);
    assert.equal(readContinue(storage, save), null);
  }
});

test('Continue clears explicitly and invalidates a record whose character context disappeared', () => {
  const storage = memoryStorage();
  const record = writeContinue(storage, '#character/meg-thomas/overview', { now: '2026-10-27T12:00:00Z' });
  const save = freshSave();
  assert.equal(continueIsValidForSave(record, save), true);
  delete save.characters['meg-thomas'];
  assert.equal(continueIsValidForSave(record, save), false);
  assert.equal(invalidateContinueForSave(storage, save), true, 'external replacement clears an invalidated character context');
  assert.equal(storage.getItem(CONTINUE_KEY), null);
  writeContinue(storage, '#character/meg-thomas/overview', { now: '2026-10-27T12:00:00Z' });
  assert.equal(clearContinue(storage), true);
  assert.equal(storage.getItem(CONTINUE_KEY), null);
});

test('Continue preference storage failures do not throw into navigation or replacement flows', () => {
  const failing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(writeContinue(failing, '#character/meg-thomas/overview'), null);
  assert.equal(readContinue(failing, freshSave()), null);
  assert.equal(clearContinue(failing), false);
});
