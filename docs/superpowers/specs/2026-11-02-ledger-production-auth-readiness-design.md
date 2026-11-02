# Ledger production-auth readiness design

## Goal and boundary

Add a Preview-only backend account lifecycle that is safe to evaluate before any real-user data is considered. Keep the current email/password Better Auth server, hosted per-user JSONB persistence, RLS, localStorage UI, direct-file support, and GitHub Pages behavior. Production authentication stays disabled and Production/Development remain without authenticated-persistence credentials.

No real Ledger saves, user migration, remote UI sync, new frontend framework, or Production mail/database configuration is in scope.

## Decisions

### Verified email

- Require email verification before Better Auth creates a session; send verification on signup and allow resend on an unverified sign-in attempt.
- Use Better Auth's verification link with an explicit one-hour expiry and no automatic sign-in after verification. Better Auth 1.7.15 signs links as stateless JWTs and treats replay after success as an idempotent success, so add a SHA-256 token-digest claim table and pre-handler hook that verifies the JWT and atomically claims it once. Store no raw link/token; let claims cascade away on account deletion and expire/prune them on later verification activity.
- Keep email change disabled. There is no email-change UI or requirement in the current email/password-only model.
- Use Better Auth callbacks as the email transport boundary. Tests inject a deterministic capture transport. Production requires a verified sender domain, a transactional provider, delivery monitoring, and a branch-appropriate secret; this change will not configure those Production settings.
- Preview delivery must be synthetic-only and must not put raw verification/reset links in logs, API responses, or browser storage. If no safe Preview mail sink is available, use local capture-transport integration tests and report the precise Preview mail setup as a remaining action.

### Abuse controls

- Use Better Auth's built-in endpoint rate-limit rules with a Neon-backed atomic `customStorage` implementation, because Vercel Functions are serverless and process-local counters are not durable across instances. Store only a keyed digest of Better Auth's IP/path bucket key and prune rows older than the longest configured window during each consume.
- Apply stricter per-IP limits to sign-up, sign-in, verification resend, password-reset request, and token-acceptance endpoints. Use Vercel's overwritten client-IP header, not caller-controlled forwarding data.
- Apply the same durable limiter to current-password checks for account deletion (five attempts per user per five minutes). The handler calls Better Auth's server API directly, which does not pass through the HTTP router's rate-limit hook; the key is based on the verified server-side user ID and is HMACed before storage.
- Verification gates account activation. Avoid account-enumeration-prone custom lockouts or a new CAPTCHA/Redis/paid WAF service. Vercel WAF rate limits are metered; they are not needed for this Preview milestone.
- Do not add email-change routes or OAuth providers.

### Password recovery

- Enable Better Auth's email/password reset callback with one-hour, single-use reset tokens.
- Revoke all database sessions when a password reset succeeds; do not automatically sign the user in afterward.
- Preserve Better Auth's generic request behavior for unknown addresses and use its supported reset-token behavior. Tests must verify invalid, expired, and reused tokens, successful reset, and session revocation.

### Account and Ledger erasure

- Account deletion means hard deletion of the Better Auth user and its cascading credential/account/session rows, email verification/reset records for the current email, per-user Ledger state, and every immutable backup owned by that account.
- There is no post-deletion backup retention in this milestone. The user-requested deletion is the explicit erasure exception; ordinary state/runtime operations remain unable to update or delete backups.
- Use one PostgreSQL transaction for erasure. A narrow `SECURITY DEFINER` function owned by a `NOLOGIN`, `NOBYPASSRLS` role will resolve the target account from the active Better Auth session ID, set the transaction-local RLS owner from that database row, remove its state/backups/tokens, then delete the user. Any error rolls the full operation back.
- The backup trigger permits DELETE only while executing as the dedicated no-login erasure-function owner. It continues to reject UPDATE and every ordinary-runtime DELETE. Forced RLS remains enabled, with a separate DELETE policy for that no-login owner, and the function owner gets only the table privileges it needs.
- Revoke `DELETE` on the Better Auth `user` table from the ordinary runtime role. A separate Preview-only erasure login receives only `EXECUTE` on the function and no table access; ordinary runtime credentials cannot call it. The HTTP handler requires the current session, exact same-origin POST, and current-password verification; it derives the session ID server-side and accepts no owner/session ID from the client.
- Account deletion invalidates all active sessions by deleting the session rows. A lost response followed by a retry is safe: the old session no longer resolves, and the database function itself returns without mutation when its session no longer exists.
- No arbitrary account/backups retention period is introduced. Active records remain until user deletion; deletion removes them transactionally. Synthetic Preview accounts and their branch are disposable test resources. Verification and reset tokens expire after one hour; rate-limit counters expire after the longest configured endpoint window and contain only a keyed digest of the IP/path key.

## Authorization invariants

- Better Auth's verified server session is the only source for the account and Ledger owner.
- Client-supplied user IDs, owner IDs, or session IDs are rejected or ignored before any query.
- Existing forced RLS, non-bypass runtime role, transaction-local owner setting, cross-user indistinguishability, and atomic CAS remain intact.
- The ordinary runtime role cannot execute or own the erasure function. The dedicated function owner is no-login and non-bypass, uses a fixed trusted search path, and has no direct login.
- Production and Development remain credential-free; the existing localStorage-authoritative UI is unchanged.

## Verification approach

Use test-first unit and PostgreSQL integration tests. Prove sign-up verification gating, token expiry/reuse, resend limits, reset expiry/reuse/session invalidation, generic unknown-address behavior, authenticated same-origin deletion, foreign/unauthenticated deletion rejection, transactional rollback, retry behavior, exact backup erasure, trigger denial for ordinary roles, erasure-function denial for the ordinary runtime role, and unchanged CAS/RLS/local-first behavior. The database integration test uses deterministic `example.invalid` identities only.

## Provider guidance

Before Production auth is ever enabled, select and configure a transactional email provider for a verified sending domain, set delivery monitoring and suppression/bounce handling, and place its secret only in approved Production scope. This milestone does not select a paid account or configure Production delivery.
