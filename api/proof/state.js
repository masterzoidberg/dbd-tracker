import { proofHandlers } from '../../src/hosted-proof/runtime.js';

export default function state(req, res) {
  return proofHandlers.state(req, res);
}
