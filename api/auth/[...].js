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

export function createAuthRoute({
  env = process.env,
  getRuntime = async () => (await import('../../src/auth/runtime.js')).getAuthRuntime(),
} = {}) {
  return async function authRoute(req, res) {
    if (env?.VERCEL_ENV !== 'preview') return res.status(404).json({ error: 'Not found.' });

    restoreAuthPath(req);
    try {
      const runtime = await getRuntime();
      return await runtime.handle(req, res);
    } catch {
      return res.status(503).json({ error: 'Authentication is unavailable.' });
    }
  };
}

export default createAuthRoute();
