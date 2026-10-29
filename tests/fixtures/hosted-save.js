import { freshSave } from '../../src/model.js';

const FIXED_UPDATED_AT = '2026-10-29T12:00:00.000Z';

export function hostedSaveV3Fixture() {
  const save = structuredClone(freshSave());
  save.updatedAt = FIXED_UPDATED_AT;
  return save;
}
