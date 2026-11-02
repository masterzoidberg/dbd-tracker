import { neon } from '@neondatabase/serverless';
import { validateSave } from '../model.js';
import { createNeonRepository } from './repository.js';
import { createProofHandlers } from './handlers.js';

export function createLazyRepositoryFactory({
  env = process.env,
  getDatabaseUrl = () => env.DATABASE_URL,
  createSqlClient = neon,
  createRepository = createNeonRepository,
} = {}) {
  let repository;

  return function getRepository() {
    if (env?.VERCEL_ENV !== 'preview') {
      throw new Error('Proof database is available only in Vercel Preview.');
    }
    if (repository) return repository;

    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) throw new Error('Preview proof database is not configured.');
    repository = createRepository(createSqlClient(databaseUrl));
    return repository;
  };
}

const env = process.env;
const getRepository = createLazyRepositoryFactory({ env });

export const proofHandlers = createProofHandlers({
  getRepository,
  env,
  validateSave,
});
