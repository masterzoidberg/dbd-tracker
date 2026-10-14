// Planning-only inventory tool. Run from repository root: node plans/rev1/audit-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { characters, perks, perkAliases, slug } from '../../data/catalog.js';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name).replaceAll('\\', '/')]);
const files = walk('images').map(p => {
  const b = fs.readFileSync(p), png = b.subarray(1, 4).toString() === 'PNG', webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  const dimensions = png ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : webp && b.subarray(12, 16).toString() === 'VP8X' ? { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 } : {};
  return { path: p, bytes: b.length, format: png ? 'PNG' : webp ? 'WebP' : path.extname(p), ...dimensions, sha256: crypto.createHash('sha256').update(b).digest('hex') };
});
const exceptions = { 'the-ghost-face': 'danny-johnson', 'the-clown': 'jeffrey-hawk', 'the-legion': 'frank-julie-susie-joey', 'the-good-guy': 'charles-lee-ray', 'the-nemesis': 'nemesis-t-type', 'the-onryo': 'onry', 'aestri-yazar': 'troupe', 'leon-s-kennedy': 'leon-scott-kennedy', 'elodie-rakoto': 'lodie-rakoto' };
const portraits = files.filter(f => /-images\//.test(f.path));
const characterRows = characters.map(c => {
  const key = exceptions[c.id] ?? c.id.replace(/^the-/, '');
  const file = portraits.find(f => slug(path.parse(f.path).name) === key && f.path.includes(c.role + '-images'));
  return { id: c.id, name: c.name, role: c.role, path: file?.path ?? null };
});
const icons = files.filter(f => /-perks\/.+\.(png|webp)$/.test(f.path));
const assetPerkExceptions = { 'detectives-hunch': 'detective-s-hunch' };
const perkRows = perks.map(p => ({ id: p.id, name: p.name, role: p.role, paths: icons.filter(f => { const key = path.parse(f.path).name; return f.path.includes(p.role + '-perks') && (assetPerkExceptions[key] ?? perkAliases[key] ?? key) === p.id; }).map(f => f.path) }));
const report = { files, characters: characterRows, perks: perkRows, duplicateContent: Object.values(Object.groupBy(files, f => f.sha256)).filter(a => a.length > 1).map(a => a.map(f => f.path)), unmatchedImages: files.filter(f => ['PNG', 'WebP'].includes(f.format) && !characterRows.some(c => c.path === f.path) && !perkRows.some(p => p.paths.includes(f.path)) && f.path !== 'images/perk_background2.png').map(f => f.path) };
fs.writeFileSync('plans/rev1/asset-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ directoryCounts: Object.fromEntries(['killer-images', 'survivor-images', 'killer-perks', 'survivor-perks'].map(d => [d, files.filter(f => f.path.includes('/' + d + '/')).length])), formats: Object.fromEntries(Object.entries(Object.groupBy(files, f => f.format)).map(([k, v]) => [k, v.length])), dimensions: Object.fromEntries(Object.entries(Object.groupBy(files.filter(f => f.width), f => `${f.width}x${f.height}`)).map(([k, v]) => [k, v.length])), missingCharacters: characterRows.filter(c => !c.path), missingPerks: perkRows.filter(p => !p.paths.length), duplicateContent: report.duplicateContent, unmatchedImages: report.unmatchedImages }, null, 2));
