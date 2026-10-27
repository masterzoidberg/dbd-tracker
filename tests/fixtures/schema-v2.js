import { characters } from '../../data/catalog.js';

// Frozen predecessor fixture: independent of the current freshSave schema.
export function schemaV2Fixture() {
  return {
    schemaVersion: 2,
    prestigeQueue: [],
    accountRulesVersion: 1,
    inventoryPolicy: 'bloodweb',
    setupComplete: false,
    accountCorrectionApplied: true,
    settings: { halloweenNames: 'original', hellraiserNames: 'original' },
    updatedAt: '2026-10-10T12:30:00.000Z',
    characters: Object.fromEntries(characters.map(character => [character.id, {
      owned: false,
      prestige: 0,
      bloodwebLevel: 1,
      setupComplete: false,
      favorite: false,
      notes: '',
      perks: {},
      updatedAt: null,
      inventory: { items: {}, addons: {} },
    }])),
    perkOverrides: {},
  };
}
