import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const scriptPath = '.automation/task-5.mjs';
let text = await readFile(scriptPath, 'utf8');

const unsafe = ` app=replaceOnce(app,"document.querySelectorAll('[data-edit-field], [data-edit-perk], [data-edit-correction], [data-inventory-quantity], [data-action=\\"character-edit-save\\"]').forEach(control => {","document.querySelectorAll('[data-edit-field], [data-edit-perk], [data-edit-correction], [data-inventory-quantity], [data-stock-step], [data-action=\\"character-edit-save\\"]').forEach(control => {",'editor stepper disabling');`;
const safe = ` app=replaceOnce(app,"const editingControls = '#detail-content select, [data-setup-owned], [data-setup-prestige], [data-setup-perk], [data-character-setup-perk], [data-character-setup-tier], [data-historical-ownership], [data-character-inventory-historical], #character-setup-bloodweb, #halloween-names, #hellraiser-names, #import-file';","const editingControls = '#detail-content select, [data-setup-owned], [data-setup-prestige], [data-setup-perk], [data-character-setup-perk], [data-character-setup-tier], [data-historical-ownership], [data-character-inventory-historical], #character-setup-bloodweb, #halloween-names, #hellraiser-names, #import-file, [data-stock-step]';",'editor stepper writer controls');`;
if (!text.includes(unsafe)) throw new Error('Expected unsafe Task 5 editor selector transformation not found.');
text = text.replace(unsafe, safe);

const oldDynamic = `  if(decrement)decrement.disabled=invalid||result.quantity===0;\\n  if(increment)increment.disabled=invalid||result.quantity===Number.MAX_SAFE_INTEGER;`;
const newDynamic = `  const blocked=editor.state!=='editing'||storageBlocked||Boolean(characterEditSession?.conflicted);\\n  if(decrement)decrement.disabled=blocked||invalid||result.quantity===0;\\n  if(increment)increment.disabled=blocked||invalid||result.quantity===Number.MAX_SAFE_INTEGER;`;
if (!text.includes(oldDynamic)) throw new Error('Expected Task 5 dynamic step control logic not found.');
text = text.replace(oldDynamic, newDynamic);

await writeFile(scriptPath, text);
const result = spawnSync('node', [scriptPath, 'run'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
