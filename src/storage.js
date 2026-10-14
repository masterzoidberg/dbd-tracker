import { freshSave, parseSave, validateSave, syncGlobalInventories, applyAccountRules } from './model.js';

export const SAVE_KEY = 'dbdTrackerData';
export const BACKUP_KEY = 'dbdTrackerBackups';
export class TrackerStorage {
  constructor(storage, assertWriter = () => { throw new Error('Read-only: a live writer capability is required.'); }) {
    this.storage = storage;
    this.assertWriter = assertWriter;
  }
  load({ persistMigration = true } = {}) {
    const raw = this.storage.getItem(SAVE_KEY);
    const loaded = raw === null ? { save: freshSave(), warnings: [], sourceSchemaVersion: 2,
      migrationRequired: false, predecessor: null } : parseSave(raw);
    let next = structuredClone(loaded.save);
    if (raw !== null) applyAccountRules(next);
    syncGlobalInventories(next);
    const normalizationPending = JSON.stringify(next) !== JSON.stringify(loaded.save);
    const migrationPending = loaded.migrationRequired || normalizationPending;
    if (migrationPending && persistMigration) {
      this.assertWriter();
      if (raw !== null) this.backup(loaded.predecessor ?? loaded.save,
        loaded.migrationRequired ? 'Before schema v2 migration' : 'Before account unlock rules update');
      if (normalizationPending) next.updatedAt = new Date().toISOString();
      next = this.save(next);
    }
    return { ...loaded, save: next, migrationPending: migrationPending && !persistMigration };
  }
  save(candidate) {
    this.assertWriter();
    const canonical = validateSave(candidate).save;
    this.storage.setItem(SAVE_KEY, JSON.stringify(canonical));
    return canonical;
  }
  original() {
    const raw = this.storage.getItem(SAVE_KEY);
    if (raw === null) throw new Error('No original stored data is available.');
    return raw;
  }
  backups() {
    const raw = this.storage.getItem(BACKUP_KEY);
    if (raw === null) return [];
    const error = () => new Error('Local backups could not be read. Restore is unavailable; import a valid JSON save to recover damaged current data. Existing backup data is unchanged.');
    let data;
    try { data = JSON.parse(raw); } catch { throw error(); }
    if (!Array.isArray(data) || data.some(b => !b || typeof b.id !== 'string' || typeof b.reason !== 'string' || !Number.isFinite(Date.parse(b.createdAt)))) throw error();
    return data;
  }
  backup(save, reason) {
    this.assertWriter();
    const backup = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), reason, save: structuredClone(save) };
    this.storage.setItem(BACKUP_KEY, JSON.stringify([backup, ...this.backups()].slice(0, 5)));
    return backup;
  }
  replace(current, next, reason, { recover = false } = {}) {
    this.assertWriter();
    const valid = validateSave(next).save;
    applyAccountRules(valid);
    // An explicit import/restore is intentional; do not repeat the account correction later.
    valid.accountCorrectionApplied = true;
    // Explicitly imported inventories are intentional, including older exports.
    valid.inventoryPolicy = 'bloodweb';
    syncGlobalInventories(valid);
    const canonical = validateSave(valid).save;
    if (recover) {
      const raw = this.original();
      this.storage.setItem('dbdTrackerRecovery-' + crypto.randomUUID(), raw);
    } else this.backup(current, reason); // A failed backup prevents replacement.
    return this.save(canonical);
  }
  deleteBackup(id) { this.assertWriter(); this.storage.setItem(BACKUP_KEY, JSON.stringify(this.backups().filter(b => b.id !== id))); }
}
