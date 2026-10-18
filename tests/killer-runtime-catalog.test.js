import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { characters } from '../data/catalog.js';
import { projectKillerRuntimeCatalog, generateKillerRuntimeCatalog, writeKillerRuntimeCatalog } from '../scripts/generate-killer-runtime-catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const source = JSON.parse(await readFile(resolve(root, 'data/dbd-killers-live-10.2.1.json'), 'utf8'));
const rarityCounts = { Common: 4, Uncommon: 5, Rare: 5, 'Very Rare': 4, 'Ultra Rare': 2 };
const powerFields = ['powerName', 'shortSummary', 'fullExplanation', 'components', 'mechanics', 'resources',
  'survivorInteractions', 'powerStates', 'addonRelevantMechanics', 'complexRules', 'artwork'];

test('canonical projection preserves all explicit identities owners source order and rarity pools', () => {
  const before = structuredClone(source), result = projectKillerRuntimeCatalog(source);
  assert.deepEqual(Object.keys(result), ['dataset', 'gameVersion', 'killers']);
  assert.equal(result.dataset, 'dbd-killers-live');
  assert.equal(result.gameVersion, '10.2.1');
  assert.equal(result.killers.length, 44);
  assert.deepEqual(new Set(result.killers.map(k => k.characterId)), new Set(characters.filter(c => c.role === 'killer').map(c => c.id)));
  const addons = result.killers.flatMap(k => k.addons);
  assert.equal(addons.length, 880);
  assert.equal(new Set(addons.map(a => a.id)).size, 880);
  assert.equal(new Set(source.killers.flatMap(k => k.addons.map(a => a.researchId))).size, 880);
  for (const [index, killer] of result.killers.entries()) {
    assert.deepEqual(Object.keys(killer), ['characterId', 'power', 'addons']);
    assert.equal(killer.characterId, source.killers[index].characterId);
    assert.equal(killer.addons.length, 20);
    assert.deepEqual(Object.fromEntries(Object.keys(rarityCounts).map(r => [r, killer.addons.filter(a => a.rarity === r).length])), rarityCounts);
    for (const [order, addon] of killer.addons.entries()) {
      const original = source.killers[index].addons[order];
      assert.deepEqual(Object.keys(addon), ['id', 'characterId', 'name', 'order', 'rarity', 'effect', 'artwork']);
      assert.deepEqual(addon, { id: original.id, characterId: killer.characterId, name: original.name,
        order, rarity: original.rarity, effect: original.effect,
        artwork: { path: original.artwork.path, confidence: original.artwork.confidence } });
    }
  }
  assert.deepEqual(source, before);
});

test('Power projection retains gameplay details and strips research metadata at every level', () => {
  const result = projectKillerRuntimeCatalog(source);
  for (const [index, killer] of result.killers.entries()) {
    assert.deepEqual(Object.keys(killer.power), powerFields);
    const original = source.killers[index].power;
    for (const field of ['powerName', 'shortSummary', 'fullExplanation', 'addonRelevantMechanics']) {
      assert.deepEqual(killer.power[field], original[field]);
    }
    for (const field of ['components', 'mechanics', 'resources', 'survivorInteractions', 'powerStates', 'complexRules']) {
      const expected = original[field].map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'sourceIds')));
      assert.deepEqual(killer.power[field], expected);
    }
    assert.deepEqual(killer.power.artwork, { path: original.artwork.path, confidence: original.artwork.confidence });
  }
  const text = JSON.stringify(result);
  for (const field of ['sources', 'sourceIds', 'researchId', 'researchStatus', 'verificationNotes', 'provenance', 'recentChanges', 'baselineFacts', 'aliases', 'notes']) {
    assert.equal(text.includes('"' + field + '":'), false, field);
  }
  const rows = result.killers.flatMap(k => [k.power, ...k.addons]);
  assert.deepEqual(rows.reduce((counts, row) => {
    counts[row.artwork.confidence] = (counts[row.artwork.confidence] ?? 0) + 1;
    return counts;
  }, {}), { EXACT: 843, REVIEW: 74, MISSING: 7 });
  assert.equal(result.killers.filter(k => k.power.artwork.path === null).length, 7);
});

