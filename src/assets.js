import { perkAliases } from '../data/catalog.js';

// The caller supplies the bundled manifest; tests supply a freshly generated one.
export function perkIconPath(id, manifest) {
  const canonical = Object.hasOwn(perkAliases, id) ? perkAliases[id] : id;
  return Object.hasOwn(manifest.perks, canonical) ? manifest.perks[canonical]?.path ?? null : null;
}
export function characterPortraitPath(id, manifest) {
  return manifest.portraits && Object.hasOwn(manifest.portraits, id) ? manifest.portraits[id]?.path ?? null : null;
}
export function inventoryIconPath(id,manifest) {
  return manifest.inventory && Object.hasOwn(manifest.inventory,id) ? manifest.inventory[id]?.path??null : null;
}
