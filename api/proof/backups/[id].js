import { proofHandlers } from '../../../src/hosted-proof/runtime.js';

export default function backup(req, res) {
  return proofHandlers.backup(req, res);
}
