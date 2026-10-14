import { characters } from '../../data/catalog.js';

// Explicit historical fixture: never derived from the current freshSave/default shape.
export function schemaV1Fixture() {
  return {
    schemaVersion: 1, accountRulesVersion: 1, inventoryPolicy: 'bloodweb',
    setupComplete: false, accountCorrectionApplied: true,
    settings: { halloweenNames: 'original', hellraiserNames: 'original' },
    updatedAt: '2026-10-01T12:30:00-04:00',
    characters: Object.fromEntries(characters.map(c => [c.id, {
      owned: false, prestige: 0, bloodwebLevel: 1, setupComplete: false,
      favorite: false, notes: '', perks: {}, updatedAt: null,
    }])),
    perkOverrides: {},
  };
}

// Frozen old version boundary, not a downgrade serializer or production migration.
export function oldV1VersionBoundary(data) {
  if (data.schemaVersion !== 1) throw new Error('Unsupported schema version: ' + data.schemaVersion);
  return data;
}
