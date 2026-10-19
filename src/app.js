import { characters, characterById, perks, perkById, catalogInfo, perkName, perkSearchText } from '../data/catalog.js';
import { freshSave, globalTier, isAvailable, unlockSource, inventoryTier, roleCharacters, rolePerks, characterStats, perkStats, parseSave, exportSave, setGlobalPerkUnlocked, syncGlobalInventories, completeCharacterSetup, automaticTier, recordedTier, ownedUnlockSource, bloodwebNextTier, bloodwebEligible, setHistoricalPerkTier } from './model.js';
import { TrackerStorage } from './storage.js';
import { parseCharacterWorkspaceRoute, characterWorkspaceHref } from './character-workspace.js';
import {inventoryEntities,inventoryEntityById,inventoryCatalogStatus,survivorInventorySource,killerPowerByCharacterId} from '../data/inventory-catalog.js';
import {inventoryIconPath,killerPowerIconPath} from './assets.js';
import {createQuantityInteraction,updateQuantityInput,acceptQuantityInput,visibleQuantityEntries,regroupQuantityEntries,quantityFocusAfterCommit,groupQuantityEntries,stepQuantityInput} from './inventory-interaction.js';
import { createCharacterEditSession, updateCharacterEditSession, buildCharacterEditCandidate, characterEditPreview } from './character-edit.js';
import { EditorGuard } from './editor.js';
import { setupView } from './setup.js';
import { characterSetupView } from './character-setup.js';
import { historicalPerkNote, historicalOwnershipControl } from './historical-perks.js';
import {derivePrestigeQueue,applyPrestigeQueueAction} from './prestige-queue.js';
import {suggestedP1Targets,recentCharacters,favoriteCharacters} from './dashboard-selectors.js';
import { correctPersonalPerkTier } from './model.js';
import assetManifest from '../data/asset-manifest.json' with { type: 'json' };
import { perkIconPath, characterPortraitPath, collectionPortraitPath } from './assets.js';
import { survivorInventoryCounts, killerAddonCount } from './survivor-collection.js';

import { getFilterContext, perkFilterDefinitions, matchesPerkFilterState, selectQuickView, toggleAdvancedOption, clearAdvancedFilters, activeAdvancedGroupCount, perkFacetCounts, createFilterRouteMemory } from './perk-filters.js';
import { CHARACTER_INVENTORY_CATEGORIES, CHARACTER_CARD_SIZES, DEFAULT_CHARACTER_CARD_SIZE, normalizeCharacterCardSize, characterInventoryCandidatePool, filterCharacterInventoryCandidates, characterNormalInventory, setCharacterPersonalTier, createCharacterInventorySession, syncCharacterInventorySession, markCharacterInventoryChanged, parseCharacterInventoryRoute } from './character-inventory.js';

