import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const testPath = 'tests/browser/character-workspace.mjs';
let text = await readFile(testPath, 'utf8');
const old = "'Keep these notes', 'Native perks']";
const replacement = "'Keep these notes', 'Native Perks']";
if (!text.includes(old)) throw new Error('Expected legacy Native perks assertion not found.');
text = text.replace(old, replacement);
await writeFile(testPath, text);

const result = spawnSync('node', ['.automation/task-2.mjs', 'run'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
