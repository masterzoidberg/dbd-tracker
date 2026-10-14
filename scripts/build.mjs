import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAssetManifest } from './generate-assets.mjs';

export async function buildProject(root = resolve(import.meta.dirname, '..'), { bundle = build } = {}) {
  root = resolve(root);
  const manifest = await writeAssetManifest(root);
  await bundle({ absWorkingDir: root, entryPoints: ['src/app.js'], bundle: true, format: 'iife', target: 'es2022', minify: true, outfile: 'dist/app.js', logLevel: 'info' });
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildProject(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
