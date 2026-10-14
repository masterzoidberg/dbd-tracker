import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildProject } from '../scripts/build.mjs';
import { generateAssetManifest } from '../scripts/generate-assets.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dbd-asset-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['src', 'data', 'images/survivor-perks/fixture']) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, 'src/app.js'), "import manifest from '../data/asset-manifest.json' with {type:'json'}; console.log(manifest.perks.adrenaline.path);");
  await writeFile(join(root, 'images/survivor-perks/fixture/adrenaline.png'), await readFile(resolve(import.meta.dirname, '../images/survivor-perks/meg-thomas/adrenaline.png')));
  return root;
}
test('standalone build regenerates missing and stale manifests before bundling current paths', async t => {
  const root = await fixture(t), expected = await generateAssetManifest(root);
  for (const stale of [false, true]) {
    if (stale) await writeFile(join(root, 'data/asset-manifest.json'), '{stale garbage');
    await buildProject(root);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'data/asset-manifest.json'))), expected);
    assert.ok((await readFile(join(root, 'dist/app.js'), 'utf8')).includes(expected.perks.adrenaline.path));
  }
});
test('generator failure prevents standalone bundling rather than using previous generated input', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'data/asset-manifest.json'), '{stale garbage');
  await writeFile(join(root, 'images/survivor-perks/fixture/adrenaline.png'), 'unsupported header');
  let bundled = false;
  await assert.rejects(buildProject(root, { bundle: async () => { bundled = true; } }), /PNG|header/);
  assert.equal(bundled, false);
});
