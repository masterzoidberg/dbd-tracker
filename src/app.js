import { characters, characterById, perkById, catalogInfo, perkName } from '../data/catalog.js';
import { freshSave, globalTier, isAvailable, unlockSource, inventoryTier, roleCharacters, rolePerks, characterStats, perkStats, parseSave, exportSave, setGlobalPerkUnlocked, syncGlobalInventories, completeCharacterSetup, automaticTier, recordedTier, ownedUnlockSource, bloodwebNextTier, bloodwebEligible, setHistoricalPerkTier } from './model.js';
import { TrackerStorage } from './storage.js';
import { parseCharacterWorkspaceRoute, characterWorkspaceHref, characterWorkspaceNeighbors } from './character-workspace.js';
import {inventoryEntities,inventoryEntityById,inventoryCatalogStatus,survivorInventorySource,killerPowerByCharacterId} from '../data/inventory-catalog.js';
import {inventoryIconPath,killerPowerIconPath} from './assets.js';
import {createQuantityInteraction,updateQuantityInput,acceptQuantityInput,visibleQuantityEntries,regroupQuantityEntries,quantityFocusAfterCommit,groupQuantityEntries,groupQuantityEntriesByItem,sortQuantityEntriesByRarity,stepQuantityInput} from './inventory-interaction.js';
import { createCharacterTaskSession, updateCharacterTaskSession, buildCharacterTaskCandidate } from './character-edit.js';
import { EditorGuard } from './editor.js';
import { setupView } from './setup.js';
import { characterSetupView } from './character-setup.js';
import { historicalPerkNote, historicalOwnershipControl } from './historical-perks.js';
import {derivePrestigeQueue,applyPrestigeQueueAction} from './prestige-queue.js';
import { applyPlanningAction } from './planning-state.js';
import { CONTINUE_KEY, clearContinue, invalidateContinueForSave, readContinue, writeContinue } from './workspace-resume.js';
import { correctPersonalPerkTier } from './model.js';
import { createRosterStateMemory, paginateRoster } from './roster-state.js';
import { createWorkspaceContextMemory } from './workspace-context.js';
import { killerAddonCount, survivorInventoryCounts } from './survivor-collection.js';
import assetManifest from '../data/asset-manifest.json' with { type: 'json' };
import { perkIconPath, characterPortraitPath, collectionPortraitPath } from './assets.js';

import { getFilterContext, perkFilterDefinitions, matchesPerkFilterState, selectQuickView, toggleAdvancedOption, clearAdvancedFilters, activeAdvancedGroupCount, perkFacetCounts, createFilterRouteMemory } from './perk-filters.js';
import { CHARACTER_INVENTORY_CATEGORIES, CHARACTER_CARD_SIZES, DEFAULT_CHARACTER_CARD_SIZE, normalizeCharacterCardSize, characterInventoryCandidatePool, filterCharacterInventoryCandidates, characterNormalInventory, setCharacterPersonalTier, createCharacterInventorySession, syncCharacterInventorySession, parseCharacterInventoryRoute } from './character-inventory.js';

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
let queueTargetEditor = null;
let queueOpener = null;
let upNextEditor = null;
let queueManagementOpen = false;
let filters = { search: '', status: 'all', prestige: 'all', favorite: false, sort: 'name' };
let collectionFiltersOpen = false;
const collectionState = createRosterStateMemory();
const workspaceContext = createWorkspaceContextMemory();
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
let characterTaskSession = null;
let stockSession = null;
let stockSessionKey = '';
let stockRendering = false;
let stockBlurPending = null;
let stockFilters = {map:'',rarity:'',search:'',inStock:false};
let selectedFamilyId = '';
let selectedItemId = '';
let stockDetailOpener = null;
let killerDetailOpener = null;
let killerSession = null;
let killerSessionKey = '';
let killerBlurPending = null;
let killerFilters = { search: '', rarity: '', inStock: false };
let addonRarityDirection = 'highest-to-lowest';
let workspaceHistoryIndex = 0;
let committedWorkspaceHash = location.hash || '#dashboard';
let restoringWorkspaceHistory = null;
let workspaceTransitionToken = 0;
history.replaceState({ ...history.state, workspaceIndex: 0 }, '', location.href);
let setupQueue = null;
let characterInventorySession = createCharacterInventorySession('');
const characterInventoryCardSizeStorageKey = 'dbdTrackerUi.characterCardSize';
const legacyCharacterCardSizeStorageKey = 'dbdTrackerUi.experimentCardSize';
const characterCardSizeLabels = { small: 'Compact', medium: 'Standard', large: 'Large' };

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

