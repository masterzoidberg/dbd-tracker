import { access, copyFile, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smokeStage } from '../tests/browser/smoke.mjs';
import { assertPerkAssetPath, pngDimensions, assertPortraitAssetPath, portraitDimensions, assertInventoryAssetPath } from './generate-assets.mjs';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
export const RUNTIME_FILES = {
  'index.html': 'index.html',
  'styles.css': 'styles.css',
  'dist/app.js': 'dist/app.js',
  'README.md': 'docs/runtime-README.md',
};

export async function assertStagePath(root, stage = resolve(root, 'release/runtime')) {
  const expected = resolve(root, 'release/runtime');
  if (resolve(stage) !== expected || expected === resolve(root)) throw new Error('Only the dedicated staging directory may be recreated.');
  for (const path of [resolve(root, 'release'), expected]) {
    const info = await lstat(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (info?.isSymbolicLink()) throw new Error('Release paths must not be a symbolic link or junction.');
  }
  return expected;
}

function runtimeFiles(manifest) {
  const files = { ...RUNTIME_FILES };
  for(const [id,asset] of Object.entries(manifest.inventory||{}).filter(([,asset])=>asset)){
    const path=assertInventoryAssetPath(asset.path);
    if(id.startsWith('killer-addon-')&&!path.startsWith('images/Powers and Add-ons/'))throw Error(`Killer Add-on asset must be below images/Powers and Add-ons/: ${path}`);
    if(!id.startsWith('killer-addon-')&&!path.startsWith('images/survivor-items-addons/'))throw Error(`Survivor inventory asset must be below images/survivor-items-addons/: ${path}`);
    if(Object.hasOwn(files,path))throw Error('Inventory asset path collision.');
    files[path]=path;
  }
  for(const asset of Object.values(manifest.killerPowers||{}).filter(Boolean)){
    const path=assertInventoryAssetPath(asset.path);
    if(!path.startsWith('images/Powers and Add-ons/'))throw Error(`Killer Power asset must be below images/Powers and Add-ons/: ${path}`);
    if(Object.hasOwn(files,path))throw Error(`Killer Power asset path collision: ${path}`);
    files[path]=path;
  }
  for (const asset of Object.values(manifest.perks).filter(Boolean)) {
    const path = assertPerkAssetPath(asset.path);
    if (Object.hasOwn(files, path)) throw new Error(`Perk asset path collision: ${path}`);
    files[path] = path;
  }
  for (const asset of Object.values(manifest.portraits || {}).filter(Boolean)) {
    const path = assertPortraitAssetPath(asset.path);
    if (Object.hasOwn(files, path)) throw new Error(`Portrait asset path collision: ${path}`);
    files[path] = path;
  }
  return files;
}

export async function stageRuntime(root, { copy = copyFile, manifest = { perks: {} } } = {}) {
  const files = runtimeFiles(manifest);
  const stage = await assertStagePath(root);
  await rm(stage, { recursive: true, force: true });
  for (const [target, source] of Object.entries(files)) {
    await mkdir(dirname(resolve(stage, target)), { recursive: true });
    await copy(resolve(root, source), resolve(stage, target));
  }
  return stage;
}

export async function checkCatalogRevision(root) {
  const names = ['dbd-survivor-perks-live-10.1.2a-2026-10-05-corrected.json', 'killer-perks-audited-10.1.2a-2026-10-05.json'];
  const [survivor, killer] = await Promise.all(names.map(async name => JSON.parse(await readFile(resolve(root, 'data', name), 'utf8'))));
  for (const field of ['verified_live_patch', 'verified_date']) {
    if (typeof survivor[field] !== 'string' || !survivor[field] || survivor[field] !== killer[field]) throw new Error(`Catalog ${field} mismatch between Survivor and Killer.`);
  }
  return { patch: survivor.verified_live_patch, date: survivor.verified_date };
}

export async function verifyStage(stage, { manifest = { perks: {} } } = {}) {
  const files = runtimeFiles(manifest), directories = new Set();
  for (const path of Object.keys(files)) {
    let folder = dirname(path);
    while (folder !== '.') { directories.add(folder.split(sep).join('/')); folder = dirname(folder); }
  }
  const found = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Staged runtime must not contain symbolic links.');
      if (entry.isDirectory()) {
        if (!directories.has(relative(stage, path).split(sep).join('/'))) throw new Error(`Unexpected staged directory: ${path}`);
        await walk(path);
      } else found.push(relative(stage, path).split(sep).join('/'));
    }
  }
  await walk(stage);
  if (JSON.stringify(found.sort()) !== JSON.stringify(Object.keys(files).sort())) throw new Error('Staged files do not match the runtime allowlist.');
  for (const asset of Object.values(manifest.perks).filter(Boolean)) {
    const bytes = await readFile(resolve(stage, asset.path)), dimensions = pngDimensions(bytes, asset.path);
    if (dimensions.width !== asset.width || dimensions.height !== asset.height || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Staged perk asset hash/dimensions mismatch: ${asset.path}`);
  }
  for(const asset of Object.values(manifest.inventory||{}).filter(Boolean)){
    const path=assertInventoryAssetPath(asset.path), bytes=await readFile(resolve(stage,path)), dimensions=pngDimensions(bytes,path);
    if(dimensions.width!==asset.width||dimensions.height!==asset.height||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)
      throw Error('Staged inventory asset hash/dimensions mismatch: '+path);
  }
  for(const asset of Object.values(manifest.killerPowers||{}).filter(Boolean)){
    const path=assertInventoryAssetPath(asset.path), bytes=await readFile(resolve(stage,path)), dimensions=pngDimensions(bytes,path);
    if(dimensions.width!==asset.width||dimensions.height!==asset.height||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)
      throw Error(`Staged Killer Power asset hash/dimensions mismatch: ${path}`);
  }
  for (const asset of Object.values(manifest.portraits || {}).filter(Boolean)) {
    const bytes = await readFile(resolve(stage, asset.path)), dimensions = portraitDimensions(bytes, asset.path);
    if (dimensions.format !== asset.format || !asset.path.endsWith('.' + asset.format) || dimensions.width !== asset.width || dimensions.height !== asset.height || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Staged portrait format/hash/dimensions mismatch: ${asset.path}`);
  }
  const contents = Object.fromEntries(await Promise.all(Object.keys(RUNTIME_FILES).map(async name => {
    const text = await readFile(resolve(stage, name), 'utf8');
    if (!text.trim()) throw new Error(`Required runtime file is empty: ${name}`);
    return [name, text];
  })));
  async function localReference(from, reference) {
    if (!reference || reference.startsWith('#') || /^(?:[a-z]+:|\/\/)/i.test(reference)) return;
    if (reference.startsWith('/') || reference.includes('\\')) throw new Error(`Reference is not direct-file compatible: ${reference}`);
    const path = resolve(stage, dirname(from), decodeURIComponent(reference.split(/[?#]/)[0]));
    const inside = relative(stage, path);
    if (inside.startsWith('..' + sep) || inside === '..' || isAbsolute(inside)) throw new Error(`Reference escapes staging: ${reference}`);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Reference is not a runtime file: ${reference}`);
  }
  const htmlReferences = [...contents['index.html'].matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  for (const required of ['styles.css', 'dist/app.js']) if (!htmlReferences.includes(required)) throw new Error(`HTML does not load ${required}.`);
  for (const reference of htmlReferences) await localReference('index.html', reference);
  for (const match of contents['styles.css'].matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/gi)) await localReference('styles.css', match[1] || match[2]);
  // Catalogs and the artwork manifest remain bundled; only referenced images are staged.
  if (/\b(?:fetch|import)\s*\(/.test(contents['dist/app.js'])) throw new Error('Runtime fetch/module loading needs an explicit staged dependency check.');
}

function runCommand(command, args, root) {
  // Reuse the npm CLI that invoked release; avoid Windows command-string construction.
  const executable = command === 'npm' && process.env.npm_execpath ? process.execPath : command;
  const arguments_ = executable === process.execPath ? [process.env.npm_execpath, ...args] : args;
  return new Promise((accept, reject) => {
    const child = spawn(executable, arguments_, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? accept() : reject(new Error(`${command} ${args.join(' ')} failed (${code}).`)));
  });
}

// Outside runtime: a human opens this page to check every staged image in file mode.
function artworkFileCheck(manifest) {
  const assets = [...Object.entries(manifest.perks), ...Object.entries(manifest.portraits || {}), ...Object.entries(manifest.inventory || {}), ...Object.entries(manifest.killerPowers || {})].filter(([, asset]) => asset).map(([id, asset]) => ({ id, ...asset }));
  const fallbacks = [...Object.values(manifest.perks), ...Object.values(manifest.portraits || {}), ...Object.values(manifest.killerPowers || {})].filter(value => value === null).length;
  return `<!doctype html><meta charset="utf-8"><title>Staged artwork verification</title>
<style>body{font:16px system-ui;background:#19191b;color:#edebe6;padding:24px}li{display:inline-flex;align-items:center;gap:8px;width:280px;margin:8px}img{width:36px;height:36px;object-fit:contain}</style>
<h1>Staged artwork verification</h1><p>Open this page directly from disk, offline. It checks the exact manifest-referenced perk, portrait, inventory, and Killer Power artwork under runtime/images; it does not access tracker saves.</p>
<p id="mode"></p><p id="result">Checking icons…</p><ul id="icons"></ul>
<script>
const assets = ${JSON.stringify(assets)};
document.querySelector('#mode').textContent = location.protocol + ' — ' + navigator.userAgent;
Promise.all(assets.map(async asset => {
  const img = new Image(); img.alt = ''; img.src = 'runtime/' + asset.path;
  const row = document.createElement('li'); row.append(img, document.createTextNode(asset.id)); document.querySelector('#icons').append(row);
  try { await img.decode(); if (img.naturalWidth !== asset.width || img.naturalHeight !== asset.height) throw Error('dimensions'); return null; }
  catch { img.remove(); row.append(document.createTextNode(' — FAILED')); return asset.id; }
})).then(results => {
  const failures = results.filter(Boolean);
  document.querySelector('#result').textContent = (failures.length ? 'FAIL' : 'PASS') + ' — ' + (assets.length - failures.length) + '/' + assets.length + ' staged images decoded; ${fallbacks} intentional fallbacks.' + (location.protocol === 'file:' ? '' : ' This is not a direct-file result.');
});
</script>\n`;
}

export async function runRelease({ root = PROJECT_ROOT, run = runCommand, copy = copyFile, verify = verifyStage, smoke = smokeStage } = {}) {
  root = resolve(root);
  const stage = await assertStagePath(root);
  await mkdir(resolve(root, 'release'), { recursive: true });
  const report = resolve(root, 'release/verification.json');
  const fileCheck = resolve(root, 'release/artwork-file-check.html');
  await rm(fileCheck, { force: true });
  await writeFile(report, JSON.stringify({ status: 'RUNNING' }, null, 2));
  try {
    await run('npm', ['test'], root);
    const catalog = await checkCatalogRevision(root);
    // The normal build must regenerate inputs. Remove stale output so an empty build cannot pass.
    await rm(resolve(root, 'data/asset-manifest.json'), { force: true });
    await rm(resolve(root, 'dist/app.js'), { force: true });
    await run('npm', ['run', 'build'], root);
    await access(resolve(root, 'dist/app.js'));
    const manifest = JSON.parse(await readFile(resolve(root, 'data/asset-manifest.json'), 'utf8'));
    await stageRuntime(root, { copy, manifest });
    await verify(stage, { manifest });
    const browser = await smoke(stage, { manifest });
    if (browser.localhost !== 'AUTOMATED PASS') throw new Error('Required localhost browser smoke did not pass.');
    await writeFile(fileCheck, artworkFileCheck(manifest));
    const result = { status: 'AWAITING_MANUAL_ACCEPTANCE', stage, catalog, ...browser,
      artwork: { usableIcons: Object.values(manifest.perks).filter(Boolean).length, fallbackPerks: Object.values(manifest.perks).filter(value => value === null).length, usablePortraits: Object.values(manifest.portraits || {}).filter(Boolean).length, fallbackPortraits: Object.values(manifest.portraits || {}).filter(value => value === null).length, killerAddons: Object.values(manifest.inventory || {}).filter(asset => asset?.path?.startsWith('images/Powers and Add-ons/')).length, killerPowers: Object.values(manifest.killerPowers || {}).filter(Boolean).length, fallbackKillerPowers: Object.values(manifest.killerPowers || {}).filter(value => value === null).length },
      directFile: 'MANUAL ACCEPTANCE REQUIRED',
      bundleSha256: createHash('sha256').update(await readFile(resolve(stage, 'dist/app.js'))).digest('hex'),
    };
    await writeFile(report, JSON.stringify(result, null, 2) + '\n');
    return result;
  } catch (error) {
    await assertStagePath(root, stage);
    await rm(stage, { recursive: true, force: true });
    await rm(fileCheck, { force: true });
    await writeFile(report, JSON.stringify({ status: 'FAILED', error: error.message }, null, 2) + '\n');
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runRelease();
    console.log(`AUTOMATED PASS: ${result.stage}\nDIRECT FILE: MANUAL ACCEPTANCE REQUIRED (see runtime README).\nThis staging run is not fully release-accepted until that manual check passes.`);
  } catch (error) { console.error(`Release failed: ${error.message}`); process.exitCode = 1; }
}
