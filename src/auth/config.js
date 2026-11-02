export function createAuthConfig({ env, database }) {
  return {
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: {
      allowedHosts: [env.VERCEL_URL],
      protocol: 'https',
    },
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    advanced: {
      useSecureCookies: true,
      disableCSRFCheck: false,
      disableOriginCheck: false,
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
