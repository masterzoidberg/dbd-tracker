import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { buildProject } from '../scripts/build.mjs';
import { fileURLToPath } from 'node:url';

test('normal builds disable account UI; Production overrides explicit opt-in', async () => {
  const previous = process.env.VERCEL_ENV;
  try {
    for (const [environment, previewAccount, expected] of [['preview', false, false], ['preview', true, true], ['production', true, false]]) {
      process.env.VERCEL_ENV = environment;
      let definitions;
      await buildProject(undefined, { previewAccount, writeCatalog: async () => {}, writeManifest: async () => ({}),
        bundle: async options => { definitions = options.define; } });
      assert.equal(definitions.__LEDGER_PREVIEW_ACCOUNT__, String(expected));
    }
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous;
  }
});

test('browser bundles exclude server dependencies and credentials; default bundle excludes auth requests', async () => {
  for (const enabled of [false, true]) {
    const result = await build({ absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
      entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'iife', write: false, metafile: true,
      define: { __LEDGER_PREVIEW_ACCOUNT__: String(enabled), __LEDGER_GOOGLE_CONFIG__: '{}' } });
    const source = result.outputFiles[0].text;
    assert.doesNotMatch(source, /BETTER_AUTH_SECRET|DATABASE_URL|MAILTRAP_|SMTP_PASSWORD|postgres(?:ql)?:\/\//);
    assert.ok(Object.keys(result.metafile.inputs).every(path => !/node_modules|src\/auth\//.test(path)), 'No server packages in browser dependency graph');
    assert.equal(source.includes('/api/auth/'), enabled);
    assert.equal(source.includes('Ledger account (Preview)'), enabled);
  }
});
