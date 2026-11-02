import { userPersistenceHandlers } from '../../src/user-persistence/runtime.js';

export default function state(req, res) {
  return userPersistenceHandlers.state(req, res);
}
