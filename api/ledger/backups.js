import { userPersistenceHandlers } from '../../src/user-persistence/runtime.js';

export default function backups(req, res) {
  return userPersistenceHandlers.backups(req, res);
}
