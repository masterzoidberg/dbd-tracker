# Ledger production-auth readiness implementation plan

## Goal

Implement a Preview-only verified-identity, abuse-control, recovery, and account-erasure boundary on top of PR #19. Never enable Production auth or credentials and never use real Ledger data.

## Sequence

### 1. Pin provider contracts and write red tests

- Confirm the locked Better Auth version and its verification, reset, rate-limit, transaction, and delete APIs from installed source and current official docs. Better Auth 1.7.15 verification links are JWTs whose replay after first success is idempotently accepted; add a digest-only atomic claim guard before that handler.
- Add failing tests first for auth configuration, unauthenticated/unverified access, token expiry/reuse, generic reset responses, resend/login/reset throttles, deletion authorization and password-check throttling, and browser/server boundary.
- Keep synthetic email and password fixtures in memory; never print raw tokens or credentials.

### 2. Implement email verification, durable abuse controls, and recovery

- Extend `src/auth/config.js` and `src/auth/runtime.js` with one-hour verification/reset tokens, verified-email sign-in gating, resend behavior, reset-session revocation, and dependency-injected email delivery.
- Use Better Auth's built-in endpoint rules with Neon-backed atomic `customStorage`, a keyed digest of the IP/path key, explicit endpoint budgets, and Vercel's overwritten `x-forwarded-for` header. Prune expired rows on every consume and add its table/grants in migration 003.
- Preserve Better Auth's default email-enumeration protections; do not create custom lockout or CAPTCHA infrastructure.

### 3. Implement transactional account and Ledger erasure

- Add migration 003 objects for the no-login erasure owner/runtime roles, tightly scoped function, and owner-scoped forced-RLS DELETE policies.
- Keep the backup immutability trigger rejecting UPDATE and ordinary DELETE; permit only the function owner to delete backups inside the erasure transaction.
- Revoke ordinary runtime `DELETE` on `user`; provision a distinct Preview-only erasure login with `EXECUTE` only.
- Add a same-origin deletion handler that requires a verified session and current-password check, derives session identity on the server, invokes the function, and does not accept client owner/session IDs.
- Rate-limit the deletion handler's direct Better Auth password-verification call by the verified user ID because direct server API calls bypass Better Auth's HTTP router limiter.
- Add PostgreSQL integration coverage for all-or-nothing rollback, active-session invalidation, repeated requests, state/backups/token deletion, and denial for ordinary roles/other users.

### 4. Keep Preview deployment and synthetic verification isolated

- Create a Neon branch from Neon `main`, not from the hosted-proof branch; apply migrations and create only restricted Preview logins.
- Create `ledger_preview` on that branch as `LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, grant it only `ledger_runtime`, and verify it has no `neon_superuser` membership. The Neon role-creation API adds that elevated membership by default, so use branch SQL for this login and assert its effective privileges in the integration script.
- Give `ledger_preview` and the separate `ledger_erasure_login` branch-only passwords, then store their pooled connection strings only in sensitive Vercel Preview variables for this Git branch.
- Keep SSO enabled. Add only branch-scoped Preview variables needed by this feature. Do not touch Production or Development.
- Use only `example.invalid` synthetic identities. Do not create a public share link or protection bypass.
- If a no-cost Preview mail sink is unavailable, complete local captured-email integration and clearly identify the remaining user-controlled provider step instead of logging links or weakening verification.

### 5. Final gates and PR

- Run focused account-lifecycle/security tests, full `npm test`, `npm run build`, `npm run release`, `git diff --check`, `npm audit`, and the browser-bundle secret/server-driver scan.
- Recheck RLS, role membership, function grants/owner, backup immutability, per-user isolation, and account erasure directly on the isolated Neon branch.
- Confirm Production Branch `main`, SSO enabled, Production/Development credentials absent, existing Preview scopes unchanged, and the Ledger UI still localStorage-authoritative.
- Review the complete diff, commit coherently, push, wait for the Preview, perform deployed synthetic verification if the delivery path permits, and open a PR. Do not merge.

## Stop conditions

Stop before any Production change, real-user data, destructive action outside the isolated feature branch, secret exposure, paid/account-level decision, or unresolved material architecture fork. Keep remote UI sync and local-save migration deferred.
