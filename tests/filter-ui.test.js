import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual detail renderer with a hostile catalog note and no inventories.
const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
function renderNote(note) {
  const perk = { id: 'fixture', role: 'survivor', sourceCharacterName: 'Fixture', historicalAvailability: { note } };
  const context = vm.createContext({ perkById: { fixture: perk }, save: { characters: {}, perkOverrides: {} },
    perkStats: () => ({ owned: 0, total: 0, tier3: 0, missing: 0 }), roleCharacters: () => [],
    perkName: () => 'Fixture', dialogHeader: () => '', historicalPerkNote: () => '<small>Legacy General Perk</small>',
    perkArtwork: () => '', globalBadge: () => '', unlockSource: () => '', globalTier: () => 0, roman: ['—', 'I', 'II', 'III'] });
  vm.runInContext(source.slice(source.indexOf('const esc ='), source.indexOf('\nconst roman =')), context);
  vm.runInContext(source.slice(source.indexOf('function perkDetail('), source.indexOf('\nfunction openDetail(')), context);
  return vm.runInContext("perkDetail('fixture')", context);
}
function renderDetail({ override = {}, prestige = 0, legacy = 0 } = {}) {
  const perk = { id: 'fixture', role: 'survivor', sourceCharacterId: 'source', sourceCharacterName: 'Fixture', historicalAvailability: {} };
  const context = vm.createContext({ perkById: { fixture: perk }, save: { characters: { source: { prestige } }, perkOverrides: { fixture: { ...override, legacyTier: legacy } } },
    perkStats: () => ({ owned: 0, total: 0, tier3: 0, missing: 0 }), roleCharacters: () => [],
    perkName: () => 'Fixture', dialogHeader: () => '', historicalPerkNote: () => '',
    perkArtwork: () => '', globalBadge: () => '', unlockSource: () => 'Other account unlock', globalTier: () => Math.max(prestige, legacy, override.shrineTier || 0, override.manualTier || 0), roman: ['—', 'I', 'II', 'III'] });
  vm.runInContext(source.slice(source.indexOf('const esc ='), source.indexOf('\nconst roman =')), context);
  vm.runInContext(source.slice(source.indexOf('function perkDetail('), source.indexOf('\nfunction openDetail(')), context);
  return vm.runInContext("perkDetail('fixture')", context);
}
test('perk detail shows the full escaped historical note after the short badge', () => {
  const html = renderNote('<img src=x onerror="boom()"> & historical');
  assert.ok(html.includes('<small>Legacy General Perk</small><p class="historical-detail-note">&lt;img src=x onerror=&quot;boom()&quot;&gt; &amp; historical</p>'));
  assert.ok(!html.includes('<img'));
});
test('perk detail omits the historical paragraph when no note exists', () => {
  assert.ok(!renderNote(undefined).includes('historical-detail-note'));
});

test('perk detail exposes Shrine and Other account unlock controls without exposing internal field names', () => {
  const html = renderDetail({ override: { shrineTier: 2, manualTier: 1 } });
  assert.match(html, /ACCOUNT UNLOCK/);
  assert.match(html, /Shrine/);
  assert.match(html, /Other account unlock/);
  assert.match(html, /Not unlocked/);
  assert.match(html, /Not recorded/);
  assert.doesNotMatch(html, /manualTier|Manual|Unspecified/);
  assert.doesNotMatch(html, /data-field="legacyTier"/);
  assert.match(html, /data-field="shrine"/);
  assert.match(html, /data-field="other"/);
});

test('perk detail keeps Prestige and Legacy visible as read-only account unlock provenance', () => {
  const html = renderDetail({ prestige: 2, legacy: 1 });
  assert.match(html, /Prestige/);
  assert.match(html, /Tier II via Fixture/);
  assert.match(html, /Legacy account unlock/);
  assert.match(html, /Tier I/);
  assert.doesNotMatch(html, /data-field="legacyTier"/);
});
