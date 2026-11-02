import { createHash } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { verifyJWT } from 'better-auth/crypto';

const invalidToken = () => APIError.from('UNAUTHORIZED', {
  code: 'INVALID_TOKEN',
  message: 'Invalid or already used verification token.',
});

export function createEmailVerificationTokenGuard({ pool, secret, now = Date.now } = {}) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('A PostgreSQL pool is required.');
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('A verification key is required.');

  return async context => {
    if (context?.path !== '/verify-email') return;
    const token = context.query?.token;
    if (typeof token !== 'string' || token.length > 4096) throw invalidToken();
    const payload = await verifyJWT(token, secret);
    if (!payload || typeof payload.email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
        Object.hasOwn(payload, 'updateTo') || Object.hasOwn(payload, 'requestType') ||
        !Number.isFinite(payload.exp) || payload.exp <= now() / 1000) {
      throw invalidToken();
    }

    const tokenHash = createHash('sha256').update(token).digest();
    const result = await pool.query(`
      WITH expired AS (
        DELETE FROM auth_email_verification_tokens
        WHERE expires_at <= NOW()
      ), claimed AS (
        INSERT INTO auth_email_verification_tokens (token_hash, user_id, expires_at)
        SELECT $1, app_user.id, to_timestamp($2)
        FROM public."user" AS app_user
        WHERE lower(app_user.email) = lower($3)
        ON CONFLICT (token_hash) DO NOTHING
        RETURNING token_hash
      )
      SELECT token_hash FROM claimed
    `, [tokenHash, payload.exp, payload.email]);
    if (result.rows.length !== 1) throw invalidToken();
  };
}
