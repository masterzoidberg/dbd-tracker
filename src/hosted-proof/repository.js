function safeRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Database revision is outside the supported integer range.');
  }
  return revision;
}

function isoTimestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function jsonDocument(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function mapState(row) {
  if (!row) return null;
  return {
    revision: safeRevision(row.revision),
    data: jsonDocument(row.data),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapBackup(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceRevision: safeRevision(row.source_revision),
    data: jsonDocument(row.data),
    createdAt: isoTimestamp(row.created_at),
  };
}

const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function createNeonRepository(sql) {
  return {
    async readCurrent() {
      const rows = await sql`
        SELECT revision, data, updated_at
        FROM ledger_state
        WHERE singleton = TRUE
      `;
      return mapState(rows[0]);
    },

    async compareAndSwapState(expectedRevision, data) {
      const rows = await sql`
        INSERT INTO ledger_state (singleton, revision, data, updated_at)
        SELECT TRUE, 1, ${JSON.stringify(data)}::jsonb, NOW()
        WHERE ${expectedRevision} = 0
           OR EXISTS (SELECT 1 FROM ledger_state WHERE singleton = TRUE)
        ON CONFLICT (singleton) DO UPDATE
        SET revision = ledger_state.revision + 1,
            data = EXCLUDED.data,
            updated_at = NOW()
        WHERE ledger_state.revision = ${expectedRevision}
        RETURNING revision, data, updated_at
      `;
      return mapState(rows[0]);
    },

    async createBackup() {
      const rows = await sql`
        INSERT INTO ledger_backups (source_revision, data)
        SELECT revision, data
        FROM ledger_state
        WHERE singleton = TRUE
        RETURNING id, source_revision, data, created_at
      `;
      return mapBackup(rows[0]);
    },

    async readBackup(id) {
      if (typeof id !== 'string' || !uuidPattern.test(id)) return null;
      const rows = await sql`
        SELECT id, source_revision, data, created_at
        FROM ledger_backups
        WHERE id = ${id}::uuid
      `;
      return mapBackup(rows[0]);
    },
  };
}
