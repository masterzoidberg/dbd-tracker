import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { freshSave, syncGlobalInventories, inventoryTier, bloodwebEligible } from '../../src/model.js';
import { perks } from '../../data/catalog.js';
import { getFilterContext, perkFilterDefinitions, matchesPerkFilterState, perkFacetCounts, normalizeFilterState } from '../../src/perk-filters.js';

const fixture = freshSave();
Object.assign(fixture.characters['meg-thomas'], { owned: true, setupComplete: true, prestige: 1, favorite: true, bloodwebLevel: 25 });
fixture.characters['dwight-fairfield'].owned = true;
const general = perks.find(p => p.role === 'survivor' && p.general && !p.sourceCharacterId);
fixture.characters['meg-thomas'].perks[general.id] = 1;
const historical = perks.find(p => p.role === 'survivor' && p.historicalAvailability?.manualOwnership);
fixture.characters['meg-thomas'].perks[historical.id] = 2;
fixture.perkOverrides[historical.id] = { shrineTier: 1, legacyTier: 2 };
syncGlobalInventories(fixture);

async function seed(page, origin, save = fixture, route = 'manage/meg-thomas/legacy') {
  await page.evaluate(save => localStorage.setItem('dbdTrackerData', JSON.stringify(save)), save);
  await page.goto(origin + '/#' + route);
  await page.reload();
  await page.locator('#search').waitFor();
}
async function openRosterFilters(page) {
  const panel = page.locator('#collection-filters');
  if (!await panel.evaluate(node => node.open)) await panel.locator('summary').click();
}
async function navigate(page, route) {
  await page.evaluate(route => { location.hash = route; }, route);
  await page.waitForFunction(route => location.hash === '#' + route && document.querySelector('#breadcrumb').textContent === (route.startsWith('manage/') ? (route.includes('meg-thomas') || route.includes('dwight') ? 'SURVIVORS' : 'KILLERS') : route.replaceAll('-', ' ').toUpperCase()), route);
}
async function assertResults(page, context, state, save = fixture) {
  const expected = perks.filter(p => matchesPerkFilterState(save, p, context, state)).map(p => p.id).sort();
  assert.deepEqual(await page.locator('tbody [data-action="perk"]').evaluateAll(nodes => nodes.map(n => n.dataset.id).sort()), expected);
  assert.ok((await page.locator('#perk-results').textContent()).startsWith(expected.length + ' PERKS'));
}
async function assertFacets(page, context, state) {
  const counts = perkFacetCounts(fixture, context, state);
  for (const [group, options] of Object.entries(counts)) for (const [option, count] of Object.entries(options)) {
    assert.equal(Number(await page.locator(`[data-facet="${group}-${option}"]`).textContent()), count, `${group}/${option}`);
  }
}

