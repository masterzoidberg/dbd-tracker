import { createHmac } from 'node:crypto';

const MAX_WINDOW_MS = 300_000;

export function createAuthRateLimitStorage(pool, { secret, now = Date.now } = {}) {
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('A PostgreSQL pool is required.');
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('A rate-limit key is required.');

  return {
    async consume(key, rule) {
      if (typeof key !== 'string' || !key ||
          !Number.isSafeInteger(rule?.window) || rule.window < 1 ||
          !Number.isSafeInteger(rule?.max) || rule.max < 1) {
        throw new TypeError('A valid rate-limit key and rule are required.');
      }
      const time = now();
      if (!Number.isSafeInteger(time) || time < 0) throw new TypeError('A valid clock value is required.');
      const keyHash = createHmac('sha256', secret).update(key).digest('hex');
      const windowMs = rule.window * 1000;
      const client = await pool.connect();
      let transactionStarted = false;
      try {
        await client.query('BEGIN');
        transactionStarted = true;
        await client.query(`
          DELETE FROM auth_rate_limits
          WHERE last_request < $1::bigint - $2::bigint
        `, [time, MAX_WINDOW_MS]);
        await client.query(`
          DELETE FROM auth_email_verification_tokens
          WHERE expires_at <= NOW()
        `);
        const result = await client.query(`
          INSERT INTO auth_rate_limits AS existing (key_hash, count, last_request)
          VALUES ($1, 1, $2)
          ON CONFLICT (key_hash) DO UPDATE
          SET count = CASE
                WHEN existing.last_request < $2 - $3 THEN 1
                ELSE existing.count + 1
              END,
              last_request = $2
          WHERE existing.last_request < $2 - $3
             OR existing.count < $4
          RETURNING count, last_request
        `, [keyHash, time, windowMs, rule.max]);
        let row = result.rows[0];
        const allowed = Boolean(row);
        if (!row) {
          const current = await client.query(
            'SELECT last_request FROM auth_rate_limits WHERE key_hash = $1',
            [keyHash],
          );
          row = current.rows[0];
        }
        await client.query('COMMIT');
        transactionStarted = false;
        if (!row) throw new Error('Rate-limit state is unavailable.');
        if (allowed) return { allowed: true, retryAfter: null };
        const retryAfter = Math.max(1, Math.ceil((Number(row.last_request) + windowMs - time) / 1000));
        return { allowed: false, retryAfter };
      } catch (error) {
        if (transactionStarted) {
          try { await client.query('ROLLBACK'); } catch { /* Preserve the original database error. */ }
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
