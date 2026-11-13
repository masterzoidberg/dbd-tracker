const internalError = { error: 'Internal server error.' };

function send(res, status, body) {
  return res.status(status).json(body);
}

function parseBody(body) {
  if (typeof body === 'string') {
    if (!body.trim()) return null;
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

function sameOrigin(req, env) {
  const hosts = [env?.VERCEL_URL, env?.VERCEL_BRANCH_URL,
    ...(env?.VERCEL_ENV === 'production' ? [env.VERCEL_PROJECT_PRODUCTION_URL] : [])];
  return hosts.some(host => typeof host === 'string' && /^[a-z0-9.-]+$/i.test(host)
    && req.headers?.origin === `https://${host}`);
}

export function createUserPersistenceHandlers({ env = process.env, resolveSession, getRepository, validateSave }) {
  function outsidePreview(res) {
    return !['preview', 'production'].includes(env?.VERCEL_ENV) ? send(res, 404, { error: 'Not found.' }) : null;
  }

  async function requireUserId(req, res) {
    let session;
    try {
      session = await resolveSession(req);
    } catch {
      send(res, 500, internalError);
      return null;
    }
    if (typeof session?.userId !== 'string' || session.userId.length === 0) {
      send(res, 401, { error: 'Authentication required.' });
      return null;
    }
    return session.userId;
  }

  async function state(req, res) {
    if (outsidePreview(res)) return;
    if (req.method !== 'GET' && req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed.' });
    if (req.method === 'GET' && ['userId', 'ownerId'].some(key => Object.hasOwn(req.query ?? {}, key))) {
      return send(res, 400, { error: 'Invalid request.' });
    }

    let canonicalData;
    let expectedRevision;
    if (req.method === 'PUT') {
      if (!sameOrigin(req, env)) return send(res, 403, { error: 'Same-origin request required.' });
      const body = parseBody(req.body);
      if (!validObject(body) || Object.keys(body).length !== 2 ||
          !Object.hasOwn(body, 'expectedRevision') || !Object.hasOwn(body, 'data') ||
          !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
        return send(res, 400, { error: 'Invalid request.' });
      }
      expectedRevision = body.expectedRevision;
      try {
        canonicalData = validateSave(body.data).save;
      } catch {
        return send(res, 400, { error: 'Invalid save document.' });
      }
    }

    const userId = await requireUserId(req, res);
    if (!userId) return;

    try {
      const result = await getRepository().withUser(userId, async user => {
        if (req.method === 'GET') return user.readState();
        return user.compareAndSwapState(expectedRevision, canonicalData);
      });
      if (req.method === 'GET') return result ? send(res, 200, result) : send(res, 404, { error: 'State not found.' });
      return result ? send(res, 200, result) : send(res, 409, { error: 'Revision conflict.' });
    } catch {
      return send(res, 500, internalError);
    }
  }

  async function backups(req, res) {
    if (outsidePreview(res)) return;
    if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (req.method === 'POST' && !sameOrigin(req, env)) return send(res, 403, { error: 'Same-origin request required.' });
    if (Object.keys(req.query ?? {}).length || req.method === 'POST' && req.body !== undefined && req.body !== null && req.body !== '') {
      return send(res, 400, { error: 'Invalid request.' });
    }

    const userId = await requireUserId(req, res);
    if (!userId) return;

    try {
      if (req.method === 'GET') {
        const list = await getRepository().withUser(userId, user => user.listBackups());
        return send(res, 200, list);
      }
      const backup = await getRepository().withUser(userId, user => user.createBackup());
      return backup ? send(res, 201, backup) : send(res, 404, { error: 'State not found.' });
    } catch {
      return send(res, 500, internalError);
    }
  }

  async function backup(req, res) {
    if (outsidePreview(res)) return;
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });

    const userId = await requireUserId(req, res);
    if (!userId) return;

    try {
      const id = typeof req.query?.id === 'string' ? req.query.id : null;
      const snapshot = await getRepository().withUser(userId, user => user.readBackup(id));
      return snapshot ? send(res, 200, snapshot) : send(res, 404, { error: 'Backup not found.' });
    } catch {
      return send(res, 500, internalError);
    }
  }

  return { state, backups, backup };
}