export async function filteringInteractions(page, origin) {
  await seed(page, origin);
  assert.equal(await page.locator('#quick-bloodweb-available').count(), 1, 'New quick views must replace flat perk filters');
  const context = getFilterContext('manage/meg-thomas/legacy');
  let state = normalizeFilterState(context);
  const bytes = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  for (const quick of perkFilterDefinitions(context).quickViews) {
    await page.locator('#quick-' + quick.id).click();
    state.quick = quick.id;
    await assertResults(page, context, state);
  }
  await page.locator('#quick-bloodweb-available').click();
  state.quick = 'bloodweb-available';
  await page.locator('#sort').selectOption('source'); state.sort = 'source';
  await page.locator('#filters-trigger').click();
  await assertFacets(page, context, state);
  const checkbox = page.locator('#filter-effectiveTier-1');
  await checkbox.evaluate(n => { window.testCheckbox = n; });
  await checkbox.check(); state.groups.effectiveTier = ['1'];
  await page.locator('#filter-effectiveTier-2').check(); state.groups.effectiveTier.push('2');
  await page.locator('#filter-source-owned').check(); state.groups.source = ['owned'];
  await assertFacets(page, context, state);
  await assertResults(page, context, state);
  assert.equal(await page.locator('#filters-trigger').textContent(), 'Filters (2)');
  assert.equal(await page.locator('.filter-summary').count(), 2);
  assert.equal(await checkbox.evaluate(n => n === window.testCheckbox), true, 'Checkbox DOM must survive filtering');
  await page.locator('#perk-filter-panel').evaluate(n => { n.scrollTop = 100; });
  const scroll = await page.locator('#perk-filter-panel').evaluate(n => n.scrollTop);
  await page.locator('#filter-source-owned').focus();
  await page.keyboard.press('Space'); delete state.groups.source;
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filter-source-owned');
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.scrollTop), scroll);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filters-trigger');
  await page.locator('#summary-effectiveTier').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filter-effectiveTier-0');
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filters-trigger');
  await page.locator('#filters-trigger').click();
  await page.locator('#search').click();
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.matches(':popover-open')), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'search', 'Light dismiss preserves destination focus');
  await page.locator('#search').fill('Meg'); state.search = 'Meg';
  await page.locator('#search').evaluate(n => { n.focus(); n.setSelectionRange(1, 2); n.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.deepEqual(await page.locator('#search').evaluate(n => [n.selectionStart, n.selectionEnd]), [1, 2]);
  await page.locator('#filters-trigger').click();
  await assertFacets(page, context, state);
  await page.locator('#filter-source-locked').check(); state.groups.source = ['locked'];
  await assertResults(page, context, state);
  assert.equal(await page.locator('#filter-source-locked').isEnabled(), true, 'Zero population stays removable');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear Effective Tier', exact: true }).click(); delete state.groups.effectiveTier;
  assert.equal(await page.evaluate(() => document.activeElement.id), 'summary-source');
  await page.getByRole('button', { name: 'Clear Source Character', exact: true }).click(); delete state.groups.source;
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filters-trigger');
  await page.locator('#filters-trigger').click();
  await page.locator('#filter-origin-native').check(); state.groups.origin = ['native'];
  await page.locator('#perk-filter-panel [data-action="clear-advanced"]').click(); state.groups = {};
  assert.equal(await page.locator('#search').inputValue(), 'Meg');
  assert.equal(await page.locator('#sort').inputValue(), 'source');
  assert.equal(await page.locator('#quick-bloodweb-available').getAttribute('aria-pressed'), 'true');
  await page.locator('#filter-origin-native').check();
  await page.keyboard.press('Escape');
  await page.locator('#quick-owned').click();
  assert.equal(await page.locator('.filter-summary').count(), 0);
  assert.equal(await page.locator('#search').inputValue(), 'Meg');
  assert.equal(await page.locator('#sort').inputValue(), 'source');
  await page.locator('#filters-trigger').click();
  await page.locator('#filter-origin-native').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filter-origin-general');
  await page.keyboard.press('Escape');
  await page.locator('#filters-trigger').click();
  await navigate(page, 'killer-perks');
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.matches(':popover-open')), false);
  await navigate(page, 'manage/meg-thomas/legacy');
  assert.equal(await page.locator('#search').inputValue(), 'Meg');
  assert.equal(await page.locator('#quick-owned').getAttribute('aria-pressed'), 'true');
  await navigate(page, 'manage/dwight-fairfield/legacy');
  assert.equal(await page.locator('#search').inputValue(), '');
  await navigate(page, 'survivor-perks');
  state = normalizeFilterState(getFilterContext('survivor-perks'));
  for (const quick of perkFilterDefinitions(getFilterContext('survivor-perks')).quickViews) {
    await page.locator('#quick-' + quick.id).click(); state.quick = quick.id;
    await assertResults(page, getFilterContext('survivor-perks'), state);
  }
  await page.locator('#filters-trigger').click();
  await page.locator('#filter-globalTier-1').check(); state.groups.globalTier = ['1'];
  await assertFacets(page, getFilterContext('survivor-perks'), state);
  await page.keyboard.press('Escape');
  await page.locator('#quick-all').click();
  await page.locator(`[data-action="perk"][data-id="${historical.id}"]`).click();
  assert.equal(await page.locator('.historical-detail-note').textContent(), historical.historicalAvailability.note);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.locator('#filters-trigger').click();
  await page.locator('tbody [data-action="perk"]').first().click();
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.matches(':popover-open')), false);
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), bytes, 'UI state never writes progression');
  await page.locator('#filters-trigger').click();
  await page.locator('[data-action="character-setup-all"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.matches(':popover-open')), false, 'Setup closes filters');
  await page.locator('[data-action="character-setup-exit"]').first().click();
  await page.goto(origin + '/#survivor-perks');
  await page.locator('#filters-trigger').click();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'dbdTrackerData' })));
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.matches(':popover-open')), false, 'Full save-context refresh closes filters');
  await navigate(page, 'killer-perks');
  await page.locator('#quick-owned-by-my-characters').click();
  assert.ok((await page.locator('.empty').textContent()).includes('You do not own any killer characters yet'));
  await page.locator('.empty a').click();
  assert.equal(new URL(page.url()).hash, '#killers');
}

