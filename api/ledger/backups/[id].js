import { userPersistenceHandlers } from '../../../src/user-persistence/runtime.js';

export default function backup(req, res) {
  return userPersistenceHandlers.backup(req, res);
}
