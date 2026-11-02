import { proofHandlers } from '../../src/hosted-proof/runtime.js';

export default function backups(req, res) {
  return proofHandlers.backups(req, res);
}
