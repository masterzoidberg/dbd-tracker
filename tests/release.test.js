import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { assertStagePath, stageRuntime, verifyStage, checkCatalogRevision, runRelease } from '../scripts/release.mjs';
import { generatePerkManifest, generateAssetManifest, writePerkManifest } from '../scripts/generate-assets.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dbd-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': '<link href="styles.css" rel="stylesheet"><script defer src="dist/app.js"></script><a href="#dashboard">Home</a>',
    'styles.css': 'body { color: white; }', 'dist/app.js': '/* stale bundle */',
    'docs/runtime-README.md': 'Open index.html directly.',
    'data/dbd-survivor-perks-live-10.1.2a-2026-10-05-corrected.json': JSON.stringify({ verified_live_patch: '10.1.2a', verified_date: '2026-10-05' }),
    'data/killer-perks-audited-10.1.2a-2026-10-05.json': JSON.stringify({ verified_live_patch: '10.1.2a', verified_date: '2026-10-05' }),
    'data/personal-save.json': 'private', 'node_modules/secret.js': 'development',
    'images/nested/source.zip': 'archive', 'src/app.js': 'source', 'tests/test.js': 'tests',
    'plans/rev1.zip': 'plans', 'server.js': 'server', 'package.json': '{}',
    'release/runtime/obsolete.txt': 'obsolete',
  };
  for (const [name, value] of Object.entries(files)) {
    await mkdir(resolve(root, name, '..'), { recursive: true });
    await writeFile(resolve(root, name), value);
  }
  return root;
}

test('catalog release metadata agrees in the actual source catalogs', async () => {
  await checkCatalogRevision(resolve(import.meta.dirname, '..'));
});
for (const field of ['verified_live_patch', 'verified_date']) {
  test(`release rejects mismatched catalog ${field}`, async t => {
    const root = await fixture(t);
    const killer = { verified_live_patch: '10.1.2a', verified_date: '2026-10-05', [field]: 'different' };
    await writeFile(join(root, 'data/killer-perks-audited-10.1.2a-2026-10-05.json'), JSON.stringify(killer));
    await assert.rejects(checkCatalogRevision(root), /Catalog.*mismatch/);
  });
}

test('staging recreates only the runtime allowlist and excludes workspace traps', async t => {
  const root = await fixture(t), stage = await stageRuntime(root);
  assert.deepEqual((await readdir(stage)).sort(), ['README.md', 'dist', 'index.html', 'styles.css']);
  assert.deepEqual(await readdir(join(stage, 'dist')), ['app.js']);
  await verifyStage(stage);
  assert.equal(await readFile(join(stage, 'README.md'), 'utf8'), 'Open index.html directly.');
  await rm(stage, { recursive: true });
  await stageRuntime(root);
  await verifyStage(stage);
});

