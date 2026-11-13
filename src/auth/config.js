const vercelHost = /^[a-z0-9.-]+(?::\d+)?$/i;

export function createAuthConfig({ env, database, rateLimitStorage }) {
  return {
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: {
      allowedHosts: [...new Set([env.VERCEL_URL, env.VERCEL_BRANCH_URL,
        ...(env.VERCEL_ENV === 'production' ? [env.VERCEL_PROJECT_PRODUCTION_URL] : [])]
        .filter(host => typeof host === 'string' && vercelHost.test(host)))],
      protocol: 'https',
    },
    basePath: '/api/auth',
    disabledPaths: ['/sign-up/email', '/send-verification-email', '/verify-email', '/request-password-reset', '/reset-password'],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      autoSignIn: false,
    },
    rateLimit: {
      enabled: true,
      customStorage: rateLimitStorage,
      customRules: {
        '/sign-up/email': { window: 60, max: 5 },
        '/sign-in/email': { window: 60, max: 5 },
        '/send-verification-email': { window: 300, max: 3 },
        '/request-password-reset': { window: 300, max: 3 },
        '/verify-email': { window: 60, max: 5 },
        '/reset-password': { window: 60, max: 5 },
        '/reset-password/*': { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: true,
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      },
    },
    user: {
      deleteUser: { enabled: false },
    },
  };
}
