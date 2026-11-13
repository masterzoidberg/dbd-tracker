import { betterAuth } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';
import { createAuthConfig } from './config.js';
import { createAuthRateLimitStorage } from './rate-limit-storage.js';

const unavailable = () => new Error('Authentication is unavailable.');

export function createAuthRuntime({
  env = process.env,
  createPool = connectionString => new Pool({ connectionString }),
  attachPool = attachDatabasePool,
  createAuth = betterAuth,
  createNodeHandler = toNodeHandler,
  convertHeaders = fromNodeHeaders,
  createRateLimitStorage = createAuthRateLimitStorage,
} = {}) {
  if (!['preview', 'production'].includes(env?.VERCEL_ENV)) throw unavailable();

  const databaseUrl = env.DATABASE_URL;
  const secret = env.BETTER_AUTH_SECRET;
  const host = env.VERCEL_URL;
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl || '') ||
      typeof secret !== 'string' || secret.length < 32 ||
      typeof host !== 'string' || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    throw unavailable();
  }

  const pool = createPool(databaseUrl);
  attachPool(pool);
  const rateLimitStorage = createRateLimitStorage(pool, { secret });
  const auth = createAuth(createAuthConfig({
    env,
    database: pool,
    rateLimitStorage,
  }));

  return {
    auth,
    pool,
    handle: createNodeHandler(auth.handler),
    async resolveSession(req) {
      const session = await auth.api.getSession({ headers: convertHeaders(req.headers) });
      if (typeof session?.user?.id !== 'string' || !session.user.id ||
          typeof session?.session?.id !== 'string' || !session.session.id) return null;
      return { userId: session.user.id, sessionId: session.session.id };
    },
    async limitPasswordVerification(userId) {
      if (typeof userId !== 'string' || !userId) throw new TypeError('A verified user identity is required.');
      return rateLimitStorage.consume(`account-deletion:${userId}`, { window: 300, max: 5 });
    },
    async verifyPassword(req, password) {
      return auth.api.verifyPassword({
        headers: convertHeaders(req.headers),
        body: { password },
      });
    },
  };
}

let runtime;

export function getAuthRuntime() {
  if (!['preview', 'production'].includes(process.env.VERCEL_ENV)) throw unavailable();
  return runtime ??= createAuthRuntime();
}
