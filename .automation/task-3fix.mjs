import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const scriptPath = '.automation/task-3.mjs';
let text = await readFile(scriptPath, 'utf8');
const old = "const searchForces=Boolean(stockFilters.search)&&(group.items.length||group.addons.length);";
const replacement = "const searchForces=Boolean(stockFilters.search)&&Boolean(group.items.length||group.addons.length);";
if (!text.includes(old)) throw new Error('Expected Task 3 searchForces expression not found.');
text = text.replace(old, replacement);
await writeFile(scriptPath, text);

const result = spawnSync('node', [scriptPath, 'run'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
