import { createAuthMiddleware } from 'better-auth/api';

const vercelHost = /^[a-z0-9.-]+(?::\d+)?$/i;

export function createAuthConfig({ env, database, emailDelivery, rateLimitStorage, verificationTokenGuard }) {
  return {
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: {
      allowedHosts: [...new Set([env.VERCEL_URL, env.VERCEL_BRANCH_URL]
        .filter(host => typeof host === 'string' && vercelHost.test(host)))],
      protocol: 'https',
    },
    basePath: '/api/auth',
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => emailDelivery({
        kind: 'password-reset',
        to: user.email,
        url,
      }),
    },
    emailVerification: {
      expiresIn: 3600,
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => emailDelivery({
        kind: 'verification',
        to: user.email,
        url,
      }),
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
    hooks: {
      before: createAuthMiddleware(async context => {
        if (context.path === '/verify-email') await verificationTokenGuard(context);
      }),
    },
  };
}