test('projection rejects malformed data duplicate identities ownership and rarity/count violations', () => {
  for (const mutate of [
    s => { s.killers = null; }, s => { s.gameVersion = ''; },
    s => { s.killers.pop(); }, s => { s.killers[1].characterId = s.killers[0].characterId; },
    s => { s.killers[0].characterId = 'meg-thomas'; },
    s => { s.killers[0].addons.pop(); },
    s => { s.killers[0].addons[0].id = 'killer-addon-bad\n'; },
    s => { s.killers[0].addons[0].id = s.killers[0].addons[1].id; },
    s => { s.killers[0].addons[0].researchId = s.killers[1].addons[0].researchId; },
    s => { s.killers[0].addons[0].researchId = null; },
    s => { s.killers[0].addons[0].characterId = 'the-doctor'; },
    s => { s.killers[0].addons[0].killerId = 'doctor'; },
    s => { s.killers[0].addons[0].rarity = 'Event'; },
    s => { s.killers[0].addons[0].rarity = 'Rare'; },
    s => { s.killers[0].addons[0].effect = ''; },
    s => { s.killers[0].power.shortSummary = null; },
    s => { s.killers[0].power.mechanics = {}; },
    s => { s.killers[0].power.components = [null]; },
    s => { s.killers[0].power.researchStatus = 'UNVERIFIED'; },
    s => { s.killers[0].addons[0].researchStatus = 'UNVERIFIED'; },
    s => { delete s.killers[0].power.artwork.path; },
    s => { s.killers[0].addons[0].artwork.path = null; },
    s => { s.killers[0].power.artwork.confidence = 'MISSING'; },
  ]) {
    const invalid = structuredClone(source); mutate(invalid);
    assert.throws(() => projectKillerRuntimeCatalog(invalid));
  }
});

test('approved field allowlist excludes unexpected nested research fields and supports absent optional details', () => {
  const input = structuredClone(source);
  input.killers[0].power.mechanics[0].provenance = { secret: 'research-only' };
  delete input.killers[0].power.complexRules;
  const result = projectKillerRuntimeCatalog(input);
  assert.equal(Object.hasOwn(result.killers[0].power.mechanics[0], 'provenance'), false);
  assert.equal(Object.hasOwn(result.killers[0].power, 'complexRules'), false);
});

test('projection rejects Power records assigned to another owner', () => {
  const input = structuredClone(source);
  input.killers[0].power = input.killers[1].power;
  assert.throws(() => projectKillerRuntimeCatalog(input), /Power.*owner/i);
});

test('gameplay detail values cannot carry nested research objects', () => {
  for (const field of ['value', 'unit', 'conditions', 'description']) {
    const input = structuredClone(source);
    input.killers[0].power.mechanics[0][field] = { sources: ['research-only'] };
    assert.throws(() => projectKillerRuntimeCatalog(input), /Power mechanics/);
  }
});

test('generation is deterministic and checked-in projection is byte-for-byte current', async () => {
  const first = await generateKillerRuntimeCatalog(root), second = await generateKillerRuntimeCatalog(root);
  assert.deepEqual(first, second);
  assert.equal(await readFile(resolve(root, 'data/killer-runtime-catalog.json'), 'utf8'), JSON.stringify(first, null, 2) + '\n');
});

test('root-based generation and writing use the supplied master and reject its malformed replacement', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'dbd-killer-catalog-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(resolve(temporary, 'data'));
  const input = structuredClone(source);
  input.killers[0].power.shortSummary = 'Temporary-root summary';
  const master = resolve(temporary, 'data/dbd-killers-live-10.2.1.json');
  await writeFile(master, JSON.stringify(input));
  const result = await writeKillerRuntimeCatalog(temporary);
  assert.equal(result.killers[0].power.shortSummary, 'Temporary-root summary');
  assert.deepEqual(await generateKillerRuntimeCatalog(temporary), result);
  assert.equal(await readFile(resolve(temporary, 'data/killer-runtime-catalog.json'), 'utf8'), JSON.stringify(result, null, 2) + '\n');
  input.killers[0].addons[0].characterId = 'the-doctor';
  await writeFile(master, JSON.stringify(input));
  await assert.rejects(generateKillerRuntimeCatalog(temporary), /owner/i);
});
