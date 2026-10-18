import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as assets from '../scripts/generate-assets.mjs';
import * as resolver from '../src/assets.js';
import { characters } from '../data/catalog.js';
import { buildProject } from '../scripts/build.mjs';
import { stageRuntime, verifyStage } from '../scripts/release.mjs';
import vm from 'node:vm';

const project = resolve(import.meta.dirname, '..');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9XkAAAAASUVORK5CYII=', 'base64');
const webp = await readFile(join(project, 'images/killer-images/the_ghost_face.png'));
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dbd-portraits-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function put(root, path, bytes = png) {
  await mkdir(resolve(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), bytes);
}
test('current portraits cover all 98 canonical characters, preserving source hashes and actual formats', async () => {
  const { portraits } = await assets.generatePortraitManifest(project);
  assert.deepEqual(Object.keys(portraits), characters.map(c => c.id).sort());
  assert.equal(Object.values(portraits).filter(Boolean).length, 98);
  assert.equal(Object.values(portraits).filter(p => p.format === 'webp').length, 12);
  assert.equal(portraits['zarina-kassir'].width, 512); assert.equal(portraits['zarina-kassir'].height, 512);
  for (const id of ['aestri-yazar', 'bill-overbeck', 'yun-jin-lee', 'the-onryo']) assert.ok(portraits[id]);
  for (const portrait of Object.values(portraits)) {
    assert.equal(createHash('sha256').update(await readFile(join(project, portrait.sourcePath))).digest('hex'), portrait.sha256);
    assert.ok(portrait.path.endsWith('.' + portrait.format));
  }
  assert.deepEqual(await assets.generatePortraitManifest(project), { portraits });
  assert.equal(resolver.characterPortraitPath('__proto__', { portraits }), null);
  assert.equal(resolver.characterPortraitPath('unknown-safe-id', { portraits }), null);
  assert.equal(resolver.characterPortraitPath('bill-overbeck', { portraits }), portraits['bill-overbeck'].path);
});
test('portrait missing entries are null and mislabeled WebP copies regenerate from source before every build', async t => {
  const root = await fixture(t);
  await put(root, 'images/killer-images/the_ghost_face.png', webp);
  await put(root, 'images/survivor-images/meg_thomas.png');
  await put(root, 'src/app.js', "import manifest from '../data/asset-manifest.json'; console.log(manifest.portraits['the-ghost-face'].path);");
  const expected = await assets.generateAssetManifest(root);
  const path = expected.portraits['the-ghost-face'].path;
  assert.equal(expected.portraits['dwight-fairfield'], null);
  for (const stale of [false, true]) {
    if (stale) { await put(root, path, 'stale derived copy'); await put(root, 'data/asset-manifest.json', '{stale'); }
    assert.deepEqual(await assets.generateAssetManifest(root), expected, 'Tests do not consume derived output');
    await buildProject(root, { writeCatalog: async () => {} });
    assert.deepEqual(await readFile(join(root, path)), webp);
    assert.deepEqual(await readFile(join(root, 'images/killer-images/the_ghost_face.png')), webp);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'data/asset-manifest.json'))), expected);
    assert.ok((await readFile(join(root, 'dist/app.js'), 'utf8')).includes(path));
  }
});
for (const [label, paths] of [
  ['collision', ['images/survivor-images/bill_overbeck.png', 'images/survivor-images/william_bill_overbeck.png']],
  ['wrong role', ['images/killer-images/meg_thomas.png']],
  ['unknown character', ['images/survivor-images/not_a_character.png']],
  ['unsafe filename', ['images/survivor-images/meg thomas.png']],
]) test(`portrait generation rejects ${label}`, async t => {
  const root = await fixture(t);
  for (const path of paths) await put(root, path);
  await assert.rejects(assets.generatePortraitManifest(root), /collision|role|Unknown|Invalid/);
});
test('invalid portrait formats prevent bundling; generated copy symlinks cannot overwrite external files', async t => {
  const root = await fixture(t);
  await put(root, 'images/survivor-images/meg_thomas.png', 'bad header');
  let bundled = false;
  await assert.rejects(buildProject(root, { writeCatalog: async () => {}, bundle: async () => { bundled = true; } }), /portrait|header|PNG|WebP/);
  assert.equal(bundled, false);
  await rm(join(root, 'images/survivor-images/meg_thomas.png'));
  await put(root, 'images/killer-images/the_ghost_face.png', webp);
  await mkdir(join(root, 'outside'));
  await symlink(join(root, 'outside'), join(root, 'images/portrait-runtime'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assets.writeAssetManifest(root), /symbolic|junction/);
});
test('portrait header checks reject truncated, animated and malformed WebP', () => {
  assert.equal(typeof assets.portraitDimensions, 'function');
  for (const bytes of [webp.subarray(0, 25), Buffer.from(webp).fill(0, 0, 4), Buffer.from(webp).fill(0, 12, 16), Buffer.from(webp).fill(2, 20, 21)]) {
    assert.throws(() => assets.portraitDimensions(bytes, 'fixture.png'), /WebP|portrait|header/);
  }
});
test('missing portrait renderer emits a fixed silhouette without an image request', async () => {
  const source = await readFile(join(project, 'src/app.js'), 'utf8');
  const context = vm.createContext({ characterPortraitPath: resolver.characterPortraitPath, assetManifest: { portraits: { 'meg-thomas': null } } });
  vm.runInContext(source.slice(source.indexOf('const esc ='), source.indexOf('\nconst roman =')), context);
  vm.runInContext(source.slice(source.indexOf('function characterArtwork('), source.indexOf('\nfunction tierButton(')), context);
  const html = vm.runInContext("characterArtwork({ id: 'meg-thomas' })", context);
  assert.ok(html.includes('portrait-fallback') && html.includes('<svg'));
  assert.ok(!html.includes('<img') && !html.includes('src=') && !html.includes('has-art'));
});
test('staging contains only manifest portraits, verifies both formats and excludes mislabeled WebP originals', async t => {
  const root = await fixture(t);
  await put(root, 'images/killer-images/the_ghost_face.png', webp);
  await put(root, 'images/survivor-images/meg_thomas.png');
  const manifest = await assets.writeAssetManifest(root);
  await put(root, 'index.html', '<link href="styles.css" rel="stylesheet"><script src="dist/app.js"></script>');
  await put(root, 'styles.css', 'body { color: white }'); await put(root, 'dist/app.js', '// bundle');
  await put(root, 'docs/runtime-README.md', 'Runtime');
  const stage = await stageRuntime(root, { manifest });
  await verifyStage(stage, { manifest });
  const path = manifest.portraits['the-ghost-face'].path;
  assert.deepEqual(await readFile(join(stage, path)), webp);
  await assert.rejects(readFile(join(stage, 'images/killer-images/the_ghost_face.png')), /ENOENT/);
  await writeFile(join(stage, path), png);
  await assert.rejects(verifyStage(stage, { manifest }), /mismatch|format/);
});
