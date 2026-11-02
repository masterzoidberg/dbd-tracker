import { getAuthRuntime } from '../../src/auth/runtime.js';
import { getErasureRuntime } from '../../src/auth/erasure-runtime.js';
import { createAccountErasureHandler } from '../../src/auth/account-erasure.js';
import { resolveUserSession } from '../../src/user-persistence/runtime.js';

export const deleteAccountHandler = createAccountErasureHandler({
  env: process.env,
  resolveSession: resolveUserSession,
  limitPasswordVerification: userId => getAuthRuntime().limitPasswordVerification(userId),
  verifyPassword: (req, password) => getAuthRuntime().verifyPassword(req, password),
  eraseAccount: sessionId => getErasureRuntime().eraseAccount(sessionId),
});

export default deleteAccountHandler;