export async function focusAndLayouts(page, origin) {
  await seed(page, origin);
  await page.locator(`[data-action="perk"][data-id="${general.id}"]`).click();
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(n => n.id));
  assert.equal(new Set(ids).size, ids.length, 'Manager and detail controls need distinct stable IDs');
  await page.getByRole('button', { name: 'Close details', exact: true }).click();
  const eligible = perks.filter(p => p.role === 'survivor' && inventoryTier(fixture, 'meg-thomas', p.id) === 1 && bloodwebEligible(fixture, 'meg-thomas', p));
  await page.locator('#quick-needs-upgrade').click();
  const first = eligible.find(p => p.id === general.id) || eligible[0];
  const action = page.locator(`#tier-meg-thomas-${first.id}`);
  await action.click();
  assert.equal(await page.evaluate(() => document.activeElement.id), `tier-meg-thomas-${first.id}`);
  await action.click();
  assert.equal(await action.count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.disabled || document.activeElement === document.body), false, 'Disappearing action has usable focus');
  await page.locator('#search').fill(first.name);
  assert.equal(await page.locator('tbody tr').count(), 0);
  await seed(page, origin);
  await page.locator('#quick-needs-upgrade').click();
  await page.locator('#search').fill(first.name);
  await action.click(); await action.click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'perk-results', 'Last action falls back to result count');
  await seed(page, origin);
  await page.locator('#quick-all').click();
  await action.click(); await action.click();
  assert.equal(await action.isDisabled(), true);
  assert.equal(await page.evaluate(() => document.activeElement.disabled || document.activeElement === document.body), false);
  await seed(page, origin);
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'dbdTrackerData') throw new Error('fixture write failure'); return window.originalSetItem.call(this, key, value); }; });
  await action.click();
  assert.equal(await action.textContent(), 'I↑');
  assert.equal(await page.evaluate(() => document.activeElement.id), `tier-meg-thomas-${first.id}`);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);
  assert.equal(await page.locator('#save-status').textContent(), 'Save failed');
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });

  for (const width of [500, 700, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, origin);
    await page.locator('#filters-trigger').click();
    const panel = await page.locator('#perk-filter-panel').boundingBox();
    assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= width && panel.y + panel.height <= 800, `Panel bounds ${width}`);
    await page.locator('#filter-source-owned').check();
    await page.getByRole('button', { name: 'Close filters', exact: true }).click();
    for (const route of ['manage/meg-thomas/legacy', 'survivor-perks', 'survivors', 'killers', 'dashboard']) {
      await navigate(page, route);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Shell overflow at ${width}/${route}`);
      const boxes = await page.locator('.topbar button').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
      assert.ok(boxes.every(b => b.x >= 0 && b.right <= width), `Topbar bounds ${width}`);
      assert.ok(boxes[0].right <= boxes[1].x || boxes[0].bottom <= boxes[1].y || boxes[1].bottom <= boxes[0].y, `Topbar collision ${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page, origin, fixture, 'survivors');
  await page.locator('#search').fill('Meg');
  await openRosterFilters(page);
  await page.locator('#prestige-filter').selectOption('1');
  await openRosterFilters(page);
  await page.locator('[data-action="favorites-filter"]').click();
  await page.locator('#ownership-filter').selectOption('owned');
  await page.locator('#sort').selectOption('bloodweb');
  assert.equal(await page.locator('.character-card').count(), 1);
  const rosterSave = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await navigate(page, 'killers'); assert.equal(await page.locator('#search').inputValue(), '');
  await navigate(page, 'survivors');
  assert.equal(await page.locator('.character-card').count(), 1);
  assert.equal(await page.locator('#search').inputValue(), 'Meg');
  assert.equal(await page.locator('#sort').inputValue(), 'bloodweb');
  assert.match(await page.locator('[data-ownership-status]').textContent(), /Owned/i, 'Ownership remains visible without editing from the roster');
  assert.equal(await page.locator('[data-action="ownership"]').count(), 0, 'Roster ownership is not a mutation control');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), rosterSave, 'Roster navigation and filters leave account data unchanged');
}