const editingActions = new Set(['favorite', 'overview-ownership-toggle', 'ownership', 'cycle', 'character-inventory-set-tier', 'character-inventory-correction-open', 'character-inventory-correction-apply', 'account-unlock-tier', 'import', 'restore', 'reset', 'delete-backup', 'setup-open', 'setup-p1', 'setup-next', 'setup-back', 'character-task-start', 'character-task-save']);
const editingControls = '#detail-content select, [data-character-task-field], [data-setup-owned], [data-setup-prestige], [data-setup-perk], [data-character-setup-perk], [data-character-setup-tier], [data-historical-ownership], [data-character-inventory-historical], [data-character-inventory-correction-tier], #character-setup-bloodweb, #halloween-names, #hellraiser-names, #import-file';
function requiresEditor(action) { return editingActions.has(action) || ['queue-add','queue-target','queue-remove','queue-move','queue-move-down','queue-save','queue-shortcut','queue-select','playing-add','playing-remove','playing-move-up','playing-move-down','up-next-pin','up-next-save','up-next-unpin','up-next-move'].includes(action) || (action?.startsWith('character-setup-') && action !== 'character-setup-exit'); }
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
  document.querySelectorAll('[data-character-task-field], [data-action="character-task-save"], [data-action="character-task-start"], [data-action="overview-ownership-toggle"], [data-action="favorite"]').forEach(control => {
    control.disabled = !editing || storageBlocked || Boolean(characterTaskSession?.conflicted);
  });
  updateStockStepControls();
  if (!initialized) $('#save-status').textContent = 'Checking editing availability';
  else if (!editing) $('#save-status').textContent = editor.state === 'unavailable' ? 'Editing unavailable' : 'Read-only';
  else if (storageBlocked) $('#save-status').textContent = 'Stored save needs recovery';
}
async function enableEditing() {
  if (editor.pending) return;
  const acquisition = editor.acquire();
  editorPresentation();
  await acquisition;
  // A retry reloads the canonical save before rendering the current route.
  $('#detail').close(); modal = null; characterSetup = null; setupQueue = null;
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
  writeContinue(localStorage, route());
  if(parseCharacterWorkspaceRoute(route())) $('#main').focus({ preventScroll: true });
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
function workspaceCharacterArtwork(character, size = 80) {
  if (character.role === 'survivor') return characterArtwork(character, size);
  const path = collectionPortraitPath(character.id, assetManifest);
  return `<span class="character-portrait portrait-large workspace-lore-portrait${path ? ' has-art' : ''}" aria-hidden="true"><span class="workspace-lore-fallback">${esc(character.name)}</span>${path ? `<img data-character-portrait="${character.id}" src="${esc(path)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">` : ''}</span>`;
}
function collectionArtwork(character) {
  const path = collectionPortraitPath(character.id, assetManifest);
  return path
    ? `<img data-collection-hero-art src="${esc(path)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`
    : '<span class="collection-art-fallback" aria-hidden="true">Portrait unavailable</span>';
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
  const perks=rolePerks(role), available=perks.filter(perk=>isAvailable(save,perk)).length;
  const p1=owned.filter(c=>save.characters[c.id].prestige>=1).length;
  const p3=owned.filter(c=>save.characters[c.id].prestige>=3).length;
  const label=role==='survivor'?'Survivors':'Killers';
  return `<article class="dashboard-role-summary" data-role-summary="${role}"><div class="dashboard-role-heading"><h3><span class="role-icon" aria-hidden="true">${role==='survivor'?'♙':'♜'}</span>${label}</h3><a href="#${role}s">View collection</a></div><p class="dashboard-owned-count"><strong>${owned.length}</strong> / ${list.length} owned</p><div class="dashboard-role-metrics"><span><strong>${p1}</strong> Prestige 1+</span><span><strong>${p3}</strong> Prestige 3+</span><span><strong>${available}</strong> / ${perks.length} account perk access</span></div></article>`;
}
function queueBenefit(row) {
  if(row.complete) return 'Target reached. Raise the target or remove the goal.';
  if(!row.character || !row.progress) return 'Character data unavailable; imported goal preserved.';
  const count=row.benefit.improvedNativeIds.length;
  if(!count) return 'Personal progression goal; no additional global perk tier.';
  return (row.entry.targetPrestige>3?'Earlier milestone on the way: ':'')+count+' native perk tiers improve at P'+row.benefit.globalTierMilestone+'.';
}
function queueControl(action,id,label,disabled=false,extra='') {
  const role=characterById[id]?.role;
  return `<button id="${action}-${esc(id)}" data-action="${action}" data-id="${esc(id)}"${role?` data-role="${role}"`:''} ${action.startsWith('queue-move')||action.startsWith('playing-move')?`aria-label="${label} ${esc(characterById[id]?.name||id)}"`:''} ${extra} ${disabled?'disabled':''}>${label}</button>`;
}
function openPrestigeTargetEditor(id,adding,opener,role=characterById[id]?.role) {
  store.assertWriter();
  if(storageBlocked) return;
  queueOpener=opener;
  if(!id){
    if(!['survivor','killer'].includes(role)) throw new Error('Choose a role for the Prestige Queue.');
    queueTargetEditor={id:null,adding:true,role};
    const candidates=characters.filter(c=>c.role===role&&save.characters[c.id]?.owned&&!save.planning.prestigeQueues[role].some(e=>e.characterId===c.id)).sort((a,b)=>a.name.localeCompare(b.name));
    $('#detail-content').innerHTML=dialogHeader('PRESTIGE QUEUE',`Add ${role==='survivor'?'Survivor':'Killer'} goal`)+(candidates.length?`<label>Character<select id="queue-character">${candidates.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><button data-action="queue-select">Choose character</button>`:'<p>Owned characters in this role are already in the Prestige Queue.</p>');
    $('#detail').showModal();editorPresentation();return;
  }
  const c=characterById[id],p=save.characters[id];
  if(!c||!p) throw new Error('Character data unavailable.');
  queueTargetEditor={id,adding,role:c.role};
  const target=adding?Math.max(1,p.prestige+1):save.planning.prestigeQueues[c.role].find(e=>e.characterId===id)?.targetPrestige;
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
function commitPlanningAction(action) {
  store.assertWriter();
  const candidate=structuredClone(save);
  if(!applyPlanningAction(candidate,action)) return false;
  return commit(next=>{applyPlanningAction(next,action);});
}
function prestigeQueueRow(row,{management=false}={}) {
  const id=row.entry.characterId,p=row.progress;
  const name=row.character?.name||id;
  return `<li value="${row.index+1}" data-prestige-queue-row data-role="${row.role}" data-queue-position="${row.index+1}" data-character-id="${esc(id)}"><div>${row.character?`<a data-dashboard-character-link href="${characterWorkspaceHref(id,'overview')}">${esc(name)}</a>`:`<strong>${esc(name)}</strong>`}<p>${row.character?row.character.role:'Unknown character'} · ${p?'P'+p.prestige+' · Bloodweb '+p.bloodwebLevel:'Progress unavailable'} → Target P${row.entry.targetPrestige}</p><p>${row.unavailable?'Unavailable'+(row.character?' · Not owned':''): 'Available'}${row.complete?' · Complete':row.complete===false?' · Incomplete':''}</p>${management?`<p>${queueBenefit(row)}</p><div class="queue-controls">${row.character&&p?queueControl('queue-target',id,'Edit target'):''}${queueControl('queue-remove',id,'Remove')}${queueControl('queue-move',id,'Move Up',row.index===0,'data-direction="-1"')}${queueControl('queue-move-down',id,'Move Down',row.index===row.laneLength-1,'data-direction="1"')}</div>`:''}</div></li>`;
}
function planningButton(action,id,role,label,disabled=false,direction=null) {
  const character=characterById[id];
  const controlId=action==='move'?`up-next-move-${direction<0?'up':'down'}`:`up-next-${action}`;
  return `<button id="${controlId}-${esc(id)}" data-action="up-next-${action}" data-id="${esc(id)}" data-role="${role}"${direction===null?'':` data-direction="${direction}"`} aria-label="${label} ${esc(character?.name||id)}"${disabled?' disabled':''}>${label}</button>`;
}
function upNextLane(role) {
  const pins=save.planning.upNext[role], label=role==='survivor'?'Survivors':'Killers';
  const rows=pins.map((pin,index)=>{
    const character=characterById[pin.characterId], progress=save.characters[pin.characterId];
    const prestige=save.planning.prestigeQueues[role].find(entry=>entry.characterId===pin.characterId);
    const playing=save.planning.playingQueues[role].some(entry=>entry.characterId===pin.characterId);
    const context=[prestige?`Prestige Queue · target P${prestige.targetPrestige}`:'',playing?'Playing Queue':''].filter(Boolean);
    const intentOptions=[['prestige','Prestige'],['play','Play']].map(([value,text])=>`<option value="${value}"${pin.intent===value?' selected':''}>${text}</option>`).join('');
    return `<li class="up-next-row" data-up-next-row data-character-id="${esc(character.id)}" data-role="${role}"><span class="up-next-rank" aria-label="Position ${index+1}">${index+1}</span>${workspaceCharacterArtwork(character,56)}<div class="up-next-identity"><a href="${characterWorkspaceHref(character.id,'overview')}">${esc(character.name)}</a><p>${progress?.owned?'Owned':'Not owned'} · P${progress?.prestige??0}</p>${context.length?`<p class="up-next-context">${context.map(esc).join(' · ')}</p>`:'<p class="up-next-context">No Prestige or Playing Queue membership</p>'}</div><label class="up-next-intent-label">Primary intent<select id="up-next-intent-${esc(character.id)}" data-up-next-intent data-character-id="${esc(character.id)}" data-role="${role}" aria-label="Primary intent for ${esc(character.name)}">${intentOptions}</select></label><div class="up-next-controls">${planningButton('move',character.id,role,'Move Up',index===0,-1)}${planningButton('move',character.id,role,'Move Down',index===pins.length-1,1)}${planningButton('unpin',character.id,role,'Unpin')}</div></li>`;
  }).join('');
  return `<section class="up-next-lane" data-up-next-lane="${role}"><div class="up-next-lane-heading"><h3>${label}</h3><span>${pins.length} / 5 pinned</span></div>${pins.length?`<ol class="up-next-list">${rows}</ol>`:`<p class="up-next-empty">No ${label.toLowerCase()} pinned yet.</p>`}<button class="secondary" data-action="up-next-pin" data-role="${role}">Pin a ${role==='survivor'?'Survivor':'Killer'}</button></section>`;
}
function queueManagement() {
  const prestigeRows=derivePrestigeQueue(save).rows;
  const roleSection=role=>{
    const label=role==='survivor'?'Survivors':'Killers';
    const prestige=prestigeRows.filter(row=>row.role===role);
    const playing=save.planning.playingQueues[role];
    const candidates=characters.filter(character=>character.role===role&&!playing.some(entry=>entry.characterId===character.id)).sort((a,b)=>a.name.localeCompare(b.name));
    const unresolved=save.planning.unresolved.filter(entry=>entry.queue==='prestige'&&(entry.role===role||entry.role===null));
    return `<section class="queue-role-management" data-queue-role="${role}"><h3>${label}</h3><div class="queue-lanes-management"><section class="queue-management-lane" data-management-queue="prestige" data-role="${role}"><h4>Prestige Queue</h4>${prestige.length?`<ol class="prestige-queue-list">${prestige.map(row=>prestigeQueueRow(row,{management:true})).join('')}</ol>`:'<p>No Prestige goals.</p>'}<button id="queue-add-${role}" data-action="queue-add" data-role="${role}"${!characters.some(character=>character.role===role&&save.characters[character.id]?.owned&&!save.planning.prestigeQueues[role].some(entry=>entry.characterId===character.id))?' disabled':''}>Add Prestige goal</button>${unresolved.length?`<details class="unresolved-goals"><summary>${unresolved.length} unresolved imported ${unresolved.length===1?'goal':'goals'}</summary><ul>${unresolved.map(entry=>`<li>Rank ${entry.rank+1} · ${entry.role||'Role unknown'} · <code>${esc(entry.record.characterId||'Unknown character')}</code> · preserved and read-only</li>`).join('')}</ul></details>`:''}</section><section class="queue-management-lane" data-management-queue="playing" data-role="${role}"><h4>Playing Queue</h4>${playing.length?`<ol class="playing-queue-list">${playing.map((entry,index)=>{const character=characterById[entry.characterId];return `<li data-playing-queue-row data-character-id="${esc(entry.characterId)}"><span>${index+1}. <a href="${characterWorkspaceHref(character.id,'overview')}">${esc(character.name)}</a></span><div class="queue-controls">${queueControl('playing-remove',character.id,'Remove')}${queueControl('playing-move-up',character.id,'Move Up',index===0,'data-direction="-1"')}${queueControl('playing-move-down',character.id,'Move Down',index===playing.length-1,'data-direction="1"')}</div></li>`;}).join('')}</ol>`:'<p>No Playing goals.</p>'}<div class="playing-queue-add"><label for="playing-character-${role}">Add a character to this queue</label><select id="playing-character-${role}" data-playing-character="${role}"><option value="">Choose a ${role==='survivor'?'Survivor':'Killer'}</option>${candidates.map(character=>`<option value="${character.id}">${esc(character.name)}</option>`).join('')}</select><button data-action="playing-add" data-role="${role}"${candidates.length?'':' disabled'}>Add to Playing Queue</button></div></section></div></section>`;
  };
  const unknown=save.planning.unresolved.filter(entry=>entry.queue==='unknown'||entry.queue==='upNext'||entry.queue==='playing');
  return `<details id="queue-management" class="queue-management"${queueManagementOpen?' open':''}><summary>Manage queues</summary><p class="muted">Prestige goals and Playing interest are independent. Up Next pins keep their own intent and order.</p>${roleSection('survivor')}${roleSection('killer')}${unknown.length?`<section class="unresolved-goals"><h3>Other unresolved planning records</h3><ul>${unknown.map(entry=>`<li>${esc(entry.queue)} · ${entry.role||'Role unknown'} · rank ${entry.rank+1} · preserved and read-only</li>`).join('')}</ul></section>`:''}</details>`;
}
function continuePanel() {
  const record=readContinue(localStorage,save), character=record&&characterById[record.characterId];
  const names={overview:'Overview',perks:'Perks','items-addons':'Items & Add-ons','power-addons':'Power & Add-ons'};
  return `<section class="dashboard-continue" data-dashboard-section="continue"><h2>Continue where you left off</h2>${record&&character?`<div class="continue-record">${workspaceCharacterArtwork(character,64)}<div><p class="eyebrow">${character.role==='survivor'?'Survivor':'Killer'} · ${names[record.section]}</p><a class="primary button-link" data-continue-link href="${record.route}">Continue with ${esc(character.name)}</a><p class="muted">Last workspace visit · <time datetime="${esc(record.visitedAt)}">${date(record.visitedAt)}</time></p></div></div>`:'<p class="muted" data-continue-empty>No workspace to continue yet. Open a character Overview, Perks, or inventory workspace to create a shortcut.</p>'}</section>`;
}
function dashboard() {
  return pageHeading('YOUR PROGRESSION','Dashboard','A compact view of account progress, pinned priorities, and your last workspace.')+
    `<section class="dashboard-snapshot" data-dashboard-section="snapshot"><h2>Progression Snapshot</h2><div class="dashboard-snapshot-grid">${roleSummary('survivor')}${roleSummary('killer')}</div></section>`+
    `<section class="dashboard-up-next" data-dashboard-section="up-next"><h2>Up Next</h2><div class="dashboard-up-next-grid">${upNextLane('survivor')}${upNextLane('killer')}</div></section>`+
    continuePanel()+queueManagement();
}
function openUpNextPinEditor(role,opener) {
  store.assertWriter();
  if(storageBlocked) return;
  if(!['survivor','killer'].includes(role)) throw new Error('Choose a role for Up Next.');
  const pins=save.planning.upNext[role];
  const candidates=characters.filter(character=>character.role===role&&!pins.some(pin=>pin.characterId===character.id)).sort((a,b)=>a.name.localeCompare(b.name));
  if(!candidates.length) { message(`All ${role==='survivor'?'Survivors':'Killers'} are already pinned.`); return; }
  queueOpener=opener; upNextEditor={role};
  const replacement=pins.length>=5?`<label for="up-next-replace">Replace a current pin<select id="up-next-replace" required><option value="">Choose a pin to replace</option>${pins.map(pin=>`<option value="${pin.characterId}">${esc(characterById[pin.characterId].name)}</option>`).join('')}</select></label><p>The new pin takes the selected pin’s position. Cancel leaves this lane unchanged.</p>`:'';
  $('#detail-content').innerHTML=dialogHeader('UP NEXT',`Pin a ${role==='survivor'?'Survivor':'Killer'}`)+`<label for="up-next-character">Character</label><select id="up-next-character">${candidates.map(character=>`<option value="${character.id}">${esc(character.name)}</option>`).join('')}</select><label for="up-next-intent">Primary intent</label><select id="up-next-intent"><option value="prestige">Prestige</option><option value="play">Play</option></select>${replacement}<p id="up-next-error" role="alert"></p><button data-action="up-next-save">${pins.length>=5?'Swap pin':'Pin to Up Next'}</button><button data-action="close">Cancel</button>`;
  $('#detail').showModal(); editorPresentation(); $('#up-next-character').focus();
}

function characterCollectionCard(c) {
  const progress = save.characters[c.id];
  const survivor = c.role === 'survivor';
  const workspace = characterWorkspaceHref(c.id, 'overview');
  const nativeRows = c.nativePerkIds.map(id => {
    const perk = perkById[id];
    const name = esc(perkName(save, perk));
    const tier = globalTier(save, perk);
    const access = isAvailable(save, perk) ? (tier ? `Tier ${roman[tier]}` : 'General · available') : 'Not unlocked';
    return `<div class="native-row"><span>${name}</span><span class="native-access">${esc(access)}</span></div>`;
  }).join('');
  const nativeSection = `<section class="native-perks" data-native-perks aria-label="Native perks, account access"><h3>Native perks <span>Account access</span></h3>${nativeRows}</section>`;
  const power = survivor ? null : killerPowerByCharacterId[c.id];
  const powerArtwork = power?.artwork.confidence === 'EXACT' ? killerPowerIconPath(c.id, assetManifest) : null;
  const powerIdentity = survivor ? '' : `<div class="killer-power-identity" data-killer-power>${powerArtwork ? `<img data-killer-power-art src="${esc(artworkUrl(powerArtwork))}" alt="" aria-hidden="true" loading="lazy" decoding="async">` : ''}<div><span>Power</span><strong data-power-name>${esc(power.powerName)}</strong></div></div>`;
  return `<article class="character-card character-collection-card ${c.role}-collection-card${progress.owned ? '' : ' locked-card'}" data-character-id="${c.id}"><a class="collection-card-link" data-open-workspace data-id="${c.id}" href="${workspace}" aria-label="View ${esc(c.name)} workspace"><div class="character-card-hero" aria-hidden="true">${collectionArtwork(c)}</div><div class="character-card-content"><div class="character-card-top"><h2 class="character-name">${esc(c.name)}</h2></div><div class="ownership ${progress.owned ? 'is-owned' : ''}" data-ownership-status><span class="ownership-dot" aria-hidden="true"></span><span>${progress.owned ? 'Owned' : 'Locked'}</span></div><div class="character-progress"><span class="prestige large" aria-label="Prestige ${progress.prestige}">P${progress.prestige}</span><div class="collection-bloodweb"><div><span>Bloodweb</span><strong data-bloodweb-value aria-label="Bloodweb level ${progress.bloodwebLevel} of 50">${progress.bloodwebLevel} <small>/ 50</small></strong></div><span class="collection-bloodweb-track" aria-hidden="true"><span style="width:${progress.bloodwebLevel / 50 * 100}%"></span></span></div></div>${powerIdentity}${nativeSection}<span class="manage-button collection-workspace-action">View character <span aria-hidden="true">→</span></span></div></a><button class="favorite-button ${progress.favorite ? 'is-favorite' : ''}" data-action="favorite" data-id="${c.id}" aria-pressed="${progress.favorite}" aria-label="Favorite ${esc(c.name)}">${progress.favorite ? '★' : '☆'}</button></article>`;
}
function characterMatches(c, status = filters.status) {
  const p = save.characters[c.id];
  return (status === 'all' || (status === 'owned' ? p.owned : !p.owned)) && (filters.prestige === 'all' || (filters.prestige === '3' ? p.prestige >= 3 : p.prestige === Number(filters.prestige))) && (!filters.favorite || p.favorite) && c.name.toLowerCase().includes(filters.search.toLowerCase());
}
function collection(role) {
  const rosterState = collectionState.update(role, { ...filters });
  const list = roleCharacters(role);
  const visible = list.filter(c => characterMatches(c));
  visible.sort((a, b) => {
    const pa = save.characters[a.id], pb = save.characters[b.id];
    const order = { 'prestige-desc': pb.prestige - pa.prestige, 'prestige-asc': pa.prestige - pb.prestige, bloodweb: pb.bloodwebLevel - pa.bloodwebLevel, perks: characterStats(save, b.id).owned - characterStats(save, a.id).owned, recent: (pb.updatedAt || '').localeCompare(pa.updatedAt || '') }[filters.sort];
    return order || a.name.localeCompare(b.name);
  });
  const page = paginateRoster(visible, rosterState.page);
  collectionState.update(role, { page: page.page });
  const cards = page.results.map(characterCollectionCard).join('');
  const activeFilters = [
    ...(filters.status !== 'all' ? [`<button type="button" data-action="collection-clear-filter" data-filter-key="status" data-active-filter="ownership">${filters.status === 'owned' ? 'Owned' : 'Locked'} ×</button>`] : []),
    ...(filters.prestige !== 'all' ? [`<button type="button" data-action="collection-clear-filter" data-filter-key="prestige" data-active-filter="prestige">${filters.prestige === '3' ? 'Prestige 3+' : `Prestige ${filters.prestige}`} ×</button>`] : []),
    ...(filters.favorite ? ['<button type="button" data-action="collection-clear-filter" data-filter-key="favorite" data-active-filter="favorite">Favorites ×</button>'] : []),
  ].join('');
  const resetDisabled = filters.status === 'all' && filters.prestige === 'all' && !filters.favorite;
  const ownershipOptions = [['all', 'Any ownership'], ['owned', 'Owned'], ['locked', 'Locked']];
  const pageControls = visible.length ? `<nav class="collection-pagination" aria-label="Character pages"><button type="button" id="collection-page-prev" data-action="collection-page" data-delta="-1"${page.page === 0 ? ' disabled' : ''}>Previous Page</button><span id="collection-page-status" role="status" aria-live="polite">Page ${page.page + 1} of ${page.pageCount} · ${page.start}–${page.end} of ${page.total}</span><button type="button" id="collection-page-next" data-action="collection-page" data-delta="1"${page.page === page.pageCount - 1 ? ' disabled' : ''}>Next Page</button></nav>` : '';
  const ownedCount = list.filter(c => save.characters[c.id].owned).length;
  const headingCount = role === 'survivor'
    ? `<div class="heading-count survivor-catalog-count">${ownedCount}<span>owned · ${list.length} Survivors</span></div>`
    : `<div class="heading-count">${ownedCount}<span>/ ${list.length} owned</span></div>`;
  const scopeNote = role === 'survivor'
    ? '<p class="collection-scope-note">Native perk states show account access, not recorded tiers on this Survivor. General perks can be available without an automatic tier.</p>' : '';
  const view = pageHeading('CHARACTER COLLECTION', role === 'survivor' ? 'Survivors' : 'Killers', 'Track your collection and the next step through the Bloodweb.', headingCount) + `<section class="collection-controls"><div class="collection-toolbar"><div class="collection-search-group">${searchInput('Search characters…')}${filters.search ? '<button type="button" data-action="collection-clear-search">Clear search</button>' : ''}</div><details id="collection-filters"${collectionFiltersOpen ? ' open' : ''}><summary>Filters${activeFilters ? `<span class="collection-filter-count">${(filters.status !== 'all' ? 1 : 0) + (filters.prestige !== 'all' ? 1 : 0) + (filters.favorite ? 1 : 0)} active</span>` : ''}</summary><div class="collection-filter-options">${selectControl('ownership-filter', 'Ownership', ownershipOptions, filters.status)}${selectControl('prestige-filter', 'Prestige', [['all', 'Any prestige'], ['0', 'P0'], ['1', 'P1'], ['2', 'P2'], ['3', 'P3+']], filters.prestige)}<button type="button" data-action="favorites-filter" class="${filters.favorite ? 'selected' : ''}" aria-pressed="${filters.favorite}">★ Favorites</button><button type="button" data-action="collection-reset-filters"${resetDisabled ? ' disabled' : ''}>Reset filters</button></div></details>${selectControl('sort', 'Sort', [['name', 'Name'], ['prestige-desc', 'Prestige ↓'], ['prestige-asc', 'Prestige ↑'], ['bloodweb', 'Bloodweb ↓'], ['perks', 'Perks owned ↓'], ['recent', 'Recently updated']], filters.sort)}</div>${activeFilters ? `<div class="collection-active-filters" aria-label="Active filters">${activeFilters}</div>` : ''}${scopeNote}</section><div class="results-label" id="collection-results-heading" tabindex="-1">${visible.length} CHARACTERS<span>${page.total ? `${page.start}–${page.end} of ${page.total} matching` : 'No matching characters'}</span></div><div class="character-grid character-collection-grid ${role}-collection-grid">${cards}</div>${visible.length ? '' : empty('No characters match these search and filters.')} ${pageControls}`;
  return `<div class="${role}-roster-layout">${view}</div>`;
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

const characterInventoryCategoryLabels = { personal: 'Native perks', general: 'General', unlocked: 'Unlocked', retained: 'Retained' };

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

function characterInventoryCardSizeControl() {
  return `<div class="character-inventory-card-size-control" role="group" aria-label="Card size"><span>Card size</span>${CHARACTER_CARD_SIZES.map(size => `<button type="button" data-action="character-inventory-card-size" data-size="${size}" aria-pressed="${characterCardSize === size}" class="${characterCardSize === size ? 'selected' : ''}">${characterCardSizeLabels[size]}</button>`).join('')}</div>`;
}

function characterInventoryGridClass() {
  return `card-size-${characterCardSize}`;
}

function characterPerkCard(row, characterId, selected = false) {
  const tier = row.effectiveTier;
  const name = perkName(save, row.perk);
  const tierClass = tier ? `perk-tier-${tier}` : 'perk-tier-none';
  return `<button class="perk-card ${tierClass}${tier === 0 ? ' perk-card-unrecorded' : ''}${selected ? ' is-selected' : ''}" data-action="character-inventory-select" data-character="${characterId}" data-perk="${row.perk.id}" aria-pressed="${selected}" aria-label="${esc(name)}: effective Tier ${esc(roman[tier])}; recorded ${esc(characterInventoryRecordedLabel(characterId, row.perk))}"><span class="perk-card-art">${perkArtwork(row.perk, 78)}</span><span class="perk-card-content"><span class="perk-card-tier-line"><span class="perk-card-tier">${roman[tier]}</span>${tier === 0 ? '<span class="perk-card-unrecorded-label">NO EFFECTIVE TIER</span>' : ''}</span><strong>${esc(name)}</strong><span class="perk-card-badges">${characterInventoryBadges(row)}</span></span></button>`;
}

function historicalCharacterInventoryControl(characterId, perk) {
  const inventory = save.characters[characterId].perks;
  const confirmed = Object.hasOwn(inventory, perk.id);
  const tier = inventory[perk.id] ?? 0;
  const floor = recordedTier(save, characterId, perk.id);
  const options = [['', 'Not Confirmed'], [0, 'Not Owned'], [1, 'Tier I'], [2, 'Tier II'], [3, 'Tier III']];
  return `<label class="character-inventory-history-control">Historical record<select data-character-inventory-historical="${perk.id}" data-character="${characterId}" aria-label="Historical ownership of ${esc(perkName(save, perk))} on ${esc(characterById[characterId].name)}" ${characterInventorySession.failedSelection ? 'disabled' : ''}>${options.map(([value, label]) => `<option value="${value}" ${(confirmed ? value === tier : value === '') ? 'selected' : ''} ${(value === '' && confirmed) || (value !== '' && value < floor) ? 'disabled' : ''}>${label}</option>`).join('')}</select></label>`;
}

function characterInventoryTierButtons(row, characterId) {
  const name = perkName(save, row.perk);
  return `<div class="character-inventory-tier-controls" role="group" aria-label="Set current tier for ${esc(name)}">${[['none', 'Not recorded', 0], ['1', 'I', 1], ['2', 'II', 2], ['3', 'III', 3]].map(([value, label, tier]) => `<button data-action="character-inventory-set-tier" data-character="${characterId}" data-perk="${row.perk.id}" data-tier="${value}" aria-label="Set ${esc(name)} to ${tier ? `Tier ${label}` : label}" aria-pressed="${row.recordedTier === tier}" ${characterInventorySession.failedSelection || (tier && tier < row.automaticMinimum) ? 'disabled title="Resolve the failed selection first"' : ''}>${label}</button>`).join('')}</div>`;
}

function characterInventoryQuickCard(row, characterId) {
  const open = characterInventorySession.quickPerkId === row.perk.id;
  const correcting = characterInventorySession.correctionDraft?.characterId === characterId
    && characterInventorySession.correctionDraft.perkId === row.perk.id;
  const correction = characterInventoryCorrectionMarkup(row, characterId);
  const editor = correcting
    ? correction
    : `${row.isHistorical ? historicalCharacterInventoryControl(characterId, row.perk) : characterInventoryTierButtons(row, characterId)}${correction}`;
  const pickerLabel = `${correcting ? 'Correct personal record for' : row.isHistorical ? 'Set historical ownership for' : 'Set current tier for'} ${perkName(save, row.perk)}`;
  const record = save.characters[characterId].perks;
  const recorded = row.isHistorical
    ? Object.hasOwn(record, row.perk.id) ? record[row.perk.id] ? `Tier ${roman[record[row.perk.id]]}` : 'Not Owned' : 'Not Confirmed'
    : characterInventoryRecordedLabel(characterId, row.perk);
  const state = `<dl class="character-inventory-quick-state"><div><dt>Recorded</dt><dd>${esc(recorded)}</dd></div><div><dt>Automatic minimum</dt><dd>${row.automaticMinimum ? `Tier ${roman[row.automaticMinimum]}` : 'None'}</dd></div><div><dt>Effective</dt><dd>${row.effectiveTier ? `Tier ${roman[row.effectiveTier]}` : 'No effective tier'}</dd></div></dl>`;
  return `<div class="character-inventory-card-anchor">${characterPerkCard(row, characterId, open)}${open ? `<div class="character-inventory-quick-picker" role="group" aria-label="${esc(pickerLabel)}"><strong>${esc(perkName(save, row.perk))}</strong>${state}${editor}<div class="character-inventory-quick-actions"><button type="button" data-action="character-inventory-details" data-perk="${row.perk.id}">Details</button></div></div>` : ''}</div>`;
}

function closeCharacterInventoryQuickPicker(restoreFocus = false) {
  const perkId = characterInventorySession.quickPerkId;
  characterInventorySession = { ...characterInventorySession, quickPerkId: null };
  $('.character-inventory-quick-picker')?.remove();
  const card = perkId ? $(`.perk-card[data-perk="${perkId}"]`) : null;
  card?.classList.remove('is-selected');
  card?.setAttribute('aria-pressed', 'false');
  if (restoreFocus) card?.focus({ preventScroll: true });
}

function captureWorkspaceContext(path) {
  const descriptor = parseCharacterWorkspaceRoute(path);
  if (descriptor?.status !== 'valid') return;
  const role = characterById[descriptor.characterId].role;
  workspaceContext.update(role, {
    section: descriptor.section,
    mode: descriptor.mode,
    perks: {
      search: characterInventorySession.search,
      category: characterInventorySession.category,
      onlyUnrecorded: characterInventorySession.onlyUnrecorded,
      allRole: characterInventorySession.allRole,
      sort: characterInventorySession.sort,
      density: characterCardSize,
    },
    ...(role === 'survivor' ? {
      survivorInventory: {
        ...stockFilters,
        familyId: selectedFamilyId,
        selectedItemId,
        rarityDirection: addonRarityDirection,
      },
    } : {
      killerInventory: {
        ...killerFilters,
        rarityDirection: addonRarityDirection,
      },
    }),
  });
}

function restoreWorkspaceContext(descriptor) {
  const role = characterById[descriptor.characterId].role;
  const context = workspaceContext.update(role, { section: descriptor.section, mode: descriptor.mode });
  characterInventorySession = {
    ...createCharacterInventorySession(descriptor.canonicalRoute),
    search: context.perks.search,
    category: context.perks.category,
    onlyUnrecorded: context.perks.onlyUnrecorded,
    allRole: context.perks.allRole,
    sort: context.perks.sort,
  };
  if (role === 'survivor') {
    const inventory = context.survivorInventory;
    stockFilters = { map: inventory.map, rarity: inventory.rarity, search: inventory.search, inStock: inventory.inStock };
    selectedFamilyId = inventory.familyId;
    selectedItemId = inventory.selectedItemId;
    addonRarityDirection = inventory.rarityDirection;
  } else {
    killerFilters = { search: context.killerInventory.search, rarity: context.killerInventory.rarity, inStock: context.killerInventory.inStock };
    addonRarityDirection = context.killerInventory.rarityDirection;
  }
}

function positionCharacterInventoryQuickPicker() {
  const picker = $('.character-inventory-quick-picker');
  if (!picker) return;
  const card = picker.parentElement.querySelector('.perk-card').getBoundingClientRect();
  const gutter = 12;
  const below = window.innerHeight - card.bottom;
  const above = card.top;
  const anchor = picker.parentElement.getBoundingClientRect();
  const maxLeft = Math.max(gutter, window.innerWidth - gutter - picker.offsetWidth);
  const left = Math.min(Math.max(card.left, gutter), maxLeft);
  picker.style.left = `${left - anchor.left}px`;
  picker.style.right = 'auto';
  picker.classList.toggle('opens-above', below < picker.offsetHeight + 8 && above > below);
}

function characterInventoryCorrectionMarkup(row, characterId) {
  if (!row?.hasRecordedRecord || row.recordedTier < 1) return '';
  const perk = row.perk;
  const draft = characterInventorySession.correctionDraft?.characterId === characterId
    && characterInventorySession.correctionDraft.perkId === perk.id ? characterInventorySession.correctionDraft : null;
  const correctionId = `character-inventory-correction-${characterId}-${perk.id}`;
  const trigger = `<button type="button" data-action="character-inventory-correction-open" data-character="${characterId}" data-perk="${perk.id}" aria-expanded="${Boolean(draft)}" aria-controls="${correctionId}">Correct personal record</button>`;
  if (!draft) return `<section class="character-inventory-correction">${trigger}</section>`;
  const preview = structuredClone(save);
  correctPersonalPerkTier(preview, characterId, perk.id, draft.tier);
  const effective = inventoryTier(preview, characterId, perk.id);
  const effectiveLabel = effective ? `Tier ${roman[effective]}` : 'No effective tier';
  const error = draft.conflicted ? 'Stored data changed. Cancel this correction and reopen it before applying.' : draft.error;
  return `<section class="character-inventory-correction">${trigger}<div class="character-inventory-correction-editor" id="${correctionId}" data-character-inventory-correction><h3>Correct personal record</h3><p class="character-inventory-correction-note">This changes the recorded tier for ${esc(perkName(save, perk))}. Automatic minimums remain derived.</p><dl class="character-inventory-correction-facts"><div><dt>Current recorded tier</dt><dd>${esc(characterInventoryRecordedLabel(characterId, perk))}</dd></div><div><dt>Automatic minimum</dt><dd>${row.automaticMinimum ? `Tier ${roman[row.automaticMinimum]}` : 'None'}</dd></div><div><dt>Effective tier after correction</dt><dd data-character-inventory-correction-preview>${effectiveLabel}</dd></div></dl><label for="character-inventory-correction-tier">Corrected personal tier</label><select id="character-inventory-correction-tier" data-character-inventory-correction-tier="${perk.id}" data-character="${characterId}" ${draft.conflicted ? 'disabled' : ''}><option value="none" ${draft.tier === null ? 'selected' : ''}>Not recorded</option>${[1, 2, 3].map(tier => `<option value="${tier}" ${draft.tier === tier ? 'selected' : ''}>Tier ${roman[tier]}</option>`).join('')}</select>${error ? `<p class="error" data-character-inventory-correction-error role="alert">${esc(error)}</p>` : ''}<div class="character-inventory-correction-actions"><button type="button" class="primary" data-action="character-inventory-correction-apply" ${!draft.dirty || draft.conflicted ? 'disabled' : ''}>Apply correction</button><button type="button" data-action="character-inventory-correction-cancel">Cancel</button></div></div></section>`;
}

function characterInventoryToolbar(candidates, visible) {
  const failed = characterInventorySession.failedSelection;
  const failedPerk = failed && perkById[failed.perkId];
  const failedTier = failed && (failed.type === 'historical' ? failed.tier === 0 ? 'Not Owned' : `Tier ${roman[failed.tier]}` : failed.tier === null ? 'Not recorded' : `Tier ${roman[failed.tier]}`);
  const failure = failed ? `<div class="error character-inventory-failed-selection" data-character-inventory-failed-selection role="alert"><p><strong>Not saved:</strong> ${esc(failedPerk ? perkName(save, failedPerk) : 'Perk')} · ${esc(failedTier)}. ${failed.conflicted ? 'Stored data changed; retry is unavailable.' : 'Retry this selection or discard it before continuing.'}</p><div><button type="button" data-action="character-inventory-retry" ${failed.conflicted ? 'disabled' : ''}>Retry failed selection</button><button type="button" data-action="character-inventory-discard-failed">Discard failed selection</button></div></div>` : '';
  return `<section class="panel character-inventory-controls" data-character-inventory-toolbar="perks"><div class="character-inventory-control-top"><label class="search character-inventory-search"><span aria-hidden="true">⌕</span><input id="character-inventory-search" type="search" placeholder="Search perks…" aria-label="Search perks" value="${esc(characterInventorySession.search)}"></label>${selectControl('character-inventory-sort', 'Sort', [['name', 'Perk name'], ['source', 'Source character'], ['tier', 'Effective tier ↓']], characterInventorySession.sort)}${characterInventoryCardSizeControl()}</div><button data-action="character-inventory-all-role" aria-pressed="${Boolean(characterInventorySession.allRole)}">Show all same-role perks / special acquisitions</button><div class="character-inventory-scopes" role="group" aria-label="Perk categories">${CHARACTER_INVENTORY_CATEGORIES.map(category => `<button data-action="character-inventory-category" data-category="${category}" aria-pressed="${characterInventorySession.category === category}" class="${characterInventorySession.category === category ? 'selected' : ''}">${category === 'all' ? 'All' : characterInventoryCategoryLabels[category]}</button>`).join('')}<label class="character-inventory-only-unrecorded"><input id="character-inventory-only-unrecorded" type="checkbox" ${characterInventorySession.onlyUnrecorded ? 'checked' : ''}>No effective tier</label></div><div class="character-inventory-results-label"><strong>${visible.length}</strong> shown · ${candidates.length} candidates · ${candidates.filter(row => row.effectiveTier === 0).length} with no effective tier</div>${failure}<p class="muted">Select a perk to view its recorded, automatic, and effective tiers. Changes save immediately; Details opens the full reference.</p></section>`;
}

function characterInventory(id) {
  const character = characterById[id];
  const candidates = characterInventoryCandidatePool(save, id, { allRole: characterInventorySession.allRole });
  const visible = filterCharacterInventoryCandidates(save, id, candidates, characterInventorySession);
  if (characterInventorySession.quickPerkId && !visible.some(row => row.perk.id === characterInventorySession.quickPerkId)) {
    characterInventorySession = { ...characterInventorySession, quickPerkId: null };
  }
  return `<div class="section-title"><h2>Perks</h2></div>${characterInventoryToolbar(candidates, visible)}<section class="character-inventory-card-grid ${characterInventoryGridClass()}" aria-label="${esc(character.name)} perk collection">${visible.length ? visible.map(row => characterInventoryQuickCard(row, id)).join('') : empty('No perks match this search and scope.')}</section>`;
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
    `<section class="panel">${sectionTitle('Account setup')}<button data-action="setup-open">Review account setup</button><button data-action="character-setup-all">Run character setups</button></section><section class="panel">${sectionTitle('Display settings')}${selectControl('halloween-names', 'Halloween perk names', [['generic', 'Renamed generic names'], ['original', 'Original Halloween names']], save.settings.halloweenNames)}${selectControl('hellraiser-names', 'Hellraiser perk names', [['original', 'Original Hellraiser names'], ['generic', 'Renamed generic names']], save.settings.hellraiserNames)}<p class="panel-note">Owned licensed characters use original names. These preferences apply to unowned sources. Search accepts either version.</p></section><section class="panel">${sectionTitle('Current save', '<span class="tag">SCHEMA v3</span>')}${storageBlocked ? '<p class="error">Stored progress is unavailable. Export JSON is disabled. Export the original stored data before recovering through a valid JSON import or readable backup.</p>' : `<div class="data-metrics"><div><span>LAST UPDATED</span><strong>${date(save.updatedAt)}</strong></div><div><span>SURVIVORS / KILLERS</span><strong>${roleCharacters('survivor').length} / ${roleCharacters('killer').length}</strong></div><div><span>PROGRESSION RECORDS</span><strong>${Object.keys(save.characters).length}</strong></div><div><span>RECORDED PERK TIERS</span><strong>${Object.values(save.characters).reduce((n, p) => n + Object.keys(p.perks).length, 0)}</strong></div></div>`}<div class="data-actions"><button class="primary" data-action="export">↓ Export JSON</button><button data-action="import">↑ Import JSON</button>${storageBlocked ? '<button data-action="raw-export">Export original stored data</button>' : ''}</div><p class="panel-note">${storageBlocked ? 'Recovery preserves the exact original stored data separately in this browser before replacement. It does not snapshot the unavailable progress or alter existing backups. Export the original first to keep a copy outside this browser.' : 'Autosaved to this browser. Import replaces progress after confirmation and creates a local backup first. Local snapshots stay in this browser; JSON exports travel with you.'}</p>${unknownCharacters.length || unknownPerks.size ? `<p class="notice">${unknownCharacters.length} unknown characters and ${unknownPerks.size} unknown perks are preserved in exports. They cannot be edited until their definitions are added to the catalog.</p>` : ''}</section><section class="panel">${sectionTitle('Local backups', `<span class="muted">${backups.length} / 5 snapshots</span>`)}<p class="muted compact">Created before import, reset, restore, or clearing a character’s perks. ${storageBlocked ? 'Recovery preserves original stored data separately and leaves these snapshots unchanged.' : 'Restoring also backs up your current progress.'}</p>${backupError ? `<p class="error">${esc(backupError)}</p>` : backups.length ? backups.map(b => `<div class="backup-row"><span class="backup-icon">↶</span><div><strong>${date(b.createdAt)}</strong><small>${esc(b.reason)}</small></div><button data-action="restore" data-id="${esc(b.id)}">Restore</button><button class="danger-text" data-action="delete-backup" data-id="${esc(b.id)}">Delete</button></div>`).join('') : empty('No snapshots yet. Your first import or reset will create one.')}</section><section class="panel catalog-panel">${sectionTitle('Game catalog', '<span class="tag">JSON CATALOG</span>')}<p>${catalogInfo.detail}</p><p class="muted">The tracker starts with no assumed ownership or progression. The catalog is separate from your save: definitions and compatibility mappings are embedded in <code>dist/app.js</code> at build time; the browser does not fetch catalog JSON. Existing save IDs stay stable. Unknown imported records stay intact.</p><p class="muted">General perks are Bloodweb-available and have no automatic owned tier. Native, Prestige, Legacy, and Shrine tiers provide owned minimums. Licensed aliases share one inventory record. Your display preference does not change progression.</p></section><section class="panel danger-zone">${sectionTitle('Reset progression')}<p>Clear ownership, prestige, Bloodweb levels, favorites, notes, inventories, and Shrine overrides. Catalog definitions stay intact. A backup is created first.</p><button class="danger-button" data-action="reset">Reset all progress</button></section>`;
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
function route() {
  const current = location.hash.slice(1) || 'dashboard';
  const workspace = parseCharacterWorkspaceRoute(current);
  if (workspace?.source === 'legacy-edit') {
    history.replaceState(history.state, '', workspace.canonicalRoute);
    return workspace.canonicalRoute.slice(1);
  }
  if (workspace?.normalizeUpdate) {
    history.replaceState(history.state, '', workspace.canonicalRoute);
    return workspace.canonicalRoute.slice(1);
  }
  return current;
}
function setGlobalMenuOpen(open, returnFocus = false) {
  const sidebar = $('.sidebar');
  const trigger = $('#menu-toggle');
  trigger.setAttribute('aria-expanded', String(open));
  if (open) sidebar.dataset.menuOpen = 'true';
  else delete sidebar.dataset.menuOpen;
  if (!open && returnFocus) trigger.focus({ preventScroll: true });
}
function characterRosterNavigation(character, descriptor) {
  const role = character.role === 'survivor' ? 'Survivor' : 'Killer';
  const { previous, next } = characterWorkspaceNeighbors(character.id, descriptor.section, descriptor.mode);
  const control = (direction, destination) => {
    const previousDirection = direction === 'previous';
    const arrow = previousDirection ? '←' : '→';
    const accessibleLabel = destination
      ? (previousDirection ? 'Previous ' : 'Next ') + role + ': ' + destination.name
      : 'No ' + (previousDirection ? 'previous ' : 'next ') + role;
    const visibleLabel = destination?.name || (previousDirection ? 'Previous ' : 'Next ') + role;
    const content = previousDirection
      ? '<span aria-hidden="true">' + arrow + '</span><span>' + esc(visibleLabel) + '</span>'
      : '<span>' + esc(visibleLabel) + '</span><span aria-hidden="true">' + arrow + '</span>';
    if (!destination) return '<button type="button" data-roster-neighbor="' + direction + '" disabled aria-label="' + esc(accessibleLabel) + '">' + content + '</button>';
    return '<a data-roster-neighbor="' + direction + '" href="' + esc(destination.href) + '" aria-label="' + esc(accessibleLabel) + '">' + content + '</a>';
  };
  return '<nav class="character-roster-navigation" data-character-roster-navigation aria-label="Character navigation">'
    + control('previous', previous) + control('next', next) + '</nav>';
}
function characterWorkspaceHeader(character, descriptor) {
  const progress = save.characters[character.id];
  const sections = [['overview', 'Overview'], ['perks', 'Perks'],
    character.role === 'survivor' ? ['items-addons', 'Items & Add-ons'] : ['power-addons', 'Power & Add-ons']];
  const collectionLabel = character.role === 'survivor' ? 'Survivors' : 'Killers';
  const roleLabel = character.role === 'survivor' ? 'Survivor' : 'Killer';
  return '<header class="character-workspace-header" data-character-header>'
    + '<a class="character-workspace-back" href="#' + character.role + 's">← ' + collectionLabel + '</a>'
    + characterRosterNavigation(character, descriptor)
    + '<div class="character-workspace-hero"><div class="character-workspace-summary"><div class="character-workspace-identity">' + workspaceCharacterArtwork(character, 80)
    + '<div class="character-workspace-title"><div class="eyebrow">' + roleLabel.toUpperCase() + '</div><h1>' + esc(character.name) + '</h1>'
    + '<div class="character-workspace-status"><span class="status-chip ' + (progress.owned ? 'is-owned' : 'is-unowned') + '">' + (progress.owned ? 'Owned' : 'Locked') + '</span>'
    + '<span class="status-chip ' + (progress.favorite ? 'is-favorite' : '') + '">' + (progress.favorite ? 'Favorite ★' : 'Not favorite') + '</span></div></div></div>'
    + '<div class="character-workspace-progress" aria-label="Character progression"><div data-character-progress="prestige"><span>PRESTIGE</span><strong>P' + progress.prestige + '</strong></div>'
    + '<div data-character-progress="bloodweb"><span>BLOODWEB</span><strong>' + progress.bloodwebLevel + ' / 50</strong></div></div></div>'
    + '<button type="button" class="character-workspace-favorite" data-action="favorite" data-id="' + character.id + '" aria-pressed="' + progress.favorite + '" aria-label="Favorite ' + esc(character.name) + '">' + (progress.favorite ? '★ Favorite' : '☆ Favorite') + '</button>'
    + '</div>'
    + '<nav class="character-workspace-nav" aria-label="Character workspace">' + sections.map(([section, label]) =>
      '<a data-workspace-section="' + section + '" href="' + characterWorkspaceHref(character.id, section) + '"'
      + (descriptor.section === section ? ' aria-current="page"' : '') + '>' + label + '</a>').join('') + '</nav></header>';
}
function characterOverview(id) {
  const character = characterById[id], progress = save.characters[id], stats = characterStats(save, id);
  const stock = Object.entries({...progress.inventory.items,...progress.inventory.addons});
  const knownStock = stock.filter(([entityId]) => Object.hasOwn(inventoryEntityById, entityId));
  const unresolved = stock.length - knownStock.length;
  const survivorCounts = character.role === 'survivor' ? survivorInventoryCounts(save, id) : null;
  const killerStockTypes = character.role === 'killer' ? killerAddonCount(save, id) : 0;
  const killerPower = killerPowerByCharacterId[id];
  const killerAddons = character.role === 'killer'
    ? Object.values(inventoryEntityById).filter(entity => entity.role === 'killer' && entity.characterId === id)
    : [];
  const nativeCards = character.nativePerkIds.map(perkId => {
    const perk = perkById[perkId], tier = inventoryTier(save, id, perkId);
    const minimum = automaticTier(save, id, perk);
    const account = globalTier(save, perk);
    const accountDescription = account ? `Tier ${roman[account]} · ${unlockSource(save, perk)}`
      : isAvailable(save, perk) ? (perk.general ? 'Available in the Bloodweb' : 'Available') : 'Not account-unlocked';
    const roleName = character.role === 'survivor' ? 'Survivor' : 'Killer';
    return '<article class="overview-native-perk" data-overview-native-perk="' + perkId + '">' + perkArtwork(perk, 64)
      + '<div class="overview-native-copy"><div class="overview-native-title"><button data-action="perk" data-id="' + perkId + '">' + esc(perkName(save, perk)) + '</button>' + badge(tier) + '</div>'
      + '<strong>On this ' + roleName + ' · Effective Tier ' + roman[tier] + '</strong>'
      + '<small>Recorded: ' + esc(characterInventoryRecordedLabel(id, perk)) + '</small>'
      + '<small>Automatic minimum: ' + (minimum ? 'Tier ' + roman[minimum] : 'None') + '</small>'
      + '<small>Account: ' + esc(accountDescription) + '</small>'
      + '<a data-open-character-perk="' + perkId + '" href="' + characterWorkspaceHref(id, 'perks') + '">Open in Perks</a></div></article>';
  }).join('');
  const task = characterTaskSession?.characterId === id ? characterTaskSession : null;
  const progressionEditor = task?.task === 'progression' ? characterOverviewTaskEditor(id, task) : '';
  const notesEditor = task?.task === 'notes' ? characterOverviewTaskEditor(id, task) : '';
  const setup = progress.owned
    ? '<div class="overview-context ' + (progress.setupComplete ? 'is-complete' : 'needs-attention') + '"><strong>' + (progress.setupComplete ? 'Initial setup complete' : 'Initial setup incomplete') + '</strong>'
      + '<p>' + (progress.setupComplete ? 'Review the saved Bloodweb setup when you need to reconcile older progress.' : 'Record the starting Bloodweb context before relying on setup-specific progression details.') + '</p>'
      + '<a href="' + characterWorkspaceHref(id, 'setup') + '">' + (progress.setupComplete ? 'Review initial setup' : 'Start initial setup') + '</a></div>'
    : '<p class="muted">This character is not marked Owned. Initial setup remains optional until ownership changes.</p>';
  const inventorySummary = character.role === 'survivor' && inventoryCatalogStatus.survivor === 'ready'
    ? '<p><strong>Catalog</strong> · ' + inventoryEntities.filter(entity => entity.role === 'survivor' && entity.map === 'items').length + ' Items · '
      + inventoryEntities.filter(entity => entity.role === 'survivor' && entity.map === 'addons').length + ' Add-ons</p>'
      + '<p class="overview-stock-counts"><strong>This Survivor</strong> · ' + survivorCounts.items + ' Item '
      + (survivorCounts.items === 1 ? 'type' : 'types') + ' in stock · ' + survivorCounts.addons + ' Add-on '
      + (survivorCounts.addons === 1 ? 'type' : 'types') + ' in stock</p>'
      + (unresolved ? '<p class="overview-unresolved">' + unresolved + ' imported ' + (unresolved === 1 ? 'record' : 'records') + ' not in current catalog.</p>' : '')
      + '<a href="' + characterWorkspaceHref(id, 'items-addons') + '">View Items & Add-ons</a>'
    : character.role === 'killer' && inventoryCatalogStatus.killerPowers === 'ready'
      && inventoryCatalogStatus.killerAddons === 'ready' && killerPower
    ? '<p><strong>Catalog</strong> · ' + killerAddons.length + ' Add-ons</p>'
      + '<p><strong>This Killer</strong> · ' + killerStockTypes + ' Add-on ' + (killerStockTypes === 1 ? 'type' : 'types') + ' in stock</p>'
      + (unresolved ? '<p class="overview-unresolved">' + unresolved + ' imported ' + (unresolved === 1 ? 'record' : 'records') + ' not in current catalog.</p>' : '')
      + '<a href="' + characterWorkspaceHref(id, 'power-addons') + '">View Power & Add-ons</a>'
    : '<p>Verified inventory and Power reference data is not yet available.</p><a href="' + characterWorkspaceHref(id, 'power-addons') + '">View Power & Add-ons</a>';
  const killerPowerIdentity = character.role === 'killer' && killerPower
    ? '<section class="overview-killer-power" data-overview-section="power"><div><span class="eyebrow">KILLER POWER</span><h2>' + esc(killerPower.powerName) + '</h2>'
      + '<p>' + esc(killerPower.shortSummary) + '</p></div><button type="button" id="overview-power-details-' + id
      + '" data-action="killer-power-details" data-character="' + id + '">Power Details</button></section>'
    : '';
  return '<div class="character-overview">'
    + killerPowerIdentity + '<div class="character-overview-grid">'
    + '<section class="character-overview-section overview-native" data-overview-section="native-perks"><div class="section-title"><h2>Native Perks</h2></div><div class="overview-native-grid">' + nativeCards + '</div></section>'
    + '<section class="character-overview-section overview-progress" data-overview-section="progress"><div class="section-title"><h2>Progress / setup</h2></div>'
      + '<div class="overview-character-state"><span>' + (progress.owned ? 'Owned' : 'Locked') + '</span><button type="button" data-action="overview-ownership-toggle" data-id="' + id + '">' + (progress.owned ? 'Mark Locked' : 'Mark Owned') + '</button></div>'
      + '<div class="overview-contextual-actions"><button type="button" data-action="character-task-start" data-task="progression"' + (task ? ' disabled' : '') + '>Edit progression</button></div>'
      + progressionEditor + setup
      + '<p class="muted overview-helper">Personal records remain separate from Native, Prestige, Shrine and Legacy minimums.</p></section>'
    + '<section class="character-overview-summary" data-overview-section="perks"><div><div class="eyebrow">PERKS</div><h2>Perk inventory</h2></div>'
      + '<div class="overview-summary-number"><strong>' + stats.owned + '</strong><span>effective owned</span></div><div class="overview-summary-number"><strong>' + stats.tier3 + '</strong><span>Tier III</span></div>'
      + '<a href="' + characterWorkspaceHref(id, 'perks') + '">View Perks</a></section>'
    + '<section class="character-overview-summary" data-overview-section="inventory"><div><div class="eyebrow">COLLECTION</div><h2>' + (character.role === 'survivor' ? 'Items & Add-ons' : 'Power & Add-ons') + '</h2></div>' + inventorySummary + '</section>'
    + '</div>'
    + '<section class="character-overview-notes" data-overview-section="notes"><div class="section-title"><h2>Notes</h2></div><p class="character-notes">' + esc(progress.notes || 'No notes recorded.') + '</p>'
      + (task?.task === 'notes' ? notesEditor : task ? '' : '<button type="button" data-action="character-task-start" data-task="notes">Edit notes</button>') + '</section>'
    + '</div>';
}
function characterOverviewTaskEditor(id, session) {
  const errors = session.errors.length ? '<div role="alert" class="error" data-character-task-errors><strong>Not saved</strong><ul>'
    + session.errors.map(error => '<li>' + esc(error.message) + '</li>').join('') + '</ul></div>' : '<div data-character-task-errors hidden></div>';
  const fields = session.task === 'progression'
    ? '<label>Prestige<input type="text" inputmode="numeric" data-character-task-field="prestige" value="' + esc(session.rawInputs.prestige) + '" aria-invalid="' + session.errors.some(error => error.field === 'prestige') + '"></label>'
      + '<label>Bloodweb level (1–50)<input type="text" inputmode="numeric" data-character-task-field="bloodwebLevel" value="' + esc(session.rawInputs.bloodwebLevel) + '" aria-invalid="' + session.errors.some(error => error.field === 'bloodwebLevel') + '"></label>'
    : '<label>Notes<textarea data-character-task-field="notes" rows="5" aria-invalid="' + session.errors.some(error => error.field === 'notes') + '">' + esc(session.draft.notes) + '</textarea></label>';
  return '<form class="character-task-editor" data-character-task="' + session.task + '" novalidate>' + errors + fields
    + '<div class="dialog-actions"><button type="button" data-action="character-task-cancel">Cancel</button><button type="button" class="primary" data-action="character-task-save">Save ' + (session.task === 'progression' ? 'progression' : 'note') + '</button></div></form>';
}
function characterWorkspaceUnavailable() {
  return '<section class="panel"><h1>Character/section unavailable</h1><p>This character or section cannot be resolved.</p><a href="#survivors">Survivors</a> · <a href="#killers">Killers</a> · <a href="#dashboard">Dashboard</a></section>';
}
function characterWorkspaceView(descriptor) {
  if (descriptor.status !== 'valid') return characterWorkspaceUnavailable();
  const id = descriptor.characterId;
  let content;
  if (descriptor.section === 'overview') content = characterOverview(id);
  else if (descriptor.section === 'items-addons' && inventoryCatalogStatus.survivor==='ready') content = stockView(id);
  else if (descriptor.section === 'power-addons' && inventoryCatalogStatus.killerPowers==='ready' && inventoryCatalogStatus.killerAddons==='ready') content = killerPowerAddonsView(id);
  else if (descriptor.section === 'setup') {
    if (!save.characters[id].owned) content = '<section class="panel"><h2>Initial Setup</h2><p>Initial setup requires an owned character.</p></section>';
    else {
      if (characterSetup?.id !== id) characterSetup = createCharacterSetupDraft(id);
      content = characterSetupView(save, characterSetup, { workspace: true });
    }
  }
  else if (descriptor.section === 'perks') content = descriptor.mode === 'legacy' ? legacyManager(id) : characterInventory(id);
  else content = '<section class="panel"><h2>' + esc(descriptor.section === 'setup' ? 'Initial setup' : 'Reference and inventory')
    + '</h2><p>This workspace content is currently unavailable.</p></section>';
  content = content.replace(/<h1(\s[^>]*)?>/g, '<h2$1>').replace(/<\/h1>/g, '</h2>');
  return '<section data-character-workspace>' + characterWorkspaceHeader(characterById[id], descriptor) + content + '</section>';
}
function inventoryProvenanceView(){
  const unknown=Object.entries(save.characters).flatMap(([characterId,progress])=>Object.entries({...progress.inventory.items,...progress.inventory.addons})
    .filter(([id])=>!Object.hasOwn(inventoryEntityById,id)).map(([id,quantity])=>({characterId,id,quantity})));
  return '<section class="panel"><h2>Survivor inventory catalog</h2><p>'+esc(survivorInventorySource.patch)+' · research '+esc(survivorInventorySource.verifiedAt)
    +' · 38 Items · 54 Add-ons · 7 families. Perk catalog version remains '+esc(catalogInfo.patch||'10.1.2a')+'.</p><p>'
    +esc(survivorInventorySource.provenance.sourcePolicy)+'</p><p>Three optional Banquet underlying rarity assignments remain flagged; Event presentation is preserved.</p>'
    +(unknown.length?'<details><summary>'+unknown.length+' unresolved inventory records (preserved/read-only)</summary><ul>'+unknown.map(e=>'<li>'+esc(e.characterId)+' / '+esc(e.id)+': '+e.quantity+'</li>').join('')+'</ul></details>':'')+'</section>';
}
function stockView(id) {
  const inventory=save.characters[id].inventory;
  const key=id+'/items-addons';
  if(stockSessionKey!==key || !stockSession){
    stockSession=createQuantityInteraction(inventoryEntities,{...inventory.items,...inventory.addons},{mode:'detail'});
    stockSessionKey=key;
    const context=workspaceContext.read('survivor').survivorInventory;
    stockFilters={map:context.map,rarity:context.rarity,search:context.search,inStock:context.inStock};
    selectedFamilyId=context.familyId;
    selectedItemId=context.selectedItemId;
    addonRarityDirection=context.rarityDirection;
  }
  const select=(id,label,options,value)=>'<label>'+label+'<select id="'+id+'">'+options.map(([v,n])=>'<option value="'+esc(v)+'"'+(value===v?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>';
  const unresolved=Object.entries({...inventory.items,...inventory.addons}).filter(([entityId])=>!Object.hasOwn(inventoryEntityById,entityId));
  const grouped=groupQuantityEntries(stockSession,stockFilters,survivorInventorySource.itemFamilies);
  if(!survivorInventorySource.itemFamilies.some(family=>family.id===selectedFamilyId))selectedFamilyId=survivorInventorySource.itemFamilies[0].id;
  const visibleGroups=grouped.filter(group=>group.family.id===selectedFamilyId);
  const selectedFamilyItems=stockSession.order.map(entityId=>inventoryEntityById[entityId])
    .filter(entity=>entity?.familyId===selectedFamilyId&&entity.map==='items');
  if(!selectedFamilyItems.some(item=>item.id===selectedItemId))selectedItemId=selectedFamilyItems[0]?.id||'';
  const secondaryCount=Number(Boolean(stockFilters.map))+Number(Boolean(stockFilters.rarity));
  const renderCard=entity=>{
    const art=inventoryIconPath(entity.id,assetManifest), error=stockSession.errors[entity.id];
    return '<article data-stock-card="'+entity.id+'" data-stock-rarity="'+esc(entity.rarity)+'" class="stock-card '+((stockSession.baseline[entity.id]||0)>0?'':'zero-stock')+'">'
      +'<div class="stock-card-media">'+(art?'<img src="'+esc(art)+'" alt="" loading="lazy" data-inventory-icon>':'<span aria-hidden="true" class="stock-art-fallback">◇</span>')+'</div>'
      +'<h5 class="stock-card-title">'+esc(entity.name)+'</h5><div class="stock-card-meta">'+esc(entity.rarity)+' · '+(entity.map==='items'?'Item':'Add-on')+'</div>'
      +(entity.map==='items'?'<button type="button" id="stock-select-item-'+esc(entity.id)+'" class="stock-item-select" data-action="stock-item-select" data-id="'+esc(entity.id)+'" aria-label="Select '+esc(entity.name)+' for Add-ons" aria-pressed="'+(entity.id===selectedItemId)+'">'+(entity.id===selectedItemId?'Selected Item':'Select Item')+'</button>':'')
      +'<label for="quantity-'+entity.id+'">Quantity of '+esc(entity.name)+'</label><div class="stock-quantity-control">'
      +'<button type="button" id="stock-decrement-'+entity.id+'" data-action="stock-step" data-stock-step data-id="'+entity.id+'" data-delta="-1" aria-label="Decrease quantity of '+esc(entity.name)+'">−</button>'
      +'<input id="quantity-'+entity.id+'" data-inventory-quantity="'+entity.id+'" inputmode="numeric" type="text" value="'+esc(stockSession.raw[entity.id])+'" aria-invalid="'+Boolean(error)+'" aria-describedby="stock-error-'+entity.id+'">'
      +'<button type="button" id="stock-increment-'+entity.id+'" data-action="stock-step" data-stock-step data-id="'+entity.id+'" data-delta="1" aria-label="Increase quantity of '+esc(entity.name)+'">+1</button>'
      +'<button type="button" id="stock-increment-5-'+entity.id+'" data-action="stock-step" data-stock-step data-id="'+entity.id+'" data-delta="5" aria-label="Increase quantity of '+esc(entity.name)+' by 5">+5</button>'
      +'<button type="button" id="stock-increment-10-'+entity.id+'" data-action="stock-step" data-stock-step data-id="'+entity.id+'" data-delta="10" aria-label="Increase quantity of '+esc(entity.name)+' by 10">+10</button></div>'
      +'<p id="stock-error-'+entity.id+'" data-stock-error role="status">'+esc(error|| (stockSession.pending[entity.id]?'Pending change':''))+'</p>'
      +'<button type="button" id="stock-details-'+entity.id+'" class="stock-details-action" data-action="stock-details" data-id="'+entity.id+'">Details</button></article>';
  };
  const familyMarkup=visibleGroups.map(group=>{
    const catalogAddonCount=inventoryEntities.filter(entity=>entity.familyId===group.family.id&&entity.map==='addons').length;
    const catalogItemCount=inventoryEntities.filter(entity=>entity.familyId===group.family.id&&entity.map==='items').length;
    const showItems=!stockFilters.map||stockFilters.map==='items';
    const showAddons=!stockFilters.map||stockFilters.map==='addons';
    const familyItems=stockSession.order.map(entityId=>inventoryEntityById[entityId])
      .filter(entity=>entity?.familyId===group.family.id&&entity.map==='items');
    const selectedItem=familyItems.find(item=>item.id===selectedItemId)||familyItems[0];
    const selectedItemCatalogAddons=selectedItem?inventoryEntities.filter(entity=>entity.familyId===group.family.id&&entity.map==='addons'
      &&entity.compatibleItemIds?.includes(selectedItem.id)):[];
    const selectedItemAddons=selectedItem
      ?groupQuantityEntriesByItem([selectedItem],group.addons)[0].addons:[];
    const addonMarkup=selectedItemAddons.length
      ?'<div class="stock-grid">'+sortQuantityEntriesByRarity(selectedItemAddons,killerRarityOrder,addonRarityDirection).map(renderCard).join('')+'</div>'
      :(!selectedItemCatalogAddons.length?'<p class="stock-empty-line">This item does not use Add-ons.</p>':'<p class="stock-empty-line">No matching Add-ons for this Item.</p>');
    const selectedItemHidden=selectedItem&&!group.items.some(item=>item.id===selectedItem.id);
    return '<section class="stock-family" data-stock-family="'+esc(group.family.id)+'"><div class="stock-family-heading"><h3>'+esc(group.family.displayName)+'</h3><p>'+catalogItemCount+' Items · '+catalogAddonCount+' Add-ons <span class="muted">(catalog totals)</span></p></div>'
      +'<div class="stock-family-content">'
      +(showItems?'<section class="stock-subsection" data-stock-subsection="items"><h4>Items</h4>'+(group.items.length?'<div class="stock-grid">'+group.items.map(renderCard).join('')+'</div>':'<p class="stock-empty-line">No matching Items.</p>')+'</section>':'<section data-stock-subsection="items" hidden></section>')
      +(showAddons?'<section class="stock-subsection" data-stock-subsection="addons" data-compatible-item-id="'+esc(selectedItem?.id||'')+'"><h4>Add-ons for '+esc(selectedItem?.name||'Item')+'</h4>'
        +'<label class="stock-item-selector"><span>Item</span><select id="inventory-item" aria-label="Item for Add-ons">'+familyItems.map(item=>'<option value="'+esc(item.id)+'"'+(item.id===selectedItem?.id?' selected':'')+'>'+esc(item.name)+'</option>').join('')+'</select></label>'
        +(selectedItemHidden?'<p data-selected-item-context class="muted">Selected Item hidden by current filters: '+esc(selectedItem.name)+'.</p>':'')
        +addonMarkup+'</section>':'<section data-stock-subsection="addons" hidden></section>')
      +'</div></section>';
  }).join('');
  const hasStockFilters=Boolean(stockFilters.map||stockFilters.rarity||stockFilters.search||stockFilters.inStock);
  return '<section data-stock-workspace><div class="stock-page-heading"><div><h2>Survivor Items &amp; Add-ons</h2><p>Track the quantities currently recorded for this Survivor. Quantities save on Enter or leaving the field.</p></div><p class="muted">Survivor inventory '+esc(survivorInventorySource.patch)+' · research '+esc(survivorInventorySource.verifiedAt)+'.</p></div>'
    +'<div class="stock-toolbar"><div class="stock-primary-controls"><label class="stock-search">Search '+esc(visibleGroups[0].family.displayName)+'<input id="inventory-search" type="search" value="'+esc(stockFilters.search)+'"></label><label class="stock-in-stock"><input id="inventory-in-stock" type="checkbox"'+(stockFilters.inStock?' checked':'')+'> In Stock</label>'
    +'<details id="inventory-filters"><summary id="inventory-filters-toggle">Filters'+(secondaryCount?' ('+secondaryCount+')':'')+'</summary><div class="stock-secondary-filters">'+select('inventory-map','Type',[['','All'],['items','Items'],['addons','Add-ons']],stockFilters.map)+select('inventory-rarity','Rarity',[['','All rarities'],...[...new Set(inventoryEntities.map(e=>e.rarity))].map(r=>[r,r])],stockFilters.rarity)+'</div></details>'+(stockFilters.map==='items'?'':renderAddonRarityOrderControl())+(hasStockFilters?'<button type="button" data-action="stock-filter-reset">Reset filters</button>':'')+'</div>'
    +'</div><nav class="stock-family-nav" aria-label="Item families">'+survivorInventorySource.itemFamilies.map(family=>'<button type="button" id="stock-family-nav-'+esc(family.id)+'" data-action="stock-family-select" data-family="'+esc(family.id)+'" aria-pressed="'+(family.id===selectedFamilyId)+'">'+esc(family.displayName)+'</button>').join('')+'</nav>'
    +(Object.keys(stockSession.errors).length?'<div role="alert" data-stock-error-summary>'+Object.entries(stockSession.errors).map(([entityId,error])=>'<p><button type="button" data-action="stock-error-focus" data-id="'+entityId+'">Fix quantity of '+esc(inventoryEntityById[entityId].name)+'</button>: '+esc(error)+'</p>').join('')+'</div>':'')
    +'<div class="stock-families">'+familyMarkup+'</div>'+(visibleGroups.every(group=>!group.items.length&&!group.addons.length)?'<p class="empty">No matches in '+esc(visibleGroups[0].family.displayName)+'.</p>':'')
    +(unresolved.length?'<section class="unresolved-stock" data-unresolved-stock><h2 id="inventory-unresolved">Imported records not in current catalog</h2><p class="muted">Preserved exactly and read-only until the runtime catalog can resolve them.</p><ul>'+unresolved.map(([unknown,quantity])=>'<li><code>'+esc(unknown)+'</code><span>Quantity '+quantity+'</span><small>Read-only</small></li>').join('')+'</ul></section>':'')+'</section>';
}
const killerRarityOrder = ['Ultra Rare','Very Rare','Rare','Uncommon','Common'];
function renderAddonRarityOrderControl() {
  return '<label class="addon-rarity-order-control"><span>Rarity order</span><select id="addon-rarity-order">'
    +'<option value="highest-to-lowest"'+(addonRarityDirection==='highest-to-lowest'?' selected':'')+'>Highest → Lowest</option>'
    +'<option value="lowest-to-highest"'+(addonRarityDirection==='lowest-to-highest'?' selected':'')+'>Lowest → Highest</option>'
    +'</select></label>';
}
function killerPowerAddonsView(characterId) {
  const power=killerPowerByCharacterId[characterId];
  if(!power)return '<section class="panel"><h2>Power &amp; Add-ons unavailable</h2><p>Verified Power and Add-on data is not available for this Killer.</p></section>';
  const character=characterById[characterId], powerArt=killerPowerIconPath(characterId,assetManifest);
  const addons=Object.values(inventoryEntityById).filter(entity=>entity.role==='killer'&&entity.characterId===characterId).sort((a,b)=>a.order-b.order);
  const unknownAddons=Object.entries(save.characters[characterId].inventory.addons).filter(([id])=>!Object.hasOwn(inventoryEntityById,id));
  if(killerSessionKey!==characterId||!killerSession){
    killerSession=createQuantityInteraction(addons,save.characters[characterId].inventory.addons);
    killerSessionKey=characterId;
  }
  const search=killerFilters.search.trim().toLocaleLowerCase();
  const matchingAddons=addons.filter(addon=>(!search||(addon.name+' '+addon.effect).toLocaleLowerCase().includes(search))
    &&(!killerFilters.rarity||addon.rarity===killerFilters.rarity)
    &&(!killerFilters.inStock||(killerSession.baseline[addon.id]||0)>0));
  const rarities=[...new Set(addons.map(addon=>addon.rarity))].sort((a,b)=>killerRarityOrder.indexOf(a)-killerRarityOrder.indexOf(b));
  const filtersActive=Boolean(killerFilters.search||killerFilters.rarity||killerFilters.inStock);
  const art=powerArt?'<img src="'+esc(artworkUrl(powerArt))+'" alt="" data-power-art>':'<span class="stock-art-fallback" role="img" aria-label="Power artwork unavailable" data-power-art-fallback>◇</span>';
  const unknownMarkup=unknownAddons.length?'<section class="unresolved-stock" data-killer-unresolved-addons><h4>Imported Add-ons not in this Killer catalog</h4><p class="muted">These records are preserved and read-only until resolved.</p><ul>'+unknownAddons.map(([unknown,quantity])=>'<li><code>'+esc(unknown)+'</code><span>Quantity '+quantity+'</span><small>Read-only</small></li>').join('')+'</ul></section>':'';
  return '<section class="killer-power-addons" data-killer-power-addons>'
    +'<section class="panel killer-power-panel" data-killer-power-panel><div class="killer-power-art">'+art+'</div><div class="killer-power-copy"><span class="eyebrow">KILLER POWER</span><h3 data-power-name>'+esc(power.powerName)+'</h3><p data-power-summary>'+esc(power.shortSummary)+'</p><button type="button" data-action="killer-power-details" data-character="'+esc(characterId)+'" id="killer-power-details-'+esc(characterId)+'">Power Details</button></div></section>'
    +'<section class="killer-addon-inventory" aria-labelledby="killer-addons-heading"><div class="stock-page-heading"><div><span class="eyebrow">INVENTORY</span><h3 id="killer-addons-heading">'+esc(character.name)+' Add-ons</h3><p data-killer-addon-results>Showing '+matchingAddons.length+' of '+addons.length+' Add-ons.</p></div></div>'
    +'<div class="killer-addon-toolbar"><label class="killer-addon-search">Search Add-ons<input id="killer-addon-search" type="search" value="'+esc(killerFilters.search)+'"></label>'
    +'<label class="killer-addon-in-stock"><input id="killer-addon-in-stock" type="checkbox"'+(killerFilters.inStock?' checked':'')+'> In Stock</label>'
    +'<label class="killer-addon-rarity"><span>Rarity</span><select id="killer-addon-rarity"><option value="">All rarities</option>'+rarities.map(value=>'<option value="'+esc(value)+'"'+(killerFilters.rarity===value?' selected':'')+'>'+esc(value)+'</option>').join('')+'</select></label>'
    +renderAddonRarityOrderControl()+(filtersActive?'<button type="button" data-action="killer-addon-filter-reset">Reset filters</button>':'')+'</div>'
    +'<div class="stock-grid">'+sortQuantityEntriesByRarity(matchingAddons,killerRarityOrder,addonRarityDirection).map(killerAddonCard).join('')+'</div>'
    +(matchingAddons.length?'':'<p class="stock-empty-line" data-killer-addon-empty>No Add-ons match these filters.</p>')
    +unknownMarkup
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
    +'<button type="button" id="killer-stock-increment-'+esc(addon.id)+'" data-action="killer-stock-step" data-killer-stock-step data-id="'+esc(addon.id)+'" data-delta="1" aria-label="Increase quantity of '+esc(addon.name)+'">+1</button>'
    +'<button type="button" id="killer-stock-increment-5-'+esc(addon.id)+'" data-action="killer-stock-step" data-killer-stock-step data-id="'+esc(addon.id)+'" data-delta="5" aria-label="Increase quantity of '+esc(addon.name)+' by 5">+5</button>'
    +'<button type="button" id="killer-stock-increment-10-'+esc(addon.id)+'" data-action="killer-stock-step" data-killer-stock-step data-id="'+esc(addon.id)+'" data-delta="10" aria-label="Increase quantity of '+esc(addon.name)+' by 10">+10</button></div>'
    +'<p id="killer-stock-error-'+esc(addon.id)+'" data-killer-stock-error role="status">'+esc(error||(killerSession.pending[addon.id]?'Pending change':''))+'</p>'
    +'<button type="button" id="killer-addon-details-'+esc(addon.id)+'" class="stock-details-action" data-action="killer-addon-details" data-id="'+esc(addon.id)+'">Details</button></article>';
}
function updateStockStepControls(id=null) {
  const blocked=!initialized||editor.state!=='editing'||storageBlocked;
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
    const order=sortQuantityEntriesByRarity(killerSession.entities,killerRarityOrder,addonRarityDirection).map(entity=>entity.id);
    const search=killerFilters.search.trim().toLocaleLowerCase();
    const visibleIds=order.filter(addonId=>{
      const addon=inventoryEntityById[addonId];
      return (!search||(addon.name+' '+addon.effect).toLocaleLowerCase().includes(search))
        &&(!killerFilters.rarity||addon.rarity===killerFilters.rarity)
        &&(!killerFilters.inStock||(killerSession.baseline[addonId]||0)>0);
    });
    const destination=quantityFocusAfterCommit(order,{entityId:id,nextTargetId,trigger,
      visibleIds:[...visibleIds,...(nextTargetId&&document.getElementById(nextTargetId)?[nextTargetId]:[])]});
    render();($('#killer-quantity-'+destination)||document.getElementById(destination)||$('#killer-addon-search'))?.focus({preventScroll:true});
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
  updateStockStepControls(id);
}
function normalizeKillerQuantityOnBlur(input,id) {
  if(input.value!==''||!killerSession)return;
  input.value='0';
  killerSession=updateQuantityInput(killerSession,id,'0');
}
function setKillerAddonFilter(key,value) {
  if(!acceptPendingKillerQuantities())return false;
  killerFilters={...killerFilters,[key]:value};
  render();
  return true;
}
function resetKillerAddonFilters() {
  if(!acceptPendingKillerQuantities())return;
  killerFilters={search:'',rarity:'',inStock:false};
  render();$('#killer-addon-search')?.focus({preventScroll:true});
}
function normalizeStockQuantityOnBlur(input,id) {
  if(input.value!==''||!stockSession)return;
  input.value='0';
  stockSession=updateQuantityInput(stockSession,id,'0');
}
function stepStock(button) {
  store.assertWriter();
  if(storageBlocked)return false;
  const id=button.dataset.id;
  if(stockBlurPending?.id===id)stockBlurPending=null;
  const result=stepQuantityInput(stockSession,id,Number(button.dataset.delta));
  stockSession=result.state;
  if(result.error){render();$('#quantity-'+id)?.focus({preventScroll:true});return false;}
  return acceptStock(id,'step');
}
function stockFocusOrder() {
  return groupQuantityEntries(stockSession,stockFilters,survivorInventorySource.itemFamilies)
    .filter(group=>group.family.id===selectedFamilyId)
    .flatMap(group=>{
      const compatibleAddons=group.addons.filter(addon=>addon.compatibleItemIds?.includes(selectedItemId));
      const visibleAddons=sortQuantityEntriesByRarity(compatibleAddons,killerRarityOrder,addonRarityDirection);
      return [...group.items,...visibleAddons].map(entity=>entity.id);
    });
}
function selectStockFamily(family) {
  if(!survivorInventorySource.itemFamilies.some(entry=>entry.id===family))return;
  const pending=stockSession.entities.filter(entity=>entity.familyId===selectedFamilyId
    && (stockSession.pending[entity.id]||stockSession.errors[entity.id]));
  stockBlurPending=null;
  for(const entity of pending){
    if(!acceptStock(entity.id,'enter'))return;
  }
  selectedFamilyId=family;
  selectedItemId=stockSession.order.map(entityId=>inventoryEntityById[entityId])
    .find(entity=>entity?.familyId===family&&entity.map==='items')?.id||'';
  render();
  document.getElementById('stock-family-nav-'+family)?.focus({preventScroll:true});
}
function selectStockItem(itemId, source='selector') {
  const item=inventoryEntityById[itemId];
  if(!item||item.map!=='items'||item.familyId!==selectedFamilyId)return;
  const pending=stockSession.entities.filter(entity=>entity.familyId===selectedFamilyId
    &&(stockSession.pending[entity.id]||stockSession.errors[entity.id]));
  stockBlurPending=null;
  for(const entity of pending){
    if(!acceptStock(entity.id,'enter'))return;
  }
  selectedItemId=itemId;render();
  (source==='card'?$('#stock-select-item-'+itemId):$('#inventory-item'))?.focus({preventScroll:true});
}
function resetStockFilters() {
  stockFilters={...stockFilters,map:'',rarity:'',search:'',inStock:false};
  render();$('#inventory-search')?.focus({preventScroll:true});
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
function saveCharacterTask({ navigate = false } = {}) {
  if (!characterTaskSession) return false;
  characterTaskSession = { ...characterTaskSession, errors: characterTaskSession.errors.filter(error => !error.saveFailure) };
  const result = buildCharacterTaskCandidate(save, characterTaskSession);
  if (result.errors.length) {
    characterTaskSession = { ...characterTaskSession, errors: result.errors, conflicted: result.conflict };
    render();
    const field = result.errors[0].field;
    document.querySelector('[data-character-task-field="' + CSS.escape(field) + '"]')?.focus({ preventScroll: true });
    return false;
  }
  const { characterId, task } = characterTaskSession;
  if (result.changed && !commit(next => {
    for (const field of Object.keys(characterTaskSession.draft)) {
      next.characters[characterId][field] = structuredClone(result.candidate.characters[characterId][field]);
    }
  }, characterId)) {
    characterTaskSession = { ...characterTaskSession, errors: [{ field: 'session', saveFailure: true, message: 'Not saved. Your draft is retained for retry.' }] };
    render();
    return false;
  }
  characterTaskSession = null;
  render();
  message(result.changed ? (task === 'progression' ? 'Progression saved.' : 'Note saved.') : 'No changes to save.');
  return true;
}
function captureCharacterSetupInput() {
  const input = $('#character-setup-bloodweb');
  if (!input || !characterSetup) return;
  const raw = input.value;
  if (raw === '') characterSetup.bloodwebLevel = '';
  else {
    const value = Number(raw);
    characterSetup.bloodwebLevel = Number.isSafeInteger(value) ? value : raw;
  }
}
function characterSetupIsDirty(draft = characterSetup) {
  if (!draft) return false;
  captureCharacterSetupInput();
  const baseline = draft.baseline;
  const bloodweb = typeof draft.bloodwebLevel === 'number' ? draft.bloodwebLevel : Number(draft.bloodwebLevel);
  const validBloodweb = Number.isSafeInteger(bloodweb) && bloodweb >= 1 && bloodweb <= 50;
  const normalizePerks = perks => Object.keys(perks || {}).sort().map(id => [id, perks[id]]);
  return !validBloodweb || bloodweb !== baseline.bloodwebLevel
    || JSON.stringify(normalizePerks(draft.perks)) !== JSON.stringify(normalizePerks(baseline.perks));
}
function hasDirtyWorkspaceDraft() {
  return Boolean(characterTaskSession?.dirty || characterSetupIsDirty() || characterInventoryCorrectionIsDirty());
}
async function resolveWorkspaceDraftTransition(intent) {
  if ($('#dirty-navigation').open) return 'stay';
  if (characterInventorySession.failedSelection) return resolveFailedInventoryTransition();
  const taskDraft = characterTaskSession?.dirty ? characterTaskSession : null;
  const setupDraft = characterSetupIsDirty() ? characterSetup : null;
  const correctionDraft = characterInventoryCorrectionIsDirty() ? characterInventorySession.correctionDraft : null;
  if (!taskDraft && !setupDraft && !correctionDraft) return 'proceed';
  const focused = document.activeElement;
  const dialog = $('#dirty-navigation');
  const sourceRoute = route();
  const sourceHash = committedWorkspaceHash;
  const sourceSave = JSON.stringify(save);
  const transitionToken = ++workspaceTransitionToken;
  dialog.returnValue = 'stay';
  configureWorkspaceTransitionDialog({
    title: correctionDraft ? 'Unsaved perk correction changes' : setupDraft ? 'Unsaved setup changes' : 'Unsaved ' + (taskDraft.task === 'progression' ? 'progression' : 'notes') + ' changes',
    text: correctionDraft ? 'Apply this personal record correction, discard it, or stay and continue editing.'
      : setupDraft ? 'Save this setup, discard the draft, or stay and continue editing.'
        : 'Save this task, discard the draft, or stay and continue editing.',
    applyLabel: correctionDraft ? 'Apply correction' : undefined,
  });
  dialog.showModal();
  const choice = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (transitionToken !== workspaceTransitionToken || committedWorkspaceHash !== sourceHash || route() !== sourceRoute) {
    message('The pending transition changed. Review the current draft before leaving.', true);
    return 'stay';
  }
  if ((taskDraft && (characterTaskSession?.characterId !== taskDraft.characterId
      || characterTaskSession?.task !== taskDraft.task || characterTaskSession?.baseFingerprint !== taskDraft.baseFingerprint))
    || (setupDraft && (characterSetup?.id !== setupDraft.id || characterSetup?.baseFingerprint !== setupDraft.baseFingerprint))
    || (correctionDraft && characterInventorySession.correctionDraft !== correctionDraft)) {
    message('The source draft changed while the confirmation was open. Review it before leaving.', true);
    return 'stay';
  }
  const destinationWorkspace = intent.destination ? parseCharacterWorkspaceRoute(intent.destination) : null;
  const continuingSetupBatch = Boolean(setupQueue && characterSetup?.batch
    && destinationWorkspace?.status === 'valid' && destinationWorkspace.section === 'setup');
  if (choice === 'discard') {
    if (taskDraft) characterTaskSession = null;
    if (setupDraft) { characterSetup = null; if (!continuingSetupBatch) setupQueue = null; }
    if (correctionDraft) characterInventorySession = { ...characterInventorySession, correctionDraft: null };
    render();
    return 'proceed';
  }
  if (choice === 'save') {
    try {
      store.assertWriter();
      if (sourceSave !== JSON.stringify(save)) { message('The saved data changed while this confirmation was open. Reload or discard the draft.', true); return 'stay'; }
      if (taskDraft) return saveCharacterTask({ navigate: false }) ? 'proceed' : 'stay';
      if (setupDraft) return finishCharacterSetup({ navigate: false, expectedDraft: setupDraft }) ? 'proceed' : 'stay';
      if (correctionDraft) return applyCharacterInventoryCorrection() ? 'proceed' : 'stay';
    }
    catch (error) { message(error.message, true); return 'stay'; }
  }
  if (focused?.closest('#global-nav') && $('#menu-toggle').getClientRects().length
    && $('#menu-toggle').getAttribute('aria-expanded') !== 'true') $('#menu-toggle').focus({ preventScroll: true });
  else if (focused?.isConnected) focused.focus();
  return 'stay';
}
function finishWorkspaceNavigation() {
  const contextWasCaptured = route() !== lastRoute;
  if (contextWasCaptured) captureWorkspaceContext(lastRoute);
  const currentRoute = route();
  const rosterRole = currentRoute === 'survivors' ? 'survivor' : currentRoute === 'killers' ? 'killer' : null;
  const previousWorkspace = parseCharacterWorkspaceRoute(lastRoute);
  const rosterReturn = rosterRole && previousWorkspace?.status === 'valid'
    && characterById[previousWorkspace.characterId].role === rosterRole
    ? collectionState.read(rosterRole) : null;
  const descriptor = parseCharacterWorkspaceRoute(route());
  if (descriptor?.status !== 'valid' || descriptor.section !== 'overview' || characterTaskSession?.characterId !== descriptor.characterId) characterTaskSession = null;
  if (descriptor?.section !== 'items-addons' || stockSessionKey !== descriptor.characterId+'/items-addons') {stockSession=null;stockSessionKey='';}
  if(descriptor?.section!=='power-addons'||killerSessionKey!==descriptor.characterId){killerSession=null;killerSessionKey='';killerBlurPending=null;}
  if (descriptor?.section !== 'setup') { characterSetup = null; setupQueue = null; }
  closeFilters(); setupOpen = false; setGlobalMenuOpen(false);
  if ($('#detail').open) $('#detail').close();
  if ($('#message').className !== 'error') message('');
  committedWorkspaceHash = location.hash || '#dashboard';
  render({ workspaceContextCaptured: contextWasCaptured });
  writeContinue(localStorage, currentRoute);
  const returnLink = rosterReturn && previousWorkspace?.status === 'valid'
    && rosterReturn.originCharacterId === previousWorkspace.characterId
    ? [...document.querySelectorAll('.character-collection-card [data-open-workspace]')]
      .find(link => link.dataset.id === rosterReturn.originCharacterId)
    : null;
  if (returnLink) {
    window.scrollTo(0, rosterReturn.scrollY);
    returnLink.focus({ preventScroll: true });
  } else if (rosterRole && previousWorkspace?.status === 'valid') {
    const resultsHeading = $('#collection-results-heading');
    if (resultsHeading) { resultsHeading.scrollIntoView({ block: 'start' }); resultsHeading.focus({ preventScroll: true }); }
    else { window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); }
  } else { window.scrollTo(0, 0); $('#main').focus({ preventScroll: true }); }
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
function acceptPendingStockQuantities() {
  if(stockSession){
    const pending=stockSession.entities.filter(entity=>stockSession.pending[entity.id]||stockSession.errors[entity.id]);
    for(const entity of pending){
      if(!acceptStock(entity.id,'enter'))return false;
    }
  }
  return true;
}
async function requestWorkspaceNavigation(destination, { source = 'link' } = {}) {
  const hash = destination.startsWith('#') ? destination : '#' + destination;
  if (hash === committedWorkspaceHash) return true;
  if(!acceptPendingKillerQuantities())return false;
  stockBlurPending=null;
  if(!acceptPendingStockQuantities())return false;
  if (await resolveWorkspaceDraftTransition({ destination: hash, source }) !== 'proceed') return false;
  history.pushState({ ...history.state, workspaceIndex: ++workspaceHistoryIndex }, '', hash);
  finishWorkspaceNavigation();
  return true;
}
function render({ workspaceContextCaptured = false } = {}) {
  if (!initialized) { $('#main').innerHTML = '<section class="panel"><h1>Loading tracker…</h1></section>'; editorPresentation(); return; }
  const current = route(), workspaceRoute = parseCharacterWorkspaceRoute(current), characterRoute = parseCharacterInventoryRoute(current),
    section = workspaceRoute?.status === 'valid' ? characterById[workspaceRoute.characterId].role + 's' : current;
  if (current !== lastRoute) {
    if (!workspaceContextCaptured) captureWorkspaceContext(lastRoute);
    closeFilters();
    filterMemory.write(lastRoute, filters);
    filters = filterMemory.read(current) || { search: '', status: 'all', prestige: 'all', favorite: false, sort: 'name' };
    lastRoute = current;
    if (workspaceRoute?.status === 'valid') {
      restoreWorkspaceContext(workspaceRoute);
    } else {
      characterInventorySession = syncCharacterInventorySession(characterInventorySession, current);
    }
  } else characterInventorySession = syncCharacterInventorySession(characterInventorySession, current);
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
function killerPowerDataMarkup(value,component=false) {
  if(Array.isArray(value))return value.length?'<ul>'+value.map(item=>'<li>'+killerPowerDataMarkup(item,component)+'</li>').join('')+'</ul>':'<p>None recorded.</p>';
  if(value&&typeof value==='object'){
    if(typeof value.name==='string'){
      const fields=Object.entries(value).filter(([key,item])=>key!=='name'&&item!==undefined&&item!==null&&item!=='');
      const type=value.type?'<p class="killer-power-type"><span>Type</span> '+esc(value.type)+'</p>':'';
      const description=value.description?'<p class="killer-power-description">'+esc(value.description)+'</p>':'';
      const measurement=value.value!==undefined?'<p class="killer-power-measurement"><strong>'+esc(value.value)+(value.unit?' '+esc(value.unit):'')+'</strong></p>':'';
      const known=new Set(['type','description','value','unit','conditions']);
      const other=fields.filter(([key])=>!known.has(key)).map(([key,item])=>'<div><dt>'+esc(key.replace(/([A-Z])/g,' $1'))+'</dt><dd>'+killerPowerDataMarkup(item)+'</dd></div>').join('');
      const conditions=value.conditions?'<p class="killer-power-conditions"><span>Conditions</span> '+esc(value.conditions)+'</p>':'';
      return '<article class="killer-power-entry"'+(component?' data-power-component':'')+'><h4>'+esc(value.name)+'</h4>'+type+measurement+conditions+description+(other?'<dl>'+other+'</dl>':'')+'</article>';
    }
    return '<dl>'+Object.entries(value).map(([key,item])=>'<div><dt>'+esc(key.replace(/([A-Z])/g,' $1'))+'</dt><dd>'+killerPowerDataMarkup(item)+'</dd></div>').join('')+'</dl>';
  }
  if(value===null||value===undefined||value==='')return '<span>—</span>';
  return esc(value);
}
function killerPowerFieldLabel(key) {
  return ({shortSummary:'Summary',fullExplanation:'Full mechanics',components:'Components',mechanics:'Mechanics',resources:'Resources',
    survivorInteractions:'Survivor interactions',powerStates:'Power states',addonRelevantMechanics:'Add-on-relevant mechanics',complexRules:'Complex rules'})[key]
    ||key.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase());
}
function killerPowerDetail(characterId) {
  const power=killerPowerByCharacterId[characterId];
  if(!power)return dialogHeader('KILLER POWER DETAILS','Unavailable Power')+'<p class="muted">This Killer Power is not in the current verified catalog.</p>';
  const art=killerPowerIconPath(characterId,assetManifest);
  const artwork=art?'<img src="'+esc(artworkUrl(art))+'" alt="">':'<span class="stock-art-fallback" role="img" aria-label="Power artwork unavailable" data-power-art-fallback>◇</span>';
  const fields=Object.entries(power).filter(([key])=>!['powerName','artwork'].includes(key));
  return dialogHeader('KILLER POWER',power.powerName,artwork)+'<div class="stock-detail-body killer-detail-body killer-power-reference" tabindex="0" aria-label="Power reference">'
    +fields.map(([key,value])=>'<section data-power-detail-field="'+esc(key)+'"><h3>'+esc(killerPowerFieldLabel(key))+'</h3>'
      +(value===null||value===''||(Array.isArray(value)&&!value.length)?'<p class="muted">No additional content recorded.</p>':killerPowerDataMarkup(value,key==='components'))+'</section>').join('')
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
function replacementNotice(parsed) {
  if (parsed.sourceSchemaVersion === 1) {
    return ' This v1 replacement has no saved Prestige Queue or inventory quantity maps; the imported schema v3 planning queues and Up Next pins start empty.';
  }
  if (parsed.sourceSchemaVersion === 2) {
    return ' This v2 replacement migrates Prestige goals into role-separated queues; new Playing queues and Up Next pins start empty.';
  }
  return '';
}
async function restore(id) {
  store.assertWriter();
  const backup = store.backups().find(b => b.id === id);
  if (!backup) return;
  const parsed = parseSave(JSON.stringify(backup.save));
  const incoming = parsed.save;
  const recovering = storageBlocked;
  if (!await confirmAction('Restore this backup?', `Restore progress from ${date(backup.createdAt)}? ${recovering ? 'The original stored data will be preserved verbatim before replacement.' : 'A snapshot of your current progress will be saved first.'}${replacementNotice(parsed)}`, 'Restore backup')) return;
  save = store.replace(save, incoming, 'Before backup restore', { recover: recovering });
  clearContinue(localStorage);
  storageBlocked = false;
  $('#save-status').textContent = 'Saved locally';
  message(`Backup restored. ${recovering ? 'The original stored data was preserved separately in this browser.' : 'Your previous progress is in local backups.'}`); render();
}
async function reset() {
  store.assertWriter();
  if (storageBlocked) { message('Import a valid save to recover before resetting. The original stored data is preserved.', true); return; }
  if (!await confirmAction('Reset all progress?', 'All progression, ownership, notes, favorites, perk tiers, Shrine overrides, Prestige and Playing queues, Up Next pins, and inventory quantities will return to defaults. Your current save will be backed up. Catalog definitions are preserved.', 'Reset all progress')) return;
  save = store.replace(save, freshSave(), 'Before reset');
  clearContinue(localStorage);
  setupOpen = false; setupStep = 0; setupSearch = ''; setupFilter = 'all';
  message('Progress reset. Your previous save is available in local backups.'); render();
}
function createCharacterSetupDraft(id, returnRoute = characterWorkspaceHref(id)) {
  const progress = save.characters[id];
  const perks = Object.fromEntries(Object.entries(progress.perks).filter(([perkId, tier]) => perkById[perkId]
    && (tier > 0 || perkById[perkId].historicalAvailability?.manualOwnership)));
  return { id, step: 'bloodweb', bloodwebLevel: progress.bloodwebLevel,
    perks, baseline: { bloodwebLevel: progress.bloodwebLevel, perks: structuredClone(perks) },
    baseFingerprint: JSON.stringify(save), conflicted: false, search: '', returnRoute };
}
async function openCharacterSetup(id, { batch = null, returnRoute = null } = {}) {
  store.assertWriter();
  if (!save.characters[id]?.owned) throw new Error('Initial setup requires an owned character.');
  const destination = characterWorkspaceHref(id, 'setup');
  if (!await requestWorkspaceNavigation(destination)) return false;
  if (characterSetup?.id !== id) characterSetup = createCharacterSetupDraft(id, returnRoute || characterWorkspaceHref(id));
  characterSetup.returnRoute = returnRoute || characterSetup.returnRoute || characterWorkspaceHref(id);
  characterSetup.batch = batch;
  if ($('#detail').open) $('#detail').close();
  render();
  $('#character-setup-bloodweb')?.focus();
  return true;
}
async function advanceCharacterSetup(startIndex = setupQueue?.index ?? 0) {
  const queue = setupQueue;
  if (!queue) return false;
  let index = startIndex;
  while (index < queue.ids.length) {
    const id = queue.ids[index];
    if (save.characters[id].owned && !save.characters[id].setupComplete) {
      const opened = await openCharacterSetup(id, { batch: { position: index + 1, total: queue.ids.length },
        returnRoute: queue.returnRoute });
      if (opened && setupQueue === queue) queue.index = index;
      return opened;
    }
    index++;
  }
  const completed = queue.completed;
  const returnRoute = queue.returnRoute || '#dashboard';
  if (!await requestWorkspaceNavigation(returnRoute)) return false;
  if (setupQueue === queue) setupQueue = null;
  characterSetup = null;
  message(`Setup pass finished. ${completed} character${completed === 1 ? '' : 's'} completed. Run character setups again to continue any skipped characters.`);
  return true;
}
function finishCharacterSetup({ navigate = true, expectedDraft = characterSetup } = {}) {
  store.assertWriter();
  const draft = expectedDraft;
  if (!draft || characterSetup !== draft) { message('The setup draft changed. Review it before saving.', true); return false; }
  if (storageBlocked) { message('Import a valid save before completing character setup.', true); return false; }
  if (draft.conflicted || draft.baseFingerprint !== JSON.stringify(save)) {
    draft.conflicted = true;
    message('The saved data changed while setup was open. Discard this draft and reopen setup before saving.', true);
    render();
    return false;
  }
  try {
    completeCharacterSetup(structuredClone(save), draft.id, draft.bloodwebLevel, draft.perks);
  } catch (error) { message(error.message, true); return false; }
  store.backup(save, `Before character setup: ${characterById[draft.id].name}`);
  if (commit(next => completeCharacterSetup(next, draft.id, draft.bloodwebLevel, draft.perks), draft.id)) {
    if (setupQueue && navigate) {
      setupQueue.completed++;
      const nextIndex = setupQueue.index + 1;
      characterSetup = null;
      void advanceCharacterSetup(nextIndex).catch(error => message(error.message, true));
      return true;
    }
    const returnRoute = draft.returnRoute || characterWorkspaceHref(draft.id);
    characterSetup = null;
    if (!navigate) {
      if (setupQueue) setupQueue.completed++;
      return true;
    }
    location.hash = returnRoute; render(); message('Character setup completed. Personal records preserved; automatic minimums remain in effect.');
    return true;
  }
  return false;
}
function characterInventoryRecordKey(currentSave, characterId, perkId) {
  const inventory = currentSave.characters[characterId]?.perks || {};
  return Object.hasOwn(inventory, perkId) ? `present:${inventory[perkId]}` : 'absent';
}
function characterInventoryCorrectionIsDirty() {
  return Boolean(characterInventorySession.correctionDraft?.dirty);
}
function applyCharacterInventoryCorrection() {
  const draft = characterInventorySession.correctionDraft;
  if (!draft?.dirty) return false;
  if (draft.baseFingerprint !== JSON.stringify(save) || draft.conflicted) {
    characterInventorySession = { ...characterInventorySession,
      correctionDraft: { ...draft, conflicted: true, error: 'Stored data changed. Cancel this correction and reopen it before applying.' } };
    message('Stored data changed while the correction was open. Cancel and reopen it before applying.', true);
    render();
    return false;
  }
  try { correctPersonalPerkTier(structuredClone(save), draft.characterId, draft.perkId, draft.tier); }
  catch (error) {
    characterInventorySession = { ...characterInventorySession, correctionDraft: { ...draft, error: error.message } };
    message(error.message, true);
    render();
    return false;
  }
  if (!commit(next => correctPersonalPerkTier(next, draft.characterId, draft.perkId, draft.tier), draft.characterId)) {
    characterInventorySession = { ...characterInventorySession, correctionDraft: { ...draft, error: 'Not saved. Retry Apply correction or Cancel this draft.' } };
    render();
    $('[data-action="character-inventory-correction-apply"]')?.focus({ preventScroll: true });
    return false;
  }
  characterInventorySession = { ...characterInventorySession, correctionDraft: null };
  render();
  $(`[data-action="character-inventory-correction-open"][data-perk="${draft.perkId}"]`)?.focus({ preventScroll: true });
  return true;
}
function saveCharacterInventorySelection(intent) {
  const descriptor = parseCharacterInventoryRoute(route());
  if (descriptor?.mode !== 'inventory' || descriptor.characterId !== intent.characterId) return false;
  if (intent.baseFingerprint !== JSON.stringify(save)) {
    characterInventorySession = { ...characterInventorySession, failedSelection: { ...intent, conflicted: true } };
    message('Stored data changed after this selection failed. Discard the failed selection before continuing.', true);
    render();
    return false;
  }
  const before = characterInventoryRecordKey(save, intent.characterId, intent.perkId);
  const expected = intent.type === 'historical' || intent.tier !== null ? `present:${intent.tier}` : 'absent';
  const wasQuick = Boolean(characterInventorySession.quickPerkId);
  const applySelection = next => intent.type === 'historical'
    ? setHistoricalPerkTier(next, intent.characterId, intent.perkId, intent.tier)
    : setCharacterPersonalTier(next, intent.characterId, intent.perkId, intent.tier);
  try { applySelection(structuredClone(save)); }
  catch (error) { message(error.message, true); return false; }
  if (before === expected) {
    characterInventorySession = { ...characterInventorySession, quickPerkId: null, failedSelection: null };
    render();
    if (wasQuick) $(`.perk-card[data-perk="${intent.perkId}"]`)?.focus({ preventScroll: true });
    return true;
  }
  characterInventorySession = { ...characterInventorySession, quickPerkId: null, failedSelection: null };
  const saved = commit(applySelection, intent.characterId);
  if (!saved) {
    characterInventorySession = { ...characterInventorySession, quickPerkId: null, failedSelection: intent };
    render();
    $('[data-action="character-inventory-retry"]')?.focus({ preventScroll: true });
    return false;
  }
  characterInventorySession = { ...characterInventorySession, quickPerkId: null, failedSelection: null };
  render();
  if (wasQuick) $(`.perk-card[data-perk="${intent.perkId}"]`)?.focus({ preventScroll: true });
  return true;
}
function discardCharacterInventoryFailedSelection() {
  const intent = characterInventorySession.failedSelection;
  if (!intent) return;
  characterInventorySession = { ...characterInventorySession, failedSelection: null, quickPerkId: null };
  message('');
  render();
  $(`.perk-card[data-perk="${intent.perkId}"]`)?.focus({ preventScroll: true });
}
function configureWorkspaceTransitionDialog({ title, text, failedSelection = false, retryDisabled = false, applyLabel = 'Save' }) {
  const dialog = $('#dirty-navigation');
  $('#dirty-title').textContent = title;
  $('#dirty-text').textContent = text;
  const discard = dialog.querySelector('[value="discard"]');
  const action = dialog.querySelector('.primary');
  discard.textContent = failedSelection ? 'Discard failed selection' : 'Discard';
  action.value = failedSelection ? 'retry' : 'save';
  action.textContent = failedSelection ? 'Retry' : applyLabel;
  action.disabled = failedSelection && retryDisabled;
}
async function resolveFailedInventoryTransition() {
  if ($('#dirty-navigation').open) return 'stay';
  const failed = characterInventorySession.failedSelection;
  if (!failed) return 'proceed';
  const focused = document.activeElement;
  const sourceRoute = route(), sourceHash = committedWorkspaceHash, sourceSave = JSON.stringify(save);
  const transitionToken = ++workspaceTransitionToken;
  const conflict = failed.baseFingerprint !== sourceSave || failed.conflicted;
  const dialog = $('#dirty-navigation');
  dialog.returnValue = 'stay';
  configureWorkspaceTransitionDialog({
    title: 'Perk selection not saved',
    text: conflict ? 'Stored data changed after the failed selection. Retry is unavailable; discard it or stay to review.'
      : 'This perk selection was not saved. Retry it, discard only this failed selection, or stay in Perks.',
    failedSelection: true,
    retryDisabled: conflict,
  });
  dialog.showModal();
  const choice = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (transitionToken !== workspaceTransitionToken || committedWorkspaceHash !== sourceHash || route() !== sourceRoute
    || characterInventorySession.failedSelection !== failed) {
    message('The pending transition changed. Review the current failed selection before leaving.', true);
    return 'stay';
  }
  if (choice === 'retry') return saveCharacterInventorySelection(failed) ? 'proceed' : 'stay';
  if (choice === 'discard') {
    discardCharacterInventoryFailedSelection();
    return 'proceed';
  }
  if (focused?.isConnected) focused.focus({ preventScroll: true });
  return 'stay';
}
async function handleClick(event) {
  if (event.target.closest('.skip-link')) {
    event.preventDefault(); setGlobalMenuOpen(false);
    $('#main').focus({ preventScroll: true }); $('#main').scrollIntoView({ block: 'start' }); return;
  }
  const link = event.target.closest('a[href]');
  if (link?.getAttribute('href').startsWith('#') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    && link.target !== '_blank' && event.button === 0) {
    const rosterRole = route() === 'survivors' ? 'survivor' : route() === 'killers' ? 'killer' : null;
    if (rosterRole && link.hasAttribute('data-open-workspace')) {
      collectionState.update(rosterRole, {
        ...filters, originCharacterId: link.dataset.id, scrollY: window.scrollY,
      });
    }
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
  if(action==='killer-addon-filter-reset'){resetKillerAddonFilters();return;}
  if(action==='stock-family-select'){selectStockFamily(family);return;}
  if(action==='stock-item-select'){selectStockItem(id,'card');return;}
  if(action==='stock-filter-reset'){resetStockFilters();return;}
  if(action==='stock-error-focus'){
    revealStockQuantity(id);return;
  }
  if (characterTaskSession?.dirty && action !== 'character-task-save' && action !== 'character-task-cancel'
    && (requiresEditor(action) || action === 'character' || action === 'enable-editing')) {
    if (await resolveWorkspaceDraftTransition({ action }) !== 'proceed') return;
  }
  if (characterSetupIsDirty() && !action?.startsWith('character-setup-')
    && (requiresEditor(action) || action === 'character' || action === 'enable-editing')) {
    if (await resolveWorkspaceDraftTransition({ action }) !== 'proceed') return;
  }
  if (characterInventoryCorrectionIsDirty()
    && !['character-inventory-correction-apply', 'character-inventory-correction-cancel'].includes(action)
    && (requiresEditor(action) || action === 'character' || action === 'enable-editing' || action === 'character-inventory-select')) {
    if (await resolveWorkspaceDraftTransition({ action }) !== 'proceed') return;
  }
  if (action === 'character-task-start') {
    const descriptor = parseCharacterWorkspaceRoute(route());
    if (descriptor?.status !== 'valid' || descriptor.section !== 'overview') return;
    const task = button.dataset.task;
    characterTaskSession = createCharacterTaskSession(save, descriptor.characterId, task);
    render();
    document.querySelector('[data-character-task-field]')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'character-task-save') { store.assertWriter(); saveCharacterTask(); return; }
  if (action === 'character-task-cancel') {
    const task = characterTaskSession?.task;
    characterTaskSession = null;
    render();
    document.querySelector('[data-action="character-task-start"][data-task="' + task + '"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'overview-ownership-toggle') {
    const wasOwned = save.characters[id].owned;
    if (commit(next => { next.characters[id].owned = !wasOwned; }, id)) {
      document.querySelector('[data-action="overview-ownership-toggle"]')?.focus({ preventScroll: true });
    }
    return;
  }
  if (action === 'enable-editing') return enableEditing();
  if (requiresEditor(action) && action !== 'character-inventory-set-tier') store.assertWriter();
  if(action==='queue-add'||action==='queue-target'){openPrestigeTargetEditor(id,action==='queue-add',button,button.dataset.role);return;}
  if(action==='queue-select'){openPrestigeTargetEditor($('#queue-character').value,true,queueOpener,queueTargetEditor?.role);return;}
  if(action==='queue-shortcut'){
    if(Number(button.dataset.target)<=save.characters[queueTargetEditor.id].prestige)return;
    $('#queue-target').value=button.dataset.target;$('#queue-target').focus();return;
  }
  if(action==='queue-save'){
    const raw=$('#queue-target').value.trim();
    try {
      if(!/^\d+$/.test(raw))throw new Error('Enter a positive whole-number target.');
      const candidate=structuredClone(save);
      const targetAction={type:queueTargetEditor.adding?'add':'target',role:queueTargetEditor.role,characterId:queueTargetEditor.id,targetPrestige:Number(raw)};
      if(!applyPrestigeQueueAction(candidate,targetAction)){$('#detail').close();queueTargetEditor=null;return;}
      if(commitPrestigeQueueAction(targetAction)){
        $('#detail').close();queueTargetEditor=null;
      }
    }catch(error){$('#queue-target-error').textContent=error.message;$('#queue-target').focus();}
    return;
  }
  if(action==='queue-remove'||action==='queue-move'||action==='queue-move-down'){
    const role=button.dataset.role||characterById[id]?.role;
    const before=save.planning.prestigeQueues[role],index=before.findIndex(entry=>entry.characterId===id);
    if(commitPrestigeQueueAction({type:action==='queue-remove'?'remove':'move',role,characterId:id,direction:Number(button.dataset.direction)})){
      const remaining=save.planning.prestigeQueues[role],focusId=action==='queue-remove'?remaining[Math.min(index,remaining.length-1)]?.characterId:id;
      const focus=action==='queue-remove'?(focusId?$('#queue-remove-'+focusId):$('#queue-add-'+role)):$('#queue-remove-'+id);
      (focus&&!focus.disabled?focus:$('#queue-add-'+role))?.focus({preventScroll:true});
      const name=characterById[id]?.name||id,position=remaining.findIndex(entry=>entry.characterId===id)+1;
      $('#filter-status').textContent=action==='queue-remove'?`${name} Prestige goal removed.`:`${name} moved to position ${position} of ${remaining.length}.`;
    }
    return;
  }
  if(action==='playing-add'){
    const role=button.dataset.role,characterId=$(`[data-playing-character="${role}"]`).value;
    if(!characterId){$(`[data-playing-character="${role}"]`).focus();return;}
    if(commitPlanningAction({type:'addPlaying',role,characterId})){
      $('#playing-remove-'+characterId)?.focus({preventScroll:true});
      $('#filter-status').textContent=`${characterById[characterId].name} added to the ${role==='survivor'?'Survivor':'Killer'} Playing Queue.`;
    }
    return;
  }
  if(action==='playing-remove'||action==='playing-move-up'||action==='playing-move-down'){
    const role=button.dataset.role,direction=Number(button.dataset.direction),before=save.planning.playingQueues[role],index=before.findIndex(entry=>entry.characterId===id);
    const type=action==='playing-remove'?'removePlaying':'movePlaying';
    if(commitPlanningAction({type,role,characterId:id,direction})){
      const remaining=save.planning.playingQueues[role],focusId=action==='playing-remove'?remaining[Math.min(index,remaining.length-1)]?.characterId:id;
      const focus=action==='playing-remove'?(focusId?$('#playing-remove-'+focusId):$(`[data-playing-character="${role}"]`)):$('#playing-remove-'+id);
      focus?.focus({preventScroll:true});
      const name=characterById[id]?.name||id,position=remaining.findIndex(entry=>entry.characterId===id)+1;
      $('#filter-status').textContent=action==='playing-remove'?`${name} removed from the Playing Queue.`:`${name} moved to position ${position} of ${remaining.length}.`;
    }
    return;
  }
  if(action==='up-next-pin'){openUpNextPinEditor(button.dataset.role,button);return;}
  if(action==='up-next-save'){
    const role=upNextEditor?.role,characterId=$('#up-next-character')?.value,intent=$('#up-next-intent')?.value;
    const replaceCharacterId=$('#up-next-replace')?.value;
    try{
      if(!role||!characterId)throw new Error('Choose a character to pin.');
      if(save.planning.upNext[role].length>=5&&!replaceCharacterId)throw new Error('Choose an existing pin to swap or cancel.');
      const action={type:'pin',role,characterId,intent,...(replaceCharacterId?{replaceCharacterId}:{})};
      if(commitPlanningAction(action)){
        const lane=save.planning.upNext[role],index=lane.findIndex(pin=>pin.characterId===characterId);
        const name=characterById[characterId]?.name||characterId;
        $('#detail').close();upNextEditor=null;
        $('#filter-status').textContent=`${name} pinned with ${intent==='prestige'?'Prestige':'Play'} intent at position ${index+1} of ${lane.length}.`;
      }
    }catch(error){$('#up-next-error').textContent=error.message;}
    return;
  }
  if(action==='up-next-unpin'||action==='up-next-move'){
    const role=button.dataset.role,before=save.planning.upNext[role],index=before.findIndex(pin=>pin.characterId===id);
    const type=action==='up-next-unpin'?'unpin':'movePin',direction=Number(button.dataset.direction);
    if(commitPlanningAction({type,role,characterId:id,direction})){
      const lane=save.planning.upNext[role],name=characterById[id]?.name||id,position=lane.findIndex(pin=>pin.characterId===id)+1;
      if(action==='up-next-move')$(`#up-next-intent-${CSS.escape(id)}`)?.focus({preventScroll:true});
      else if(lane[index])$(`#up-next-intent-${CSS.escape(lane[index].characterId)}`)?.focus({preventScroll:true});
      else $(`[data-up-next-lane="${role}"] [data-action="up-next-pin"]`)?.focus({preventScroll:true});
      $('#filter-status').textContent=action==='up-next-unpin'?`${name} unpinned from ${role==='survivor'?'Survivor':'Killer'} Up Next.`:`${name} moved to position ${position} of ${lane.length}.`;
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
    void advanceCharacterSetup().catch(error => message(error.message, true));
    return;
  }
  if (action === 'character-setup-next-character' && setupQueue) {
    await advanceCharacterSetup(setupQueue.index + 1);
    return;
  }
  if (action === 'character-setup-exit') {
    const target = characterSetup?.returnRoute || '#dashboard';
    await requestWorkspaceNavigation(target); return;
  }
  if (action === 'character-setup-skip') { characterSetup = null; refreshDetail(); return; }
  if (action === 'character-setup-edit') {
    return openCharacterSetup(id);
  }
  if (action === 'character-setup-start') return openCharacterSetup(characterSetup.id);
  if (action === 'character-setup-p1' && characterSetup?.step === 'bloodweb') {
    characterSetup.bloodwebLevel = $('#character-setup-bloodweb').value;
    const characterId = characterSetup.id;
    if (commit(next => { next.characters[characterId].prestige = Math.max(1, next.characters[characterId].prestige); }, characterId)) {
      characterSetup.baseFingerprint = JSON.stringify(save);
      refreshDetail();
    }
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
  if (action === 'character-inventory-card-size') {
    characterCardSize = normalizeCharacterCardSize(button.dataset.size);
    saveCharacterCardSize(characterCardSize);
    render();
    return;
  }
  if (action === 'character-inventory-select') {
    characterInventorySession = { ...characterInventorySession, quickPerkId: perk };
    render();
    $('.character-inventory-quick-picker button:not(:disabled), .character-inventory-quick-picker select')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'character-inventory-details') {
    return openDetail('perk', perk);
  }
  if (action === 'character-inventory-correction-open') {
    const characterId = button.dataset.character, perkId = button.dataset.perk;
    const row = characterInventoryCandidatePool(save, characterId, { allRole: true }).find(candidate => candidate.perk.id === perkId);
    if (!row?.hasRecordedRecord || row.recordedTier < 1) return;
    characterInventorySession = { ...characterInventorySession, correctionDraft: {
      characterId, perkId, originalTier: row.recordedTier, tier: row.recordedTier,
      dirty: false, conflicted: false, error: null, baseFingerprint: JSON.stringify(save),
    } };
    render();
    $('#character-inventory-correction-tier')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'character-inventory-correction-cancel') {
    const perkId = characterInventorySession.correctionDraft?.perkId;
    characterInventorySession = { ...characterInventorySession, correctionDraft: null };
    render();
    if (perkId) $(`[data-action="character-inventory-correction-open"][data-perk="${perkId}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === 'character-inventory-correction-apply') {
    store.assertWriter();
    applyCharacterInventoryCorrection();
    return;
  }
  if (action === 'character-inventory-all-role') { characterInventorySession = { ...characterInventorySession, allRole: !characterInventorySession.allRole }; render(); return; }
  if (action === 'character-inventory-category') {
    characterInventorySession = { ...characterInventorySession, category: button.dataset.category };
    render();
    return;
  }
  if (action === 'character-inventory-retry') {
    const intent = characterInventorySession.failedSelection;
    if (intent && !intent.conflicted) saveCharacterInventorySelection(intent);
    return;
  }
  if (action === 'character-inventory-discard-failed') {
    discardCharacterInventoryFailedSelection();
    return;
  }
  if (action === 'character-inventory-set-tier') {
    if (characterInventorySession.failedSelection) return;
    const characterId = button.dataset.character, perkId = button.dataset.perk;
    const tier = button.dataset.tier === 'none' ? null : Number(button.dataset.tier);
    saveCharacterInventorySelection({ type: 'personal', characterId, perkId, tier, baseFingerprint: JSON.stringify(save) });
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
  if (action === 'collection-clear-search') { filters.search = ''; render(); $('#search')?.focus({ preventScroll: true }); return; }
  if (action === 'collection-reset-filters') { filters.status = 'all'; filters.prestige = 'all'; filters.favorite = false; render(); $('#collection-filters summary')?.focus({ preventScroll: true }); return; }
  if (action === 'collection-clear-filter') {
    if (button.dataset.filterKey === 'status') filters.status = 'all';
    if (button.dataset.filterKey === 'prestige') filters.prestige = 'all';
    if (button.dataset.filterKey === 'favorite') filters.favorite = false;
    render(); $('#collection-filters summary')?.focus({ preventScroll: true }); return;
  }
  if (action === 'filter') { filters.status = button.dataset.filter; render(); return; }
  if (action === 'favorites-filter') {
    collectionFiltersOpen = $('#collection-filters')?.open ?? false;
    filters.favorite = !filters.favorite;
    render();
    $('[data-action="favorites-filter"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === 'collection-page') {
    const role = route() === 'survivors' ? 'survivor' : 'killer';
    const currentPage = collectionState.read(role).page;
    collectionState.update(role, { page: Math.max(0, currentPage + Number(button.dataset.delta)) });
    render();
    document.getElementById('collection-results-heading')?.focus();
    return;
  }
  if (action === 'favorite') {
    const wasFavorite = save.characters[id].favorite;
    const card = button.closest('.character-collection-card');
    const cardIndex = [...document.querySelectorAll('.character-collection-card')].indexOf(card);
    const removesFilteredResult = filters.favorite && wasFavorite;
    if (!commit(next => { next.characters[id].favorite = !next.characters[id].favorite; }, id)) return;
    if (!card) {
      document.querySelector('.character-workspace-favorite')?.focus({ preventScroll: true });
    } else if (removesFilteredResult) {
      const cards = [...document.querySelectorAll('.character-collection-card')];
      (cards[Math.min(Math.max(cardIndex, 0), cards.length - 1)]?.querySelector('[data-open-workspace]') || $('#collection-results-heading'))?.focus();
    } else {
      const favorites = [...document.querySelectorAll('.character-collection-card [data-action="favorite"]')];
      (favorites.find(candidate => candidate.dataset.id === id)
        || favorites[Math.min(cardIndex, favorites.length - 1)]
        || $('#collection-results-heading'))?.focus({ preventScroll: true });
    }
    return;
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
  if (characterInventorySession.quickPerkId && !event.target.closest('.character-inventory-quick-picker, .perk-card[data-action="character-inventory-select"], #detail')) closeCharacterInventoryQuickPicker();
});
document.addEventListener('click', event => {
  const trigger = event.target.closest('#menu-toggle');
  if (trigger) {
    setGlobalMenuOpen(trigger.getAttribute('aria-expanded') !== 'true');
    return;
  }
  const sidebar = $('.sidebar');
  if (sidebar.dataset.menuOpen !== 'true') return;
  const link = event.target.closest('#global-nav a[href^="#"]');
  const currentRoute = location.hash || '#dashboard';
  if (!sidebar.contains(event.target) || link?.hash === currentRoute) {
    setGlobalMenuOpen(false, link?.hash === currentRoute && $('#menu-toggle').getClientRects().length > 0);
  }
});
document.addEventListener('click', event => { handleClick(event).catch(error => message(error.message || 'The action could not be completed.', true)); });
document.addEventListener('input', event => {
  if(event.target.hasAttribute('data-killer-quantity')){try{killerQuantityInput(event.target);}catch(error){message(error.message,true);}return;}
  if(event.target.dataset.inventoryQuantity){try{stockInput(event.target);}catch(error){message(error.message,true);}return;}
  if(event.target.id==='killer-addon-search'){setKillerAddonFilter('search',event.target.value);return;}
  if(event.target.id==='inventory-search'){stockFilters={...stockFilters,search:event.target.value};render();return;}
  if (event.target.dataset.characterTaskField) {
    try {
      store.assertWriter();
      characterTaskSession = updateCharacterTaskSession(characterTaskSession, {
        field: event.target.dataset.characterTaskField,
        value: event.target.value,
      });
    } catch (error) { message(error.message, true); }
    return;
  }
  if (event.target.id === 'character-setup-search') { characterSetup.search = event.target.value; refreshDetail(); }
  if (event.target.id === 'character-inventory-search') { characterInventorySession = { ...characterInventorySession, search: event.target.value }; render(); }
  if (event.target.id === 'setup-search') { setupSearch = event.target.value; render(); }
  if (event.target.dataset.setupPrestige) {
    const target = event.target, id = target.dataset.setupPrestige, value = Number(target.value);
    target.setCustomValidity(target.value && !Number.isSafeInteger(value) ? 'Enter a valid whole-number Prestige.' : '');
    if (target.checkValidity() && Number.isSafeInteger(value)) commit(next => { next.characters[id].prestige = value; }, id);
  }
  if (event.target.id === 'search') {
    const start = event.target.selectionStart, end = event.target.selectionEnd;
    filters.search = event.target.value; render();
    const restored = $('#search');
    restored?.focus({ preventScroll: true });
    if (restored && Number.isInteger(start) && Number.isInteger(end)) restored.setSelectionRange(start, end);
  }
});
document.addEventListener('change', async event => {
  const target = event.target;
  try {
    if(target.matches('[data-up-next-intent]')){
      const {characterId,role}=target.dataset,intent=target.value;
      if(commitPlanningAction({type:'pin',characterId,role,intent})){
        target.focus({preventScroll:true});
        $('#filter-status').textContent=`${characterById[characterId].name} primary intent changed to ${intent==='prestige'?'Prestige':'Play'}.`;
      }
      return;
    }
    if(target.id==='killer-addon-rarity'){
      const validRarity=['',...new Set(Object.values(inventoryEntityById).filter(entity=>entity.role==='killer').map(entity=>entity.rarity))];
      if(validRarity.includes(target.value))setKillerAddonFilter('rarity',target.value);
      return;
    }
    if(target.id==='killer-addon-in-stock'){setKillerAddonFilter('inStock',target.checked);return;}
    if(target.id==='addon-rarity-order'){
      if(['highest-to-lowest','lowest-to-highest'].includes(target.value))addonRarityDirection=target.value;
      render();return;
    }
    if (target.id === 'ownership-filter' && ['all', 'owned', 'locked'].includes(target.value)) { collectionFiltersOpen = $('#collection-filters')?.open ?? false; filters.status = target.value; render(); return; }
    if(target.id==='inventory-item'){selectStockItem(target.value);return;}
    if(['inventory-map','inventory-rarity','inventory-in-stock'].includes(target.id)){
      const key={'inventory-map':'map','inventory-rarity':'rarity','inventory-in-stock':'inStock'}[target.id];
      stockFilters={...stockFilters,[key]:target.type==='checkbox'?target.checked:target.value};render();return;
    }
    if(target.dataset.inventoryQuantity)return;
    if (target.matches(editingControls) && !target.matches('[data-character-inventory-historical]')) store.assertWriter();
    if (target.dataset.characterInventoryHistorical) {
      if (target.value === '') return;
      const perkId = target.dataset.characterInventoryHistorical, characterId = target.dataset.character;
      if (characterInventorySession.failedSelection) { render(); return; }
      saveCharacterInventorySelection({ type: 'historical', characterId, perkId, tier: Number(target.value), baseFingerprint: JSON.stringify(save) });
      return;
    }
    if (target.dataset.characterInventoryCorrectionTier) {
      const draft = characterInventorySession.correctionDraft;
      const characterId = target.dataset.character, perkId = target.dataset.characterInventoryCorrectionTier;
      if (!draft || draft.characterId !== characterId || draft.perkId !== perkId || draft.conflicted) return;
      const tier = target.value === 'none' ? null : Number(target.value);
      characterInventorySession = { ...characterInventorySession, correctionDraft: {
        ...draft, tier, dirty: tier !== draft.originalTier, error: null,
      } };
      render();
      $('#character-inventory-correction-tier')?.focus({ preventScroll: true });
      return;
    }
    if (target.id === 'character-inventory-only-unrecorded') { characterInventorySession = { ...characterInventorySession, onlyUnrecorded: target.checked }; render(); return; }
    if (target.id === 'character-inventory-sort' && ['name', 'source', 'tier'].includes(target.value)) {
      characterInventorySession = { ...characterInventorySession, sort: target.value };
      render(); $('#character-inventory-sort')?.focus({ preventScroll: true }); return;
    }
    if (target.dataset.personalTier) {
      const characterId = target.dataset.character;
      const perkId = target.dataset.personalTier;
      const tier = Number(target.value);
      if (hasDirtyWorkspaceDraft()
        && await resolveWorkspaceDraftTransition({ action: 'detail-personal-tier', characterId, perkId, tier }) !== 'proceed') {
        refreshDetail();
        $('#personal-tier-' + CSS.escape(characterId) + '-' + CSS.escape(perkId))?.focus({ preventScroll: true });
        return;
      }
      commit(next => correctPersonalPerkTier(next, characterId, perkId, tier === 0 ? null : tier), characterId);
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
      } else {
        if (hasDirtyWorkspaceDraft()
          && await resolveWorkspaceDraftTransition({ action: 'detail-historical-tier', characterId, perkId, tier }) !== 'proceed') {
          refreshDetail();
          [...document.querySelectorAll('[data-historical-ownership]')]
            .find(control => control.dataset.character === characterId && control.dataset.historicalOwnership === perkId)
            ?.focus({ preventScroll: true });
          return;
        }
        if (commit(next => setHistoricalPerkTier(next, characterId, perkId, tier), characterId)) refreshDetail();
      }
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
    if (target.id === 'sort') { filters.sort = target.value; render(); $('#sort')?.focus({ preventScroll: true }); }
    if (target.id === 'prestige-filter') { collectionFiltersOpen = $('#collection-filters')?.open ?? false; filters.prestige = target.value; render(); $('#prestige-filter')?.focus({ preventScroll: true }); }
    if (target.id === 'import-file') {
      if (await resolveWorkspaceDraftTransition({ action: 'import-file' }) !== 'proceed') { target.value = ''; return; }
      const file = target.files[0]; target.value = '';
      if (!file) return;
      pendingImport = parseSave(await file.text());
      const incoming = pendingImport.save;
      const summary = s => `${Object.keys(s.characters).length} records, ${Object.values(s.characters).filter(c => c.owned).length} owned, ${Object.values(s.characters).reduce((n, c) => n + Object.keys(c.perks).length, 0)} recorded perk tiers`;
      const warning = pendingImport.warnings.length ? ` ${pendingImport.warnings.length} unknown IDs will be preserved.` : '';
      const recovering = storageBlocked;
      const predecessor = recovering ? 'Current stored progress is unavailable. Its original bytes will be preserved separately before replacement.' : `Current: ${summary(save)}. A backup of your current data will be created.`;
      if (!await confirmAction('Import tracker data?', `${predecessor} Import: ${summary(incoming)}. This replaces your progression.${replacementNotice(pendingImport)}${warning}`, 'Import data')) { pendingImport = null; return; }
      save = store.replace(save, incoming, 'Before JSON import', { recover: recovering });
      clearContinue(localStorage);
      storageBlocked = false;
      $('#save-status').textContent = 'Saved locally';
      message(`Import complete. ${recovering ? 'The original stored data was preserved separately in this browser.' : 'Your previous progress is in local backups.'}${pendingImport.warnings.length ? ' ' + pendingImport.warnings.join(' · ') : ''}`);
      pendingImport = null; render();
    }
  } catch (error) { pendingImport = null; message(error.message || 'Could not complete this change.', true); }
});
document.addEventListener('keydown', event => {
  if (event.target.matches('.killer-power-reference') && (event.key === 'PageDown' || event.key === 'PageUp')) {
    event.preventDefault();
    event.target.scrollTop += (event.key === 'PageDown' ? 1 : -1) * event.target.clientHeight;
    return;
  }
  if (event.key === 'Escape' && $('dialog[open]')) return;
  if (event.key === 'Escape' && $('#menu-toggle').getAttribute('aria-expanded') === 'true') {
    event.preventDefault(); setGlobalMenuOpen(false, true); return;
  }
  if(event.key==='Enter'&&event.target.hasAttribute('data-killer-quantity')){event.preventDefault();acceptKillerQuantity(event.target.dataset.killerQuantity,'enter');return;}
  if(event.key==='Enter'&&event.target.dataset.inventoryQuantity){event.preventDefault();acceptStock(event.target.dataset.inventoryQuantity,'enter');return;}
  if (event.key === 'Escape' && characterInventorySession.quickPerkId) { event.preventDefault(); closeCharacterInventoryQuickPicker(true); return; }
  if (event.key === 'Escape' && $('#perk-filter-panel').matches(':popover-open')) { event.preventDefault(); closeFilters(true); return; }
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !$('#detail').open && !$('#confirmation').open) { event.preventDefault(); (setupOpen ? $('#setup-search') : $('#search'))?.focus(); }
});
document.addEventListener('focusin',event=>{
  if((event.target.hasAttribute('data-killer-quantity')||event.target.hasAttribute('data-inventory-quantity'))&&event.target.value==='0')event.target.value='';
  if(event.target.dataset.action==='stock-family-select')keepStockFamilyVisible(event.target);
});
document.addEventListener('focusout',event=>{
  if(stockRendering)return;
  if(event.target.hasAttribute('data-killer-quantity')||event.target.hasAttribute('data-killer-stock-step')){
    const id=event.target.dataset.killerQuantity||event.target.dataset.id, key=killerSessionKey, related=event.relatedTarget;
    if(event.target.hasAttribute('data-killer-quantity'))normalizeKillerQuantityOnBlur(event.target,id);
    if(related?.dataset.action==='killer-addon-details'||related?.dataset.action==='killer-power-details'||(modal?.type?.startsWith('killer-')&&$('#detail').open)){
      killerBlurPending=null;return;
    }
    const destination=related?.dataset.killerQuantity||related?.id;
    if(event.target.hasAttribute('data-killer-quantity'))killerBlurPending={id,key,destination};
    if(related?.closest('a[href^="#"]'))return;
    if(related?.dataset.killerQuantity===id||(related?.hasAttribute('data-killer-stock-step')&&related.dataset.id===id))return;
    if(killerBlurPending?.id===id&&killerBlurPending.key===key)setTimeout(()=>{
      if(killerBlurPending?.id===id&&killerBlurPending.key===key&&killerSessionKey===key)acceptKillerQuantity(id,'blur',destination);
    },0);
    return;
  }
  const id=event.target.dataset.inventoryQuantity||((event.target.hasAttribute('data-stock-step')||event.target.dataset.action==='stock-details')?event.target.dataset.id:((event.target.dataset.action==='stock-family-select'||event.target.dataset.action==='stock-error-focus'||event.target.id==='inventory-filters-toggle')?stockBlurPending?.id:null));
  if(!id)return;
  if(event.target.dataset.inventoryQuantity)normalizeStockQuantityOnBlur(event.target,id);
  const key=stockSessionKey;
  const related=event.relatedTarget, destination=related?.dataset.inventoryQuantity||related?.id;
  if(event.target.dataset.inventoryQuantity)stockBlurPending={id,key,destination};
  // Route links commit through their delegated click handler after pointer activation completes.
  if(related?.closest('a[href^="#"]'))return;
  // Family activation resolves pending edits itself before replacing their content.
  if(related?.dataset.action==='stock-family-select'||related?.dataset.action==='stock-error-focus'||related?.id==='inventory-filters-toggle'||related?.id==='inventory-item')return;
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
  if(queueOpener){const opener=queueOpener;queueOpener=null;queueTargetEditor=null;upNextEditor=null;const role=opener.dataset.role;const fallback=opener.dataset.action==='up-next-pin'?`[data-action="up-next-pin"][data-role="${role}"]`:`#queue-add-${role}`;(document.getElementById(opener.id)||$(fallback))?.focus({preventScroll:true});}
  modal = null;
  if (parseCharacterWorkspaceRoute(route())?.section !== 'setup') { characterSetup = null; setupQueue = null; }
});
document.addEventListener('toggle', event => {
  if(event.target.id==='queue-management') queueManagementOpen=event.target.open;
}, true);
window.addEventListener('hashchange', async () => {
  if (restoringWorkspaceHistory) { const restored = restoringWorkspaceHistory; restoringWorkspaceHistory = null; restored(); return; }
  const target = location.hash || '#dashboard', targetIndex = history.state?.workspaceIndex;
  if (hasDirtyWorkspaceDraft() || characterInventorySession.failedSelection || killerSession?.entities.some(entity=>killerSession.pending[entity.id]||killerSession.errors[entity.id])
    || stockSession?.mode==='detail'&&stockSession.entities.some(entity=>stockSession.pending[entity.id]||stockSession.errors[entity.id])) {
    if (Number.isInteger(targetIndex) && targetIndex !== workspaceHistoryIndex) {
      await new Promise(resolve => { restoringWorkspaceHistory = resolve; history.go(workspaceHistoryIndex - targetIndex); });
    } else history.replaceState({ ...history.state, workspaceIndex: workspaceHistoryIndex }, '', committedWorkspaceHash);
    if(!acceptPendingKillerQuantities())return;
    stockBlurPending=null;
    if(!acceptPendingStockQuantities())return;
    if (await resolveWorkspaceDraftTransition({ destination: target, source: 'history' }) !== 'proceed') return;
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
  if (hasDirtyWorkspaceDraft() || characterInventorySession.failedSelection) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('storage', event => {
  if (!initialized) return;
  if (event.key === 'dbdTrackerData') {
    closeFilters();
    try {
      const loaded = store.load({ persistMigration: editor.state === 'editing' });
      if (characterTaskSession?.dirty && JSON.stringify(loaded.save) !== characterTaskSession.baseFingerprint) {
        characterTaskSession = { ...characterTaskSession, conflicted: true,
          errors: [{ field: 'session', message: 'Underlying save changed; conflict. Discard/reload before saving.' }] };
      }
      if (characterInventorySession.failedSelection?.baseFingerprint !== undefined
        && JSON.stringify(loaded.save) !== characterInventorySession.failedSelection.baseFingerprint) {
        characterInventorySession = { ...characterInventorySession,
          failedSelection: { ...characterInventorySession.failedSelection, conflicted: true } };
      }
      if (characterInventorySession.correctionDraft?.baseFingerprint !== undefined
        && JSON.stringify(loaded.save) !== characterInventorySession.correctionDraft.baseFingerprint) {
        characterInventorySession = { ...characterInventorySession,
          correctionDraft: { ...characterInventorySession.correctionDraft, conflicted: true } };
      }
      save = loaded.save; migrationPending = loaded.migrationPending; storageBlocked = false;
      invalidateContinueForSave(localStorage, loaded.save);
      if (characterSetup && JSON.stringify(loaded.save) !== characterSetup.baseFingerprint) {
        if (characterSetupIsDirty()) characterSetup = { ...characterSetup, conflicted: true };
        else {
          const previous = characterSetup;
          characterSetup = createCharacterSetupDraft(previous.id, previous.returnRoute);
          characterSetup.step = previous.step;
          characterSetup.search = previous.search;
          characterSetup.batch = previous.batch;
        }
      }
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
  if (event.key === CONTINUE_KEY && route() === 'dashboard') render();
  if (event.key === 'dbdTrackerBackups' && route() === 'data') render();
});
$('#perk-filter-panel').addEventListener('toggle', () => $('#filters-trigger')?.setAttribute('aria-expanded', String($('#perk-filter-panel').matches(':popover-open'))));
document.addEventListener('error', event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.hasAttribute('data-collection-hero-art')
    && image.closest('.character-collection-card')) {
    const fallback = document.createElement('span');
    fallback.className = 'collection-art-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = 'Portrait unavailable';
    image.replaceWith(fallback); return;
  }
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

