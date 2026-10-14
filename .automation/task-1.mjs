import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const testPath = 'tests/inventory-interaction.test.js';
const sourcePath = 'src/inventory-interaction.js';

function run(command, args, { expectFailure = false } = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (expectFailure) {
    if (result.status === 0) throw new Error('RED gate unexpectedly passed.');
    console.log(`RED confirmed with exit ${result.status}.`);
    return;
  }
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}.`);
}

async function red() {
  let text = await readFile(testPath, 'utf8');
  const oldImport = "import { createQuantityInteraction, updateQuantityInput, acceptQuantityInput, visibleQuantityEntries, regroupQuantityEntries, quantityFocusAfterCommit } from '../src/inventory-interaction.js';";
  const newImport = "import { createQuantityInteraction, updateQuantityInput, acceptQuantityInput, visibleQuantityEntries, regroupQuantityEntries, quantityFocusAfterCommit, groupQuantityEntries, stepQuantityInput } from '../src/inventory-interaction.js';";
  if (!text.includes(oldImport)) throw new Error('Task 1 test import anchor not found.');
  text = text.replace(oldImport, newImport);
  text += `\n\ntest('family grouping keeps verified family order and family-local stock order', () => {\n  const familyEntities = [\n    {id:'map-zero',order:5,name:'Map Zero',familyId:'map',map:'items'},\n    {id:'key-addon-zero',order:3,name:'Key Add-on Zero',familyId:'key',map:'addons'},\n    {id:'key-zero',order:1,name:'Key Zero',familyId:'key',map:'items'},\n    {id:'key-positive',order:0,name:'Key Positive',familyId:'key',map:'items'},\n    {id:'key-addon-positive',order:2,name:'Key Add-on Positive',familyId:'key',map:'addons'},\n    {id:'map-positive',order:4,name:'Map Positive',familyId:'map',map:'items'},\n  ];\n  const families = [{id:'key',displayName:'Keys'},{id:'map',displayName:'Maps'}];\n  const state = createQuantityInteraction(familyEntities,{\n    'key-positive':2,'key-addon-positive':1,'map-positive':3,\n  });\n  const grouped = groupQuantityEntries(state, {}, families);\n  assert.deepEqual(grouped.map(group => group.family.id), ['key','map']);\n  assert.deepEqual(grouped[0].items.map(entity => entity.id), ['key-positive','key-zero']);\n  assert.deepEqual(grouped[0].addons.map(entity => entity.id), ['key-addon-positive','key-addon-zero']);\n  assert.deepEqual(grouped[1].items.map(entity => entity.id), ['map-positive','map-zero']);\n});\n\ntest('family grouping keeps pending and invalid zero-stock edits visible without reordering them', () => {\n  const familyEntities = [\n    {id:'key-positive',order:0,name:'Key Positive',familyId:'key',map:'items'},\n    {id:'key-zero',order:1,name:'Key Zero',familyId:'key',map:'items'},\n  ];\n  const families = [{id:'key',displayName:'Keys'}];\n  const base = createQuantityInteraction(familyEntities,{'key-positive':2});\n  const pending = updateQuantityInput(base,'key-zero','4');\n  assert.deepEqual(groupQuantityEntries(pending,{inStock:true},families)[0].items.map(entity=>entity.id),['key-positive','key-zero']);\n  const invalid = acceptQuantityInput(updateQuantityInput(base,'key-zero','bad'),'key-zero').state;\n  assert.equal(invalid.raw['key-zero'],'bad');\n  assert.deepEqual(groupQuantityEntries(invalid,{inStock:true},families)[0].items.map(entity=>entity.id),['key-positive','key-zero']);\n});\n\ntest('quantity stepping shares validation and respects zero and safe-integer boundaries', () => {\n  const one = [{id:'a',order:0,name:'Alpha',familyId:'key',map:'items'}];\n  const base = createQuantityInteraction(one,{});\n  const incremented = stepQuantityInput(base,'a',1);\n  assert.equal(incremented.error,null);\n  assert.equal(incremented.quantity,1);\n  assert.equal(incremented.state.raw.a,'1');\n  const zero = stepQuantityInput(base,'a',-1);\n  assert.equal(zero.quantity,0);\n  const maxState = createQuantityInteraction(one,{a:Number.MAX_SAFE_INTEGER});\n  assert.equal(stepQuantityInput(maxState,'a',1).quantity,Number.MAX_SAFE_INTEGER);\n  const invalidState = updateQuantityInput(base,'a','bad');\n  const invalid = stepQuantityInput(invalidState,'a',1);\n  assert.ok(invalid.error);\n  assert.equal(invalid.state.raw.a,'bad');\n});\n`;
  await writeFile(testPath, text);
}

async function green() {
  let text = await readFile(sourcePath, 'utf8');
  if (text.includes('export function groupQuantityEntries')) throw new Error('Task 1 source already contains grouping helper.');
  text += `\n\nexport function groupQuantityEntries(state, filters = {}, families = []) {\n  const visible = visibleQuantityEntries(state, filters);\n  return families.map(family => ({\n    family: structuredClone(family),\n    items: visible.filter(entity => entity.familyId === family.id && entity.map === 'items'),\n    addons: visible.filter(entity => entity.familyId === family.id && entity.map === 'addons'),\n  }));\n}\n\nexport function stepQuantityInput(state, id, delta) {\n  const accepted = acceptQuantityInput(state, id);\n  if (accepted.error) return accepted;\n  if (!Number.isSafeInteger(delta)) throw new Error('Quantity step must be a safe integer.');\n  const quantity = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, accepted.quantity + delta));\n  return acceptQuantityInput(updateQuantityInput(accepted.state, id, String(quantity)), id);\n}\n`;
  await writeFile(sourcePath, text);
}

if (process.argv[2] === 'run') {
  await red();
  run('node',['--test',testPath],{expectFailure:true});
  await green();
  run('node',['--test',testPath]);
  run('npm',['test']);
  await writeFile('.automation/commit-message.txt','Add family-local inventory presentation helpers\n');
}