export async function shellNavigationRegression(page, origin) {
  const destinations = [
    ['dashboard', 'Dashboard'],
    ['survivors', 'Survivors'],
    ['killers', 'Killers'],
    ['survivor-perks', 'Survivor perks'],
    ['killer-perks', 'Killer perks'],
    ['data', 'Data & backups'],
  ];
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });

  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, origin, fixture);
  assert.equal(await page.locator('.brand').isVisible(), true, 'Compact header retains product identity');
  assert.equal(await page.locator('#breadcrumb').isVisible(), true, 'Compact header retains the current destination');
  const shellType = await page.evaluate(() => ({
    route: parseFloat(getComputedStyle(document.querySelector('.topbar')).fontSize),
    status: parseFloat(getComputedStyle(document.querySelector('#save-status')).fontSize),
    action: parseFloat(getComputedStyle(document.querySelector('.topbar button')).fontSize),
    destination: parseFloat(getComputedStyle(document.querySelector('#global-nav a')).fontSize),
  }));
  assert.ok(shellType.route >= 11 && shellType.status >= 12 && shellType.action >= 12 && shellType.destination >= 14, `Shell labels and controls remain readable: ${JSON.stringify(shellType)}`);
  const compactChrome = await page.locator('#save-status, .topbar button').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { label: node.textContent.trim(), left: rect.left, right: rect.right, visible: rect.width > 0 && rect.height > 0 };
  }));
  const compactWidth = await page.evaluate(() => innerWidth);
  assert.equal(compactChrome.length, 3, 'Save status, Setup, and Export remain available');
  assert.ok(compactChrome.every(item => item.visible && item.left >= 0 && item.right <= compactWidth), `Compact status/actions fit the viewport: ${JSON.stringify(compactChrome)}`);

  await page.setViewportSize({ width: 1366, height: 768 });
  await seed(page, origin, fixture);
  await navigate(page, 'dashboard');
  assert.equal(await navigation.isVisible(), true, 'Wide laptop retains full labeled navigation');
  for (const [route, label] of destinations) {
    assert.equal(await navigation.getByRole('link', { name: new RegExp('^' + label) }).isVisible(), true, `${label} is labeled and reachable`);
  }

  await page.setViewportSize({ width: 1280, height: 768 });
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  assert.equal(await menu.isVisible(), true, 'Intermediate width releases the sidebar for content');
  assert.equal(await navigation.isVisible(), false, 'Compact navigation starts collapsed');
  await menu.focus();
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  assert.equal(await navigation.isVisible(), true);
  await page.keyboard.press('Tab');
  assert.equal(await navigation.getByRole('link').first().evaluate(node => node === document.activeElement), true, 'Tab enters the expanded navigation');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate(node => node === document.activeElement), true, 'Escape returns focus to Menu');

  await navigate(page, 'survivors');
  const before = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await page.evaluate(() => {
    window.__trackerSaveWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'dbdTrackerData') window.__trackerSaveWrites++;
      return original.call(this, key, value);
    };
  });
  for (const [route, label] of destinations) {
    await menu.click();
    const link = navigation.getByRole('link', { name: new RegExp('^' + label) });
    await link.click();
    await page.waitForFunction(route => location.hash === '#' + route, route);
    assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Successful route activation closes Menu');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main', 'Route activation moves focus to the main landmark');
    assert.equal(await page.locator('#global-nav a[aria-current="page"]').getAttribute('href'), '#' + route, 'Current destination stays identified');
    const clearance = await page.evaluate(() => {
      const main = document.querySelector('#main').getBoundingClientRect();
      const topbar = document.querySelector('.topbar').getBoundingClientRect();
      const stickyHeader = document.querySelector('.sidebar').getBoundingClientRect();
      return { mainTop: main.top, topbarBottom: topbar.bottom, stickyHeaderBottom: stickyHeader.bottom };
    });
    assert.ok(clearance.mainTop >= Math.max(clearance.topbarBottom, clearance.stickyHeaderBottom) - 1, `Route focus is not hidden under sticky chrome (${route}: ${JSON.stringify(clearance)})`);
  }
  assert.equal(await page.evaluate(() => window.__trackerSaveWrites), 0, 'Global navigation does not write account data');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before, 'Global navigation preserves the account save');

  for (const [width, height] of [[320, 800], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await menu.isVisible(), true, `Phone navigation remains labeled at ${width}px`);
    await menu.click();
    assert.equal(await navigation.isVisible(), true);
    for (const [, label] of destinations) assert.equal(await navigation.getByRole('link', { name: new RegExp('^' + label) }).isVisible(), true, `${label} remains reachable at ${width}px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal shell overflow at ${width}px`);
    await page.keyboard.press('Escape');
  }

  for (const width of [1280, 1320, 1360, 1366]) {
    await page.setViewportSize({ width, height: 768 });
    const compact = width <= 1320;
    assert.equal(await menu.isVisible(), compact, `Menu transition at ${width}px`);
    assert.equal(await navigation.isVisible(), !compact, `Sidebar transition at ${width}px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No shell overflow at ${width}px`);
    const contentWidth = await page.locator('#main').evaluate(node => node.clientWidth - parseFloat(getComputedStyle(node).paddingLeft) - parseFloat(getComputedStyle(node).paddingRight));
    if (!compact) assert.ok(contentWidth >= 1000, `Full sidebar leaves at least 1000px of task width at ${width}px (got ${contentWidth})`);
  }

  await page.setViewportSize({ width: 1366, height: 600 });
  assert.equal(await menu.isVisible(), true, 'Short laptop height uses compact navigation before the fixed sidebar is clipped');
  assert.equal(await navigation.isVisible(), false);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Short-height shell has no horizontal overflow');

  await page.setViewportSize({ width: 720, height: 900 });
  assert.equal(await menu.isVisible(), true, 'Narrow effective viewport uses the compact shell');
  await menu.focus();
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'Keyboard activates Menu');
  for (const [, label] of destinations) assert.equal(await navigation.getByRole('link', { name: new RegExp('^' + label) }).isVisible(), true, `${label} remains reachable at the enlarged-text reflow width`);
  await page.keyboard.press('Tab');
  assert.equal(await navigation.getByRole('link').first().evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#dashboard');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Keyboard route activation closes Menu');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  assert.equal(await page.evaluate(() => window.__trackerSaveWrites), 0, 'Keyboard route activation does not write account data');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), before);

  await menu.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await navigation.getByRole('link').first().evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Activating the current route dismisses Menu');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle', 'Current-route activation returns focus to the visible Menu trigger');

  await page.setViewportSize({ width: 1280, height: 768 });
  await seed(page, origin, freshSave(), 'survivors');
  await page.evaluate(() => { location.hash = '#character/meg-thomas/overview'; });
  await page.getByRole('button', { name: 'Edit notes', exact: true }).first().click();
  await page.locator('[data-character-task-field="notes"]').fill('Compact navigation draft');
  const taskBytes = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await navigation.getByRole('link').first().evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Stay', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dirty-navigation').evaluate(dialog => dialog.open), false, 'Escape closes the dirty-edit dialog');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true', 'Dialog Escape leaves the expanded Menu behind the dialog alone');
  await page.waitForFunction(() => document.activeElement.matches('#global-nav a'));
  assert.equal(await navigation.getByRole('link').first().evaluate(node => node === document.activeElement), true,
    'Dialog Escape restores focus to the navigation link that opened it');
  assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Compact navigation draft');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), taskBytes);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Stay', exact: true }).waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Stay dismisses compact Menu');
  await page.waitForFunction(() => document.activeElement.id === 'menu-toggle');
  assert.ok(page.url().endsWith('/overview'), 'Blocked compact-menu navigation leaves the current route in place');
  assert.equal(await page.locator('[data-character-task-field="notes"]').inputValue(), 'Compact navigation draft');
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), taskBytes, 'Staying in the task editor preserves the existing save');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('[data-character-task-field="notes"]').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), taskBytes, 'Cancel discards only the unsaved task draft');

  const skip = page.locator('.skip-link');
  await skip.focus();
  const bounds = await skip.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const contrast = await skip.evaluate(node => {
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const text = luminance(getComputedStyle(node).color);
    const background = luminance(getComputedStyle(node).backgroundColor);
    return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  });
  assert.ok(contrast >= 4.5, `Skip link text contrast remains at least 4.5:1 while hovered (got ${contrast.toFixed(2)}:1)`);

  await page.setViewportSize({ width: 1280, height: 768 });
  await page.goto(origin + '/');
  await page.getByRole('heading', { name: 'Account overview', exact: true }).waitFor();
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  assert.equal(await navigation.getByRole('link').first().evaluate(node => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false', 'Bare-root Dashboard activation dismisses Menu');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle', 'Bare-root Dashboard activation returns focus to Menu');
}

