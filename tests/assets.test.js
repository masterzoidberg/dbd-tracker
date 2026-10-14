import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { generatePerkManifest, writePerkManifest } from '../scripts/generate-assets.mjs';
import { perkIconPath } from '../src/assets.js';
import { perks, perkName, perkById } from '../data/catalog.js';
import { freshSave, exportSave } from '../src/model.js';
import vm from 'node:vm';

const project = resolve(import.meta.dirname, '..');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9XkAAAAASUVORK5CYII=', 'base64');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dbd-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function put(root, path, bytes = png) {
  await mkdir(resolve(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), bytes);
}

test('current tree has all 321 usable perk references, with sorted repeatable output', async () => {
  const manifest = await generatePerkManifest(project);
  assert.equal(Object.keys(manifest.perks).length, 321);
  assert.equal(Object.values(manifest.perks).filter(Boolean).length, 321);
  assert.equal(Object.values(manifest.perks).filter(value => value === null).length, 0);
  assert.deepEqual(Object.keys(manifest.perks), perks.map(p => p.id).sort());
  assert.deepEqual(await generatePerkManifest(project), manifest);
  for (const value of Object.values(manifest.perks).filter(Boolean)) {
    if (value.path.includes('/supplied/') && !['images/killer-perks/supplied/deadlock.png', 'images/killer-perks/supplied/scourge-hook-gift-of-pain.png'].includes(value.path)) {
      assert.equal(value.width, 256); assert.equal(value.height, 256);
    } else {
      assert.ok([96, 100].includes(value.width)); assert.equal(value.height, value.width);
    }
    assert.equal(createHash('sha256').update(await readFile(join(project, value.path))).digest('hex'), value.sha256);
  }
});
test('transparent replacements use the supplied PNG bytes and exclude question-mark duplicates', async () => {
  const manifest = await generatePerkManifest(project);
  for (const [id, source] of [
    ['adrenaline', 'images/no-background/survivor-perks/meg-thomas/adrenaline.png'],
    ['deadlock', 'images/no-background/killer-perks/universal/deadlock.png'],
    ['scourge-hook-gift-of-pain', 'images/no-background/killer-perks/universal/scourge-hook-gift-of-pain.png'],
  ]) {
    const bytes = await readFile(join(project, source));
    assert.equal(manifest.perks[id].sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(manifest.perks['hex-plaything'].path, 'images/killer-perks/supplied/hex-plaything.png');
});
test('authentic supplemental artwork supersedes a retained placeholder in either scan order', async t => {
  const root = await fixture(t);
  const placeholder = await readFile(join(project, 'images/killer-perks/cenobite/no-holds-barred.png'));
  for (const [first, second] of [[placeholder, png], [png, placeholder]]) {
    await put(root, 'images/killer-perks/a/no-holds-barred.png', first);
    await put(root, 'images/killer-perks/b/deadlock.png', second);
    const manifest = await generatePerkManifest(root);
    assert.equal(manifest.perks.deadlock.path, first === png ? 'images/killer-perks/a/no-holds-barred.png' : 'images/killer-perks/b/deadlock.png');
  }
  await put(root, 'images/killer-perks/c/deadlock.png');
  await assert.rejects(generatePerkManifest(root), /collision/);
});
test('scanner uses role, canonical aliases and the Detective asset exception; absent icons are null', async t => {
  const root = await fixture(t);
  await put(root, 'images/survivor-perks/fixture/detectives-hunch.png');
  await put(root, 'images/survivor-perks/fixture/will-to-live.png');
  await put(root, 'images/killer-perks/fixture/no-holds-barred.png');
  await put(root, 'images/killer-perks/source.zip', 'ignored archive');
  await put(root, 'images/survivor-images/meg_thomas.png', 'out of scope portrait');
  const { perks: assets } = await generatePerkManifest(root);
  assert.equal(assets['detective-s-hunch'].path, 'images/survivor-perks/fixture/detectives-hunch.png');
  assert.equal(assets['decisive-strike'].path, 'images/survivor-perks/fixture/will-to-live.png');
  assert.equal(assets.deadlock.path, 'images/killer-perks/fixture/no-holds-barred.png');
  assert.equal(assets.adrenaline, null);
});
test('runtime artwork renders a known null as a fixed diamond without an image URL', async () => {
  const source = await readFile(join(project, 'src/app.js'), 'utf8');
  const context = vm.createContext({ perkIconPath, assetManifest: { perks: { adrenaline: null } } });
  vm.runInContext(source.slice(source.indexOf('const esc ='), source.indexOf('\nconst roman =')), context);
  vm.runInContext(source.slice(source.indexOf('function perkArtwork('), source.indexOf('\nfunction tierButton(')), context);
  const html = vm.runInContext("perkArtwork({ id: 'adrenaline' })", context);
  assert.ok(html.includes('perk-diamond'));
  assert.ok(!html.includes('<img') && !html.includes('src=') && !html.includes('has-art'));
});
test('audited placeholder content is null; authentic replacement bytes become eligible for all three IDs', async t => {
  const root = await fixture(t);
  const placeholder = await readFile(join(project, 'images/killer-perks/cenobite/no-holds-barred.png'));
  const names = ['no-holds-barred', 'hex-fortunes-fool', 'scourge-hook-weeping-wounds'];
  for (const name of names) await put(root, `images/killer-perks/cenobite/${name}.png`, placeholder);
  const old = await generatePerkManifest(root);
  for (const id of ['deadlock', 'hex-plaything', 'scourge-hook-gift-of-pain']) assert.equal(old.perks[id], null);
  for (const name of names) await put(root, `images/killer-perks/cenobite/${name}.png`);
  const replaced = await generatePerkManifest(root);
  for (const id of ['deadlock', 'hex-plaything', 'scourge-hook-gift-of-pain']) assert.ok(replaced.perks[id]);
});
for (const [name, files] of [
  ['canonical/alias collision', ['images/survivor-perks/a/decisive-strike.png', 'images/survivor-perks/b/will-to-live.png']],
  ['wrong role', ['images/killer-perks/a/adrenaline.png']],
  ['unknown icon', ['images/survivor-perks/a/not-a-catalog-perk.png']],
  ['unsafe path', ['images/survivor-perks/unsafe folder/adrenaline.png']],
]) test(`generation rejects ${name}`, async t => {
  const root = await fixture(t);
  for (const path of files) await put(root, path);
  await assert.rejects(generatePerkManifest(root), /collision|role|Unknown|Invalid.*path/i);
});
for (const [name, bytes] of [
  ['non-PNG', Buffer.from('RIFFxxxxWEBP')],
  ['truncated PNG', png.subarray(0, 24)],
  ['invalid IHDR', Buffer.from(png).fill(0, 12, 16)],
  ['zero dimensions', Buffer.from(png).fill(0, 16, 20)],
]) test(`generation rejects ${name} headers`, async t => {
  const root = await fixture(t);
  await put(root, 'images/survivor-perks/a/adrenaline.png', bytes);
  await assert.rejects(generatePerkManifest(root), /PNG|header|dimensions/i);
});
test('scanner rejects symlink/junction trees rather than following external assets', async t => {
  const root = await fixture(t);
  await put(root, 'outside/adrenaline.png');
  await mkdir(join(root, 'images'), { recursive: true });
  await symlink(join(root, 'outside'), join(root, 'images/survivor-perks'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(generatePerkManifest(root), /symbolic|junction/i);
});
test('generation ignores absent/stale output, rewrites it, and leaves it untouched on generation failure', async t => {
  const root = await fixture(t);
  await put(root, 'images/survivor-perks/a/adrenaline.png');
  const expected = await generatePerkManifest(root);
  await writePerkManifest(root);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data/asset-manifest.json'), 'utf8')), expected);
  await put(root, 'data/asset-manifest.json', '{stale garbage');
  assert.deepEqual(await generatePerkManifest(root), expected);
  await writePerkManifest(root);
  const canonical = await readFile(join(root, 'data/asset-manifest.json'), 'utf8');
  await put(root, 'images/survivor-perks/a/adrenaline.png', 'bad header');
  await assert.rejects(writePerkManifest(root), /PNG|header/i);
  assert.equal(await readFile(join(root, 'data/asset-manifest.json'), 'utf8'), canonical);
});
test('resolver accepts canonical/alias IDs, rejects unknown IDs and is independent of display settings/save data', async () => {
  const manifest = await generatePerkManifest(project), save = freshSave();
  const before = exportSave(save);
  assert.equal(perkIconPath('will-to-live', manifest), perkIconPath('decisive-strike', manifest));
  assert.equal(perkIconPath('no-holds-barred', manifest), perkIconPath('deadlock', manifest));
  assert.ok(perkIconPath('deadlock', manifest));
  assert.ok(perkIconPath('a-place-for-us', manifest));
  for (const id of ['unknown-safe-id', '__proto__', 'constructor']) assert.equal(perkIconPath(id, manifest), null);
  const path = perkIconPath('decisive-strike', manifest);
  save.settings.halloweenNames = 'generic';
  assert.equal(perkName(save, perkById['decisive-strike']), 'Will to Live');
  assert.equal(perkIconPath('decisive-strike', manifest), path);
  save.characters['laurie-strode'].owned = true;
  assert.equal(perkName(save, perkById['decisive-strike']), 'Decisive Strike');
  assert.equal(perkIconPath('decisive-strike', manifest), path);
  assert.ok(!before.includes('images/') && !exportSave(save).includes('images/'));
});