const $ = selector => document.querySelector(selector);
const artworkUrl = path => path.split('/').map(encodeURIComponent).join('/');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roman = ['—', 'I', 'II', 'III'];
const date = value => value ? new Date(value).toLocaleString() : 'Not updated yet';
const editor = new EditorGuard(navigator.locks);
const store = new TrackerStorage({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, () => editor.assertWriter());
let save = freshSave();
let storageBlocked = false;
let initialized = false;
let migrationPending = false;
let modal = null;
let queueView = {expanded:false,role:'all'};
let queueTargetEditor = null;
let queueOpener = null;
let filters = { search: '', status: 'all', prestige: 'all', favorite: false, sort: 'name' };
let lastRoute = '';
let managerView = 'detailed';
const filterMemory = createFilterRouteMemory();
let panelContext = '';
let pendingImport = null;
let setupOpen = false;
let setupStep = 0;
let setupSearch = '';
let setupFilter = 'all';
let characterSetup = null;
let characterEditSession = null;
let characterEditViewState = { search: '', allRole: false };
let characterEditReturnRoute = null;
let stockSession = null;
let stockSessionKey = '';
let stockRendering = false;
let stockBlurPending = null;
let stockFilters = {map:'',rarity:'',search:'',inStock:false};
let selectedFamilyId = '';
let stockDetailOpener = null;
let killerDetailOpener = null;
let killerSession = null;
let killerSessionKey = '';
let killerBlurPending = null;
let workspaceHistoryIndex = 0;
let committedWorkspaceHash = location.hash || '#dashboard';
let restoringWorkspaceHistory = null;
history.replaceState({ ...history.state, workspaceIndex: 0 }, '', location.href);
let setupQueue = null;
let characterInventorySession = createCharacterInventorySession('');
const characterInventoryCardSizeStorageKey = 'dbdTrackerUi.characterCardSize';
const legacyCharacterCardSizeStorageKey = 'dbdTrackerUi.experimentCardSize';
const characterCardSizeLabels = { small: 'Small', medium: 'Medium', large: 'Large' };

function loadCharacterCardSize() {
  try {
    const stored = localStorage.getItem(characterInventoryCardSizeStorageKey) ?? localStorage.getItem(legacyCharacterCardSizeStorageKey);
    return normalizeCharacterCardSize(stored);
  } catch { return DEFAULT_CHARACTER_CARD_SIZE; }
}
function saveCharacterCardSize(size) {
  try { localStorage.setItem(characterInventoryCardSizeStorageKey, size); } catch { /* UI preference remains session-local if storage is unavailable. */ }
}
let characterCardSize = loadCharacterCardSize();

function message(text, error = false) {
  $('#message').hidden = !text;
  $('#message').textContent = text;
  $('#message').className = error ? 'error' : 'notice';
  const detailMessage = $('#detail-message');
  detailMessage.hidden = !text || !error || !$('#detail').open;
  detailMessage.textContent = detailMessage.hidden ? '' : text;
}

const editingActions = new Set(['favorite', 'ownership', 'cycle', 'character-inventory-set-tier', 'account-unlock-tier', 'import', 'restore', 'reset', 'delete-backup', 'setup-open', 'setup-p1', 'setup-next', 'setup-back']);
const editingControls = '#detail-content select, [data-setup-owned], [data-setup-prestige], [data-setup-perk], [data-character-setup-perk], [data-character-setup-tier], [data-historical-ownership], [data-character-inventory-historical], #character-setup-bloodweb, #halloween-names, #hellraiser-names, #import-file';
function requiresEditor(action) { return editingActions.has(action) || ['queue-add','queue-target','queue-remove','queue-move','queue-move-down','queue-save','queue-shortcut','queue-select'].includes(action) || (action?.startsWith('character-setup-') && action !== 'character-setup-exit'); }
function editorPresentation() {
  const editing = initialized && editor.state === 'editing';
  const text = !initialized ? 'Checking editing availability…' : editor.state === 'unavailable'
    ? 'Read-only: editing is unavailable because this browser could not provide Web Locks. Use a supported browser and retry.'
    : 'Read-only: another tracker window is editing. Close that window, then choose Enable editing.';
  $('#editor-notice').hidden = editing;
  $('#editor-reason').textContent = text + (!editing && migrationPending ? ' This view includes unsaved compatibility updates.' : '');
  $('[data-action="enable-editing"]').disabled = !initialized || editor.state === 'requesting';
  const controls = [...document.querySelectorAll(editingControls+', [data-inventory-quantity]'), ...[...document.querySelectorAll('[data-action]')].filter(button => requiresEditor(button.dataset.action))];
  controls.forEach(control => {
    if (!editing) {
      if (!control.hasAttribute('data-editor-disabled')) control.dataset.editorDisabled = String(control.disabled);
      control.disabled = true;
      control.title = text;
    } else if (control.hasAttribute('data-editor-disabled')) {
      control.disabled = control.dataset.editorDisabled === 'true';
      delete control.dataset.editorDisabled;
      control.title = '';
    }
  });
  document.querySelectorAll('[data-action="export"]').forEach(button => { button.disabled = !initialized || storageBlocked; });
  document.querySelectorAll('[data-edit-field], [data-edit-perk], [data-edit-correction], [data-inventory-quantity], [data-action="character-edit-save"]').forEach(control => {
    control.disabled = !editing || storageBlocked || Boolean(characterEditSession?.conflicted);
  });
  updateStockStepControls();
  if (characterEditSession) {
    $('#detail-content').querySelectorAll('select, [data-action="account-unlock-tier"], [data-action="cycle"]').forEach(control => { control.disabled = true; });
  }
  if (!initialized) $('#save-status').textContent = 'Checking editing availability';
  else if (!editing) $('#save-status').textContent = editor.state === 'unavailable' ? 'Editing unavailable' : 'Read-only';
  else if (storageBlocked) $('#save-status').textContent = 'Stored save needs recovery';
}
async function enableEditing() {
  if (editor.pending) return;
  const acquisition = editor.acquire();
  editorPresentation();
  await acquisition;
  // A retry never commits a draft or keeps a form based on the previous view.
  $('#detail').close(); modal = null; characterSetup = null; setupQueue = null;
  characterEditSession = null;
  setupOpen = false; pendingImport = null;
  try {
    const loaded = store.load({ persistMigration: editor.state === 'editing' });
    save = loaded.save; storageBlocked = false; migrationPending = loaded.migrationPending;
    message(loaded.warnings.join(' · '));
  } catch (error) {
    storageBlocked = true; migrationPending = false;
    message(`Stored data could not be loaded: ${error.message} The original save is untouched. Open Data & backups to export the original, import a valid save, or restore a readable backup.`, true);
  }
  initialized = true;
  $('#save-status').textContent = 'Saved locally';
  render();
  if(parseCharacterWorkspaceRoute(route())) $('#main').focus();
}

// Account setup remains available explicitly; character setup is offered on click.
setupOpen = false;

function commit(mutator, characterId) {
  if (storageBlocked) { message('Editing is disabled until you import a valid save. Your original stored data is preserved.', true); return false; }
  try {
    store.assertWriter();
    const next = structuredClone(save);
    mutator(next);
    syncGlobalInventories(next);
    next.updatedAt = new Date().toISOString();
    if (characterId) next.characters[characterId].updatedAt = next.updatedAt;
    save = store.save(next);
  } catch (error) { $('#save-status').textContent = 'Save failed'; message(`Could not save: ${error.message} The edit was not applied. Export a backup and check browser storage space/settings if needed.`, true); return false; }
  $('#save-status').textContent = 'Saved locally';
  if (!$('#detail-message').hidden) message('');
  render();
  return true;
}

function badge(tier, label = roman[tier]) { return `<span class="tier tier-${tier}">${esc(label)}</span>`; }
function globalBadge(perk) { return globalTier(save, perk) ? badge(globalTier(save, perk)) : perk.general ? '<span class="tier general">GENERAL</span>' : badge(0, 'LOCKED'); }
function perkArtwork(perk, size = 36) {
  const path = perkIconPath(perk.id, assetManifest);
  return `<span class="perk-art${path ? ' has-art' : ''}" aria-hidden="true"><span class="perk-diamond">◇</span>${path ? `<img data-perk-icon src="${esc(path)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">` : ''}</span>`;
}
function characterArtwork(character, size = 64) {
  const path = characterPortraitPath(character.id, assetManifest);
  const portraitSizeClass = size === 80 ? ' portrait-large' : size === 112 ? ' portrait-card' : '';
  return `<span class="character-portrait${portraitSizeClass}${path ? ' has-art' : ''}" aria-hidden="true"><span class="portrait-fallback"><svg viewBox="0 0 40 48" width="32" height="40"><circle cx="20" cy="13" r="9"/><path d="M3 46v-7a17 17 0 0 1 34 0v7z"/></svg></span>${path ? `<img data-character-portrait="${character.id}" src="${esc(path)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">` : ''}</span>`;
}
function collectionArtwork(character) {
  const path = collectionPortraitPath(character.id, assetManifest);
  return path ? `<img data-collection-hero-art src="${esc(path)}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : '';
}
function tierButton(characterId, perk, idPrefix = '') {
  const tier = inventoryTier(save, characterId, perk.id);
  const next = bloodwebNextTier(save, characterId, perk);
  return `<button id="${idPrefix}tier-${characterId}-${perk.id}" class="tier cycle tier-${tier}" data-action="cycle" data-character="${characterId}" data-perk="${perk.id}" ${next ? '' : 'disabled'} aria-label="${esc(perkName(save, perk))} on ${esc(characterById[characterId].name)}: ${tier ? `Tier ${roman[tier]}` : 'missing'}; ${next ? 'record next tier ' + roman[next] : tier === 3 ? 'Maxed' : 'Not available in the Bloodweb'}">${roman[tier]}<span class="cycle-hint">↑</span></button>`;
}
function pageHeading(eyebrow, title, subtitle, right = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${right}</div>`;
}
function sectionTitle(title, right = '') { return `<div class="section-title"><h2>${title}</h2>${right}</div>`; }
function inventoryRaritySlug(rarity) { return String(rarity).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function inventoryRarityBadge(entity) { const slug=inventoryRaritySlug(entity.rarity); return '<span class="inventory-rarity-badge inventory-rarity-'+slug+'" data-rarity="'+esc(entity.rarity)+'">'+esc(entity.rarity)+'</span>'; }
function inventoryFamily(entity) { return survivorInventorySource.itemFamilies.find(family=>family.id===entity.familyId) || {id:entity.familyId,displayName:entity.familyId}; }
function empty(text = 'No matches. Try a different search or filter.') { return `<div class="empty">${text}</div>`; }
function searchInput(placeholder) { return `<label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(filters.search)}"><kbd>/</kbd></label>`; }
function selectControl(id, label, options, selected) { return `<label class="select-label"><span>${label}</span><select id="${id}">${options.map(([value, name]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`; }
function filterPills(options, countFn, multiple = false) {
  const active = id => multiple ? id === 'all' ? !filters.perkStatuses?.length : !!filters.perkStatuses?.includes(id) : filters.status === id;
  return `<div class="filter-pills" aria-label="Filters">${options.map(([id, label]) => `<button data-action="${multiple ? 'perk-filter' : 'filter'}" data-filter="${id}" aria-pressed="${active(id)}" class="${active(id) ? 'selected' : ''}">${label}${countFn ? `<span>${countFn(id)}</span>` : ''}</button>`).join('')}</div>`;
}

function roleSummary(role) {
  const list = roleCharacters(role), owned = list.filter(c => save.characters[c.id].owned);
  const totalPrestige = owned.reduce((n, c) => n + save.characters[c.id].prestige, 0);
  return `<article class="summary-panel"><div class="summary-head"><span class="role-icon" aria-hidden="true">${role === 'survivor' ? '♙' : '♜'}</span><h2>${role === 'survivor' ? 'Survivors' : 'Killers'}</h2><a href="#${role}s">View collection ↗</a></div><div class="collection-total">${owned.length}<span>/ ${list.length}</span><small>CHARACTERS OWNED</small></div><div class="progress-track"><span style="width:${owned.length / list.length * 100}%"></span></div><div class="summary-grid"><div><strong>${list.length - owned.length}</strong><span>Locked</span></div><div><strong>${owned.filter(c => save.characters[c.id].prestige >= 1).length}</strong><span>Prestige 1+</span></div><div><strong>${owned.filter(c => save.characters[c.id].prestige >= 3).length}</strong><span>Prestige 3+</span></div></div><details><summary>More collection statistics</summary><div class="summary-grid"><div><strong>${totalPrestige}</strong><span>Total prestige</span></div><div><strong>${owned.length ? (totalPrestige / owned.length).toFixed(1) : '0.0'}</strong><span>Average prestige</span></div><div><strong>${owned.filter(c => save.characters[c.id].favorite).length}</strong><span>Favorites</span></div></div></details></article>`;
}
function perkSummary(role) {
  const list = rolePerks(role), available = list.filter(p => isAvailable(save, p)).length, tier3 = list.filter(p => globalTier(save, p) === 3).length;
  return `<article class="perk-summary"><div><span class="eyebrow">${role.toUpperCase()} · Account perk access</span><a href="#${role}-perks">Explore library ↗</a></div><div class="perk-summary-numbers"><strong>${available}<small>Account access</small></strong><span><b>${tier3}</b>Tier III</span><span><b>${list.length - available}</b>Locked</span><span><b>${list.length}</b>Total</span></div><div class="progress-track"><span style="width:${available / list.length * 100}%"></span></div><p class="panel-note">Account access is separate from personal character inventory.</p></article>`;
}
function prestigeChart(role) {
  const owned = roleCharacters(role).filter(c => save.characters[c.id].owned);
  const buckets = [0, 1, 2, 3].map(tier => owned.filter(c => Math.min(3, save.characters[c.id].prestige) === tier).length);
  return `<div class="prestige-chart"><h3>${role === 'survivor' ? 'Survivors' : 'Killers'}<span>${owned.length} owned</span></h3>${buckets.map((n, i) => `<div class="bar-row"><span>P${i}${i === 3 ? '+' : ''}</span><div class="bar-track"><div class="bar bar-${i}" style="width:${owned.length ? n / owned.length * 100 : 0}%"></div></div><b>${n}</b></div>`).join('')}</div>`;
}
function queueBenefit(row) {
  if(row.complete) return 'Target reached. Raise the target or remove the goal.';
  if(!row.character || !row.progress) return 'Character data unavailable; imported goal preserved.';
  const count=row.benefit.improvedNativeIds.length;
  if(!count) return 'Personal progression goal; no additional global perk tier.';
  return (row.entry.targetPrestige>3?'Earlier milestone on the way: ':'')+count+' native perk tiers improve at P'+row.benefit.globalTierMilestone+'.';
}
function queueControl(action,id,label,disabled=false,extra='') {
  return `<button id="${action}-${esc(id)}" data-action="${action}" data-id="${esc(id)}" ${action.startsWith('queue-move')?`aria-label="${label} ${esc(characterById[id]?.name||id)}"`:''} ${extra} ${disabled?'disabled':''}>${label}</button>`;
}
function openPrestigeTargetEditor(id,adding,opener) {
  store.assertWriter();
  if(storageBlocked) return;
  queueOpener=opener;
  if(!id){
    const candidates=characters.filter(c=>save.characters[c.id]?.owned&&!save.prestigeQueue.some(e=>e.characterId===c.id)).sort((a,b)=>a.name.localeCompare(b.name));
    $('#detail-content').innerHTML=dialogHeader('PRESTIGE QUEUE','Add character')+(candidates.length?`<label>Character<select id="queue-character">${candidates.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><button data-action="queue-select">Choose character</button>`:'<p>Mark a character owned to add a goal. All eligible characters may already be in your queue.</p>');
    $('#detail').showModal();editorPresentation();return;
  }
  const c=characterById[id],p=save.characters[id];
  if(!c||!p) throw new Error('Character data unavailable.');
  queueTargetEditor={id,adding};
  const target=adding?Math.max(1,p.prestige+1):save.prestigeQueue.find(e=>e.characterId===id)?.targetPrestige;
  $('#detail-content').innerHTML=dialogHeader('PRESTIGE QUEUE',(adding?'Add goal: ':'Edit target: ')+c.name)+`<p>Current P${p.prestige}. Target must exceed current Prestige.</p><label for="queue-target">Target Prestige</label><input id="queue-target" type="text" inputmode="numeric" value="${target}"><div class="queue-controls">${[1,3,6,9].map(n=>`<button data-action="queue-shortcut" data-target="${n}" ${n<=p.prestige?'disabled':''}>P${n}</button>`).join('')}</div><p id="queue-target-error" role="alert"></p><button data-action="queue-save">Save target</button><button data-action="close">Cancel</button>`;
  if(!$('#detail').open) $('#detail').showModal();
  editorPresentation();$('#queue-target').focus();
}
function commitPrestigeQueueAction(action) {
  store.assertWriter();
  const candidate=structuredClone(save);
  if(!applyPrestigeQueueAction(candidate,action)) return false;
  return commit(next=>{applyPrestigeQueueAction(next,action);});
}
function prestigeQueueRow(row,{management=false}={}) {
  const id=row.entry.characterId,p=row.progress;
  const name=row.character?.name||id;
  return `<li value="${row.index+1}" data-prestige-queue-row data-queue-position="${row.index+1}" data-character-id="${esc(id)}"><div>${row.character?`<a data-dashboard-character-link href="${characterWorkspaceHref(id,'overview')}">${esc(name)}</a>`:`<strong>${esc(name)}</strong>`}<p>${row.character?row.character.role:'Unknown character'} · ${p?'P'+p.prestige+' · Bloodweb '+p.bloodwebLevel:'Progress unavailable'} → Target P${row.entry.targetPrestige}</p><p>${row.unavailable?'Unavailable'+(row.character?' · Not owned':''): 'Available'}${row.complete?' · Complete':row.complete===false?' · Incomplete':''}</p>${management?`<p>${queueBenefit(row)}</p><div class="queue-controls">${row.character&&p?queueControl('queue-target',id,'Edit target'):''}${queueControl('queue-remove',id,'Remove')}${queueControl('queue-move',id,'Move Up',queueView.role!=='all'||row.index===0,'data-direction="-1"')}${queueControl('queue-move-down',id,'Move Down',queueView.role!=='all'||row.index===save.prestigeQueue.length-1,'data-direction="1"')}</div>`:''}</div></li>`;
}
function prestigeQueuePanel() {
  const {rows,focus}=derivePrestigeQueue(save);
  const visible=queueView.expanded?rows.filter(r=>queueView.role==='all'||r.character?.role===queueView.role):rows.filter(r=>r.index<3||r===focus);
  const state=!rows.length?'Choose the characters you want to work on next.':focus?'':rows.some(r=>r.unavailable)?'No available unfinished goals. Unavailable goals remain preserved.':'All queue targets are complete.';
  return `<section class="panel" data-prestige-queue>${sectionTitle('My Prestige Queue')}<p>${state}</p>${focus?`<div data-current-focus data-character-id="${focus.entry.characterId}"><h3>Current Focus · Position ${focus.index+1}</h3><a data-dashboard-character-link href="${characterWorkspaceHref(focus.entry.characterId,'overview')}">Continue with ${esc(focus.character.name)}</a><p>P${focus.progress.prestige} · Bloodweb ${focus.progress.bloodwebLevel} → Target P${focus.entry.targetPrestige}</p><p>${queueBenefit(focus)}</p></div>`:''}<button id="queue-add" data-action="queue-add">Add character</button><button data-action="queue-manage" aria-expanded="${queueView.expanded}">${queueView.expanded?'Close management':'Manage Queue'}</button>${queueView.expanded?`<div class="filter-pills" aria-label="Queue role">${[['all','All'],['survivor','Survivors'],['killer','Killers']].map(([role,label])=>`<button data-action="queue-filter" data-role="${role}" aria-pressed="${queueView.role===role}">${label}</button>`).join('')}</div>${queueView.role!=='all'?'<p>Show All to change global order.</p>':''}`:''}<ol class="prestige-queue-list">${visible.map(row=>prestigeQueueRow(row,{management:queueView.expanded})).join('')}</ol>${queueView.expanded&&!visible.length?'<p>No goals for this role.</p><button data-action="queue-filter" data-role="all">Show All</button>':''}${!characters.some(c=>save.characters[c.id]?.owned)?'<p>Mark a character owned to add a goal.</p>':''}</section>`;
}
function dashboard() {
  const targets=suggestedP1Targets(save),recent=recentCharacters(save),favorites=favoriteCharacters(save);
  const link=c=>`<a data-dashboard-character-link href="${characterWorkspaceHref(c.id,'overview')}">${esc(c.name)}</a>`;
  return pageHeading('YOUR PROGRESSION','Account overview','Choose your next goal or continue a recent edit.')+
    `<details class="catalog-note"><summary>Perk catalog 10.1.2a</summary><p>${catalogInfo.detail}</p><a href="#data">About your data</a></details>`+
    (!save.setupComplete?'<div class="setup-launch"><button data-action="setup-open">Account setup →</button></div>':'')+
    `<div class="two-column dashboard-actions" data-dashboard-section="actions">${prestigeQueuePanel()}<section class="panel">${sectionTitle('Continue where you left off')}<p class="muted">Recently edited · last 5 changes</p>${recent.length?recent.map(c=>`<div class="recent-item">${link(c)}<span>P${save.characters[c.id].prestige} · Bloodweb ${save.characters[c.id].bloodwebLevel}${save.characters[c.id].owned?'':' · Not owned'}</span><time datetime="${esc(save.characters[c.id].updatedAt)}">${date(save.characters[c.id].updatedAt)}</time></div>`).join(''):empty('No recent edits. Open a character to record progress.')}</section></div>`+
    `<section class="panel" data-dashboard-section="suggestions">${sectionTitle('Suggested P1 targets')}<p class="muted">Ranked by native perks still globally locked.</p>${targets.length?targets.map(({character:c,missing})=>`<div class="dashboard-suggestion">${link(c)}<span>${c.role} · Bloodweb ${save.characters[c.id].bloodwebLevel} · +${missing} unlocks</span>${save.prestigeQueue.some(e=>e.characterId===c.id)?'<span class="tag">In queue</span>':`<button data-action="queue-add" data-id="${c.id}">Add ${esc(c.name)} to queue</button>`}</div>`).join(''):empty(characters.some(c=>save.characters[c.id].owned)?'No remaining P1 unlock suggestions.':'Mark characters owned to see P1 suggestions.')}</section>`+
    `<div class="two-column" data-dashboard-section="collection">${roleSummary('survivor')}${roleSummary('killer')}</div>`+
    `<div class="two-column perk-summary-row" data-dashboard-section="perks">${perkSummary('survivor')}${perkSummary('killer')}</div>`+
    `<section class="panel" data-dashboard-section="distribution">${sectionTitle('Prestige distribution','<span class="muted">Owned characters</span>')}<div class="two-column charts">${prestigeChart('survivor')}${prestigeChart('killer')}</div><p class="panel-note">P1 → Tier I · P2 → Tier II · P3+ → Tier III global unlocks</p></section>`+
    `<details class="panel" data-dashboard-section="favorites"><summary>Favorite characters (${favorites.length})</summary><div class="favorite-links">${favorites.map(c=>`${link(c)} · P${save.characters[c.id].prestige}${save.characters[c.id].owned?'':' · Not owned'}`).join('')||'No favorites yet.'}</div></details>`;
}

function characterCollectionCard(c) {
  const progress = save.characters[c.id], stats = characterStats(save, c.id);
  const survivor = c.role === 'survivor';
  const stock = survivor ? survivorInventoryCounts(save, c.id) : null;
  const addonTypes = survivor ? stock.addons : killerAddonCount(save, c.id);
  const workspace = characterWorkspaceHref(c.id, 'overview');
  const stockSummary = survivor
    ? `<span><b>${stock.items}</b> Items</span><span><b>${stock.addons}</b> Add-ons</span>`
    : `<span><b>${addonTypes}</b> Add-ons</span>`;
  return `<article class="character-card character-collection-card ${c.role}-collection-card${progress.owned ? '' : ' locked-card'}" data-character-id="${c.id}"><div class="character-card-hero" aria-hidden="true">${collectionArtwork(c)}</div><div class="character-card-content"><div class="character-card-top"><a class="character-name" href="${workspace}" data-id="${c.id}"><span>${esc(c.name)}</span></a><button class="favorite-button ${progress.favorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${c.id}" aria-pressed="${progress.favorite}" aria-label="Favorite ${esc(c.name)}">${progress.favorite ? '★' : '☆'}</button></div><button class="ownership ${progress.owned ? 'is-owned' : ''}" data-action="ownership" data-id="${c.id}" aria-pressed="${progress.owned}"><span class="ownership-dot" aria-hidden="true"></span><span>${progress.owned ? 'OWNED' : 'LOCKED'}</span><span class="toggle-track" aria-hidden="true"><span></span></span></button><div class="character-progress"><a class="prestige large" href="${workspace}">P${progress.prestige}</a><div class="collection-bloodweb"><div><span>Bloodweb</span><strong data-bloodweb-value>${progress.bloodwebLevel} <small>/ 50</small></strong></div><span class="collection-bloodweb-track" aria-hidden="true"><span style="width:${progress.bloodwebLevel / 50 * 100}%"></span></span></div></div><section class="native-perks" data-native-perks aria-label="Native perks"><h3>NATIVE PERKS <span>OWNED</span></h3>${c.nativePerkIds.map(id => `<button class="native-row" data-action="perk" data-id="${id}"><span>${esc(perkName(save, perkById[id]))}</span>${badge(inventoryTier(save, c.id, id))}</button>`).join('')}</section><div class="collection-summary" data-collection-summary><div class="collection-summary-row"><span><b>${stats.owned} / ${stats.total}</b> Perks</span><span><b>${stats.tier3}</b> Tier III</span></div><div class="collection-summary-row">${stockSummary}</div></div><a class="manage-button collection-workspace-action" data-open-workspace href="${workspace}">Open workspace <span aria-hidden="true">→</span></a></div></article>`;
}
function characterMatches(c, status = filters.status) {
  const p = save.characters[c.id];
  return (status === 'all' || (status === 'owned' ? p.owned : !p.owned)) && (filters.prestige === 'all' || (filters.prestige === '3' ? p.prestige >= 3 : p.prestige === Number(filters.prestige))) && (!filters.favorite || p.favorite) && c.name.toLowerCase().includes(filters.search.toLowerCase());
}
function collection(role) {
  const list = roleCharacters(role);
  const visible = list.filter(c => characterMatches(c));
  visible.sort((a, b) => {
    const pa = save.characters[a.id], pb = save.characters[b.id];
    const order = { 'prestige-desc': pb.prestige - pa.prestige, 'prestige-asc': pa.prestige - pb.prestige, bloodweb: pb.bloodwebLevel - pa.bloodwebLevel, perks: characterStats(save, b.id).owned - characterStats(save, a.id).owned, recent: (pb.updatedAt || '').localeCompare(pa.updatedAt || '') }[filters.sort];
    return order || a.name.localeCompare(b.name);
  });
  const cards = visible.map(characterCollectionCard).join('');
  return pageHeading('CHARACTER COLLECTION', role === 'survivor' ? 'Survivors' : 'Killers', 'Track your collection and the next step through the Bloodweb.', `<div class="heading-count">${list.filter(c => save.characters[c.id].owned).length}<span>/ ${list.length} owned</span></div>`) + `<section class="collection-controls"><div class="toolbar">${searchInput('Search characters…')}${selectControl('prestige-filter', 'Prestige', [['all', 'Any prestige'], ['0', 'P0'], ['1', 'P1'], ['2', 'P2'], ['3', 'P3+']], filters.prestige)}<button data-action="favorites-filter" class="${filters.favorite ? 'selected' : ''}" aria-pressed="${filters.favorite}">★ Favorites</button>${selectControl('sort', 'Sort', [['name', 'Name'], ['prestige-desc', 'Prestige ↓'], ['prestige-asc', 'Prestige ↑'], ['bloodweb', 'Bloodweb ↓'], ['perks', 'Perks owned ↓'], ['recent', 'Recently updated']], filters.sort)}</div>${filterPills([['all', 'All characters'], ['owned', 'Owned'], ['locked', 'Locked']], status => list.filter(c => characterMatches(c, status)).length)}</section><div class="results-label">${visible.length} CHARACTERS<span>Click a name or prestige badge to edit</span></div><div class="character-grid character-collection-grid ${role}-collection-grid">${cards}</div>${visible.length ? '' : empty()}`;
}

function perkMatches(perk) {
  return matchesPerkFilterState(save, perk, getFilterContext(route()), filters);
}
function perkList(role, characterId) {
  return rolePerks(role).filter(p => perkMatches(p, characterId)).sort((a, b) => {
    let delta = 0;
    if (filters.sort === 'source') delta = a.sourceCharacterName.localeCompare(b.sourceCharacterName);
    if (filters.sort === 'tier') delta = inventoryTier(save, characterId, b.id) - inventoryTier(save, characterId, a.id);
    if (filters.sort === 'global') delta = globalTier(save, b) - globalTier(save, a);
    return delta || perkName(save, a).localeCompare(perkName(save, b));
  });
}
function sourceCell(perk) {
  const source = save.characters[perk.sourceCharacterId];
  return `<span class="source-name">${esc(perk.sourceCharacterName)}</span>${source ? `<small>${source.owned ? 'Owned' : 'Locked'} <span>· P${source.prestige}</span></small>` : '<small>Available to everyone</small>'}`;
}
function perkTable(list, characterId) {
  return `<div class="table-scroll"><table><thead><tr><th>Perk</th><th>Source character / Prestige</th><th>Global unlock tier / Source</th>${characterId ? '<th class="tier-column">Owned tier / Source</th><th>Next Bloodweb tier</th>' : '<th>Owned</th><th>Tier III</th><th>Missing</th>'}</tr></thead><tbody>${list.map(perk => {
    const stats = characterId ? null : perkStats(save, perk);
    const next = characterId ? bloodwebNextTier(save, characterId, perk) : null;
    const nativeOnly = characterId && characterById[characterId].nativePerkIds.includes(perk.id) && !isAvailable(save, perk);
    return `<tr><td><button class="perk-name" data-action="perk" data-id="${perk.id}">${perkArtwork(perk)}${esc(perkName(save, perk))}</button></td><td>${sourceCell(perk)}${historicalPerkNote(perk)}</td><td><div class="global-cell">${nativeOnly ? badge(0, 'NO GLOBAL TIER') : globalBadge(perk)}<small>${nativeOnly ? 'Character only' : unlockSource(save, perk)}${perk.general && !globalTier(save, perk) ? ' · No auto-owned tier' : ''}</small></div></td>${characterId ? `<td class="tier-column">${tierButton(characterId, perk)}<small>${esc(ownedUnlockSource(save, characterId, perk))}</small>${historicalOwnershipControl(save, characterId, perk)}</td><td>${next ? roman[next] : inventoryTier(save, characterId, perk.id) === 3 ? 'Maxed' : 'Not available'}</td>` : `<td>${stats.owned}<span class="muted"> / ${stats.total}</span></td><td>${stats.tier3}</td><td>${stats.missing}</td>`}</tr>`;
  }).join('')}</tbody></table>${list.length ? '' : perkEmpty()}</div>`;
}
function compactPerks(list, characterId) {
  return `<div class="compact-perks">${list.map(perk => {
    const tier = inventoryTier(save, characterId, perk.id), next = bloodwebNextTier(save, characterId, perk);
    const inventory = save.characters[characterId].perks;
    const recorded = Object.hasOwn(inventory, perk.id) ? inventory[perk.id] ? roman[inventory[perk.id]] : 'Not Owned' : 'Not Confirmed';
    return `<div class="compact-perk" data-perk="${perk.id}"><button class="perk-name" data-action="perk" data-id="${perk.id}">${perkArtwork(perk)}<span>${esc(perkName(save, perk))}</span></button><div class="compact-tier"><small>Effective: ${tier ? roman[tier] : 'None'}</small>${tierButton(characterId, perk)}<small>${next ? 'Next: ' + roman[next] : tier === 3 ? 'Maxed' : 'Not available'}</small></div>${perk.historicalAvailability?.manualOwnership ? `<div class="compact-history"><small>Recorded: ${recorded} · Effective: ${tier ? roman[tier] : 'None'}</small>${historicalOwnershipControl(save, characterId, perk)}</div>` : ''}</div>`;
  }).join('')}${list.length ? '' : perkEmpty()}</div>`;
}

const characterInventoryCategoryLabels = { personal: 'Native perks', general: 'General', unlocked: 'Unlocked', retained: 'Retained on this character' };

function characterInventoryBadges(row) {
  const labels = [characterInventoryCategoryLabels[row.primaryCategory]];
  if (row.primaryCategory !== 'personal' && row.reasons.includes('personal')) labels.push('Personal');
  if (row.primaryCategory !== 'general' && row.reasons.includes('general')) labels.push('General');
  labels.push(...row.unlockReasons);
  return [...new Set(labels.filter(Boolean))].map(label => `<span class="character-inventory-badge">${esc(label)}</span>`).join('');
}

function characterInventoryRecordedLabel(characterId, perk) {
  const inventory = save.characters[characterId]?.perks || {};
  if (!Object.hasOwn(inventory, perk.id)) return 'Not recorded';
  const tier = inventory[perk.id];
  return tier ? `Tier ${roman[tier]}` : 'Explicitly not owned';
}

function characterInventoryExplanation(row, character) {
  if (row.primaryCategory === 'personal') return `Personal to ${character.name}; it remains in this character's inventory regardless of global unlock state.`;
  if (row.primaryCategory === 'general') return 'Role-appropriate General perk that can naturally appear in this Bloodweb.';
  if (row.primaryCategory === 'unlocked') return `Available through account progression${row.unlockReasons.length ? ` (${row.unlockReasons.join(' · ')})` : ''}.`;
  return 'Retained on this character from a recorded personal or historical copy, even though current account rules do not explain it.';
}

function characterInventoryCardSizeControl() {
  return `<div class="character-inventory-card-size-control" role="group" aria-label="Card size"><span>Card size</span>${CHARACTER_CARD_SIZES.map(size => `<button type="button" data-action="character-inventory-card-size" data-size="${size}" aria-pressed="${characterCardSize === size}" class="${characterCardSize === size ? 'selected' : ''}">${characterCardSizeLabels[size]}</button>`).join('')}</div>`;
}

function characterInventoryGridClass() {
  return `card-size-${characterCardSize}`;
}

function characterPerkCard(row, characterId, selected = false) {
  const tier = row.effectiveTier;
  const changed = characterInventorySession.changedPerkIds.has(row.perk.id);
  const name = perkName(save, row.perk);
  const tierClass = tier ? `perk-tier-${tier}` : 'perk-tier-none';
  return `<button class="perk-card ${tierClass}${tier === 0 ? ' perk-card-unrecorded' : ''}${selected ? ' is-selected' : ''}${changed ? ' changed-this-update' : ''}" data-action="character-inventory-select" data-character="${characterId}" data-perk="${row.perk.id}" aria-pressed="${selected}" aria-label="${esc(name)}: effective Tier ${esc(roman[tier])}"><span class="perk-card-art">${perkArtwork(row.perk, 78)}</span><span class="perk-card-content"><span class="perk-card-tier-line"><span class="perk-card-tier">${roman[tier]}</span>${tier === 0 ? '<span class="perk-card-unrecorded-label">UNRECORDED</span>' : ''}${changed ? '<span class="perk-card-changed">Changed this update</span>' : ''}</span><strong>${esc(name)}</strong><span class="perk-card-badges">${characterInventoryBadges(row)}</span></span></button>`;
}

function historicalCharacterInventoryControl(characterId, perk) {
  const inventory = save.characters[characterId].perks;
  const confirmed = Object.hasOwn(inventory, perk.id);
  const tier = inventory[perk.id] ?? 0;
  const floor = recordedTier(save, characterId, perk.id);
  const options = [['', 'Not Confirmed'], [0, 'Not Owned'], [1, 'Tier I'], [2, 'Tier II'], [3, 'Tier III']];
  return `<label class="character-inventory-history-control">Historical record<select data-character-inventory-historical="${perk.id}" data-character="${characterId}" aria-label="Historical ownership of ${esc(perkName(save, perk))} on ${esc(characterById[characterId].name)}">${options.map(([value, label]) => `<option value="${value}" ${(confirmed ? value === tier : value === '') ? 'selected' : ''} ${(value === '' && confirmed) || (value !== '' && value < floor) ? 'disabled' : ''}>${label}</option>`).join('')}</select></label>`;
}

function characterInventoryTierButtons(row, characterId) {
  const name = perkName(save, row.perk);
  return `<div class="character-inventory-tier-controls" role="group" aria-label="Set current tier for ${esc(name)}">${[['none', 'Not recorded', 0], ['1', 'I', 1], ['2', 'II', 2], ['3', 'III', 3]].map(([value, label, tier]) => `<button data-action="character-inventory-set-tier" data-character="${characterId}" data-perk="${row.perk.id}" data-tier="${value}" aria-label="Set ${esc(name)} to ${tier ? `Tier ${label}` : label}" aria-pressed="${row.recordedTier === tier}" ${tier && tier < row.automaticMinimum ? 'disabled title="Below the automatic minimum"' : ''}>${label}</button>`).join('')}</div>`;
}

function characterInventoryQuickCard(row, characterId, selected) {
  const open = characterInventorySession.quickPerkId === row.perk.id && !row.isHistorical;
  return `<div class="character-inventory-card-anchor">${characterPerkCard(row, characterId, selected)}${open ? `<div class="character-inventory-quick-picker" role="group" aria-label="Quick tier picker for ${esc(perkName(save, row.perk))}"><strong>${esc(perkName(save, row.perk))}</strong>${characterInventoryTierButtons(row, characterId)}</div>` : ''}</div>`;
}

function closeCharacterInventoryQuickPicker(restoreFocus = false) {
  const perkId = characterInventorySession.quickPerkId;
  characterInventorySession = { ...characterInventorySession, quickPerkId: null };
  $('.character-inventory-quick-picker')?.remove();
  if (restoreFocus && perkId) $(`.perk-card[data-perk="${perkId}"]`)?.focus();
}

function positionCharacterInventoryQuickPicker() {
  const picker = $('.character-inventory-quick-picker');
  if (!picker) return;
  const card = picker.parentElement.querySelector('.perk-card').getBoundingClientRect();
  const below = window.innerHeight - card.bottom;
  const above = card.top;
  picker.classList.toggle('opens-above', below < picker.offsetHeight + 8 && above > below);
}

function characterInventoryTierEditor(row, characterId) {
  const perk = row.perk;
  if (row.isHistorical) return `${historicalCharacterInventoryControl(characterId, perk)}<p class="character-inventory-editor-note">Historical ownership keeps the existing Not Confirmed / explicit zero distinction and cannot be downgraded through this workflow.</p>`;
  return `${characterInventoryTierButtons(row, characterId)}${row.automaticMinimum ? `<p class="character-inventory-editor-note">Automatic minimum: Tier ${roman[row.automaticMinimum]}. Clearing the recorded copy keeps that effective minimum.</p>` : '<p class="character-inventory-editor-note">No automatic minimum. Not recorded means this perk is absent from this character\'s tracked inventory.</p>'}`;
}

function characterInventoryEditor(row, characterId) {
  if (!row) return '<aside class="character-inventory-editor"><p class="empty">Select a perk to inspect its provenance and set its current tier.</p></aside>';
  const character = characterById[characterId];
  const perk = row.perk;
  return `<aside class="character-inventory-editor" data-character-inventory-detail><div class="character-inventory-editor-art">${perkArtwork(perk, 100)}</div><div class="eyebrow">SELECTED PERK</div><h2>${esc(perkName(save, perk))}</h2><div class="character-inventory-editor-badges">${characterInventoryBadges(row)}</div><div class="character-inventory-effective"><span>EFFECTIVE TIER</span>${badge(row.effectiveTier)}<small>What you compare against DBD</small></div><dl class="character-inventory-editor-facts"><div><dt>Recorded tier</dt><dd>${esc(characterInventoryRecordedLabel(characterId, perk))}</dd></div><div><dt>Automatic minimum</dt><dd>${row.automaticMinimum ? roman[row.automaticMinimum] : 'None'}</dd></div><div><dt>Why it appears</dt><dd>${esc(characterInventoryExplanation(row, character))}</dd></div><div><dt>Source</dt><dd>${esc(perk.sourceCharacterName)}</dd></div></dl><h3>Set current tier</h3>${characterInventoryTierEditor(row, characterId)}</aside>`;
}

function characterInventory(id) {
  const character = characterById[id];
  const rows = characterNormalInventory(save, id);
  const maxed = rows.filter(row => row.effectiveTier === 3).length;
  const upgradable = rows.filter(row => bloodwebEligible(save, id, row.perk)).length;
  return `<div class="section-title"><h2>Perks</h2><a class="primary button-link character-inventory-update-action" href="${characterWorkspaceHref(id, 'perks', 'update')}">Update Inventory</a></div><section class="character-inventory-intro"><div><strong>${rows.length} perks tracked</strong><span>${maxed} maxed${upgradable ? ` · ${upgradable} can upgrade` : ''}</span></div><p>Your effective perk inventory. Use Update Inventory to compare and sync with Dead by Daylight.</p><div class="character-inventory-size">${characterInventoryCardSizeControl()}</div></section><section class="character-inventory-grid ${characterInventoryGridClass()}" aria-label="${esc(character.name)} effective perk inventory">${rows.length ? rows.map(row => characterPerkCard(row, id)).join('') : empty('No effective perks are currently tracked for this character.')}</section>`;
}

function characterInventoryUpdate(id) {
  const character = characterById[id];
  const candidates = characterInventoryCandidatePool(save, id, { allRole: characterInventorySession.allRole });
  const visible = filterCharacterInventoryCandidates(save, id, candidates, characterInventorySession);
  const selected = visible.find(row => row.perk.id === characterInventorySession.selectedPerkId) || visible[0] || null;
  if (selected && characterInventorySession.selectedPerkId !== selected.perk.id) characterInventorySession = { ...characterInventorySession, selectedPerkId: selected.perk.id };
  const unrecorded = candidates.filter(row => row.effectiveTier === 0).length;
  const changed = characterInventorySession.changedPerkIds.size;
  return `<a class="back-link" href="${characterWorkspaceHref(id, 'perks')}">← ${esc(character.name)} inventory</a>${pageHeading('UPDATE INVENTORY', `${esc(character.name)} · Reconcile perks`, 'Compare and sync this character with your in-game perk inventory.', `<div class="character-inventory-session-status"><strong>${changed} changes saved this session</strong><span>Saved automatically</span></div>`)}<section class="panel character-inventory-controls"><div class="character-inventory-control-top"><label class="search character-inventory-search"><span aria-hidden="true">⌕</span><input id="character-inventory-search" type="search" placeholder="Search perks…" aria-label="Search perks" value="${esc(characterInventorySession.search)}"></label>${characterInventoryCardSizeControl()}</div><button data-action="character-inventory-all-role" aria-pressed="${Boolean(characterInventorySession.allRole)}">Show all same-role perks / special acquisitions</button><div class="character-inventory-scopes" role="group" aria-label="Perk categories">${CHARACTER_INVENTORY_CATEGORIES.map(category => `<button data-action="character-inventory-category" data-category="${category}" aria-pressed="${characterInventorySession.category === category}" class="${characterInventorySession.category === category ? 'selected' : ''}">${category === 'all' ? 'All' : characterInventoryCategoryLabels[category]}</button>`).join('')}<label class="character-inventory-only-unrecorded"><input id="character-inventory-only-unrecorded" type="checkbox" ${characterInventorySession.onlyUnrecorded ? 'checked' : ''}>Only unrecorded</label></div><div class="character-inventory-results-label"><strong>${visible.length}</strong> shown · ${candidates.length} candidates · ${unrecorded} unrecorded</div></section><div class="character-inventory-layout"><section class="character-inventory-card-grid ${characterInventoryGridClass()}" aria-label="${esc(character.name)} Update Inventory candidates">${visible.length ? visible.map(row => characterInventoryQuickCard(row, id, row.perk.id === selected?.perk.id)).join('') : empty('No candidate perks match this search and scope.')}</section>${characterInventoryEditor(selected, id)}</div>`;
}

function perkControls(role, characterId) {
  const definitions = perkFilterDefinitions(getFilterContext(route()));
  const help = definitions.quickViews.find(view => view.id === filters.quick)?.help;
  return `<div class="toolbar">${searchInput('Search perks or source character…')}${selectControl('sort', 'Sort', [['name', 'Perk name'], ['source', 'Source character'], ...(characterId ? [['tier', 'Current tier ↓']] : []), ['global', 'Global tier ↓']], filters.sort)}<button id="filters-trigger" data-action="filters-open" aria-controls="perk-filter-panel" aria-expanded="${$('#perk-filter-panel').matches(':popover-open')}">Filters${activeAdvancedGroupCount(filters) ? ' (' + activeAdvancedGroupCount(filters) + ')' : ''}</button>${characterId ? `<fieldset class="manager-view"><legend class="visually-hidden">Perk presentation</legend>${['detailed', 'compact'].map(view => `<label><input id="view-${view}" type="radio" name="manager-view" value="${view}" ${managerView === view ? 'checked' : ''}>${view === 'detailed' ? 'Detailed' : 'Compact'}</label>`).join('')}</fieldset>` : ''}</div>
    <div class="quick-views" role="group" aria-label="Quick views">${definitions.quickViews.map(view => `<button id="quick-${view.id}" data-action="quick-view" data-quick="${view.id}" aria-pressed="${filters.quick === view.id}">${esc(view.label)}</button>`).join('')}</div>
    ${help ? `<p class="filter-help">${esc(help)}</p>` : ''}<div class="filter-summaries">${definitions.groups.filter(group => filters.groups[group.id]?.length).map(group => `<span class="filter-summary"><button id="summary-${group.id}" data-action="filter-summary" data-group="${group.id}">${esc(group.label)}: ${group.options.filter(option => filters.groups[group.id].includes(option.id)).map(option => esc(option.label)).join(', ')}</button><button data-action="clear-group" data-group="${group.id}" aria-label="Clear ${esc(group.label)}">×</button></span>`).join('')}${activeAdvancedGroupCount(filters) ? '<button data-action="clear-advanced">Clear advanced filters</button>' : ''}</div>`;
}
function perkEmpty() {
  const context = getFilterContext(route());
  if (filters.quick === 'owned-by-my-characters' && !roleCharacters(context.role).some(c => save.characters[c.id].owned)) {
    return empty(`You do not own any ${context.role} characters yet. <a href="#${context.role}s">View collection →</a>`);
  }
  return empty(`No perks match this search, quick view and advanced filters.${activeAdvancedGroupCount(filters) ? ' <button data-action="clear-advanced">Clear advanced filters</button>' : ''}`);
}
function closeFilters(restoreFocus = false) {
  const panel = $('#perk-filter-panel');
  if (panel.matches(':popover-open')) panel.hidePopover();
  $('#filters-trigger')?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('#filters-trigger')?.focus({ preventScroll: true });
}
function positionFilters() {
  const panel = $('#perk-filter-panel'), trigger = $('#filters-trigger');
  if (!trigger || !panel.matches(':popover-open')) return;
  const rect = trigger.getBoundingClientRect(), gap = 12;
  panel.style.left = Math.max(gap, Math.min(rect.right - panel.offsetWidth, innerWidth - panel.offsetWidth - gap)) + 'px';
  panel.style.top = (innerWidth <= 600 ? gap : Math.max(gap, Math.min(rect.bottom + 8, innerHeight - panel.offsetHeight - gap))) + 'px';
}
function updateFilterPanel() {
  const context = getFilterContext(route());
  if (!context || context.kind !== 'perks' || setupOpen) return;
  const panel = $('#perk-filter-panel'), definitions = perkFilterDefinitions(context);
  if (panelContext !== context.route) {
    panelContext = context.route;
    panel.innerHTML = `<div class="filter-panel-heading"><h2>Advanced filters</h2><button data-action="filters-close" aria-label="Close filters">×</button></div>${definitions.groups.map(group => `<fieldset id="filter-group-${group.id}" tabindex="-1"><legend>${esc(group.label)}</legend>${group.options.map(option => `<label for="filter-${group.id}-${option.id}"><input type="checkbox" id="filter-${group.id}-${option.id}" data-filter-group="${group.id}" data-option="${option.id}"><span>${esc(option.label)}</span><span data-facet="${group.id}-${option.id}"></span></label>`).join('')}</fieldset>`).join('')}<p class="filter-help">Counts show option populations with search, quick view and other groups applied.</p><button data-action="clear-advanced">Clear advanced filters</button>`;
  }
  const counts = perkFacetCounts(save, context, filters);
  for (const group of definitions.groups) for (const option of group.options) {
    panel.querySelector(`[data-filter-group="${group.id}"][data-option="${option.id}"]`).checked = !!filters.groups[group.id]?.includes(option.id);
    panel.querySelector(`[data-facet="${group.id}-${option.id}"]`).textContent = counts[group.id][option.id];
  }
  $('#filters-trigger')?.setAttribute('aria-expanded', String(panel.matches(':popover-open')));
  positionFilters();
}
function openFilters(groupId) {
  updateFilterPanel();
  const panel = $('#perk-filter-panel');
  if (!panel.matches(':popover-open')) panel.showPopover();
  $('#filters-trigger')?.setAttribute('aria-expanded', 'true');
  positionFilters();
  (groupId ? panel.querySelector(`#filter-group-${groupId} input`) : panel.querySelector('input'))?.focus({ preventScroll: true });
}
function library(role) {
  const list = perkList(role);
  return pageHeading('ACCOUNT-WIDE UNLOCKS', `${role === 'survivor' ? 'Survivor' : 'Killer'} perks`, 'Global availability is separate from each character’s Bloodweb inventory.', `<div class="heading-count">${rolePerks(role).filter(p => isAvailable(save, p)).length}<span>/ ${rolePerks(role).length} available</span></div>`) + `<section class="panel library-panel">${perkControls(role)}<div id="perk-results" class="results-label" tabindex="-1">${list.length} PERKS<span>Counts include owned characters only · Click a perk for details</span></div>${perkTable(list)}</section>`;
}
function legacyManager(id) {
  const c = characterById[id];
  if (!Object.hasOwn(characterById, id)) return empty('Unknown character. Return to your collection.');
  const stats = characterStats(save, id), p = save.characters[id], list = perkList(c.role, id);
  return `<a class="back-link" href="#${c.role}s">← ${c.role === 'survivor' ? 'Survivors' : 'Killers'}</a>` + pageHeading('LEGACY CHARACTER MANAGER', `<span class="character-title">${characterArtwork(c, 80)}<span>${esc(c.name)}</span></span>`, 'Temporary compatibility view for the previous catalog-wide character manager.', `<a class="primary button-link" href="${characterWorkspaceHref(id, 'perks')}">Open Character Inventory</a>`) + `<div class="manager-stats"><span><strong>${stats.owned}</strong> / ${stats.total} owned</span><span><strong>${stats.tier3}</strong> Tier III</span><span><strong>${stats.total - stats.owned}</strong> missing</span></div><section class="panel library-panel">${perkControls(c.role, id)}<div id="perk-results" class="results-label" tabindex="-1">${list.length} PERKS<span>Native perks start at I. Account unlocks provide minimum tiers; general perks require personal acquisition.</span></div>${managerView === 'compact' ? compactPerks(list, id) : perkTable(list, id)}</section>`;
}

function dataPage() {
  let backups = [], backupError = '';
  try { backups = store.backups(); } catch (error) { backupError = error.message; }
  const unknownCharacters = Object.keys(save.characters).filter(id => !characterById[id]);
  const unknownPerks = new Set([...Object.keys(save.perkOverrides), ...Object.values(save.characters).flatMap(c => Object.keys(c.perks))].filter(id => !perkById[id]));
  return pageHeading('YOUR DATA, UNDER YOUR CONTROL', 'Data & backups', 'Take your ledger with you. Keep a copy outside your browser.') + inventoryProvenanceView() +
    `<section class="panel">${sectionTitle('Account setup')}<button data-action="setup-open">Review account setup</button><button data-action="character-setup-all">Run character setups</button></section><section class="panel">${sectionTitle('Display settings')}${selectControl('halloween-names', 'Halloween perk names', [['generic', 'Renamed generic names'], ['original', 'Original Halloween names']], save.settings.halloweenNames)}${selectControl('hellraiser-names', 'Hellraiser perk names', [['original', 'Original Hellraiser names'], ['generic', 'Renamed generic names']], save.settings.hellraiserNames)}<p class="panel-note">Owned licensed characters use original names. These preferences apply to unowned sources. Search accepts either version.</p></section><section class="panel">${sectionTitle('Current save', '<span class="tag">SCHEMA v2</span>')}${storageBlocked ? '<p class="error">Stored progress is unavailable. Export JSON is disabled. Export the original stored data before recovering through a valid JSON import or readable backup.</p>' : `<div class="data-metrics"><div><span>LAST UPDATED</span><strong>${date(save.updatedAt)}</strong></div><div><span>SURVIVORS / KILLERS</span><strong>${roleCharacters('survivor').length} / ${roleCharacters('killer').length}</strong></div><div><span>PROGRESSION RECORDS</span><strong>${Object.keys(save.characters).length}</strong></div><div><span>RECORDED PERK TIERS</span><strong>${Object.values(save.characters).reduce((n, p) => n + Object.keys(p.perks).length, 0)}</strong></div></div>`}<div class="data-actions"><button class="primary" data-action="export">↓ Export JSON</button><button data-action="import">↑ Import JSON</button>${storageBlocked ? '<button data-action="raw-export">Export original stored data</button>' : ''}</div><p class="panel-note">${storageBlocked ? 'Recovery preserves the exact original stored data separately in this browser before replacement. It does not snapshot the unavailable progress or alter existing backups. Export the original first to keep a copy outside this browser.' : 'Autosaved to this browser. Import replaces progress after confirmation and creates a local backup first. Local snapshots stay in this browser; JSON exports travel with you.'}</p>${unknownCharacters.length || unknownPerks.size ? `<p class="notice">${unknownCharacters.length} unknown characters and ${unknownPerks.size} unknown perks are preserved in exports. They cannot be edited until their definitions are added to the catalog.</p>` : ''}</section><section class="panel">${sectionTitle('Local backups', `<span class="muted">${backups.length} / 5 snapshots</span>`)}<p class="muted compact">Created before import, reset, restore, or clearing a character’s perks. ${storageBlocked ? 'Recovery preserves original stored data separately and leaves these snapshots unchanged.' : 'Restoring also backs up your current progress.'}</p>${backupError ? `<p class="error">${esc(backupError)}</p>` : backups.length ? backups.map(b => `<div class="backup-row"><span class="backup-icon">↶</span><div><strong>${date(b.createdAt)}</strong><small>${esc(b.reason)}</small></div><button data-action="restore" data-id="${esc(b.id)}">Restore</button><button class="danger-text" data-action="delete-backup" data-id="${esc(b.id)}">Delete</button></div>`).join('') : empty('No snapshots yet. Your first import or reset will create one.')}</section><section class="panel catalog-panel">${sectionTitle('Game catalog', '<span class="tag">JSON CATALOG</span>')}<p>${catalogInfo.detail}</p><p class="muted">The tracker starts with no assumed ownership or progression. The catalog is separate from your save: definitions and compatibility mappings are embedded in <code>dist/app.js</code> at build time; the browser does not fetch catalog JSON. Existing save IDs stay stable. Unknown imported records stay intact.</p><p class="muted">General perks are Bloodweb-available and have no automatic owned tier. Native, Prestige, Legacy, and Shrine tiers provide owned minimums. Licensed aliases share one inventory record. Your display preference does not change progression.</p></section><section class="panel danger-zone">${sectionTitle('Reset progression')}<p>Clear ownership, prestige, Bloodweb levels, favorites, notes, inventories, and Shrine overrides. Catalog definitions stay intact. A backup is created first.</p><button class="danger-button" data-action="reset">Reset all progress</button></section>`;
}

function preserveRender(element, html) {
  const focused = document.activeElement;
  const id = element.contains(focused) ? focused.id : null;
  const selection = id && /search|text/.test(focused.type) ? [focused.selectionStart, focused.selectionEnd] : null;
  const scrolls = [...element.querySelectorAll('.table-scroll')].map(n => [n.scrollLeft, n.scrollTop]);
  element.innerHTML = html;
  if (id) {
    const replacement = element.querySelector(`#${CSS.escape(id)}`);
    replacement?.focus({ preventScroll: true });
    if (selection && replacement?.setSelectionRange) replacement.setSelectionRange(...selection);
  }
  [...element.querySelectorAll('.table-scroll')].forEach((n, i) => { if (scrolls[i]) [n.scrollLeft, n.scrollTop] = scrolls[i]; });
}
function route() { return location.hash.slice(1) || 'dashboard'; }
function characterWorkspaceHeader(character, descriptor) {
  const progress = save.characters[character.id];
  const sections = [['overview', 'Overview'], ['perks', 'Perks'],
    character.role === 'survivor' ? ['items-addons', 'Items & Add-ons'] : ['power-addons', 'Power & Add-ons']];
  const collectionLabel = character.role === 'survivor' ? 'Survivors' : 'Killers';
  const roleLabel = character.role === 'survivor' ? 'Survivor' : 'Killer';
  return '<header class="character-workspace-header" data-character-header>'
    + '<a class="character-workspace-back" href="#' + character.role + 's">← ' + collectionLabel + '</a>'
    + '<div class="character-workspace-hero"><div class="character-workspace-summary"><div class="character-workspace-identity">' + characterArtwork(character, 80)
    + '<div class="character-workspace-title"><div class="eyebrow">' + roleLabel.toUpperCase() + '</div><h1>' + esc(character.name) + '</h1>'
    + '<div class="character-workspace-status"><span class="status-chip ' + (progress.owned ? 'is-owned' : 'is-unowned') + '">' + (progress.owned ? 'Owned' : 'Not owned') + '</span>'
    + '<span class="status-chip ' + (progress.favorite ? 'is-favorite' : '') + '">' + (progress.favorite ? 'Favorite ★' : 'Not favorite') + '</span></div></div></div>'
    + '<div class="character-workspace-progress" aria-label="Character progression"><div data-character-progress="prestige"><span>PRESTIGE</span><strong>P' + progress.prestige + '</strong></div>'
    + '<div data-character-progress="bloodweb"><span>BLOODWEB</span><strong>' + progress.bloodwebLevel + ' / 50</strong></div></div></div>'
    + '<a class="primary button-link character-workspace-edit" href="' + characterWorkspaceHref(character.id, 'edit') + '">Edit Character</a></div>'
    + '<nav class="character-workspace-nav" aria-label="Character workspace">' + sections.map(([section, label]) =>
      '<a data-workspace-section="' + section + '" href="' + characterWorkspaceHref(character.id, section) + '"'
      + (descriptor.section === section ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav></header>';
}
function characterOverview(id) {
  const character = characterById[id], progress = save.characters[id], stats = characterStats(save, id);
  const stock = Object.entries({...progress.inventory.items,...progress.inventory.addons});
  const knownStock = stock.filter(([entityId]) => Object.hasOwn(inventoryEntityById, entityId));
  const unresolved = stock.length - knownStock.length;
  const killerPower = killerPowerByCharacterId[id];
  const killerAddons = character.role === 'killer'
    ? Object.values(inventoryEntityById).filter(entity => entity.role === 'killer' && entity.characterId === id)
    : [];
  const nativeCards = character.nativePerkIds.map(perkId => {
    const perk = perkById[perkId], tier = inventoryTier(save, id, perkId);
    return '<article class="overview-native-perk">' + perkArtwork(perk, 64)
      + '<div class="overview-native-copy"><div class="overview-native-title"><button data-action="perk" data-id="' + perkId + '">' + esc(perkName(save, perk)) + '</button>' + badge(tier) + '</div>'
      + '<small>Personal record: ' + (recordedTier(save, id, perkId) || 'None') + ' · ' + esc(ownedUnlockSource(save, id, perk)) + '</small></div></article>';
  }).join('');
  const setup = progress.owned
    ? '<div class="overview-context ' + (progress.setupComplete ? 'is-complete' : 'needs-attention') + '"><strong>' + (progress.setupComplete ? 'Initial setup complete' : 'Initial setup incomplete') + '</strong>'
      + '<p>' + (progress.setupComplete ? 'Review the saved Bloodweb setup when you need to reconcile older progress.' : 'Record the starting Bloodweb context before relying on setup-specific progression details.') + '</p>'
      + '<a href="' + characterWorkspaceHref(id, 'setup') + '">' + (progress.setupComplete ? 'Review initial setup' : 'Start initial setup') + '</a></div>'
    : '<p class="muted">This character is not marked Owned. Initial setup remains optional until ownership changes.</p>';
  const inventorySummary = character.role === 'survivor' && inventoryCatalogStatus.survivor === 'ready'
    ? '<p>38 Items · 54 Add-ons · Survivor inventory ' + esc(survivorInventorySource.patch) + '.</p>'
      + '<strong class="overview-summary-value">' + (knownStock.length ? knownStock.length + ' stocked ' + (knownStock.length === 1 ? 'entry' : 'entries') + ' recorded.' : 'No quantities recorded yet.') + '</strong>'
      + (unresolved ? '<p class="overview-unresolved">' + unresolved + ' imported ' + (unresolved === 1 ? 'record' : 'records') + ' not in current catalog.</p>' : '')
      + '<a href="' + characterWorkspaceHref(id, 'items-addons') + '">View Items & Add-ons</a>'
    : character.role === 'killer' && inventoryCatalogStatus.killerPowers === 'ready'
      && inventoryCatalogStatus.killerAddons === 'ready' && killerPower
    ? '<p>Power: ' + esc(killerPower.powerName) + ' · ' + killerAddons.length + ' Add-ons.</p>'
      + '<strong class="overview-summary-value">' + (knownStock.length ? knownStock.length + ' stocked Add-on' + (knownStock.length === 1 ? '' : 's') + ' recorded.' : 'No Add-on quantities recorded yet.') + '</strong>'
      + (unresolved ? '<p class="overview-unresolved">' + unresolved + ' imported ' + (unresolved === 1 ? 'record' : 'records') + ' not in current catalog.</p>' : '')
      + '<a href="' + characterWorkspaceHref(id, 'power-addons') + '">View Power & Add-ons</a>'
    : '<p>Verified inventory and Power reference data is not yet available.</p><a href="' + characterWorkspaceHref(id, 'power-addons') + '">View Power & Add-ons</a>';
  return '<div class="character-overview">'
    + '<div class="character-overview-grid">'
    + '<section class="character-overview-section overview-native" data-overview-section="native-perks"><div class="section-title"><h2>Native Perks</h2></div><div class="overview-native-grid">' + nativeCards + '</div></section>'
    + '<section class="character-overview-section overview-progress" data-overview-section="progress"><div class="section-title"><h2>Progress / setup</h2></div>' + setup
      + '<p class="muted overview-helper">Personal records remain separate from Native, Prestige, Shrine and Legacy minimums.</p></section>'
    + '<section class="character-overview-summary" data-overview-section="perks"><div><div class="eyebrow">PERKS</div><h2>Perk inventory</h2></div>'
      + '<div class="overview-summary-number"><strong>' + stats.owned + '</strong><span>effective owned</span></div><div class="overview-summary-number"><strong>' + stats.tier3 + '</strong><span>Tier III</span></div>'
      + '<a href="' + characterWorkspaceHref(id, 'perks') + '">View Perks</a></section>'
    + '<section class="character-overview-summary" data-overview-section="inventory"><div><div class="eyebrow">COLLECTION</div><h2>' + (character.role === 'survivor' ? 'Items & Add-ons' : 'Power & Add-ons') + '</h2></div>' + inventorySummary + '</section>'
    + '</div>'
    + '<section class="character-overview-notes" data-overview-section="notes"><div class="section-title"><h2>Notes</h2></div><p class="character-notes">' + esc(progress.notes || 'No notes recorded.') + '</p></section>'
    + '</div>';
}
function characterWorkspaceUnavailable() {
  return '<section class="panel"><h1>Character/section unavailable</h1><p>This character or section cannot be resolved.</p><a href="#survivors">Survivors</a> · <a href="#killers">Killers</a> · <a href="#dashboard">Dashboard</a></section>';
}
function characterWorkspaceView(descriptor) {
  if (descriptor.status !== 'valid') return characterWorkspaceUnavailable();
  const id = descriptor.characterId;
  let content;
  if (descriptor.section === 'overview') content = characterOverview(id);
  else if (descriptor.section === 'items-addons' && inventoryCatalogStatus.survivor==='ready') content = stockView(id,'detail');
  else if (descriptor.section === 'power-addons' && inventoryCatalogStatus.killerPowers==='ready' && inventoryCatalogStatus.killerAddons==='ready') content = killerPowerAddonsView(id);
  else if (descriptor.section === 'edit') {
    if (characterEditSession?.characterId !== id) {
      characterEditSession = createCharacterEditSession(save, id, characterEditReturnRoute);
      characterEditViewState = { search: '', allRole: false };
    }
    content = characterEditView(id, characterEditSession);
  }
  else if (descriptor.section === 'setup') {
    if (!save.characters[id].owned) content = '<section class="panel"><h2>Initial Setup</h2><p>Initial setup requires an owned character.</p></section>';
    else {
      if (characterSetup?.id !== id) characterSetup = createCharacterSetupDraft(id);
      content = characterSetupView(save, characterSetup, { workspace: true });
    }
  }
  else if (descriptor.section === 'perks') content = descriptor.mode === 'legacy' ? legacyManager(id)
    : descriptor.mode === 'update' ? characterInventoryUpdate(id) : characterInventory(id);
  else content = '<section class="panel"><h2>' + esc(descriptor.section === 'edit' ? 'Edit Character' : descriptor.section === 'setup' ? 'Initial setup' : 'Reference and inventory')
    + '</h2><p>This workspace content is currently unavailable.</p></section>';
  content = content.replace(/<h1(\s[^>]*)?>/g, '<h2$1>').replace(/<\/h1>/g, '</h2>');
  return '<section data-character-workspace>' + characterWorkspaceHeader(characterById[id], descriptor) + content + '</section>';
}
function characterEditView(id, session) {
  const preview = characterEditPreview(save, session);
  const rows = characterInventoryCandidatePool(preview, id, { allRole: characterEditViewState.allRole })
    .filter(row => perkSearchText(row.perk).toLowerCase().includes(characterEditViewState.search.toLowerCase()));
  const input = (field, label, type = 'number') => '<label>' + label + '<input id="edit-' + (field === 'bloodwebLevel' ? 'bloodweb' : field)
    + '" data-edit-field="' + field + '" type="' + type + '"' + (type === 'checkbox'
      ? (session.draft[field] ? ' checked' : '') : ' value="' + esc(session.rawInputs[field] ?? session.draft[field]) + '" step="1"')
    + '></label>';
  const errors = session.errors.length ? '<div class="error" role="alert" data-edit-errors tabindex="-1"><strong>Not saved</strong><ul>'
    + session.errors.map(error => '<li>' + esc(error.message) + '</li>').join('') + '</ul></div>' : '<div data-edit-errors hidden></div>';
  return '<form data-character-edit novalidate><h2>Edit Character</h2><p>Changes are not saved until Save Character. This draft is kept in memory only.</p>'
    + errors + '<fieldset><legend>Progression</legend><div class="two-column edit-numbers">' + input('prestige', 'Prestige')
    + input('bloodwebLevel', 'Bloodweb level (1–50)') + '</div></fieldset>'
    + '<fieldset><legend>Character state</legend>' + input('owned', 'Owned', 'checkbox') + input('favorite', 'Favorite', 'checkbox')
    + '<label>Notes<textarea id="edit-notes" data-edit-field="notes" rows="3">' + esc(session.draft.notes) + '</textarea></label></fieldset>'
    + '<fieldset><legend>Personal Perks</legend><label>Search perks<input id="character-edit-search" type="search" value="' + esc(characterEditViewState.search) + '"></label>'
    + '<button type="button" data-action="character-edit-all" aria-pressed="' + characterEditViewState.allRole + '">Show all same-role perks / special acquisitions</button>'
    + '<div class="character-edit-perks">' + rows.map(row => {
      const perk = row.perk, historical = row.isHistorical, personal = session.draft.perks[perk.id];
      const options = historical ? [['', 'Not Confirmed'], ['0', 'Not Owned'], ['1', 'I'], ['2', 'II'], ['3', 'III']]
        : [['none', 'Not recorded'], ['1', 'I'], ['2', 'II'], ['3', 'III']];
      const selected = personal === undefined ? (historical ? '' : 'none') : String(personal);
      return '<article><h3><button type="button" data-action="perk" data-id="' + perk.id + '">' + esc(perkName(preview, perk)) + '</button></h3>'
        + '<p>Effective ' + roman[row.effectiveTier] + ' · Automatic minimum ' + roman[row.automaticMinimum]
        + ' · ' + esc(ownedUnlockSource(preview, id, perk)) + '</p><label>Personal record'
        + '<select data-edit-perk="' + perk.id + '" data-mode="' + (historical ? 'historical' : 'personal') + '" aria-label="Personal tier of ' + esc(perkName(preview, perk)) + '">'
        + options.map(([value, label]) => '<option value="' + value + '"' + (selected === value ? ' selected' : '')
          + (historical ? ((value === '' && Object.hasOwn(session.baseline.perks, perk.id)) || (value !== '' && Number(value) < (session.baseline.perks[perk.id] || 0)) ? ' disabled' : '')
            : (value !== 'none' && Number(value) < row.automaticMinimum ? ' disabled' : '')) + '>' + label + '</option>').join('')
        + '</select></label><details><summary>Correct personal record</summary><p>Deliberate correction; automatic minimums still apply.</p>'
        + '<select data-edit-correction="' + perk.id + '" aria-label="Correct personal record of ' + esc(perkName(preview, perk)) + '">'
        + [['', 'Choose correction'], ['none', 'Clear record'], ['1', 'I'], ['2', 'II'], ['3', 'III']].map(([value,label]) =>
          '<option value="' + value + '">' + label + '</option>').join('') + '</select></details></article>';
    }).join('') + '</div></fieldset>' + (characterById[id].role==='survivor'&&inventoryCatalogStatus.survivor==='ready' ? stockView(id,'draft') : '<section><h3>Inventory</h3><p>Verified inventory data is not yet available. Existing unresolved quantities are preserved.</p></section>')
    + '<div class="dialog-actions"><button type="button" data-action="character-edit-cancel">Cancel</button><button type="button" class="primary" data-action="character-edit-save">Save Character</button></div></form>';
}
function inventoryProvenanceView(){
  const unknown=Object.entries(save.characters).flatMap(([characterId,progress])=>Object.entries({...progress.inventory.items,...progress.inventory.addons})
    .filter(([id])=>!Object.hasOwn(inventoryEntityById,id)).map(([id,quantity])=>({characterId,id,quantity})));
  return '<section class="panel"><h2>Survivor inventory catalog</h2><p>'+esc(survivorInventorySource.patch)+' · research '+esc(survivorInventorySource.verifiedAt)
    +' · 38 Items · 54 Add-ons · 7 families. Perk catalog version remains '+esc(catalogInfo.patch||'10.1.2a')+'.</p><p>'
    +esc(survivorInventorySource.provenance.sourcePolicy)+'</p><p>Three optional Banquet underlying rarity assignments remain flagged; Event presentation is preserved.</p>'
    +(unknown.length?'<details><summary>'+unknown.length+' unresolved inventory records (preserved/read-only)</summary><ul>'+unknown.map(e=>'<li>'+esc(e.characterId)+' / '+esc(e.id)+': '+e.quantity+'</li>').join('')+'</ul></details>':'')+'</section>';
}
function stockView(id,mode) {
  const inventory=(mode==='draft'?characterEditSession.draft:save.characters[id]).inventory;
  const key=id+'/'+(mode==='draft'?'edit':'items-addons');
  if(stockSessionKey!==key || !stockSession){
    stockSession=createQuantityInteraction(inventoryEntities,{...inventory.items,...inventory.addons},{mode});
    stockSessionKey=key;stockFilters={map:'',rarity:'',search:'',inStock:false};
    selectedFamilyId=survivorInventorySource.itemFamilies[0].id;
  }
  const select=(id,label,options,value)=>'<label>'+label+'<select id="'+id+'">'+options.map(([v,n])=>'<option value="'+esc(v)+'"'+(value===v?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>';
  const unresolved=Object.entries({...inventory.items,...inventory.addons}).filter(([entityId])=>!Object.hasOwn(inventoryEntityById,entityId));
  const grouped=groupQuantityEntries(stockSession,stockFilters,survivorInventorySource.itemFamilies);
  if(!survivorInventorySource.itemFamilies.some(family=>family.id===selectedFamilyId))selectedFamilyId=survivorInventorySource.itemFamilies[0].id;
  const visibleGroups=grouped.filter(group=>group.family.id===selectedFamilyId);
  const secondaryCount=Number(Boolean(stockFilters.map))+Number(Boolean(stockFilters.rarity));
  const renderCard=entity=>{
    const art=inventoryIconPath(entity.id,assetManifest), error=stockSession.errors[entity.id];
    return '<article data-stock-card="'+entity.id+'" data-stock-rarity="'+esc(entity.rarity)+'" class="stock-card '+((stockSession.baseline[entity.id]||0)>0?'':'zero-stock')+'">'
      +'<div class="stock-card-media">'+(art?'<img src="'+esc(art)+'" alt="" loading="lazy" data-inventory-icon>':'<span aria-hidden="true" class="stock-art-fallback">◇</span>')+'</div>'
      +'<h5 class="stock-card-title">'+esc(entity.name)+'</h5><div class="stock-card-meta">'+esc(entity.rarity)+' · '+(entity.map==='items'?'Item':'Add-on')+'</div>'
      +'<label for="quantity-'+entity.id+'">Quantity of '+esc(entity.name)+'</label><div class="stock-quantity-control">'
      +'<button type="button" id="stock-decrement-'+entity.id+'" data-action="stock-step" data-stock-step data-id="'+entity.id+'" data-delta="-1" aria-label="Decrease quantity of '+esc(entity.name)+'">−</button>'
      +'<input id="quantity-'+entity.id+'" data-inventory-quantity="'+entity.id+'" inputmode="numeric" type="text" value="'+esc(stockSession.raw[entity.id])+'" aria-invalid="'+Boolean(error)+'" aria-describedby="stock-error-'+entity.id+'">'
      +'<button type="button" id="stock-increment-'+entity.id+'" data-action="stock-step" data-stock-step data-id="'+entity.id+'" data-delta="1" aria-label="Increase quantity of '+esc(entity.name)+'">+</button></div>'
      +'<p id="stock-error-'+entity.id+'" data-stock-error role="status">'+esc(error|| (stockSession.pending[entity.id]?(mode==='draft'?'Unsaved draft':'Pending change'):''))+'</p>'
      +'<button type="button" id="stock-details-'+entity.id+'" class="stock-details-action" data-action="stock-details" data-id="'+entity.id+'">Details</button></article>';
  };
  const familyMarkup=visibleGroups.map(group=>{
    const catalogAddonCount=inventoryEntities.filter(entity=>entity.familyId===group.family.id&&entity.map==='addons').length;
    const catalogItemCount=inventoryEntities.filter(entity=>entity.familyId===group.family.id&&entity.map==='items').length;
    const showItems=!stockFilters.map||stockFilters.map==='items';
    const showAddons=!stockFilters.map||stockFilters.map==='addons';
    return '<section class="stock-family" data-stock-family="'+esc(group.family.id)+'"><div class="stock-family-heading"><h3>'+esc(group.family.displayName)+'</h3><p>'+catalogItemCount+' Items · '+catalogAddonCount+' Add-ons <span class="muted">(catalog totals)</span></p></div>'
      +'<div class="stock-family-content">'
      +(showItems?'<section class="stock-subsection" data-stock-subsection="items"><h4>Items</h4>'+(group.items.length?'<div class="stock-grid">'+group.items.map(renderCard).join('')+'</div>':'<p class="stock-empty-line">No matching Items.</p>')+'</section>':'<section data-stock-subsection="items" hidden></section>')
      +(showAddons?'<section class="stock-subsection" data-stock-subsection="addons"><h4>Add-ons</h4>'+(group.addons.length?'<div class="stock-grid">'+group.addons.map(renderCard).join('')+'</div>':(!catalogAddonCount?'<p class="stock-empty-line">No compatible Add-ons in this catalog.</p>':'<p class="stock-empty-line">No matching Add-ons.</p>'))+'</section>':'<section data-stock-subsection="addons" hidden></section>')
      +'</div></section>';
  }).join('');
  return '<section data-stock-workspace><div class="stock-page-heading"><div><h2>Survivor Items &amp; Add-ons</h2><p>'+(mode==='detail'?'Track the quantities currently recorded for this Survivor. Quantities save on Enter or leaving the field.':'Stock changes stay in this draft until Save Character.')+'</p></div><p class="muted">Survivor inventory '+esc(survivorInventorySource.patch)+' · research '+esc(survivorInventorySource.verifiedAt)+'.</p></div>'
    +'<div class="stock-toolbar"><div class="stock-primary-controls"><label class="stock-search">Search '+esc(visibleGroups[0].family.displayName)+'<input id="inventory-search" type="search" value="'+esc(stockFilters.search)+'"></label><label class="stock-in-stock"><input id="inventory-in-stock" type="checkbox"'+(stockFilters.inStock?' checked':'')+'> In Stock</label>'
    +'<details id="inventory-filters"><summary id="inventory-filters-toggle">Filters'+(secondaryCount?' ('+secondaryCount+')':'')+'</summary><div class="stock-secondary-filters">'+select('inventory-map','Type',[['','All'],['items','Items'],['addons','Add-ons']],stockFilters.map)+select('inventory-rarity','Rarity',[['','All rarities'],...[...new Set(inventoryEntities.map(e=>e.rarity))].map(r=>[r,r])],stockFilters.rarity)+'</div></details></div>'
    +'</div><nav class="stock-family-nav" aria-label="Item families">'+survivorInventorySource.itemFamilies.map(family=>'<button type="button" id="stock-family-nav-'+esc(family.id)+'" data-action="stock-family-select" data-family="'+esc(family.id)+'" aria-pressed="'+(family.id===selectedFamilyId)+'">'+esc(family.displayName)+'</button>').join('')+'</nav>'
    +(Object.keys(stockSession.errors).length?'<div role="alert" data-stock-error-summary>'+Object.entries(stockSession.errors).map(([entityId,error])=>'<p><button type="button" data-action="stock-error-focus" data-id="'+entityId+'">Fix quantity of '+esc(inventoryEntityById[entityId].name)+'</button>: '+esc(error)+'</p>').join('')+'</div>':'')
    +'<div class="stock-families">'+familyMarkup+'</div>'+(visibleGroups.every(group=>!group.items.length&&!group.addons.length)?'<p class="empty">No matches in '+esc(visibleGroups[0].family.displayName)+'.</p>':'')
    +(unresolved.length?'<section class="unresolved-stock" data-unresolved-stock><h2 id="inventory-unresolved">Imported records not in current catalog</h2><p class="muted">Preserved exactly and read-only until the runtime catalog can resolve them.</p><ul>'+unresolved.map(([unknown,quantity])=>'<li><code>'+esc(unknown)+'</code><span>Quantity '+quantity+'</span><small>Read-only</small></li>').join('')+'</ul></section>':'')+'</section>';
}
const killerRarityOrder = ['Common','Uncommon','Rare','Very Rare','Ultra Rare'];
function killerPowerAddonsView(characterId) {
  const power=killerPowerByCharacterId[characterId];
  if(!power)return '<section class="panel"><h2>Power &amp; Add-ons unavailable</h2><p>Verified Power and Add-on data is not available for this Killer.</p></section>';
  const character=characterById[characterId], powerArt=killerPowerIconPath(characterId,assetManifest);
  const addons=Object.values(inventoryEntityById).filter(entity=>entity.role==='killer'&&entity.characterId===characterId).sort((a,b)=>a.order-b.order);
  if(killerSessionKey!==characterId||!killerSession){
    killerSession=createQuantityInteraction(addons,save.characters[characterId].inventory.addons);
    killerSessionKey=characterId;
  }
  const groups=killerRarityOrder.map(rarity=>({rarity,addons:addons.filter(addon=>addon.rarity===rarity)}));
  const art=powerArt?'<img src="'+esc(artworkUrl(powerArt))+'" alt="" data-power-art>':'<span class="stock-art-fallback" role="img" aria-label="Power artwork unavailable" data-power-art-fallback>◇</span>';
  return '<section class="killer-power-addons" data-killer-power-addons>'
    +'<section class="panel killer-power-panel" data-killer-power-panel><div class="killer-power-art">'+art+'</div><div class="killer-power-copy"><span class="eyebrow">KILLER POWER</span><h3 data-power-name>'+esc(power.powerName)+'</h3><p data-power-summary>'+esc(power.shortSummary)+'</p><button type="button" data-action="killer-power-details" data-character="'+esc(characterId)+'" id="killer-power-details-'+esc(characterId)+'">Power Details</button></div></section>'
    +'<section class="killer-addon-inventory" aria-labelledby="killer-addons-heading"><div class="stock-page-heading"><div><span class="eyebrow">INVENTORY</span><h3 id="killer-addons-heading">'+esc(character.name)+' Add-ons</h3><p>All 20 Add-ons, grouped by rarity.</p></div></div>'
    +groups.map(group=>'<section class="killer-rarity-section" data-killer-rarity-section data-rarity="'+esc(group.rarity)+'"><h4>'+esc(group.rarity)+'</h4><div class="stock-grid">'+group.addons.map(killerAddonCard).join('')+'</div></section>').join('')
    +'</section></section>';
}
function killerAddonCard(addon) {
  const art=inventoryIconPath(addon.id,assetManifest), quantity=killerSession.baseline[addon.id]||0, error=killerSession.errors[addon.id];
  const artwork=art?'<img src="'+esc(artworkUrl(art))+'" alt="" loading="lazy" data-killer-addon-art>':'<span aria-hidden="true" class="stock-art-fallback">◇</span>';
  return '<article class="stock-card killer-addon-card '+(quantity?'':'zero-stock')+'" data-killer-addon-card data-character-id="'+esc(addon.characterId)+'" data-addon-id="'+esc(addon.id)+'" data-rarity="'+esc(addon.rarity)+'">'
    +'<div class="stock-card-media">'+artwork+'</div><h5 class="stock-card-title">'+esc(addon.name)+'</h5><div class="stock-card-meta">'+esc(addon.rarity)+' · Add-on</div>'
    +'<label for="killer-quantity-'+esc(addon.id)+'">Quantity of '+esc(addon.name)+'</label><div class="stock-quantity-control">'
    +'<button type="button" id="killer-stock-decrement-'+esc(addon.id)+'" data-action="killer-stock-step" data-killer-stock-step data-id="'+esc(addon.id)+'" data-delta="-1" aria-label="Decrease quantity of '+esc(addon.name)+'">−</button>'
    +'<input id="killer-quantity-'+esc(addon.id)+'" data-inventory-quantity="'+esc(addon.id)+'" data-killer-quantity="'+esc(addon.id)+'" inputmode="numeric" type="text" value="'+esc(killerSession.raw[addon.id])+'" aria-invalid="'+Boolean(error)+'" aria-describedby="killer-stock-error-'+esc(addon.id)+'">'
    +'<button type="button" id="killer-stock-increment-'+esc(addon.id)+'" data-action="killer-stock-step" data-killer-stock-step data-id="'+esc(addon.id)+'" data-delta="1" aria-label="Increase quantity of '+esc(addon.name)+'">+</button></div>'
    +'<p id="killer-stock-error-'+esc(addon.id)+'" data-killer-stock-error role="status">'+esc(error||(killerSession.pending[addon.id]?'Pending change':''))+'</p>'
    +'<button type="button" id="killer-addon-details-'+esc(addon.id)+'" class="stock-details-action" data-action="killer-addon-details" data-id="'+esc(addon.id)+'">Details</button></article>';
}
function updateStockStepControls(id=null) {
  const blocked=!initialized||editor.state!=='editing'||storageBlocked||Boolean(characterEditSession?.conflicted);
  for(const input of document.querySelectorAll('[data-inventory-quantity]')){
    const entityId=input.dataset.inventoryQuantity;
    if(id && entityId!==id)continue;
    const result=acceptQuantityInput(input.hasAttribute('data-killer-quantity')?killerSession:stockSession,entityId);
    input.closest('.stock-quantity-control').querySelectorAll('[data-stock-step], [data-killer-stock-step]').forEach(control=>{
      control.disabled=blocked||Boolean(result.error)
        || (control.dataset.delta==='-1'?result.quantity===0:result.quantity===Number.MAX_SAFE_INTEGER);
    });
  }
}
function killerQuantityInput(target) {
  killerSession=updateQuantityInput(killerSession,target.dataset.killerQuantity,target.value);
  store.assertWriter();
  updateStockStepControls(target.dataset.killerQuantity);
}
function stepKillerQuantity(button) {
  store.assertWriter();
  if(storageBlocked)return false;
  const id=button.dataset.id;
  killerBlurPending=null;
  const result=stepQuantityInput(killerSession,id,Number(button.dataset.delta));
  killerSession=result.state;
  return acceptKillerQuantity(id,'step');
}
function acceptKillerQuantity(id,trigger,nextTargetId=null) {
  if(!killerSession||!killerSession.entities.some(entity=>entity.id===id))return false;
  killerBlurPending=null;
  const result=acceptQuantityInput(killerSession,id);killerSession=result.state;
  const focus=()=>$('#killer-quantity-'+id)?.focus({preventScroll:true});
  if(result.error){render();if(trigger!=='blur')focus();return false;}
  const characterId=killerSessionKey;
  try {
    store.assertWriter();
    if(storageBlocked)throw Error('Stored save needs recovery.');
    if((save.characters[characterId].inventory.addons[id]||0)!==result.quantity){
      if(!commit(next=>{
        if(result.quantity)next.characters[characterId].inventory.addons[id]=result.quantity;
        else delete next.characters[characterId].inventory.addons[id];
      },characterId))throw Error('Quantity retained for retry.');
    }
    const previous=killerSession;
    killerSession=regroupQuantityEntries(previous,save.characters[characterId].inventory.addons);
    for(const other of Object.keys(previous.pending).filter(other=>other!==id&&previous.pending[other])){
      killerSession.raw[other]=previous.raw[other];killerSession.pending[other]=true;
      if(previous.errors[other])killerSession.errors[other]=previous.errors[other];
    }
    const order=killerRarityOrder.flatMap(rarity=>killerSession.entities.filter(entity=>entity.rarity===rarity).map(entity=>entity.id));
    const destination=quantityFocusAfterCommit(order,{entityId:id,nextTargetId,trigger,
      visibleIds:[...order,...(nextTargetId&&document.getElementById(nextTargetId)?[nextTargetId]:[])]});
    render();($('#killer-quantity-'+destination)||document.getElementById(destination))?.focus({preventScroll:true});
    message('Quantity saved: '+inventoryEntityById[id].name+' '+result.quantity+'.');
    return true;
  }catch(error){
    killerSession.errors[id]='Not saved. '+error.message;render();if(trigger!=='blur')focus();return false;
  }
}
function stockInput(target) {
  store.assertWriter();
  const id=target.dataset.inventoryQuantity;
  stockSession=updateQuantityInput(stockSession,id,target.value);
  if(characterEditSession) {
    characterEditSession=updateCharacterEditSession(characterEditSession,{field:'quantity',map:inventoryEntityById[id].map,id,text:target.value},save);
  }
  updateStockStepControls(id);
}
function stepStock(button) {
  store.assertWriter();
  if(storageBlocked||characterEditSession?.conflicted)return false;
  const id=button.dataset.id;
  if(stockBlurPending?.id===id)stockBlurPending=null;
  const result=stepQuantityInput(stockSession,id,Number(button.dataset.delta));
  stockSession=result.state;
  if(result.error){render();$('#quantity-'+id)?.focus({preventScroll:true});return false;}
  if(characterEditSession){
    characterEditSession=updateCharacterEditSession(characterEditSession,{field:'quantity',map:inventoryEntityById[id].map,id,text:String(result.quantity)},save);
  }
  return acceptStock(id,'step');
}
function stockFocusOrder() {
  return groupQuantityEntries(stockSession,stockFilters,survivorInventorySource.itemFamilies)
    .filter(group=>group.family.id===selectedFamilyId)
    .flatMap(group=>[...group.items,...group.addons]).map(entity=>entity.id);
}
function selectStockFamily(family) {
  if(!survivorInventorySource.itemFamilies.some(entry=>entry.id===family))return;
  const pending=stockSession.entities.filter(entity=>entity.familyId===selectedFamilyId
    && (stockSession.pending[entity.id]||stockSession.errors[entity.id]));
  stockBlurPending=null;
  for(const entity of pending){
    if(stockSession.mode==='draft')stockSession=acceptQuantityInput(stockSession,entity.id).state;
    else if(!acceptStock(entity.id,'enter'))return;
  }
  selectedFamilyId=family;render();
  document.getElementById('stock-family-nav-'+family)?.focus({preventScroll:true});
}
function keepStockFamilyVisible(button) {
  const nav=button.parentElement, bounds=nav.getBoundingClientRect(), target=button.getBoundingClientRect();
  if(target.left<bounds.left)nav.scrollLeft+=target.left-bounds.left-4;
  else if(target.right>bounds.right)nav.scrollLeft+=target.right-bounds.right+4;
}
function revealStockQuantity(id) {
  const entity=inventoryEntityById[id];
  for(const pendingId of Object.keys(stockSession.pending).filter(pendingId=>stockSession.pending[pendingId])){
    stockSession=acceptQuantityInput(stockSession,pendingId).state;
  }
  selectedFamilyId=entity.familyId;
  stockBlurPending=null;
  stockFilters={...stockFilters};
  if(stockFilters.map&&stockFilters.map!==entity.map)stockFilters.map='';
  if(stockFilters.rarity&&stockFilters.rarity!==entity.rarity)stockFilters.rarity='';
  if(stockFilters.search&&!visibleQuantityEntries(stockSession,{search:stockFilters.search}).some(entry=>entry.id===id))stockFilters.search='';
  if(stockFilters.inStock&&!visibleQuantityEntries(stockSession,{inStock:true}).some(entry=>entry.id===id))stockFilters.inStock=false;
  render();$('#quantity-'+id)?.focus();
}
function acceptStock(id,trigger,nextTargetId=null) {
  if(!stockSession)return;
  if(stockBlurPending?.id===id&&stockBlurPending.key===stockSessionKey)stockBlurPending=null;
  const result=acceptQuantityInput(stockSession,id);stockSession=result.state;
  if(result.error){render();if(trigger==='enter')$('#quantity-'+id)?.focus({preventScroll:true});return false;}
  if(stockSession.mode==='draft'){render();if(trigger==='step')$('#quantity-'+id)?.focus({preventScroll:true});return true;}
  const characterId=stockSessionKey.split('/')[0], entity=inventoryEntityById[id];
  const before=stockFocusOrder();
  try {
    store.assertWriter();
    if((save.characters[characterId].inventory[entity.map][id]||0)!==result.quantity) {
      if(!commit(next=>{
        if(result.quantity)next.characters[characterId].inventory[entity.map][id]=result.quantity;
        else delete next.characters[characterId].inventory[entity.map][id];
      },characterId))throw Error('Not saved. Quantity retained for retry.');
    }
    const inventory=save.characters[characterId].inventory;
    // Retain other pending editors while regrouping only the committed entity.
    const previous=stockSession;
    stockSession=regroupQuantityEntries(stockSession,{...inventory.items,...inventory.addons});
    for(const other of Object.keys(previous.pending).filter(other=>other!==id&&previous.pending[other])){
      stockSession.raw[other]=previous.raw[other];stockSession.pending[other]=true;
      if(previous.errors[other])stockSession.errors[other]=previous.errors[other];
    }
    const visible=stockFocusOrder();
    const stepDestinations=[...document.querySelectorAll('[data-stock-step]:not(:disabled)')].filter(control=>visible.includes(control.dataset.id)).map(control=>control.id);
    const availableDestinations=[...visible,...['inventory-search','inventory-map','inventory-rarity','inventory-in-stock','inventory-filters-toggle','inventory-unresolved'],...visible.map(entityId=>'stock-details-'+entityId),...stepDestinations];
    const destination=quantityFocusAfterCommit(before,{entityId:id,nextTargetId,trigger,visibleIds:availableDestinations});
    render(); ($('#quantity-'+destination)||document.getElementById(destination))?.focus({preventScroll:true});
    message('Quantity saved: '+entity.name+' '+result.quantity+'.');
    return true;
  }catch(error){stockSession.errors[id]='Not saved. '+error.message;render();if(trigger==='enter'||trigger==='step')$('#quantity-'+id)?.focus({preventScroll:true});return false;}
}
function saveCharacterEdit({ navigate = true } = {}) {
  if (!characterEditSession) return false;
  characterEditSession = { ...characterEditSession, errors: characterEditSession.errors.filter(error => !error.saveFailure) };
  const result = buildCharacterEditCandidate(save, characterEditSession);
  if (result.errors.length) {
    characterEditSession = { ...characterEditSession, errors: result.errors, conflicted: result.conflict };
    render();
    const first = result.errors[0];
    if(first.field==='quantity'){revealStockQuantity(first.id);}
    const control = first.field === 'quantity' ? $('#quantity-'+first.id) : first.field === 'perk' ? $('[data-edit-perk="' + first.id + '"]')
      : $('[data-edit-field="' + first.field + '"]');
    (control || $('[data-edit-errors]'))?.focus();
    return false;
  }
  const id = characterEditSession.characterId, target = characterEditSession.returnRoute || characterWorkspaceHref(id);
  if (result.changed && !commit(next => { next.characters[id] = structuredClone(result.candidate.characters[id]); }, id)) {
    characterEditSession = { ...characterEditSession, errors: [{ field: 'session', saveFailure: true, message: 'Not saved. Your draft is retained for retry.' }] };
    render(); return false;
  }
  characterEditSession = null;
  if (navigate) { void requestWorkspaceNavigation(target); message(result.changed ? 'Character saved.' : 'No changes to save.'); }
  else {stockSession=null;stockSessionKey='';stockBlurPending=null;render();}
  return true;
}
async function resolveDirtyCharacterEdit(intent) {
  if (!characterEditSession?.dirty) return 'proceed';
  const focused = document.activeElement;
  const dialog = $('#dirty-navigation');
  dialog.returnValue = 'stay';
  dialog.showModal();
  const choice = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (choice === 'discard') {
    characterEditSession = null;stockSession=null;stockSessionKey='';stockBlurPending=null;
    render();return 'proceed';
  }
  if (choice === 'save') {
    try { store.assertWriter(); return saveCharacterEdit({ navigate: false }) ? 'proceed' : 'stay'; }
    catch (error) { message(error.message, true); return 'stay'; }
  }
  if (focused?.isConnected) focused.focus();
  return 'stay';
}
function finishWorkspaceNavigation() {
  const descriptor = parseCharacterWorkspaceRoute(route());
  if (descriptor?.section === 'edit' && !characterEditSession) {
    const previous = parseCharacterWorkspaceRoute(lastRoute);
    characterEditReturnRoute = previous?.status === 'valid' && previous.characterId === descriptor.characterId
      && !['edit', 'setup'].includes(previous.section) ? previous.canonicalRoute : null;
  }
  if (descriptor?.section !== 'edit') characterEditSession = null;
  if (!['edit','items-addons'].includes(descriptor?.section) || stockSessionKey !== descriptor.characterId+'/'+descriptor.section) {stockSession=null;stockSessionKey='';}
  if(descriptor?.section!=='power-addons'||killerSessionKey!==descriptor.characterId){killerSession=null;killerSessionKey='';killerBlurPending=null;}
  if (descriptor?.section !== 'setup') { characterSetup = null; setupQueue = null; }
  closeFilters(); setupOpen = false;
  if ($('#detail').open) $('#detail').close();
  if ($('#message').className !== 'error') message('');
  committedWorkspaceHash = location.hash || '#dashboard';
  render(); window.scrollTo(0, 0); $('#main').focus();
}
function acceptPendingKillerQuantities() {
  if(killerSession){
    const pending=killerSession.entities.filter(entity=>killerSession.pending[entity.id]||killerSession.errors[entity.id]);
    for(const entity of pending){
      if(!acceptKillerQuantity(entity.id,'enter'))return false;
    }
  }
  return true;
}
async function requestWorkspaceNavigation(destination, { source = 'link' } = {}) {
  const hash = destination.startsWith('#') ? destination : '#' + destination;
  if (hash === committedWorkspaceHash) return true;
  if(!acceptPendingKillerQuantities())return false;
  if(stockSession?.mode==='detail'&&stockBlurPending?.key===stockSessionKey){
    const pending=stockBlurPending;stockBlurPending=null;
    if(!acceptStock(pending.id,'blur',pending.destination))return false;
  }
  if (await resolveDirtyCharacterEdit({ destination: hash, source }) !== 'proceed') return false;
  history.pushState({ ...history.state, workspaceIndex: ++workspaceHistoryIndex }, '', hash);
  finishWorkspaceNavigation();
  return true;
}
function render() {
  if (!initialized) { $('#main').innerHTML = '<section class="panel"><h1>Loading tracker…</h1></section>'; editorPresentation(); return; }
  const current = route(), workspaceRoute = parseCharacterWorkspaceRoute(current), characterRoute = parseCharacterInventoryRoute(current),
    section = workspaceRoute?.status === 'valid' ? characterById[workspaceRoute.characterId].role + 's' : current;
  characterInventorySession = syncCharacterInventorySession(characterInventorySession, current);
  if (current !== lastRoute) {
    closeFilters();
    filterMemory.write(lastRoute, filters);
    filters = filterMemory.read(current) || { search: '', status: 'all', prestige: 'all', favorite: false, sort: 'name' };
    lastRoute = current;
  }
  document.querySelectorAll('nav a').forEach(a => { a.classList.toggle('active', a.dataset.page === section); if (a.dataset.page === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#survivor-count').textContent = roleCharacters('survivor').filter(c => save.characters[c.id].owned).length;
  $('#killer-count').textContent = roleCharacters('killer').filter(c => save.characters[c.id].owned).length;
  $('#breadcrumb').textContent = (section || 'overview').replace(/-/g, ' ').toUpperCase();
  if (setupOpen && !storageBlocked) {
    $('#breadcrumb').textContent = 'ACCOUNT SETUP';
    preserveRender($('#main'), setupView(save, setupStep, setupSearch, setupFilter));
    editorPresentation();
    return;
  }
  const views = { dashboard, survivors: () => collection('survivor'), killers: () => collection('killer'), 'survivor-perks': () => library('survivor'), 'killer-perks': () => library('killer'), data: dataPage };
  const html = workspaceRoute ? characterWorkspaceView(workspaceRoute) : (Object.hasOwn(views, current) ? views[current] : dashboard)();
  stockRendering=true;
  const familyScroll=$('.stock-family-nav')?.scrollLeft;
  const openStockReferences=[...document.querySelectorAll('[data-stock-card] details[open]')].map(node=>node.closest('[data-stock-card]').dataset.stockCard);
  try {
    preserveRender($('#main'), html);
    if(familyScroll!==undefined&&$('.stock-family-nav'))$('.stock-family-nav').scrollLeft=familyScroll;
    for(const entityId of openStockReferences){const details=$('[data-stock-card="'+entityId+'"] details');if(details)details.open=true;}
  }
  finally {stockRendering=false;}
  document.querySelectorAll('[data-action="export"]').forEach(button => {
    button.disabled = storageBlocked;
    button.title = storageBlocked ? 'Stored progress is unavailable. Use Export original stored data on Data & backups.' : '';
  });
  filterMemory.write(current, filters);
  updateFilterPanel();
  const result = $('#perk-results');
  const announcement = result ? result.textContent.split('PERKS')[0].trim() + ' perks shown' : '';
  if ($('#filter-status').textContent !== announcement) $('#filter-status').textContent = announcement;
  if (storageBlocked) $('#save-status').textContent = 'Stored save needs recovery';
  editorPresentation();
  positionCharacterInventoryQuickPicker();
}

function dialogHeader(eyebrow, title, artwork = '') {
  return `<div class="dialog-heading"><div><span class="eyebrow">${eyebrow}</span><h2 id="detail-title"${artwork ? ' class="perk-detail-title"' : ''}>${artwork}${esc(title)}</h2></div><button class="close-dialog" data-action="close" aria-label="Close details">×</button></div>`;
}
function killerPowerDataMarkup(value) {
  if(Array.isArray(value))return value.length?'<ul>'+value.map(item=>'<li>'+killerPowerDataMarkup(item)+'</li>').join('')+'</ul>':'<p>None recorded.</p>';
  if(value&&typeof value==='object')return '<dl>'+Object.entries(value).map(([key,item])=>'<div><dt>'+esc(key.replace(/([A-Z])/g,' $1'))+'</dt><dd>'+killerPowerDataMarkup(item)+'</dd></div>').join('')+'</dl>';
  if(value===null||value===undefined||value==='')return '<span>—</span>';
  return esc(value);
}
function killerPowerDetail(characterId) {
  const power=killerPowerByCharacterId[characterId];
  if(!power)return dialogHeader('KILLER POWER DETAILS','Unavailable Power')+'<p class="muted">This Killer Power is not in the current verified catalog.</p>';
  const art=killerPowerIconPath(characterId,assetManifest);
  const artwork=art?'<img src="'+esc(artworkUrl(art))+'" alt="">':'<span class="stock-art-fallback" role="img" aria-label="Power artwork unavailable">◇</span>';
  const fields=[['fullExplanation','Full Explanation'],['components','Components'],['mechanics','Mechanics'],['resources','Resources'],['survivorInteractions','Survivor Interactions'],['powerStates','Power States'],['addonRelevantMechanics','Add-on-Relevant Mechanics'],['complexRules','Complex Rules']];
  return dialogHeader('KILLER POWER',power.powerName,artwork)+'<div class="stock-detail-body killer-detail-body">'
    +fields.filter(([key])=>power[key]!==undefined&&power[key]!==null&&power[key]!==''&&(!Array.isArray(power[key])||power[key].length))
      .map(([key,label])=>'<section data-power-detail-field="'+key+'"><h3>'+label+'</h3>'+killerPowerDataMarkup(power[key])+'</section>').join('')
    +'</div>';
}
function killerAddonDetail(addonId) {
  const addon=inventoryEntityById[addonId];
  if(!addon||addon.role!=='killer')return dialogHeader('ADD-ON DETAILS','Unavailable Add-on')+'<p class="muted">This Killer Add-on is not in the current verified catalog.</p>';
  const art=inventoryIconPath(addonId,assetManifest);
  const artwork=art?'<img src="'+esc(artworkUrl(art))+'" alt="">':'<span class="stock-art-fallback" aria-hidden="true">◇</span>';
  return dialogHeader('KILLER ADD-ON',addon.name)+'<div class="stock-detail-body killer-detail-body"><div class="stock-detail-hero"><div class="stock-detail-media">'+artwork+'</div><div class="stock-detail-meta"><span class="inventory-rarity-badge inventory-rarity-'+esc(addon.rarity.toLowerCase().replace(/\s+/g,'-'))+'">'+esc(addon.rarity)+'</span></div></div><section><h3>Effect</h3><p data-killer-addon-effect>'+esc(addon.effect)+'</p></section></div>';
}
function openKillerPowerDetail(characterId,opener) {
  killerBlurPending=null;
  closeFilters();$('#detail-message').hidden=true;$('#detail-message').textContent='';
  killerDetailOpener={id:opener?.id||''};modal={type:'killer-power',id:characterId};
  $('#detail-content').innerHTML=killerPowerDetail(characterId);
  if(!$('#detail').open)$('#detail').showModal();editorPresentation();
}
function openKillerAddonDetail(addonId,opener) {
  killerBlurPending=null;
  closeFilters();$('#detail-message').hidden=true;$('#detail-message').textContent='';
  killerDetailOpener={id:opener?.id||''};modal={type:'killer-addon',id:addonId};
  $('#detail-content').innerHTML=killerAddonDetail(addonId);
  if(!$('#detail').open)$('#detail').showModal();editorPresentation();
}
function inventoryDetail(id) {
  const entity=inventoryEntityById[id];
  if(!entity||entity.role!=='survivor') return dialogHeader('INVENTORY DETAILS','Unavailable inventory record')+'<p class="muted">This record is not in the current Survivor inventory catalog.</p>';
  const family=inventoryFamily(entity), art=inventoryIconPath(entity.id,assetManifest);
  const compatible=entity.map==='addons' ? entity.compatibleItemIds.map(itemId=>inventoryEntityById[itemId]?.name).filter(Boolean) : [];
  return dialogHeader(entity.map==='addons'?'ADD-ON DETAILS':'ITEM DETAILS',entity.name)
    +'<div class="stock-detail-body"><div class="stock-detail-hero"><div class="stock-detail-media">'+(art?'<img src="'+esc(art)+'" alt="" data-inventory-detail-icon>':'<span class="stock-art-fallback" aria-hidden="true">◇</span>')+'</div>'
    +'<div class="stock-detail-meta">'+inventoryRarityBadge(entity)+'<span>'+esc(family.displayName)+'</span></div></div>'
    +'<section><h3>Effect</h3><p>'+esc(entity.effect)+'</p></section>'
    +(compatible.length?'<section><h3>Compatible Items</h3><ul>'+compatible.map(name=>'<li>'+esc(name)+'</li>').join('')+'</ul></section>':'')
    +(entity.needsVerification||entity.notes?'<section><h3>Qualification notes</h3><p>'+esc(entity.notes||'Optional catalog metadata remains qualified.')+'</p></section>':'')
    +'<section><h3>Research sources</h3><div class="stock-detail-sources">'+entity.provenance.references.map((url,index)=>'<a data-stock-source href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Source '+(index+1)+'</a>').join(' · ')+'</div></section></div>';
}
function openStockDetail(id, opener) {
  closeFilters();
  $('#detail-message').hidden=true;$('#detail-message').textContent='';
  stockDetailOpener={id:opener?.id||'',entityId:id};
  modal={type:'stock',id};
  $('#detail-content').innerHTML=inventoryDetail(id);
  if(!$('#detail').open)$('#detail').showModal();
  editorPresentation();
}
function perkDetail(id) {
  const perk = perkById[id], stats = perkStats(save, perk), source = save.characters[perk.sourceCharacterId];
  const override = save.perkOverrides[id] || {};
  const accountTierControl = (field, label, emptyLabel) => {
    const internalField = field === 'shrine' ? 'shrineTier' : 'manualTier';
    const current = override[internalField] || 0;
    return `<div class="account-unlock-row"><div class="account-unlock-copy"><strong>${label}</strong><small>Current: ${current ? `Tier ${roman[current]}` : emptyLabel}</small>${field === 'other' ? '<small>Use when the account unlock source is not tracked.</small>' : ''}</div><div class="account-tier-options" role="group" aria-label="Set ${label} for ${esc(perkName(save, perk))}">${roman.map((name, tier) => `<button type="button" data-action="account-unlock-tier" data-id="${esc(id)}" data-field="${field}" data-tier="${tier}" aria-pressed="${current === tier}">${tier ? name : emptyLabel}</button>`).join('')}</div></div>`;
  };
  const prestige = source ? Math.min(3, Math.max(0, source.prestige || 0)) : 0;
  const legacy = override.legacyTier || 0;
  const globalSource = unlockSource(save, perk);
  const displayedSource = globalSource.includes('Legacy') && globalSource.includes('Unspecified') ? 'Account unlock' : globalSource.replace('Unspecified', 'Other account unlock');
  const accountUnlock = `<section class="account-unlock-section" aria-labelledby="account-unlock-heading"><h3 id="account-unlock-heading" class="detail-section-label">ACCOUNT UNLOCK <span>Edit account-wide sources without changing personal records</span></h3>${accountTierControl('shrine', 'Shrine', 'Not unlocked')}${accountTierControl('other', 'Other account unlock', 'Not recorded')}${prestige ? `<div class="account-unlock-readonly"><strong>Prestige</strong><span>Tier ${roman[prestige]} via ${esc(perk.sourceCharacterName)}</span><small>Derived from character Prestige · read-only</small></div>` : ''}${legacy ? `<div class="account-unlock-readonly"><strong>Legacy account unlock</strong><span>Tier ${roman[legacy]}</span><small>Historical account state · read-only</small></div>` : ''}</section>`;
  return dialogHeader(perk.role.toUpperCase() + ' PERK', perkName(save, perk), perkArtwork(perk)) + historicalPerkNote(perk) + (perk.historicalAvailability?.note ? `<p class="historical-detail-note">${esc(perk.historicalAvailability.note)}</p>` : '') + `<div class="perk-detail-info"><div><span>SOURCE CHARACTER / PRESTIGE</span><strong>${esc(perk.sourceCharacterName)}${source ? ` · P${source.prestige}` : ''}</strong><small>${source ? source.owned ? 'Source owned' : 'Source locked' : 'General perk'}</small></div><div><span>GLOBAL AVAILABILITY / AUTO-OWNED TIER</span><strong>${globalBadge(perk)}</strong><small>${esc(displayedSource)}${perk.general && !globalTier(save, perk) ? ' · Available in every Bloodweb; no auto-owned tier' : ''}</small></div></div>${accountUnlock}<p class="panel-note">Effective global tier uses the highest Prestige, Legacy, Shrine, or Other account unlock. Existing personal tiers are preserved.</p><div class="manager-stats"><span><strong>${stats.owned}</strong> / ${stats.total} owned characters</span><span><strong>${stats.tier3}</strong> Tier III</span><span><strong>${stats.missing}</strong> missing</span></div><h3 class="detail-section-label">CHARACTER-OWNED TIERS <span>Click to record an upgrade</span></h3><div class="detail-inventories">${roleCharacters(perk.role).sort((a, b) => Number(save.characters[b.id].owned) - Number(save.characters[a.id].owned) || a.name.localeCompare(b.name)).map(c => {
    const next = bloodwebNextTier(save, c.id, perk);
    const personal = recordedTier(save, c.id, perk.id);
    const correction = `<label class="select-label">Personal record<select id="personal-tier-${c.id}-${perk.id}" data-personal-tier="${perk.id}" data-character="${c.id}" aria-label="Personal tier of ${esc(perkName(save, perk))} on ${esc(c.name)}">${[0, 1, 2, 3].map(t => `<option value="${t}" ${personal === t ? 'selected' : ''}>${t ? 'Tier ' + roman[t] : 'None (clear record)'}</option>`).join('')}</select></label>`;
    return `<div class="perk-character-row"><span>${esc(c.name)}<small>${save.characters[c.id].owned ? 'Owned' : 'Locked'} · P${save.characters[c.id].prestige} · ${esc(ownedUnlockSource(save, c.id, perk))}</small><small>Next Bloodweb tier: ${next ? roman[next] : inventoryTier(save, c.id, perk.id) === 3 ? 'Maxed' : 'Not available'}</small></span><div>${correction}${perk.historicalAvailability?.manualOwnership ? historicalOwnershipControl(save, c.id, perk) : ''}<small>Effective owned tier · automatic minimums still apply</small>${tierButton(c.id, perk, 'detail-')}</div></div>`;
  }).join('')}</div>`;
}
function openDetail(type, id) {
  closeFilters();
  $('#detail-message').hidden = true;
  $('#detail-message').textContent = '';
  modal = { type, id };
  $('#detail-content').innerHTML = perkDetail(id);
  if (!$('#detail').open) $('#detail').showModal();
  editorPresentation();
}
function refreshDetail() {
  if (parseCharacterWorkspaceRoute(route())?.section === 'setup' && characterSetup) { render(); return; }
  if (!modal || !$('#detail').open) return;
  const scrollTop = $('#detail').scrollTop;
  const detail=modal.type==='stock'?inventoryDetail(modal.id):modal.type==='killer-power'?killerPowerDetail(modal.id):modal.type==='killer-addon'?killerAddonDetail(modal.id):perkDetail(modal.id);
  preserveRender($('#detail-content'),detail);
  $('#detail').scrollTop = scrollTop;
  editorPresentation();
}
function confirmAction(title, text, label = 'Confirm') {
  closeFilters();
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-accept').textContent = label;
  $('#confirmation').returnValue = 'cancel';
  $('#confirmation').showModal();
  return new Promise(resolve => $('#confirmation').addEventListener('close', () => resolve($('#confirmation').returnValue === 'accept'), { once: true }));
}
function download(content, filename, type = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportFile() {
  if (!initialized) { message('Wait for stored data to load before exporting.', true); return; }
  if (storageBlocked) { message('Export JSON is disabled because stored progress is unavailable. Use Export original stored data on Data & backups.', true); return; }
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  download(exportSave(save), `dbd-tracker-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`);
}
function v1ReplacementNotice(parsed) {
  return parsed.sourceSchemaVersion === 1
    ? ' This v1 replacement loads an empty Prestige Queue and empty inventory quantity maps; current goals and stock will be replaced.'
    : '';
}
async function restore(id) {
  store.assertWriter();
  const backup = store.backups().find(b => b.id === id);
  if (!backup) return;
  const parsed = parseSave(JSON.stringify(backup.save));
  const incoming = parsed.save;
  const recovering = storageBlocked;
  if (!await confirmAction('Restore this backup?', `Restore progress from ${date(backup.createdAt)}? ${recovering ? 'The original stored data will be preserved verbatim before replacement.' : 'A snapshot of your current progress will be saved first.'}${v1ReplacementNotice(parsed)}`, 'Restore backup')) return;
  save = store.replace(save, incoming, 'Before backup restore', { recover: recovering });
  storageBlocked = false;
  $('#save-status').textContent = 'Saved locally';
  message(`Backup restored. ${recovering ? 'The original stored data was preserved separately in this browser.' : 'Your previous progress is in local backups.'}`); render();
}
async function reset() {
  store.assertWriter();
  if (storageBlocked) { message('Import a valid save to recover before resetting. The original stored data is preserved.', true); return; }
  if (!await confirmAction('Reset all progress?', 'All progression, ownership, notes, favorites, perk tiers, Shrine overrides, Prestige Queue goals, and inventory quantities will return to defaults. Your current save will be backed up. Catalog definitions are preserved.', 'Reset all progress')) return;
  save = store.replace(save, freshSave(), 'Before reset');
  setupOpen = false; setupStep = 0; setupSearch = ''; setupFilter = 'all';
  message('Progress reset. Your previous save is available in local backups.'); render();
}
function createCharacterSetupDraft(id, returnRoute = characterWorkspaceHref(id)) {
  const progress = save.characters[id];
  return { id, step: 'bloodweb', bloodwebLevel: progress.bloodwebLevel,
    perks: Object.fromEntries(Object.entries(progress.perks).filter(([perkId, tier]) => perkById[perkId]
      && (tier > 0 || perkById[perkId].historicalAvailability?.manualOwnership))), search: '', returnRoute };
}
function openCharacterSetup(id, { batch = null, returnRoute = null } = {}) {
  store.assertWriter();
  if (!save.characters[id]?.owned) throw new Error('Initial setup requires an owned character.');
  characterSetup = createCharacterSetupDraft(id, returnRoute || characterWorkspaceHref(id));
  characterSetup.batch = batch;
  location.hash = characterWorkspaceHref(id, 'setup');
  if ($('#detail').open) $('#detail').close();
  render();
  $('#character-setup-bloodweb')?.focus();
}
function advanceCharacterSetup() {
  while (setupQueue.index < setupQueue.ids.length) {
    const id = setupQueue.ids[setupQueue.index];
    if (save.characters[id].owned && !save.characters[id].setupComplete) {
      openCharacterSetup(id, { batch: { position: setupQueue.index + 1, total: setupQueue.ids.length },
        returnRoute: setupQueue.returnRoute });
      return;
    }
    setupQueue.index++;
  }
  const completed = setupQueue.completed;
  const returnRoute = setupQueue.returnRoute || '#dashboard';
  setupQueue = null;
  characterSetup = null;
  location.hash = returnRoute; render();
  message(`Setup pass finished. ${completed} character${completed === 1 ? '' : 's'} completed. Run character setups again to continue any skipped characters.`);
}
function finishCharacterSetup() {
  store.assertWriter();
  const draft = characterSetup;
  if (storageBlocked) { message('Import a valid save before completing character setup.', true); return; }
  store.backup(save, `Before character setup: ${characterById[draft.id].name}`);
  if (commit(next => completeCharacterSetup(next, draft.id, draft.bloodwebLevel, draft.step === 'bloodweb' ? {} : draft.perks), draft.id)) {
    if (setupQueue) {
      setupQueue.completed++;
      setupQueue.index++;
      advanceCharacterSetup();
      return;
    }
    const returnRoute = draft.returnRoute || characterWorkspaceHref(draft.id);
    characterSetup = null; location.hash = returnRoute; render(); message('Character setup completed. Personal records preserved; automatic minimums remain in effect.');
  }
}
function characterInventoryRecordKey(currentSave, characterId, perkId) {
  const inventory = currentSave.characters[characterId]?.perks || {};
  return Object.hasOwn(inventory, perkId) ? `present:${inventory[perkId]}` : 'absent';
}
async function handleClick(event) {
  if (event.target.closest('.skip-link')) { event.preventDefault(); $('#main').focus(); $('#main').scrollIntoView(); return; }
  const link = event.target.closest('a[href]');
  if (link?.getAttribute('href').startsWith('#') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    && link.target !== '_blank' && event.button === 0) {
    event.preventDefault(); await requestWorkspaceNavigation(link.getAttribute('href')); return;
  }
  if (setupOpen && event.target.closest('nav a')) { setupOpen = false; render(); }
  if(event.target.closest('#inventory-filters-toggle')&&stockBlurPending?.key===stockSessionKey){
    event.preventDefault();const open=!$('#inventory-filters').open;
    const pending=stockBlurPending;stockBlurPending=null;
    acceptStock(pending.id,'blur','inventory-filters-toggle');
    $('#inventory-filters').open=open;$('#inventory-filters-toggle').focus({preventScroll:true});return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, character, perk, mode, family } = button.dataset;
  if(action==='stock-step'){stepStock(button);return;}
  if(action==='killer-stock-step'){stepKillerQuantity(button);return;}
  if(action==='stock-family-select'){selectStockFamily(family);return;}
  if(action==='queue-manage'){queueView.expanded=!queueView.expanded;render();$('[data-action="queue-manage"]')?.focus();return;}
  if(action==='queue-filter'){queueView.role=button.dataset.role;render();$('[data-action="queue-filter"][data-role="'+queueView.role+'"]')?.focus();return;}
  if(action==='stock-error-focus'){
    revealStockQuantity(id);return;
  }
  if (characterEditSession?.dirty && action !== 'character-edit-save' && action !== 'character-edit-cancel'
    && (requiresEditor(action) || action === 'character' || action === 'enable-editing')) {
    if (await resolveDirtyCharacterEdit({ action }) !== 'proceed') return;
  }
  if (characterEditSession && $('#detail').contains(button) && requiresEditor(action)) { message('Reference only during Edit Character.', true); return; }
  if (action === 'character-edit-save') { store.assertWriter(); saveCharacterEdit(); return; }
  if (action === 'character-edit-cancel') {
    const target = characterEditSession?.returnRoute || characterWorkspaceHref(characterEditSession.characterId);
    if (await resolveDirtyCharacterEdit({ action }) !== 'proceed') return;
    characterEditSession = null; await requestWorkspaceNavigation(target); return;
  }
  if (action === 'character-edit-all') { characterEditViewState.allRole = !characterEditViewState.allRole; render(); return; }
  if (action === 'enable-editing') return enableEditing();
  if (requiresEditor(action)) store.assertWriter();
  if(action==='queue-add'||action==='queue-target'){openPrestigeTargetEditor(id,action==='queue-add',button);return;}
  if(action==='queue-select'){openPrestigeTargetEditor($('#queue-character').value,true,queueOpener);return;}
  if(action==='queue-shortcut'){
    if(Number(button.dataset.target)<=save.characters[queueTargetEditor.id].prestige)return;
    $('#queue-target').value=button.dataset.target;$('#queue-target').focus();return;
  }
  if(action==='queue-save'){
    const raw=$('#queue-target').value.trim();
    try {
      if(!/^\d+$/.test(raw))throw new Error('Enter a positive whole-number target.');
      const candidate=structuredClone(save);
      const targetAction={type:queueTargetEditor.adding?'add':'target',characterId:queueTargetEditor.id,targetPrestige:Number(raw)};
      if(!applyPrestigeQueueAction(candidate,targetAction)){$('#detail').close();queueTargetEditor=null;return;}
      if(commitPrestigeQueueAction(targetAction)){
        $('#detail').close();queueTargetEditor=null;
      }
    }catch(error){$('#queue-target-error').textContent=error.message;$('#queue-target').focus();}
    return;
  }
  if(action==='queue-remove'||action==='queue-move'||action==='queue-move-down'){
    if(action!=='queue-remove'&&(!queueView.expanded||queueView.role!=='all'))return;
    const visibleBefore=derivePrestigeQueue(save).rows.filter(r=>queueView.role==='all'||r.character?.role===queueView.role);
    const index=visibleBefore.findIndex(r=>r.entry.characterId===id);
    if(commitPrestigeQueueAction({type:action==='queue-remove'?'remove':'move',characterId:id,direction:Number(button.dataset.direction)})){
      const remaining=derivePrestigeQueue(save).rows;
      const visibleAfter=remaining.filter(r=>queueView.role==='all'||r.character?.role===queueView.role);
      const focusId=action==='queue-remove'?(visibleAfter[Math.min(index,visibleAfter.length-1)]?.entry.characterId):id;
      const target=action==='queue-remove'?$('#queue-remove-'+focusId):$('#'+action+'-'+id);
      (target&&!target.disabled?target:$('#queue-remove-'+focusId)||$('#queue-add'))?.focus({preventScroll:true});
      const name=characterById[id]?.name||id;
      $('#filter-status').textContent=action==='queue-remove'?`${name} goal removed.`:`${name} moved to position ${remaining.findIndex(r=>r.entry.characterId===id)+1} of ${remaining.length}.`;
    }
    return;
  }
  if (action === 'character-setup-all') {
    if (storageBlocked) { message('Import a valid save before running character setups.', true); return; }
    const pending = characters.filter(c => save.characters[c.id].owned && !save.characters[c.id].setupComplete).sort((a, b) => Number(b.role === 'survivor') - Number(a.role === 'survivor'));
    if (!pending.length) {
      message(characters.some(c => save.characters[c.id].owned) ? 'All owned characters have completed setup.' : 'Mark your characters Owned first, then run character setups.');
      return;
    }
    setupQueue = { ids: pending.map(c => c.id), index: 0, completed: 0, returnRoute: '#' + route() };
    advanceCharacterSetup();
    return;
  }
  if (action === 'character-setup-next-character' && setupQueue) { setupQueue.index++; advanceCharacterSetup(); return; }
  if (action === 'character-setup-exit') {
    const target = characterSetup?.returnRoute || '#dashboard';
    setupQueue = null; characterSetup = null; location.hash = target; render(); return;
  }
  if (action === 'character-setup-skip') { characterSetup = null; refreshDetail(); return; }
  if (action === 'character-setup-edit') {
    openCharacterSetup(id); return;
  }
  if (action === 'character-setup-start') { openCharacterSetup(characterSetup.id); return; }
  if (action === 'character-setup-p1' && characterSetup?.step === 'bloodweb') {
    characterSetup.bloodwebLevel = $('#character-setup-bloodweb').value;
    const characterId = characterSetup.id;
    if (commit(next => { next.characters[characterId].prestige = Math.max(1, next.characters[characterId].prestige); }, characterId)) refreshDetail();
    return;
  }
  if (action === 'character-setup-next') {
    const input = $('#character-setup-bloodweb');
    if (!input.reportValidity()) return;
    characterSetup.bloodwebLevel = Number(input.value);
    if (characterSetup.bloodwebLevel === 1 && save.characters[characterSetup.id].prestige === 0) { finishCharacterSetup(); return; }
    characterSetup.step = 'perks'; refreshDetail(); return;
  }
  if (action === 'character-setup-back') { characterSetup.step = 'bloodweb'; refreshDetail(); return; }
  if (action === 'character-setup-special' && characterSetup?.step === 'perks') {
    characterSetup.specialUnlocks = !characterSetup.specialUnlocks;
    refreshDetail(); return;
  }
  if (action === 'character-setup-finish') {
    finishCharacterSetup();
    return;
  }
  if (action === 'character-inventory-open-update') {
    location.hash = characterWorkspaceHref(id, 'perks', 'update');
    return;
  }
  if (action === 'character-inventory-card-size') {
    characterCardSize = normalizeCharacterCardSize(button.dataset.size);
    saveCharacterCardSize(characterCardSize);
    render();
    return;
  }
  if (action === 'character-inventory-select') {
    characterInventorySession = { ...characterInventorySession, selectedPerkId: perk, quickPerkId: perkById[perk]?.historicalAvailability?.manualOwnership ? null : perk };
    const characterRoute = parseCharacterInventoryRoute(route());
    if (characterRoute?.mode === 'inventory') {
      characterInventorySession = { ...createCharacterInventorySession(characterWorkspaceHref(character, 'perks', 'update')), selectedPerkId: perk };
      location.hash = characterWorkspaceHref(character, 'perks', 'update');
    } else {
      render();
      $('.character-inventory-quick-picker button:not(:disabled)')?.focus({ preventScroll: true });
    }
    return;
  }
  if (action === 'character-inventory-all-role') { characterInventorySession = { ...characterInventorySession, allRole: !characterInventorySession.allRole }; render(); return; }
  if (action === 'character-inventory-category') {
    characterInventorySession = { ...characterInventorySession, category: button.dataset.category };
    render();
    return;
  }
  if (action === 'character-inventory-set-tier') {
    const characterId = button.dataset.character, perkId = button.dataset.perk;
    const tier = button.dataset.tier === 'none' ? null : Number(button.dataset.tier);
    const before = characterInventoryRecordKey(save, characterId, perkId);
    if (!commit(next => setCharacterPersonalTier(next, characterId, perkId, tier), characterId)) return;
    if (before !== characterInventoryRecordKey(save, characterId, perkId)) characterInventorySession = markCharacterInventoryChanged(characterInventorySession, perkId);
    const wasQuick = Boolean(characterInventorySession.quickPerkId);
    characterInventorySession = { ...characterInventorySession, selectedPerkId: perkId, quickPerkId: null };
    render();
    if (wasQuick) $(`.perk-card[data-perk="${perkId}"]`)?.focus();
    return;
  }
  if (action === 'account-unlock-tier') {
    const field = { shrine: 'shrineTier', other: 'manualTier' }[button.dataset.field];
    const tier = Number(button.dataset.tier);
    if (!field || !Number.isSafeInteger(tier) || tier < 0 || tier > 3) throw new Error('Select a valid account unlock tier.');
    if (commit(next => { const override = next.perkOverrides[id] ??= { shrineTier: 0 }; override[field] = tier; })) refreshDetail();
    return;
  }
  if (action === 'setup-open') { closeFilters(); setupOpen = true; setupStep = 0; setupSearch = ''; setupFilter = 'all'; render(); window.scrollTo(0, 0); return; }
  if (action === 'setup-exit') { setupOpen = false; location.hash = 'dashboard'; render(); return; }
  if (action === 'setup-p1') {
    if (commit(next => { next.characters[id].owned = true; next.characters[id].prestige = Math.max(1, next.characters[id].prestige); }, id)) $(`#setup-prestige-${id}`)?.focus({ preventScroll: true });
    return;
  }
  if (action === 'setup-filter') { setupFilter = button.dataset.filter; render(); return; }
  if (action === 'setup-next' || action === 'setup-back') {
    if (action === 'setup-next' && [...document.querySelectorAll('[data-setup-prestige]')].some(input => !input.reportValidity())) return;
    if (action === 'setup-next' && setupStep === 2) {
      if (commit(next => { next.setupComplete = true; })) { setupOpen = false; location.hash = 'dashboard'; render(); }
    } else {
      setupStep += action === 'setup-next' ? 1 : -1;
      setupSearch = ''; setupFilter = 'all'; render();
    }
    window.scrollTo(0, 0);
    return;
  }
  if (action === 'stock-details') return openStockDetail(id, button);
  if (action === 'killer-power-details') return openKillerPowerDetail(character,button);
  if (action === 'killer-addon-details') return openKillerAddonDetail(id,button);
  if (action === 'export') return exportFile();
  if (action === 'raw-export') return download(store.original(), 'dbd-tracker-original-data.txt', 'text/plain;charset=utf-8');
  if (action === 'import') return $('#import-file').click();
  if (action === 'close' || action === 'manage-link') { $('#detail').close(); modal = null; return; }
  if (action === 'character') return requestWorkspaceNavigation(characterWorkspaceHref(id));
  if (action === 'perk') return openDetail(action, id);
  if (action === 'filters-open' || action === 'filter-summary') { openFilters(button.dataset.group); return; }
  if (action === 'filters-close') { closeFilters(true); return; }
  if (action === 'quick-view') { filters = selectQuickView(getFilterContext(route()), filters, button.dataset.quick); render(); return; }
  if (action === 'clear-group' || action === 'clear-advanced') {
    const summaries = [...document.querySelectorAll('.filter-summary > button:first-child')];
    const index = summaries.findIndex(n => n.dataset.group === button.dataset.group);
    const insidePanel = $('#perk-filter-panel').contains(button);
    filters = clearAdvancedFilters(getFilterContext(route()), filters, action === 'clear-group' ? button.dataset.group : undefined);
    render();
    if (!insidePanel) (document.querySelectorAll('.filter-summary > button:first-child')[Math.max(0, index)] || $('#filters-trigger'))?.focus({ preventScroll: true });
    return;
  }
  if (action === 'filter') { filters.status = button.dataset.filter; render(); return; }
  if (action === 'favorites-filter') { filters.favorite = !filters.favorite; render(); return; }
  if (action === 'favorite' || action === 'ownership') {
    const field = action === 'favorite' ? 'favorite' : 'owned';
    commit(next => { next.characters[id][field] = !next.characters[id][field]; }, id); return;
  }
  if (action === 'cycle') {
    if (inventoryTier(save, character, perk) === 3 || !bloodwebEligible(save, character, perkById[perk])) return;
    const scope = $('#detail').open ? $('#detail-content') : $('#main');
    const actions = [...scope.querySelectorAll('[data-action="cycle"]:not(:disabled)')];
    const index = actions.indexOf(button);
    if (!commit(next => { next.characters[character].perks[perk] = inventoryTier(next, character, perk) + 1; }, character)) return;
    refreshDetail();
    const same = scope.querySelector(`[data-action="cycle"][data-character="${character}"][data-perk="${perk}"]`);
    const remaining = [...scope.querySelectorAll('[data-action="cycle"]:not(:disabled)')];
    (same && !same.disabled ? same : remaining[Math.max(0, index)] || $('#perk-results') || scope.querySelector('[data-action="close"]'))?.focus({ preventScroll: true });
    return;
  }
  if (action === 'restore') return restore(id);
  if (action === 'reset') return reset();
  if (action === 'delete-backup' && await confirmAction('Delete local backup?', 'This snapshot will be removed from this browser. Your current progression will stay intact.', 'Delete backup')) { store.deleteBackup(id); render(); }
}
document.addEventListener('pointerdown', event => {
  if (characterInventorySession.quickPerkId && !event.target.closest('.character-inventory-quick-picker, .perk-card[data-action="character-inventory-select"]')) closeCharacterInventoryQuickPicker();
});
document.addEventListener('click', event => { handleClick(event).catch(error => message(error.message || 'The action could not be completed.', true)); });
document.addEventListener('input', event => {
  if(event.target.hasAttribute('data-killer-quantity')){try{killerQuantityInput(event.target);}catch(error){message(error.message,true);}return;}
  if(event.target.dataset.inventoryQuantity){try{stockInput(event.target);}catch(error){message(error.message,true);}return;}
  if(event.target.id==='inventory-search'){stockFilters={...stockFilters,search:event.target.value};render();return;}
  if (event.target.dataset.editField) {
    try {
      store.assertWriter();
      const field = event.target.dataset.editField;
      characterEditSession = updateCharacterEditSession(characterEditSession, { field,
        value: event.target.type === 'checkbox' ? event.target.checked : event.target.value }, save);
    } catch (error) { message(error.message, true); }
    return;
  }
  if (event.target.id === 'character-edit-search') { characterEditViewState.search = event.target.value; render(); return; }
  if (event.target.id === 'character-setup-search') { characterSetup.search = event.target.value; refreshDetail(); }
  if (event.target.id === 'character-inventory-search') { characterInventorySession = { ...characterInventorySession, search: event.target.value }; render(); }
  if (event.target.id === 'setup-search') { setupSearch = event.target.value; render(); }
  if (event.target.dataset.setupPrestige) {
    const target = event.target, id = target.dataset.setupPrestige, value = Number(target.value);
    target.setCustomValidity(target.value && !Number.isSafeInteger(value) ? 'Enter a valid whole-number Prestige.' : '');
    if (target.checkValidity() && Number.isSafeInteger(value)) commit(next => { next.characters[id].prestige = value; }, id);
  }
  if (event.target.id === 'search') { filters.search = event.target.value; render(); }
});
document.addEventListener('change', async event => {
  const target = event.target;
  try {
    if(['inventory-map','inventory-rarity','inventory-in-stock'].includes(target.id)){
      const key={'inventory-map':'map','inventory-rarity':'rarity','inventory-in-stock':'inStock'}[target.id];
      stockFilters={...stockFilters,[key]:target.type==='checkbox'?target.checked:target.value};render();return;
    }
    if(target.dataset.inventoryQuantity)return;
    if (target.dataset.editField) return;
    if (target.dataset.editPerk || target.dataset.editCorrection) {
      store.assertWriter();
      if (target.dataset.editCorrection && target.value === '') return;
      const perkId = target.dataset.editPerk || target.dataset.editCorrection;
      characterEditSession = updateCharacterEditSession(characterEditSession, { field: 'perk', id: perkId,
        value: target.value === 'none' || target.value === '' ? null : Number(target.value),
        mode: target.dataset.editCorrection ? 'correction' : target.dataset.mode }, save);
      render(); return;
    }
    if (characterEditSession && $('#detail').contains(target)) { message('Reference only during Edit Character.', true); return; }
    if (target.matches(editingControls)) store.assertWriter();
    if (target.dataset.characterInventoryHistorical) {
      if (target.value === '') return;
      const perkId = target.dataset.characterInventoryHistorical, characterId = target.dataset.character;
      const before = characterInventoryRecordKey(save, characterId, perkId);
      if (!commit(next => setHistoricalPerkTier(next, characterId, perkId, Number(target.value)), characterId)) return;
      if (before !== characterInventoryRecordKey(save, characterId, perkId)) characterInventorySession = markCharacterInventoryChanged(characterInventorySession, perkId);
      characterInventorySession = { ...characterInventorySession, selectedPerkId: perkId };
      render();
      return;
    }
    if (target.id === 'character-inventory-only-unrecorded') { characterInventorySession = { ...characterInventorySession, onlyUnrecorded: target.checked }; render(); return; }
    if (target.dataset.personalTier) {
      const tier = Number(target.value);
      commit(next => correctPersonalPerkTier(next, target.dataset.character, target.dataset.personalTier, tier === 0 ? null : tier), target.dataset.character);
      refreshDetail();
      return;
    }
    if (target.name === 'manager-view') { managerView = target.value; render(); return; }
    if (target.dataset.filterGroup) { filters = toggleAdvancedOption(getFilterContext(route()), filters, target.dataset.filterGroup, target.dataset.option); render(); return; }
    if (target.dataset.historicalOwnership) {
      if (target.value === '') return;
      const perkId = target.dataset.historicalOwnership, characterId = target.dataset.character;
      const tier = Number(target.value);
      if (target.dataset.historicalSetup) {
        const preview = structuredClone(save);
        setHistoricalPerkTier(preview, characterId, perkId, tier);
        characterSetup.perks[perkId] = tier;
        refreshDetail();
      } else if (commit(next => setHistoricalPerkTier(next, characterId, perkId, tier), characterId)) refreshDetail();
      return;
    }
    if (target.dataset.characterSetupPerk) {
      const id = target.dataset.characterSetupPerk;
      if (target.checked) characterSetup.perks[id] = 1;
      else delete characterSetup.perks[id];
      refreshDetail();
    }
    if (target.dataset.characterSetupTier) {
      const id = target.dataset.characterSetupTier;
      characterSetup.perks[id] = Math.max(recordedTier(save, characterSetup.id, id), automaticTier(save, characterSetup.id, perkById[id]), Number(target.value));
      refreshDetail();
    }
    if (target.dataset.setupOwned) { const id = target.dataset.setupOwned; commit(next => { next.characters[id].owned = target.checked; }, id); }
    if (target.dataset.setupPerk) {
      const id = target.dataset.setupPerk, p = perkById[id];
      if (!p.general && !(save.characters[p.sourceCharacterId]?.prestige > 0)) commit(next => setGlobalPerkUnlocked(next, p, target.checked));
    }
    if (target.id === 'halloween-names') { commit(next => { next.settings.halloweenNames = target.value; }); refreshDetail(); }
    if (target.id === 'hellraiser-names') { commit(next => { next.settings.hellraiserNames = target.value; }); refreshDetail(); }
    if (target.id === 'sort') { filters.sort = target.value; render(); }
    if (target.id === 'prestige-filter') { filters.prestige = target.value; render(); }
    if (target.id === 'import-file') {
      if (await resolveDirtyCharacterEdit({ action: 'import-file' }) !== 'proceed') { target.value = ''; return; }
      const file = target.files[0]; target.value = '';
      if (!file) return;
      pendingImport = parseSave(await file.text());
      const incoming = pendingImport.save;
      const summary = s => `${Object.keys(s.characters).length} records, ${Object.values(s.characters).filter(c => c.owned).length} owned, ${Object.values(s.characters).reduce((n, c) => n + Object.keys(c.perks).length, 0)} recorded perk tiers`;
      const warning = pendingImport.warnings.length ? ` ${pendingImport.warnings.length} unknown IDs will be preserved.` : '';
      const recovering = storageBlocked;
      const predecessor = recovering ? 'Current stored progress is unavailable. Its original bytes will be preserved separately before replacement.' : `Current: ${summary(save)}. A backup of your current data will be created.`;
      if (!await confirmAction('Import tracker data?', `${predecessor} Import: ${summary(incoming)}. This replaces your progression.${v1ReplacementNotice(pendingImport)}${warning}`, 'Import data')) { pendingImport = null; return; }
      save = store.replace(save, incoming, 'Before JSON import', { recover: recovering });
      storageBlocked = false;
      $('#save-status').textContent = 'Saved locally';
      message(`Import complete. ${recovering ? 'The original stored data was preserved separately in this browser.' : 'Your previous progress is in local backups.'}${pendingImport.warnings.length ? ' ' + pendingImport.warnings.join(' · ') : ''}`);
      pendingImport = null; render();
    }
  } catch (error) { pendingImport = null; message(error.message || 'Could not complete this change.', true); }
});
document.addEventListener('submit', event => {
  if (event.target.matches('[data-character-edit]')) { event.preventDefault(); return; }
});
document.addEventListener('keydown', event => {
  if(event.key==='Enter'&&event.target.hasAttribute('data-killer-quantity')){event.preventDefault();acceptKillerQuantity(event.target.dataset.killerQuantity,'enter');return;}
  if(event.key==='Enter'&&event.target.dataset.inventoryQuantity){event.preventDefault();acceptStock(event.target.dataset.inventoryQuantity,'enter');return;}
  if (event.key === 'Escape' && characterInventorySession.quickPerkId) { event.preventDefault(); closeCharacterInventoryQuickPicker(true); return; }
  if (event.key === 'Escape' && $('#perk-filter-panel').matches(':popover-open')) { event.preventDefault(); closeFilters(true); return; }
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !$('#detail').open && !$('#confirmation').open) { event.preventDefault(); (setupOpen ? $('#setup-search') : $('#search'))?.focus(); }
});
document.addEventListener('focusin',event=>{
  if(event.target.dataset.action==='stock-family-select')keepStockFamilyVisible(event.target);
});
document.addEventListener('focusout',event=>{
  if(stockRendering)return;
  if(event.target.hasAttribute('data-killer-quantity')||event.target.hasAttribute('data-killer-stock-step')){
    const id=event.target.dataset.killerQuantity||event.target.dataset.id, key=killerSessionKey, related=event.relatedTarget;
    if(related?.dataset.action==='killer-addon-details'||related?.dataset.action==='killer-power-details'||(modal?.type?.startsWith('killer-')&&$('#detail').open)){
      killerBlurPending=null;return;
    }
    const destination=related?.dataset.killerQuantity||related?.id;
    if(event.target.hasAttribute('data-killer-quantity'))killerBlurPending={id,key,destination};
    if(related?.dataset.killerQuantity===id||(related?.hasAttribute('data-killer-stock-step')&&related.dataset.id===id))return;
    if(killerBlurPending?.id===id&&killerBlurPending.key===key)setTimeout(()=>{
      if(killerBlurPending?.id===id&&killerBlurPending.key===key&&killerSessionKey===key)acceptKillerQuantity(id,'blur',destination);
    },0);
    return;
  }
  const id=event.target.dataset.inventoryQuantity||((event.target.hasAttribute('data-stock-step')||event.target.dataset.action==='stock-details')?event.target.dataset.id:((event.target.dataset.action==='stock-family-select'||event.target.dataset.action==='stock-error-focus'||event.target.id==='inventory-filters-toggle')?stockBlurPending?.id:null));
  if(!id)return;
  const key=stockSessionKey;
  const related=event.relatedTarget, destination=related?.dataset.inventoryQuantity||related?.id;
  if(event.target.dataset.inventoryQuantity)stockBlurPending={id,key,destination};
  // Family activation resolves pending edits itself before replacing their content.
  if(related?.dataset.action==='stock-family-select'||related?.dataset.action==='stock-error-focus'||related?.id==='inventory-filters-toggle')return;
  // Inventory reference reading retains raw edits without an implicit quantity write.
  if(related?.dataset.action==='stock-details'||(modal?.type==='stock'&&$('#detail').open))return;
  // Moving within the quantity control defers blur until activation or leaving the control.
  if(related?.dataset.inventoryQuantity===id || (related?.hasAttribute('data-stock-step')&&related.dataset.id===id))return;
  if(stockBlurPending?.id!==id||stockBlurPending.key!==key)return;
  stockBlurPending.destination=destination;
  setTimeout(()=>{if(stockBlurPending?.id===id&&stockBlurPending?.key===key){
    stockBlurPending=null;if(stockSessionKey===key&&stockSession)acceptStock(id,'blur',destination);
  }},0);
});
$('#detail').addEventListener('close', () => {
  if(killerDetailOpener){
    const opener=killerDetailOpener;killerDetailOpener=null;
    const focused=document.activeElement;
    if(focused===document.body||focused===document.documentElement||$('#detail').contains(focused)||focused.id===opener.id){
      (document.getElementById(opener.id)||$('#main'))?.focus({preventScroll:true});
    }
  }
  if(stockDetailOpener){
    const opener=stockDetailOpener;stockDetailOpener=null;
    const focused=document.activeElement;
    // Native dialogs restore focus immediately; their later close event must not override a newer user destination.
    if(focused===document.body||focused===document.documentElement||$('#detail').contains(focused)||focused.id===opener.id){
      (document.getElementById(opener.id)||$('#inventory-search')||$('#main'))?.focus({preventScroll:true});
    }
  }
  if(queueOpener){const opener=queueOpener;queueOpener=null;queueTargetEditor=null;(document.getElementById(opener.id)||$('[data-action="queue-add"][data-id="'+(opener.dataset.id||'')+'"]')||$('#queue-add'))?.focus({preventScroll:true});}
  modal = null;
  if (parseCharacterWorkspaceRoute(route())?.section !== 'setup') { characterSetup = null; setupQueue = null; }
});
window.addEventListener('hashchange', async () => {
  if (restoringWorkspaceHistory) { const restored = restoringWorkspaceHistory; restoringWorkspaceHistory = null; restored(); return; }
  const target = location.hash || '#dashboard', targetIndex = history.state?.workspaceIndex;
  if (characterEditSession?.dirty || killerSession?.entities.some(entity=>killerSession.pending[entity.id]||killerSession.errors[entity.id])) {
    if (Number.isInteger(targetIndex) && targetIndex !== workspaceHistoryIndex) {
      await new Promise(resolve => { restoringWorkspaceHistory = resolve; history.go(workspaceHistoryIndex - targetIndex); });
    } else history.replaceState({ ...history.state, workspaceIndex: workspaceHistoryIndex }, '', committedWorkspaceHash);
    if(!acceptPendingKillerQuantities())return;
    if (await resolveDirtyCharacterEdit({ destination: target, source: 'history' }) !== 'proceed') return;
    if (Number.isInteger(targetIndex) && targetIndex !== workspaceHistoryIndex) {
      history.go(targetIndex - workspaceHistoryIndex); return;
    }
    await requestWorkspaceNavigation(target, { source: 'history' }); return;
  }
  if (Number.isInteger(targetIndex) && targetIndex !== workspaceHistoryIndex) workspaceHistoryIndex = targetIndex;
  else history.replaceState({ ...history.state, workspaceIndex: ++workspaceHistoryIndex }, '', location.href);
  finishWorkspaceNavigation();
});
window.addEventListener('beforeunload', event => {
  if (characterEditSession?.dirty) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('storage', event => {
  if (!initialized) return;
  if (event.key === 'dbdTrackerData') {
    closeFilters();
    try {
      const loaded = store.load({ persistMigration: editor.state === 'editing' });
      if (characterEditSession?.dirty && JSON.stringify(loaded.save) !== characterEditSession.baseFingerprint) {
        characterEditSession = { ...characterEditSession, conflicted: true,
          errors: [{ field: 'session', message: 'Underlying save changed; conflict. Discard/reload before saving.' }] };
      }
      save = loaded.save; migrationPending = loaded.migrationPending; storageBlocked = false;
      if(killerSession){
        const previous=killerSession;
        killerSession=regroupQuantityEntries(previous,save.characters[killerSessionKey].inventory.addons);
        for(const id of Object.keys(previous.pending).filter(id=>previous.pending[id])){
          killerSession.raw[id]=previous.raw[id];killerSession.pending[id]=true;
          if(previous.errors[id])killerSession.errors[id]=previous.errors[id];
        }
      }
      if(stockSession?.mode==='detail'){
        const previous=stockSession, id=stockSessionKey.split('/')[0], inventory=save.characters[id]?.inventory;
        if(inventory){
          stockSession=regroupQuantityEntries(previous,{...inventory.items,...inventory.addons});
          const pending=Object.keys(previous.pending).filter(entityId=>previous.pending[entityId]);
          if(pending.length)stockSession.order=previous.order;
          for(const entityId of pending){stockSession.raw[entityId]=previous.raw[entityId];stockSession.pending[entityId]=true;if(previous.errors[entityId])stockSession.errors[entityId]=previous.errors[entityId];}
        }
      }
      render(); refreshDetail(); message('Progress updated from another tab.' + (loaded.warnings.length ? ' Unknown imported records were preserved.' : ''));
    }
    catch (error) { storageBlocked = true; message(`Another tab changed the save to invalid data: ${error.message}`, true); render(); }
  }
  if (event.key === 'dbdTrackerBackups' && route() === 'data') render();
});
$('#perk-filter-panel').addEventListener('toggle', () => $('#filters-trigger')?.setAttribute('aria-expanded', String($('#perk-filter-panel').matches(':popover-open'))));
document.addEventListener('error', event => {
  const image = event.target;
  if(image instanceof HTMLImageElement && image.hasAttribute('data-inventory-icon')){
    const fallback=document.createElement('span');fallback.className='stock-art-fallback';fallback.setAttribute('aria-hidden','true');fallback.textContent='◇';
    image.replaceWith(fallback);return;
  }
  if (image instanceof HTMLImageElement && (image.hasAttribute('data-perk-icon') || image.hasAttribute('data-character-portrait'))) {
    image.parentElement.classList.remove('has-art');
    image.remove();
  }
}, true);
window.addEventListener('resize', positionFilters);
window.addEventListener('scroll', positionFilters, true);
window.addEventListener('resize', positionCharacterInventoryQuickPicker);
window.addEventListener('scroll', positionCharacterInventoryQuickPicker, true);
render();
void enableEditing();

