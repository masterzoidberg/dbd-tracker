import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAssetManifest, assertInventoryAssetPath } from '../scripts/generate-assets.mjs';
import { inventoryIconPath, killerPowerIconPath } from '../src/assets.js';
import { inventoryEntities, inventoryEntityById, killerPowerByCharacterId } from '../data/inventory-catalog.js';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {stageRuntime,verifyStage} from '../scripts/release.mjs';
test('only referenced verified Survivor assets bind stable IDs and null fallback',async()=>{
 const manifest=await generateAssetManifest();
 assert.equal(Object.values(manifest.inventory).filter(asset=>asset?.path.startsWith('images/survivor-items-addons/')).length,92);
 for(const entity of inventoryEntities) assert.equal(inventoryIconPath(entity.id,manifest),entity.imagePath);
 assert.equal(inventoryIconPath('unknown',manifest),null);
 for(const path of ['../secret.png','images/updated-images/anything.png','images/survivor-items-addons/key/items/../secret.png'])
  assert.throws(()=>assertInventoryAssetPath(path));
});

test('all explicit Killer Power and Add-on artwork mappings resolve with confidence retained',async()=>{
 const manifest=await generateAssetManifest();
 const killerAddons=Object.values(inventoryEntityById).filter(entity=>entity.kind==='killer-addon');
 assert.equal(killerAddons.length,880);
 assert.equal(Object.keys(manifest.killerPowers).length,44);
 assert.equal(Object.values(manifest.inventory).filter(asset=>asset&&asset.path.startsWith('images/Powers and Add-ons/')).length,880);
 const mappings=[...killerAddons.map(entity=>entity.artworkConfidence),...Object.values(killerPowerByCharacterId).map(power=>power.artwork.confidence).filter(confidence=>confidence==='EXACT'||confidence==='REVIEW')];
 assert.equal(mappings.length,917);
 assert.equal(mappings.filter(confidence=>confidence==='EXACT').length,843);
 assert.equal(mappings.filter(confidence=>confidence==='REVIEW').length,74);
 assert.equal(Object.values(killerPowerByCharacterId).filter(power=>power.artwork.path===null).length,7);
 for(const entity of killerAddons) {
  const asset=manifest.inventory[entity.id];
  assert.ok(asset,`missing ${entity.id}`);
  assert.equal(asset.path,entity.imagePath);
 }
 for(const [characterId,power] of Object.entries(killerPowerByCharacterId)) {
  const asset=manifest.killerPowers[characterId];
  assert.equal(asset?.path??null,power.artwork.path);
  assert.equal(killerPowerIconPath(characterId,manifest),power.artwork.path);
 }
 assert.equal(killerPowerIconPath('unknown',manifest),null);
});

test('Killer artwork rejects missing explicit files, symlinks, and invalid PNG bytes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'dbd-killer-art-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const entities=Object.values(inventoryEntityById).filter(row=>row.kind==='killer-addon');
 const entity=entities[0], originals=entities.map(row=>row.imagePath);
 const powers=Object.values(killerPowerByCharacterId), originalPowerPaths=powers.map(power=>power.artwork.path);
 try {
  for(const row of entities)row.imagePath=null;
  for(const power of powers)power.artwork.path=null;
  entity.imagePath='images/Powers and Add-ons/does-not-exist.png';
  await assert.rejects(generateAssetManifest(root),/Killer artwork path does not exist/i);
  entity.imagePath=null;
  powers[0].artwork.path='images/Powers and Add-ons/missing-power.png';
  await assert.rejects(generateAssetManifest(root),/Killer Power artwork path does not exist/i);
  powers[0].artwork.path=null;
  await mkdir(join(root,'images/Powers and Add-ons'),{recursive:true});
  await writeFile(join(root,'images/Powers and Add-ons/target.png'),'not png');
  entity.imagePath='images/Powers and Add-ons/target.png';
  await assert.rejects(generateAssetManifest(root),/PNG/i);
  await rm(join(root,'images/Powers and Add-ons/target.png'));
  await rm(join(root,'images/Powers and Add-ons'),{recursive:true,force:true});
  const source=resolve('images/Powers and Add-ons');
  await symlink(source,join(root,'images/Powers and Add-ons'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(generateAssetManifest(root),/symbolic link|junction/i);
 } finally { entities.forEach((row,index)=>row.imagePath=originals[index]);powers.forEach((power,index)=>power.artwork.path=originalPowerPaths[index]); }
});

test('Killer artwork paths accept only safe explicit paths under the tracked art root',()=>{
 for(const path of ["images/Powers and Add-ons/Artist's Boots.png",'images/survivor-items-addons/alex/items/flashlight.png'])
  assert.equal(assertInventoryAssetPath(path),path);
 for(const path of ['../secret.png','images/Powers and Add-ons/../secret.png','images/Powers and Add-ons\\secret.png','C:/secret.png','/absolute.png','images/other/secret.png'])
  assert.throws(()=>assertInventoryAssetPath(path));
});
test('inventory stage contains only referenced bytes and rejects hash tampering',async t=>{
 const root=await mkdtemp(join(tmpdir(),'dbd-stock-stage-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const complete=await generateAssetManifest();
 const [id,asset]=Object.entries(complete.inventory)[0];
 const manifest={perks:{},portraits:{},inventory:{[id]:asset}};
 const files={'index.html':'<link href="styles.css"><script src="dist/app.js"></script>',
 'styles.css':'body{}','dist/app.js':'/* fixture */','docs/runtime-README.md':'Fixture', [asset.path]:await readFile(resolve(asset.path))};
 for(const [path,bytes] of Object.entries(files)){await mkdir(resolve(root,path,'..'),{recursive:true});await writeFile(resolve(root,path),bytes);}
 const stage=await stageRuntime(root,{manifest});
 await verifyStage(stage,{manifest});
 assert.deepEqual(await readFile(resolve(stage,asset.path)),files[asset.path]);
 const modified=Buffer.from(files[asset.path]);modified[modified.length-1]^=1;
 await writeFile(resolve(stage,asset.path),modified);
 await assert.rejects(verifyStage(stage,{manifest}),/hash\/dimensions mismatch/);
});
