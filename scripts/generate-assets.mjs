import { lstat, readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { perks, perkAliases, characters, slug } from '../data/catalog.js';
import { inventoryEntities, inventoryEntityById, killerPowerByCharacterId } from '../data/inventory-catalog.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const PLACEHOLDER_HASH = '3f794fe2e61b06702dbb027010b15e67e78a18e79b2b9c096be1180b76beb89b';
const assetExceptions = { 'detectives-hunch': 'detective-s-hunch' };
const collectionPortraitAliases = {
  survivor: { jakestore: 'jake-park' },
  killer: { pinhead: 'the-cenobite', ghostface: 'the-ghost-face' },
};
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function assertPerkAssetPath(path) {
  if (typeof path !== 'string' || !/^images\/(survivor|killer)-perks\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.png$/.test(path)) throw new Error(`Invalid perk asset path: ${path}`);
  return path;
}
export function pngDimensions(bytes, path) {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(pngSignature) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`Unsupported PNG header: ${path}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!width || !height || !depths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) throw new Error(`Invalid PNG dimensions/header: ${path}`);
  return { width, height };
}
export function assertPortraitAssetPath(path) {
  if (typeof path !== 'string' || !/^images\/(?:(?:survivor|killer)-images\/[\p{L}0-9_-]+\.(?:png|webp)|portrait-runtime\/[a-z0-9-]+\.webp)$/u.test(path)) throw new Error(`Invalid portrait asset path: ${path}`);
  return path;
}
export function assertCollectionPortraitAssetPath(path) {
  if (typeof path !== 'string' || !/^images\/updated-images\/Character Portraits\/(?:Survivors|Killers)\/Lore\/[\p{L}0-9 _-]+\.png$/u.test(path)) throw new Error(`Invalid collection portrait asset path: ${path}`);
  return path;
}
export function portraitDimensions(bytes, path) {
  if (bytes.subarray(0, 8).equals(pngSignature)) return { ...pngDimensions(bytes, path), format: 'png' };
  // Supplied WebP portraits use a static VP8X container. Other encodings fail clearly.
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length || bytes.toString('ascii', 12, 16) !== 'VP8X' || bytes.readUInt32LE(16) !== 10 || (bytes[20] & 0xc3) || bytes.subarray(21, 24).some(value => value !== 0)) throw new Error(`Unsupported portrait PNG/WebP header: ${path}`);
  let image = false;
  for (let offset = 30; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error(`Truncated WebP chunk: ${path}`);
    const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    if (type === 'ANIM' || type === 'ANMF') throw new Error(`Animated WebP portrait: ${path}`);
    image ||= type === 'VP8 ' || type === 'VP8L';
    offset += 8 + size + (size & 1);
    if (offset > bytes.length) throw new Error(`Truncated WebP chunk: ${path}`);
  }
  if (!image) throw new Error(`Missing WebP image: ${path}`);
  return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1, format: 'webp' };
}
async function entries(path) {
  const info = await lstat(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (!info) return [];
  if (info.isSymbolicLink()) throw new Error(`Perk assets cannot use a symbolic link/junction: ${path}`);
  return readdir(path, { withFileTypes: true });
}

export async function generatePerkManifest(root = PROJECT_ROOT) {
  root = resolve(root);
  // Portraits/background/archives are deliberately outside the runtime icon scan.
  const images = await lstat(resolve(root, 'images')).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (images?.isSymbolicLink()) throw new Error('Images cannot be a symbolic link/junction.');
  const manifest = { perks: Object.fromEntries(perks.map(perk => perk.id).sort().map(id => [id, null])) };
  const seen = new Map();
  for (const role of ['survivor', 'killer']) {
    async function walk(folder) {
      const children = await entries(folder);
      children.sort((a, b) => a.name.localeCompare(b.name));
      for (const child of children) {
        const path = resolve(folder, child.name);
        if (child.isSymbolicLink()) throw new Error(`Perk assets cannot use a symbolic link: ${path}`);
        if (child.isDirectory()) { await walk(path); continue; }
        if (child.name.endsWith('.zip')) continue;
        const name = relative(root, path).split(sep).join('/');
        assertPerkAssetPath(name);
        const stem = basename(name, '.png');
        const id = Object.hasOwn(assetExceptions, stem) ? assetExceptions[stem] : Object.hasOwn(perkAliases, stem) ? perkAliases[stem] : stem;
        const perk = perks.find(perk => perk.id === id);
        if (!perk) throw new Error(`Unknown perk icon: ${name}`);
        if (perk.role !== role) throw new Error(`Wrong role for perk icon: ${name}`);
        const bytes = await readFile(path), dimensions = pngDimensions(bytes, name);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const previous = seen.get(id);
        // Retain audited source placeholders, but allow one authentic replacement.
        if (previous && (previous.paired || (previous.sha256 === PLACEHOLDER_HASH) === (sha256 === PLACEHOLDER_HASH))) throw new Error(`Perk asset collision for ${id}: ${name}`);
        seen.set(id, { sha256, paired: !!previous });
        if (sha256 !== PLACEHOLDER_HASH) manifest.perks[id] = { path: name, ...dimensions, sha256 };
      }
    }
    await walk(resolve(root, `images/${role}-perks`));
  }
  return manifest;
}

export async function writePerkManifest(root = PROJECT_ROOT) {
  const manifest = await generatePerkManifest(root);
  await mkdir(resolve(root, 'data'), { recursive: true });
  await writeFile(resolve(root, 'data/asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export async function generatePortraitManifest(root = PROJECT_ROOT) {
  root = resolve(root);
  await entries(resolve(root, 'images')); // Reject an images-root junction too.
  const portraits = Object.fromEntries(characters.map(c => c.id).sort().map(id => [id, null]));
  for (const role of ['survivor', 'killer']) {
    const folder = resolve(root, `images/${role}-images`);
    for (const child of (await entries(folder)).sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.isSymbolicLink()) throw new Error(`Portrait cannot use a symbolic link: ${child.name}`);
      const sourcePath = `images/${role}-images/${child.name}`;
      assertPortraitAssetPath(sourcePath);
      if (!child.isFile()) throw new Error(`Invalid portrait file: ${sourcePath}`);
      const stem = slug(child.name.replace(/\.(png|webp)$/, ''));
      const matches = characters.filter(c => c.id === stem || slug(c.name) === stem);
      if (matches.length !== 1) throw new Error(`Unknown or ambiguous portrait: ${sourcePath}`);
      const character = matches[0];
      if (character.role !== role) throw new Error(`Wrong role for portrait: ${sourcePath}`);
      if (portraits[character.id]) throw new Error(`Portrait collision for ${character.id}`);
      const bytes = await readFile(resolve(root, sourcePath)), dimensions = portraitDimensions(bytes, sourcePath);
      const path = dimensions.format === 'webp' && sourcePath.endsWith('.png') ? `images/portrait-runtime/${character.id}.webp` : sourcePath;
      assertPortraitAssetPath(path);
      if (!path.endsWith('.' + dimensions.format)) throw new Error(`Portrait extension/format mismatch: ${sourcePath}`);
      portraits[character.id] = { path, sourcePath, ...dimensions, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
  }
  return { portraits };
}
export async function generateCollectionPortraitManifest(root = PROJECT_ROOT) {
  root = resolve(root);
  await entries(resolve(root, 'images'));
  const collectionPortraits = Object.fromEntries(characters.map(character => [character.id, null]).sort(([a], [b]) => a.localeCompare(b)));
  for (const [role, folderName] of [
    ['survivor', 'images/updated-images/Character Portraits/Survivors/Lore'],
    ['killer', 'images/updated-images/Character Portraits/Killers/Lore'],
  ]) {
    const roster = characters.filter(character => character.role === role);
    const folder = resolve(root, folderName);
    for (const child of (await entries(folder)).sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.isSymbolicLink()) throw new Error(`Collection portrait cannot use a symbolic link: ${child.name}`);
      const sourcePath = `${folderName}/${child.name}`;
      assertCollectionPortraitAssetPath(sourcePath);
      if (!child.isFile()) throw new Error(`Invalid collection portrait file: ${sourcePath}`);
      const stem = slug(basename(child.name, '.png'));
      const alias = collectionPortraitAliases[role][stem];
      const matches = alias
        ? roster.filter(character => character.id === alias)
        : roster.filter(character => character.id === stem || slug(character.name).replace(/^the-/, '') === stem);
      if (matches.length !== 1) throw new Error(`Unknown or ambiguous ${role} collection portrait: ${sourcePath}`);
      const character = matches[0];
      if (collectionPortraits[character.id]) throw new Error(`Collection portrait collision for ${character.id}`);
      const bytes = await readFile(resolve(root, sourcePath));
      const dimensions = portraitDimensions(bytes, sourcePath);
      if (dimensions.format !== 'png') throw new Error(`Collection portrait format/extension mismatch: ${sourcePath}`);
      collectionPortraits[character.id] = { path: sourcePath, sourcePath, ...dimensions, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
  }
  return { collectionPortraits };
}
export async function generateAssetManifest(root = PROJECT_ROOT) {
  const [perks, portraits, collectionPortraits] = await Promise.all([
    generatePerkManifest(root), generatePortraitManifest(root), generateCollectionPortraitManifest(root),
  ]);
  const inventory={};
  for(const entity of [...inventoryEntities,...Object.values(inventoryEntityById).filter(entity=>entity.kind==='killer-addon')]) {
    inventory[entity.id]=null;
    if(!entity.imagePath) continue;
    const path=assertInventoryAssetPath(entity.imagePath);
    const isKiller=entity.kind==='killer-addon';
    if(isKiller&&!path.startsWith('images/Powers and Add-ons/'))throw Error(`Killer artwork path must be below images/Powers and Add-ons/: ${path}`);
    let safe=true;
    let parent=root;
    const parts=path.split('/');
    for(const [index,part] of parts.entries()) {
      parent=resolve(parent,part);
      const info=await lstat(parent).catch(e=>{if(e.code!=='ENOENT')throw e; return null;});
      if(!info){
        if(isKiller)throw Error(`Killer artwork path does not exist: ${path}`);
        safe=false;break;
      }
      if(info.isSymbolicLink())throw Error('Inventory artwork cannot use symbolic links.');
      if(isKiller&&(index===parts.length-1?!info.isFile():!info.isDirectory()))throw Error(`Killer artwork path has an invalid component: ${path}`);
    }
    if(!safe)continue;
    const bytes=await readFile(resolve(root,path)), sha256=createHash('sha256').update(bytes).digest('hex');
    if(isKiller) {
      if(!['EXACT','REVIEW'].includes(entity.artworkConfidence))throw Error(`Killer artwork confidence is invalid: ${entity.id}`);
      inventory[entity.id]={path,...pngDimensions(bytes,path),sha256};
      continue;
    }
    if(sha256!==entity.imageSha256)continue;
    try {inventory[entity.id]={path,...pngDimensions(bytes,path),sha256};}catch{ /* Truthful art fallback. */ }
  }
  const killerPowers={};
  for(const [characterId,power] of Object.entries(killerPowerByCharacterId)) {
    const path=power.artwork.path;
    if(path===null){killerPowers[characterId]=null;continue;}
    assertInventoryAssetPath(path);
    if(!path.startsWith('images/Powers and Add-ons/'))throw Error(`Killer Power artwork path must be below images/Powers and Add-ons/: ${path}`);
    if(!['EXACT','REVIEW'].includes(power.artwork.confidence))throw Error(`Killer Power artwork confidence is invalid: ${characterId}`);
    let parent=root;
    const parts=path.split('/');
    for(const [index,part] of parts.entries()) {
      parent=resolve(parent,part);
      const info=await lstat(parent).catch(error=>{if(error.code!=='ENOENT')throw error;});
      if(!info)throw Error(`Killer Power artwork path does not exist: ${path}`);
      if(info.isSymbolicLink())throw Error(`Killer Power artwork cannot use symbolic links: ${path}`);
      if(index===parts.length-1?!info.isFile():!info.isDirectory())throw Error(`Killer Power artwork path has an invalid component: ${path}`);
    }
    const bytes=await readFile(resolve(root,path));
    killerPowers[characterId]={path,...pngDimensions(bytes,path),sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  return { ...perks, ...portraits, ...collectionPortraits, inventory, killerPowers };
}
export function assertInventoryAssetPath(path) {
  const survivor=typeof path==='string'&&/^images\/survivor-items-addons\/[a-z0-9]+(?:-[a-z0-9]+)*\/(items|addons)\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/.test(path);
  const killer=typeof path==='string'&&path.startsWith('images/Powers and Add-ons/')&&path.endsWith('.png')
    &&!path.includes('\\')&&path.split('/').every(part=>part&&part!=='.'&&part!=='..');
  if(!survivor&&!killer)
    throw Error('Invalid inventory asset path.');
  return path;
}
export async function writeAssetManifest(root = PROJECT_ROOT) {
  root = resolve(root);
  const manifest = await generateAssetManifest(root);
  for (const asset of Object.values(manifest.portraits).filter(asset => asset && asset.path !== asset.sourcePath)) {
    const folder = resolve(root, 'images/portrait-runtime');
    await entries(folder);
    await mkdir(folder, { recursive: true });
    const target = resolve(root, asset.path);
    const existing = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (existing && !existing.isFile()) throw new Error(`Generated portrait cannot use a symbolic link/directory: ${target}`);
    await copyFile(resolve(root, asset.sourcePath), target);
  }
  await mkdir(resolve(root, 'data'), { recursive: true });
  await writeFile(resolve(root, 'data/asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = await writeAssetManifest();
    console.log(`Perk artwork: ${Object.values(manifest.perks).filter(Boolean).length} icons, ${Object.values(manifest.perks).filter(value => value === null).length} fallbacks.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
