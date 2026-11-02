export const config = { api: { bodyParser: false } };

export function createAuthRoute({
  env = process.env,
  getRuntime = async () => (await import('../../src/auth/runtime.js')).getAuthRuntime(),
} = {}) {
  return async function authRoute(req, res) {
    if (env?.VERCEL_ENV !== 'preview') return res.status(404).json({ error: 'Not found.' });

    try {
      const runtime = await getRuntime();
      return await runtime.handle(req, res);
    } catch {
      return res.status(503).json({ error: 'Authentication is unavailable.' });
    }
  };
}

export default createAuthRoute();
