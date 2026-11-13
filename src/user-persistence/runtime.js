import { validateSave } from '../model.js';
import { getAuthRuntime } from '../auth/runtime.js';
import { getSessionCookie } from 'better-auth/cookies';
import { createUserPersistenceRepository } from './repository.js';
import { createUserPersistenceHandlers } from './handlers.js';

const env = process.env;
let repository;

function getRepository() {
  if (!['preview', 'production'].includes(env.VERCEL_ENV)) throw new Error('User persistence requires a hosted environment.');
  if (repository) return repository;
  repository = createUserPersistenceRepository(getAuthRuntime().pool);
  return repository;
}

export async function resolveUserSession(req, getRuntime = getAuthRuntime) {
  if (!getSessionCookie(new Headers(req.headers))) return null;
  return getRuntime().resolveSession(req);
}

export const userPersistenceHandlers = createUserPersistenceHandlers({
  env,
  resolveSession: resolveUserSession,
  getRepository,
  validateSave,
});
