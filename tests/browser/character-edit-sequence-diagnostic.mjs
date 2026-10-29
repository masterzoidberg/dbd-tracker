import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smokeStage } from './smoke.mjs';
import { dashboardRegression } from './dashboard.mjs';
import { characterWorkspaceRegression } from './character-workspace.mjs';
import { killerPowerAddonsRegression } from './killer-power-addons.mjs';
import { characterSetupRegression } from './character-setup.mjs';
import { characterEditRegression } from './character-edit.mjs';

async function regression(page, origin, manifest) {
  await dashboardRegression(page, origin);
  await characterWorkspaceRegression(page, origin);
  await killerPowerAddonsRegression(page, origin, manifest);
  await characterSetupRegression(page, origin);
  try {
    await characterEditRegression(page, origin);
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      hash: location.hash,
      historyLength: history.length,
      workspaceIndex: history.state?.workspaceIndex ?? null,
      dirtyDialogOpen: Boolean(document.querySelector('#dirty-navigation')?.open),
      dirtyDialogText: document.querySelector('#dirty-text')?.textContent || '',
      notesValue: document.querySelector('[data-character-task-field="notes"]')?.value ?? null,
      activeElement: document.activeElement?.getAttribute?.('data-character-task-field') || document.activeElement?.id || document.activeElement?.tagName || null,
    }));
    console.error('CHARACTER_EDIT_SEQUENCE_STATE=' + JSON.stringify(state));
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await smokeStage(resolve(process.argv[2] || '.'), { channel: 'msedge', regression });
    console.log(result);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
