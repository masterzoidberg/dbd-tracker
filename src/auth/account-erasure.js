const internalError = { error: 'Internal server error.' };

function send(res, status, body) {
  if (body === undefined) return res.status(status).end();
  return res.status(status).json(body);
}

function parseBody(body) {
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return null; }
  }
  return body;
}

function sameOrigin(req, env) {
  const host = env?.VERCEL_URL;
  return typeof host === 'string' && /^[a-z0-9.-]+$/i.test(host) &&
    req.headers?.origin === `https://${host}`;
}

export function createAccountErasureHandler({ env = process.env, resolveSession, limitPasswordVerification, verifyPassword, eraseAccount }) {
  return async function deleteAccount(req, res) {
    if (env?.VERCEL_ENV !== 'preview') return send(res, 404, { error: 'Not found.' });
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (!sameOrigin(req, env)) return send(res, 403, { error: 'Same-origin request required.' });

    const body = parseBody(req.body);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || typeof body.password !== 'string' ||
        body.password.length < 8 || body.password.length > 128) {
      return send(res, 400, { error: 'Invalid request.' });
    }

    let session;
    try {
      session = await resolveSession(req);
    } catch {
      return send(res, 500, internalError);
    }
    if (typeof session?.userId !== 'string' || !session.userId ||
        typeof session?.sessionId !== 'string' || !session.sessionId) {
      return send(res, 401, { error: 'Authentication required.' });
    }

    let attempt;
    try {
      attempt = await limitPasswordVerification(session.userId);
    } catch {
      return send(res, 500, internalError);
    }
    if (attempt?.allowed !== true) return send(res, 429, { error: 'Too many requests.' });

    try {
      const verified = await verifyPassword(req, body.password);
      if (verified?.status !== true) return send(res, 401, { error: 'Current password is incorrect.' });
    } catch {
      return send(res, 401, { error: 'Current password is incorrect.' });
    }

    try {
      const erased = await eraseAccount(session.sessionId);
      if (!erased) return send(res, 401, { error: 'Authentication required.' });
      return send(res, 204);
    } catch {
      return send(res, 500, internalError);
    }
  };
}
