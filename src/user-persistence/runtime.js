import { validateSave } from '../model.js';
import { getAuthRuntime } from '../auth/runtime.js';
import { createUserPersistenceRepository } from './repository.js';
import { createUserPersistenceHandlers } from './handlers.js';

const env = process.env;
let repository;

function getRepository() {
  if (env.VERCEL_ENV !== 'preview') throw new Error('User persistence is available only in Vercel Preview.');
  if (repository) return repository;
  repository = createUserPersistenceRepository(getAuthRuntime().pool);
  return repository;
}

async function resolveSession(req) {
  if (typeof req.headers?.cookie !== 'string' || req.headers.cookie.length === 0) return null;
  return getAuthRuntime().resolveSession(req);
}

export const userPersistenceHandlers = createUserPersistenceHandlers({
  env,
  resolveSession,
  getRepository,
  validateSave,
});
