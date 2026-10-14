import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const scriptPath = '.automation/task-4.mjs';
let text = await readFile(scriptPath, 'utf8');
const old = "  assert.match(await page.locator('#detail-content').textContent(),new RegExp(item.effect.replace(/[.*+?^\\\\${}()|[\\\\]\\\\\\\\]/g,'\\\\\\\\$&').slice(0,24)));\\n";
const replacement = "  assert.ok((await page.locator('#detail-content').textContent()).includes(item.effect.slice(0,24)),'Effect summary appears in Details');\\n";
if (!text.includes(old)) throw new Error('Expected Task 4 generated regex assertion not found.');
text = text.replace(old, replacement);
await writeFile(scriptPath, text);

const result = spawnSync('node', [scriptPath, 'run'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
