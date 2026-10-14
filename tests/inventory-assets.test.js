import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAssetManifest, assertInventoryAssetPath } from '../scripts/generate-assets.mjs';
import { inventoryIconPath } from '../src/assets.js';
import { inventoryEntities } from '../data/inventory-catalog.js';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {stageRuntime,verifyStage} from '../scripts/release.mjs';
test('only referenced verified Survivor assets bind stable IDs and null fallback',async()=>{
 const manifest=await generateAssetManifest();
 assert.equal(Object.values(manifest.inventory).filter(Boolean).length,92);
 for(const entity of inventoryEntities) assert.equal(inventoryIconPath(entity.id,manifest),entity.imagePath);
 assert.equal(inventoryIconPath('unknown',manifest),null);
 for(const path of ['../secret.png','images/updated-images/anything.png','images/survivor-items-addons/key/items/../secret.png'])
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
