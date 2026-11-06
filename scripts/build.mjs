import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeKillerRuntimeCatalog } from './generate-killer-runtime-catalog.mjs';
import { googleDriveConfig } from '../src/google-drive.js';

export async function buildProject(root = resolve(import.meta.dirname, '..'), {
  bundle = build,
  writeCatalog = writeKillerRuntimeCatalog,
  writeManifest,
  previewAccount = false,
} = {}) {
  root = resolve(root);
  await writeCatalog(root);
  const generateManifest = writeManifest ?? (await import('./generate-assets.mjs')).writeAssetManifest;
  const manifest = await generateManifest(root);
  await bundle({ absWorkingDir: root, entryPoints: ['src/app.js'], bundle: true, format: 'iife', target: 'es2022', minify: true, outfile: 'dist/app.js', logLevel: 'info',
    define: { __LEDGER_GOOGLE_CONFIG__: JSON.stringify(googleDriveConfig(process.env)),
      __LEDGER_PREVIEW_ACCOUNT__: JSON.stringify(previewAccount && process.env.VERCEL_ENV !== 'production') } });
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildProject(undefined, { previewAccount: process.argv.includes('--preview-account') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
