import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { buildProject } from '../scripts/build.mjs';
import { generatePerkManifest } from '../scripts/generate-assets.mjs';
import { writeKillerRuntimeCatalog } from '../scripts/generate-killer-runtime-catalog.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dbd-asset-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['src', 'data', 'images/survivor-perks/fixture']) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, 'src/app.js'), "import manifest from '../data/asset-manifest.json' with {type:'json'}; console.log(manifest.perks.adrenaline.path);");
  await writeFile(join(root, 'images/survivor-perks/fixture/adrenaline.png'), await readFile(resolve(import.meta.dirname, '../images/survivor-perks/meg-thomas/adrenaline.png')));
  return root;
}
test('standalone build regenerates missing and stale manifests before bundling current paths', async t => {
  const root = await fixture(t), expected = await generatePerkManifest(root);
  for (const stale of [false, true]) {
    if (stale) await writeFile(join(root, 'data/asset-manifest.json'), '{stale garbage');
    await buildProject(root, { writeCatalog: async () => {}, writeManifest: async projectRoot => {
      await writeFile(join(projectRoot, 'data/asset-manifest.json'), JSON.stringify(expected));
      return expected;
    } });
    assert.deepEqual(JSON.parse(await readFile(join(root, 'data/asset-manifest.json'))), expected);
    assert.ok((await readFile(join(root, 'dist/app.js'), 'utf8')).includes(expected.perks.adrenaline.path));
  }
});
test('generator failure prevents standalone bundling rather than using previous generated input', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'data/asset-manifest.json'), '{stale garbage');
  await writeFile(join(root, 'images/survivor-perks/fixture/adrenaline.png'), 'unsupported header');
  let bundled = false;
  await assert.rejects(buildProject(root, { writeCatalog: async () => {}, bundle: async () => { bundled = true; } }), /PNG|header/);
  assert.equal(bundled, false);
});

test('build writes the Killer catalog before asset manifest generation and bundling', async t => {
  const root = await fixture(t), calls = [];
  await buildProject(root, {
    writeCatalog: async projectRoot => {
      calls.push('catalog');
      await writeFile(join(projectRoot, 'data/killer-runtime-catalog.json'), '{"generated":true}');
    },
    writeManifest: async projectRoot => {
      calls.push('manifest');
      assert.deepEqual(JSON.parse(await readFile(join(projectRoot, 'data/killer-runtime-catalog.json'), 'utf8')), { generated: true });
      return { generated: true };
    },
    bundle: async ({ absWorkingDir }) => {
      calls.push('bundle');
      assert.deepEqual(JSON.parse(await readFile(join(absWorkingDir, 'data/killer-runtime-catalog.json'), 'utf8')), { generated: true });
    },
  });
  assert.deepEqual(calls, ['catalog', 'manifest', 'bundle']);
});

test('Killer catalog writer failure prevents asset manifest generation and bundling', async t => {
  const root = await fixture(t), calls = [];
  await assert.rejects(buildProject(root, {
    writeCatalog: async () => { calls.push('catalog'); throw new Error('catalog failed'); },
    writeManifest: async () => { calls.push('manifest'); },
    bundle: async () => { calls.push('bundle'); },
  }), /catalog failed/);
  assert.deepEqual(calls, ['catalog']);
});

test('app bundle imports the compact Killer runtime catalog and excludes the research master', async () => {
  const root = resolve(import.meta.dirname, '..');
  let metafile;
  await buildProject(root, {
    writeCatalog: writeKillerRuntimeCatalog,
    writeManifest: async () => ({}),
    bundle: async options => {
      ({ metafile } = await build({ ...options, metafile: true, write: false }));
    },
  });
  const inputs = Object.keys(metafile.inputs).map(path => path.replaceAll('\\', '/'));
  assert.ok(inputs.some(path => path.endsWith('data/killer-runtime-catalog.json')));
  assert.ok(!inputs.some(path => path.endsWith('data/dbd-killers-live-10.2.1.json')));
});
