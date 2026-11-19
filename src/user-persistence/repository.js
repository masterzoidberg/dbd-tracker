const safeRevision = value => {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Database revision is outside the supported integer range.');
  }
  return revision;
};

const jsonDocument = value => typeof value === 'string' ? JSON.parse(value) : value;
const isoTimestamp = value => value instanceof Date ? value.toISOString() : new Date(value).toISOString();

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

function createUserRepository(client) {
  return {
    async readState() {
      const result = await client.query(`
        SELECT revision, data, updated_at
        FROM ledger_user_state
        WHERE user_id = current_setting('app.user_id', true)
      `);
      return mapState(result.rows[0]);
    },

    async compareAndSwapState(expectedRevision, canonicalData) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
        throw new Error('Expected revision is invalid.');
      }
      const serialized = JSON.stringify(canonicalData);
      if (typeof serialized !== 'string') throw new Error('State data is invalid.');

      const result = await client.query(`
        INSERT INTO ledger_user_state (user_id, revision, data, updated_at)
        SELECT current_setting('app.user_id', true), 1, $2::jsonb, NOW()
        WHERE $1::bigint = 0
           OR EXISTS (
             SELECT 1
             FROM ledger_user_state AS current_state
             WHERE current_state.user_id = current_setting('app.user_id', true)
               AND current_state.revision = $1::bigint
           )
        ON CONFLICT (user_id) DO UPDATE
        SET revision = ledger_user_state.revision + 1,
            data = EXCLUDED.data,
            updated_at = NOW()
        WHERE ledger_user_state.revision = $1::bigint
          AND ledger_user_state.revision < 9007199254740991
        RETURNING revision, data, updated_at
      `, [expectedRevision, serialized]);
      return mapState(result.rows[0]);
    },

    async createBackup() {
      const result = await client.query(`
        INSERT INTO ledger_user_backups (user_id, source_revision, data)
        SELECT user_id, revision, data
        FROM ledger_user_state
        WHERE user_id = current_setting('app.user_id', true)
        RETURNING id, source_revision, data, created_at
      `);
      return mapBackup(result.rows[0]);
    },

    async listBackups() {
      const result = await client.query(`
        SELECT id, source_revision, created_at
        FROM ledger_user_backups
        WHERE user_id = current_setting('app.user_id', true)
        ORDER BY created_at DESC, id DESC
      `);
      return result.rows.map(row => ({
        id: row.id,
        sourceRevision: safeRevision(row.source_revision),
        createdAt: isoTimestamp(row.created_at),
      }));
    },

    async readBackup(backupId) {
      if (typeof backupId !== 'string' || !uuidPattern.test(backupId)) return null;
      const result = await client.query(`
        SELECT id, source_revision, data, created_at
        FROM ledger_user_backups
        WHERE id = $1::uuid
          AND user_id = current_setting('app.user_id', true)
      `, [backupId]);
      return mapBackup(result.rows[0]);
    },
  };
}

export function createUserPersistenceRepository(pool) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('A PostgreSQL pool is required.');

  return {
    async withUser(userId, callback) {
      if (typeof userId !== 'string' || userId.length === 0) throw new TypeError('A user identity is required.');
      if (typeof callback !== 'function') throw new TypeError('A user operation callback is required.');

      const client = await pool.connect();
      let transactionStarted = false;
      try {
        await client.query('BEGIN');
        transactionStarted = true;
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        const result = await callback(createUserRepository(client));
        await client.query('COMMIT');
        transactionStarted = false;
        return result;
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // Preserve the operation error; releasing the connection discards any broken transaction.
          }
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
