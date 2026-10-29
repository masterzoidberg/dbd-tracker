const internalError = { error: 'Internal server error.' };

function send(res, status, body) {
  return res.status(status).json(body);
}

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

function validObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createProofHandlers({ getRepository, env, validateSave }) {
  function outsidePreview(res) {
    return env?.VERCEL_ENV !== 'preview' ? send(res, 404, { error: 'Not found.' }) : null;
  }

  async function state(req, res) {
    if (outsidePreview(res)) return;
    if (req.method === 'GET') {
      try {
        const current = await getRepository().readCurrent();
        return current ? send(res, 200, current) : send(res, 404, { error: 'State not found.' });
      } catch {
        return send(res, 500, internalError);
      }
    }

    if (req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed.' });
    const body = parseBody(req.body);
    if (!validObject(body) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
      return send(res, 400, { error: 'Invalid request.' });
    }

    let data;
    try {
      data = validateSave(body.data).save;
    } catch {
      return send(res, 400, { error: 'Invalid save document.' });
    }

    try {
      const saved = await getRepository().compareAndSwapState(body.expectedRevision, data);
      return saved ? send(res, 200, saved) : send(res, 409, { error: 'Revision conflict.' });
    } catch {
      return send(res, 500, internalError);
    }
  }

  async function backups(req, res) {
    if (outsidePreview(res)) return;
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    try {
      const backup = await getRepository().createBackup();
      return backup ? send(res, 201, backup) : send(res, 404, { error: 'State not found.' });
    } catch {
      return send(res, 500, internalError);
    }
  }

  async function backup(req, res) {
    if (outsidePreview(res)) return;
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
    try {
      const snapshot = await getRepository().readBackup(req.query?.id);
      return snapshot ? send(res, 200, snapshot) : send(res, 404, { error: 'Backup not found.' });
    } catch {
      return send(res, 500, internalError);
    }
  }

  return { state, backups, backup };
}