export async function filteringRegression(page, origin) {
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.goto(origin + '/#manage/meg-thomas/legacy');
  await page.locator('#search').fill('Meg');
  const before = await page.locator('tbody').textContent();
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#manage/meg-thomas/legacy', 'Skip must preserve route');
  assert.equal(await page.locator('tbody').textContent(), before);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  const skipClearance = await page.evaluate(() => ({ main: document.querySelector('#main').getBoundingClientRect().top,
    header: document.querySelector('.sidebar').getBoundingClientRect().bottom }));
  assert.ok(skipClearance.main >= skipClearance.header - 1, `Skip target clears sticky header: ${JSON.stringify(skipClearance)}`);
  await page.locator('#filters-trigger').click();
  assert.equal(await page.locator('#perk-filter-panel').getAttribute('popover'), 'auto');
  assert.equal(await page.locator('#perk-filter-panel').evaluate(n => n.closest('#main')), null);
  await page.locator('[data-filter-group="effectiveTier"][data-option="1"]').check();
  assert.equal(await page.locator('#filters-trigger').textContent(), 'Filters (1)');
  assert.equal(await page.locator('.filter-summary').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.option), '1');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'filters-trigger');
  const bytes = await page.evaluate(() => localStorage.getItem('dbdTrackerData'));
  await navigate(page, 'killer-perks');
  await navigate(page, 'manage/meg-thomas/legacy');
  assert.equal(await page.locator('#search').inputValue(), 'Meg');
  assert.equal(await page.locator('.filter-summary').count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('dbdTrackerData')), bytes);
  await page.reload();
  assert.equal(await page.locator('#search').inputValue(), '');
  assert.equal(await page.locator('.filter-summary').count(), 0);
  await navigate(page, 'survivor-perks');
  await page.locator('#quick-globally-locked').click();
  await page.locator('#search').fill('Bill');
  const libraryRows = await page.locator('tbody').textContent();
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).hash, '#survivor-perks');
  assert.equal(await page.locator('tbody').textContent(), libraryRows);
  assert.equal(await page.locator('#quick-globally-locked').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#search').inputValue(), 'Bill');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
}

if (process.argv[1]?.endsWith('filtering.mjs')) {
  const { smokeStage } = await import('./smoke.mjs');
  console.log(await smokeStage(resolve(process.argv[2] || 'release/runtime'), { channel: process.argv.includes('--chrome') ? 'chrome' : 'msedge', regression: async (page, origin) => {
    await filteringInteractions(page, origin);
    await filteringRegression(page, origin);
    await focusAndLayouts(page, origin);
    await shellNavigationRegression(page, origin);
  } }));
}
