import { characterById, perkName } from '../data/catalog.js';
import { recordedTier } from './model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function historicalPerkNote(perk) {
  const historical = perk.historicalAvailability;
  return historical?.manualOwnership ? `<small><span class="tag">${esc(historical.label)}</span></small>` : '';
}

export function historicalOwnershipControl(save, characterId, perk, inventory = save.characters[characterId].perks, setup = false) {
  if (!perk.historicalAvailability?.manualOwnership) return '';
  const confirmed = Object.hasOwn(inventory, perk.id);
  const tier = inventory[perk.id] ?? 0;
  const floor = recordedTier(save, characterId, perk.id);
  const options = [['', 'Not Confirmed'], [0, 'Not Owned'], [1, 'Tier I'], [2, 'Tier II'], [3, 'Tier III']];
  return `<label class="select-label historical-ownership"><select data-historical-ownership="${perk.id}" data-character="${characterId}" ${setup ? 'data-historical-setup="true"' : ''} aria-label="Historical ownership of ${esc(perkName(save, perk))} on ${esc(characterById[characterId].name)}">${options.map(([value, label]) => `<option value="${value}" ${(confirmed ? value === tier : value === '') ? 'selected' : ''} ${(value === '' && confirmed) || (value !== '' && value < floor) ? 'disabled' : ''}>${label}</option>`).join('')}</select></label>`;
}