test('unexpected staging paths and junctions cannot trigger deletion outside staging', async t => {
  const root = await fixture(t);
  for (const path of [root, join(root, 'src'), join(root, 'images'), join(root, 'plans'), join(root, 'elsewhere')]) {
    await assert.rejects(assertStagePath(root, path), /dedicated staging/);
  }
  await rm(join(root, 'release/runtime'), { recursive: true });
  await symlink(join(root, 'src'), join(root, 'release/runtime'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(stageRuntime(root), /symbolic link/);
  assert.equal(await readFile(join(root, 'src/app.js'), 'utf8'), 'source');
});

for (const [name, file, value] of [
  ['missing required file', 'dist/app.js', null],
  ['missing HTML reference', 'index.html', '<script src="missing.js"></script>'],
  ['missing CSS reference', 'styles.css', 'body { background: url("missing.png"); }'],
  ['escaping reference', 'styles.css', 'body { background: url("../private.png"); }'],
  ['runtime fetch', 'dist/app.js', 'fetch("data/catalog.json")'],
  ['extra staged material', 'personal-save.json', 'private'],
]) {
  test(`stage verification rejects ${name}`, async t => {
    const root = await fixture(t), stage = await stageRuntime(root);
    if (value === null) await rm(join(stage, file));
    else await writeFile(join(stage, file), value);
    await assert.rejects(verifyStage(stage));
  });
}

test('release runs tests then fresh build and smokes the exact staged build bytes', async t => {
  const root = await fixture(t), commands = [];
  const result = await runRelease({ root, run: async (command, args) => {
    commands.push(args.join(' '));
    if (args.join(' ') === 'run build') { await writePerkManifest(root); await writeFile(join(root, 'dist/app.js'), '/* fresh current source */'); }
  }, smoke: async stage => {
    assert.equal(stage, join(root, 'release/runtime'));
    assert.equal(await readFile(join(stage, 'dist/app.js'), 'utf8'), '/* fresh current source */');
    return { localhost: 'AUTOMATED PASS', browser: 'fixture browser' };
  } });
  assert.deepEqual(commands, ['test', 'run build']);
  assert.equal(result.localhost, 'AUTOMATED PASS');
  assert.equal(result.directFile, 'MANUAL ACCEPTANCE REQUIRED');
  assert.equal(result.status, 'AWAITING_MANUAL_ACCEPTANCE');
  assert.equal((await readFile(join(root, 'release/verification.json'), 'utf8')).includes(result.bundleSha256), true);
  assert.ok((await readFile(join(root, 'release/artwork-file-check.html'), 'utf8')).includes('img.decode()'));
});

for (const failure of ['test', 'build', 'copy', 'reference', 'browser']) {
  test(`failed ${failure} gate rejects release and removes unverified staging`, async t => {
    const root = await fixture(t);
    const run = async (command, args) => {
      if ((failure === 'test' && args[0] === 'test') || (failure === 'build' && args[1] === 'build')) throw new Error('Injected ' + failure);
      if (args[1] === 'build') { await writePerkManifest(root); await writeFile(join(root, 'dist/app.js'), '/* fresh bundle */'); }
      if (failure === 'reference' && args[1] === 'build') await writeFile(join(root, 'styles.css'), 'body { background: url("missing.png"); }');
    };
    await assert.rejects(runRelease({ root, run,
      ...(failure === 'copy' ? { copy: async () => { throw new Error('Injected copy'); } } : {}),
      smoke: async () => { if (failure === 'browser') throw new Error('Injected browser'); return { localhost: 'AUTOMATED PASS' }; },
    }), failure === 'reference' ? /ENOENT/ : new RegExp('Injected ' + failure));
    await assert.rejects(access(join(root, 'release/runtime')));
    assert.equal(JSON.parse(await readFile(join(root, 'release/verification.json'), 'utf8')).status, 'FAILED');
    await assert.rejects(access(join(root, 'release/artwork-file-check.html')));
  });
}

test('required build outputs cannot be replaced by a successful but empty build', async t => {
  const root = await fixture(t);
  let smoked = false;
  await assert.rejects(runRelease({ root, run: async () => {}, smoke: async () => { smoked = true; } }), /ENOENT/);
  assert.equal(smoked, false);
});

test('a junction at the release parent cannot redirect reporting or staging into source', async t => {
  const root = await fixture(t);
  await rm(join(root, 'release'), { recursive: true });
  await symlink(join(root, 'src'), join(root, 'release'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(runRelease({ root }), /symbolic link/);
  assert.equal(await readFile(join(root, 'src/app.js'), 'utf8'), 'source');
  await assert.rejects(access(join(root, 'src/verification.json')));
});

test('artwork staging copies only non-null references with exact bytes, excluding placeholders/portraits/archives', async t => {
  const root = await fixture(t);
  const icon = await readFile(resolve(import.meta.dirname, '../images/survivor-perks/meg-thomas/adrenaline.png'));
  await mkdir(join(root, 'images/survivor-perks/fixture'), { recursive: true });
  await writeFile(join(root, 'images/survivor-perks/fixture/adrenaline.png'), icon);
  await mkdir(join(root, 'images/killer-perks/fixture'), { recursive: true });
  await writeFile(join(root, 'images/killer-perks/fixture/no-holds-barred.png'), await readFile(resolve(import.meta.dirname, '../images/killer-perks/cenobite/no-holds-barred.png')));
  await mkdir(join(root, 'images/survivor-images'), { recursive: true });
  await writeFile(join(root, 'images/survivor-images/meg.png'), icon);
  await writeFile(join(root, 'images/perk_background2.png'), icon);
  const manifest = await generatePerkManifest(root);
  const stage = await stageRuntime(root, { manifest });
  await verifyStage(stage, { manifest });
  assert.deepEqual(await readFile(join(stage, manifest.perks.adrenaline.path)), icon);
  assert.deepEqual(await readdir(join(stage, 'images')), ['survivor-perks']);
  assert.deepEqual(await readdir(join(stage, 'images/survivor-perks/fixture')), ['adrenaline.png']);
  await writeFile(join(stage, manifest.perks.adrenaline.path), 'bad asset');
  await assert.rejects(verifyStage(stage, { manifest }), /PNG|hash|asset/i);
});
test('Killer release stages only manifest-referenced Add-on and Power artwork and verifies their bytes',async t=>{
 const root=await fixture(t),full=await generateAssetManifest();
 const addon=Object.values(full.inventory).find(asset=>asset?.path.startsWith('images/Powers and Add-ons/'));
 const power=Object.values(full.killerPowers).find(asset=>asset?.path);
 const manifest={perks:{},portraits:{},inventory:{'killer-addon-fixture':addon},killerPowers:{'the-fixture':power}};
 for(const asset of [addon,power]){
  const path=join(root,asset.path);
  await mkdir(join(path,'..'),{recursive:true});
  await writeFile(path,await readFile(resolve(asset.path)));
 }
 const stage=await stageRuntime(root,{manifest});
 await verifyStage(stage,{manifest});
 assert.deepEqual((await readdir(join(stage,'images','Powers and Add-ons'))).sort(),['Trapper']);
 assert.deepEqual(await readFile(join(stage,addon.path)),await readFile(resolve(addon.path)));
 assert.deepEqual(await readFile(join(stage,power.path)),await readFile(resolve(power.path)));
 await writeFile(join(stage,power.path),'tampered');
 await assert.rejects(verifyStage(stage,{manifest}),/Killer Power asset hash\/dimensions mismatch|PNG/i);
});
test('release report and offline artwork check include Killer references and null Power fallbacks',async t=>{
 const root=await fixture(t),full=await generateAssetManifest();
 const addon=Object.values(full.inventory).find(asset=>asset?.path.startsWith('images/Powers and Add-ons/'));
 const power=Object.values(full.killerPowers).find(asset=>asset?.path);
 const manifest={perks:{},portraits:{},inventory:{'killer-addon-report':addon},killerPowers:{'the-report':power,'the-null-power':null}};
 for(const asset of [addon,power]){
  const path=join(root,asset.path);
  await mkdir(join(path,'..'),{recursive:true});
  await writeFile(path,await readFile(resolve(asset.path)));
 }
 const result=await runRelease({root,run:async(_command,args)=>{
  if(args[1]==='build'){
   await writeFile(join(root,'data/asset-manifest.json'),JSON.stringify(manifest));
   await writeFile(join(root,'dist/app.js'),'/* generated bundle */');
  }
 },smoke:async()=>({localhost:'AUTOMATED PASS'})});
 assert.equal(result.artwork.killerAddons,1);
 assert.equal(result.artwork.killerPowers,1);
 assert.equal(result.artwork.fallbackKillerPowers,1);
 const fileCheck=await readFile(join(root,'release/artwork-file-check.html'),'utf8');
 assert.ok(fileCheck.includes('killer-addon-report'));
 assert.ok(fileCheck.includes('the-report'));
 assert.ok(fileCheck.includes('1 intentional fallbacks'));
});

test('offline artwork checker preserves a literal hash in a referenced filename', async t => {
  const root = await fixture(t), full = await generateAssetManifest();
  const asset = Object.values(full.inventory).find(asset => asset?.path.endsWith('/Adi Valente #1.png'));
  const manifest = { perks: {}, inventory: { 'killer-addon-hash': asset }, killerPowers: {} };
  await mkdir(join(root, asset.path, '..'), { recursive: true });
  await writeFile(join(root, asset.path), await readFile(resolve(asset.path)));
  await runRelease({ root, run: async (_command, args) => {
    if (args[1] === 'build') {
      await writeFile(join(root, 'data/asset-manifest.json'), JSON.stringify(manifest));
      await writeFile(join(root, 'dist/app.js'), '/* generated bundle */');
    }
  }, smoke: async () => ({ localhost: 'AUTOMATED PASS' }) });
  const checker = join(root, 'release/artwork-file-check.html');
  const html = await readFile(checker, 'utf8'), requested = [];
  const nodes = Object.fromEntries(['#mode', '#result', '#icons'].map(id => [id, { append() {} }]));
  // Execute the emitted page script; the Image boundary reads the real staged PNG.
  await runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], {
    document: { querySelector: id => nodes[id], createElement: () => ({ append() {} }), createTextNode: value => value },
    location: { protocol: 'file:' }, navigator: { userAgent: 'URL serialization fixture' },
    Image: class {
      remove() {}
      async decode() {
        const url = new URL(this.src, pathToFileURL(checker)); requested.push(url);
        const bytes = await readFile(fileURLToPath(url));
        this.naturalWidth = bytes.readUInt32BE(16); this.naturalHeight = bytes.readUInt32BE(20);
      }
    },
  });
  assert.equal(requested[0].hash, '', 'Filename hash must not become a URL fragment');
  assert.equal(fileURLToPath(requested[0]), join(root, 'release/runtime', asset.path));
  assert.match(nodes['#result'].textContent, /^PASS — 1\/1 staged images decoded/);
});
test('release rejects Killer manifest entries rooted in Survivor inventory artwork',async t=>{
 const root=await fixture(t),path='images/survivor-items-addons/toolbox/items/worn-out-tools.png';
 const asset={path,width:1,height:1,sha256:'0'.repeat(64)};
 await assert.rejects(stageRuntime(root,{manifest:{perks:{},inventory:{'killer-addon-fixture':asset}}}),/Killer Add-on.*images\/Powers and Add-ons\//i);
 await assert.rejects(verifyStage(root,{manifest:{perks:{},killerPowers:{'the-fixture':asset}}}),/Killer Power.*images\/Powers and Add-ons\//i);
});
test('unsafe manifest paths cannot copy files outside the perk runtime allowlist', async t => {
  const root = await fixture(t);
  for (const path of ['../personal-save.json', 'images/survivor-images/meg.png', '/absolute.png', 'images/killer-perks/../secret.png']) {
    await assert.rejects(stageRuntime(root, { manifest: { perks: { fixture: { path } } } }), /Invalid.*path/);
  }
});
test('successful build without a regenerated manifest cannot release a stale workspace manifest', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'data/asset-manifest.json'), '{stale output');
  let smoked = false;
  await assert.rejects(runRelease({ root, run: async (_command, args) => {
    if (args[1] === 'build') await writeFile(join(root, 'dist/app.js'), '/* new bundle but missing generation */');
  }, smoke: async () => { smoked = true; } }), /ENOENT/);
  assert.equal(smoked, false);
  await assert.rejects(access(join(root, 'release/runtime')));
});
test('release uses the manifest regenerated by the normal build and handles generation failure', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'data/asset-manifest.json'), '{stale output');
  const commands = [];
  await runRelease({ root, run: async (_command, args) => {
    commands.push(args.join(' '));
    if (args[1] === 'build') { await writePerkManifest(root); await writeFile(join(root, 'dist/app.js'), '/* current bundle */'); }
  }, smoke: async () => ({ localhost: 'AUTOMATED PASS' }) });
  assert.deepEqual(commands, ['test', 'run build']);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'data/asset-manifest.json'))), await generatePerkManifest(root));
  await assert.rejects(runRelease({ root, run: async (_command, args) => {
    if (args[1] === 'build') throw new Error('Injected generation failure');
  } }), /generation failure/);
  await assert.rejects(access(join(root, 'release/runtime')));
  assert.equal(JSON.parse(await readFile(join(root, 'release/verification.json'))).status, 'FAILED');
});
