export const config = { api: { bodyParser: false } };

function restoreAuthPath(req) {
  const url = new URL(req.url || '/api/auth/[...]', 'https://vercel.invalid');
  if (url.pathname !== '/api/auth/[...]') return;

  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;
  if (typeof path !== 'string' || path.length === 0) return;

  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return;

  url.pathname = `/api/auth/${segments.map(encodeURIComponent).join('/')}`;
  url.searchParams.delete('path');
  req.url = `${url.pathname}${url.search}`;
}

function safeErrorMetadata(error) {
  const chain = [];
  for (let current = error; current && typeof current === 'object' && chain.length < 3; current = current.cause) {
    chain.push(current);
  }

  const safeValue = (key, pattern = /^[A-Za-z0-9_.-]{1,64}$/) => {
    for (const item of chain) {
      const value = item[key];
      if (typeof value === 'string' && pattern.test(value)) return value;
    }
    return undefined;
  };

  const networkErrorCodes = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'EAI_AGAIN',
    'ENETUNREACH', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE',
  ]);
  const code = chain.map(item => item.code).find(value =>
    typeof value === 'string' &&
    (value === 'SCHEMA_MISMATCH' || /^[0-9A-Z]{5}$/.test(value) || networkErrorCodes.has(value)));
  const name = safeValue('name', /^(?:Error|[A-Za-z][A-Za-z0-9]{0,58}(?:Error|Exception))$/);
  let category = 'auth_route_error';
  if (code === 'SCHEMA_MISMATCH') category = 'better_auth_schema_mismatch';
  else if (/^[0-9A-Z]{5}$/.test(code || '')) category = 'postgres_error';
  else if (networkErrorCodes.has(code)) category = 'database_connection_error';
  else if (chain.some(item => typeof item.name === 'string' && item.name.startsWith('BetterAuth'))) {
    category = 'better_auth_error';
  }

  return Object.fromEntries(Object.entries({
    category,
    name,
    code,
    table: safeValue('table'),
    column: safeValue('column'),
    constraint: safeValue('constraint'),
  }).filter(([, value]) => value !== undefined));
}

export function createAuthRoute({
  env = process.env,
  getRuntime = async () => (await import('../../src/auth/runtime.js')).getAuthRuntime(),
} = {}) {
  return async function authRoute(req, res) {
    if (!['preview', 'production'].includes(env?.VERCEL_ENV)) return res.status(404).json({ error: 'Not found.' });

    restoreAuthPath(req);
    try {
      const runtime = await getRuntime();
      return await runtime.handle(req, res);
    } catch (error) {
      console.error('[auth] route request failed', safeErrorMetadata(error));
      return res.status(503).json({ error: 'Authentication is unavailable.' });
    }
  };
}

export default createAuthRoute();
