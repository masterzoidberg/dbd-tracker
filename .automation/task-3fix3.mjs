import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const scriptPath = '.automation/task-3.mjs';
let text = await readFile(scriptPath, 'utf8');
const booleanOld = "const searchForces=Boolean(stockFilters.search)&&(group.items.length||group.addons.length);";
const booleanNew = "const searchForces=Boolean(stockFilters.search)&&Boolean(group.items.length||group.addons.length);";
if (!text.includes(booleanOld)) throw new Error('Expected Task 3 searchForces expression not found.');
text = text.replace(booleanOld, booleanNew);

const writeAnchor = " await writeFile(testPath,t);\n}";
const adaptation = ` t=t.replaceAll(" await page.locator('#inventory-map').selectOption('addons');"," await page.locator('#inventory-filters').evaluate(el=>el.open=true);\\n await page.locator('#inventory-map').selectOption('addons');");\n t=t.replace("assert.match(await page.locator('[data-stock-error]').first().textContent(),/Not saved/);","assert.match(await page.locator('#stock-error-'+addon.id).textContent(),/Not saved/);");\n await writeFile(testPath,t);\n}`;
if (!text.includes(writeAnchor)) throw new Error('Expected Task 3 red write anchor not found.');
text = text.replace(writeAnchor, adaptation);
await writeFile(scriptPath, text);

const result = spawnSync('node', [scriptPath, 'run'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
