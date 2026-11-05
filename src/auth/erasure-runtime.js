import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

const unavailable = () => new Error('Account deletion is unavailable.');

export function createErasureRuntime({
  env = process.env,
  createPool = connectionString => new Pool({ connectionString }),
  attachPool = attachDatabasePool,
} = {}) {
  if (env?.VERCEL_ENV !== 'preview') throw unavailable();
  const connectionString = env.ERASURE_DATABASE_URL;
  let url;
  try { url = new URL(connectionString); } catch { throw unavailable(); }
  if (!/^postgres(?:ql)?:$/.test(url.protocol) ||
      decodeURIComponent(url.username) !== 'ledger_erasure_login' ||
      !url.password || !url.hostname.endsWith('.neon.tech')) throw unavailable();

  const pool = createPool(connectionString);
  attachPool(pool);
  return {
    pool,
    async eraseAccount(sessionId) {
      if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('A verified session is required.');
      const result = await pool.query(
        'SELECT public.erase_ledger_account_for_session($1) AS erased',
        [sessionId],
      );
      return result.rows[0]?.erased === true;
    },
  };
}

let runtime;

export function getErasureRuntime() {
  if (process.env.VERCEL_ENV !== 'preview') throw unavailable();
  return runtime ??= createErasureRuntime();
}
