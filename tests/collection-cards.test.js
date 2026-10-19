import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import * as assets from '../scripts/generate-assets.mjs';
import * as resolver from '../src/assets.js';
import { freshSave } from '../src/model.js';
import { characters } from '../data/catalog.js';
import { inventoryEntityById } from '../data/inventory-catalog.js';
import { stageRuntime, verifyStage } from '../scripts/release.mjs';

const project = resolve(import.meta.dirname, '..');
const collection = await import('../src/survivor-collection.js').catch(() => null);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9XkAAAAASUVORK5CYII=', 'base64');

test('collection Lore manifest maps every live character to an explicit role-correct source image', async () => {
  assert.equal(typeof assets.generateCollectionPortraitManifest, 'function');
  const { collectionPortraits } = await assets.generateCollectionPortraitManifest(project);
  assert.deepEqual(Object.keys(collectionPortraits), characters.map(character => character.id).sort());
  assert.equal(Object.values(collectionPortraits).filter(Boolean).length, 97);
  assert.equal(collectionPortraits['the-slasher'], null, 'The Slasher has no Lore image in the approved source tree');
  assert.ok(collectionPortraits['jake-park'].path.endsWith('/Survivors/Lore/JakeStore.png'));
  assert.ok(collectionPortraits['the-cenobite'].path.endsWith('/Killers/Lore/Pinhead.png'));
  assert.ok(collectionPortraits['the-ghost-face'].path.endsWith('/Killers/Lore/Ghostface.png'));

  for (const character of characters.filter(character => collectionPortraits[character.id])) {
    const asset = collectionPortraits[character.id];
    const folder = character.role === 'survivor' ? '/Survivors/Lore/' : '/Killers/Lore/';
    assert.ok(asset.path.includes(folder), `${character.id} uses its role's Lore folder`);
    assert.equal(asset.path, asset.sourcePath, 'Lore images are referenced directly without a copied runtime directory');
    assert.equal(asset.format, 'png');
    const bytes = await readFile(join(project, asset.sourcePath));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.deepEqual(assets.portraitDimensions(bytes, asset.path), {
      width: asset.width, height: asset.height, format: 'png',
    });
  }
});

test('collection portrait resolver reads only explicit manifest mappings', () => {
  assert.equal(typeof resolver.collectionPortraitPath, 'function');
  const manifest = { collectionPortraits: { 'ace-visconti': { path: 'images/updated-images/Character Portraits/Survivors/Lore/Ace Visconti.png' }, '__proto__': { path: 'bad.png' } } };
  assert.equal(resolver.collectionPortraitPath('ace-visconti', manifest), manifest.collectionPortraits['ace-visconti'].path);
  assert.equal(resolver.collectionPortraitPath('unknown-safe-id', manifest), null);
  assert.equal(resolver.collectionPortraitPath('__proto__', manifest), null);
  assert.equal(resolver.collectionPortraitPath('the-slasher', { collectionPortraits: { 'the-slasher': null } }), null);
});

test('collection inventory summaries count distinct verified positive quantities by role', () => {
  assert.ok(collection, 'collection inventory selectors are available');
  assert.equal(typeof collection.survivorInventoryCounts, 'function');
  assert.equal(typeof collection.killerAddonCount, 'function');
  const save = freshSave();
  const entities = Object.values(inventoryEntityById);
  const survivorItems = entities.filter(entity => entity.role === 'survivor' && entity.kind === 'survivor-item' && entity.map === 'items');
  const survivorAddons = entities.filter(entity => entity.role === 'survivor' && entity.kind === 'survivor-addon' && entity.map === 'addons');
  const killerAddons = entities.filter(entity => entity.role === 'killer' && entity.kind === 'killer-addon' && entity.map === 'addons');
  const survivorInventory = save.characters['meg-thomas'].inventory;
  survivorInventory.items[survivorItems[0].id] = 9;
  survivorInventory.items[survivorItems[1].id] = 1;
  survivorInventory.addons[survivorAddons[0].id] = 6;
  survivorInventory.addons[survivorAddons[1].id] = 3;
  survivorInventory.addons[survivorAddons[2].id] = 0;
  survivorInventory.addons[killerAddons[0].id] = 7;
  survivorInventory.items['survivor-item-future-family-future-item'] = 5;
  assert.deepEqual(collection.survivorInventoryCounts(save, 'meg-thomas'), { items: 2, addons: 2 });

  const killerInventory = save.characters['the-trapper'].inventory;
  killerInventory.addons[killerAddons[0].id] = 12;
  killerInventory.addons[killerAddons[1].id] = 1;
  killerInventory.addons[killerAddons[2].id] = 0;
  killerInventory.addons['killer-addon-future-killer-future-addon'] = 8;
  killerInventory.items[killerAddons[3].id] = 4;
  assert.equal(collection.killerAddonCount(save, 'the-trapper'), 2, 'counts stocked Add-on types, not copies or Power');
});

test('release stages only explicitly mapped Lore images and verifies the staged PNG', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dbd-collection-stage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = 'images/updated-images/Character Portraits/Survivors/Lore/Meg Thomas.png';
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), png);
  await writeFile(join(root, 'index.html'), '<link href="styles.css" rel="stylesheet"><script src="dist/app.js"></script>');
  await writeFile(join(root, 'styles.css'), 'body { color: white }');
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist/app.js'), '// bundle');
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'docs/runtime-README.md'), 'Runtime');
  const manifest = {
    perks: {}, portraits: {}, inventory: {}, killerPowers: {},
    collectionPortraits: { 'meg-thomas': { path, sourcePath: path, width: 1, height: 1, format: 'png', sha256: createHash('sha256').update(png).digest('hex') } },
  };
  const stage = await stageRuntime(root, { manifest });
  await verifyStage(stage, { manifest });
  assert.deepEqual(await readFile(join(stage, path)), png);
});
