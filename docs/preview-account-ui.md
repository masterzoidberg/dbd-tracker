# Optional Preview account UI

This milestone adds email/password sign-in, explicit session refresh, session identity and sign-out for existing verified Preview accounts. Accounts remain optional. DBD progression setup is separate.

## Visibility and local review

Normal `npm run build` builds omit the account interface and its auth requests. The checked-in bundle is built in that mode. An explicit local opt-in is available:

```powershell
npm run build -- --preview-account
node server.js
```

Use `http://localhost:5173`. Do not use `npm start` for this opt-in: its prestart rebuild restores the default-off bundle. Rebuild with `npm run build` afterwards. When `VERCEL_ENV=production`, even an explicit opt-in is disabled. No new environment variables are needed or exposed. Direct-file use hides the account entry even in an opted-in build. Opening the tracker never probes authentication; opening the dialog does.

The feature branch does not inherit the backend auth branch's scoped credentials. Opting into this UI does **not** make live authentication available. No deployment scope, Mailtrap allowlist, backend configuration, database schema or secrets were changed.

## Contracts and boundaries

Contracts were checked against the installed Better Auth implementation (`dist/api/routes/sign-in.mjs`, `session.mjs`, `sign-out.mjs`) and the repository's auth config/provider tests:

- `POST /api/auth/sign-in/email`: JSON `{email,password}`; 401 invalid credentials, 403 `EMAIL_NOT_VERIFIED`, 429 rate limit. Success may contain a token, which is discarded. Success is confirmed with the session endpoint.
- `GET /api/auth/get-session`: `null` or `{session,user}`. Only a future session expiry and string email produce a recognized identity. Only email is retained in presentation state.
- `POST /api/auth/sign-out`: JSON `{}`; success requires `{success:true}`. A failed sign-out retains the last recognized identity and provides retry feedback.

Requests use same-origin cookies, no-store caching, no redirects, and a 15-second timeout. Password fields clear on submission and close. Server error text is never rendered. Identity and status use textContent; native dialog behavior supplies modal keyboard containment, Escape dismissal and focus restoration. All request actions are disabled while pending; Close remains available. Reopening during a pending request does not duplicate it.

The account module has no storage or save dependencies and calls only these three endpoints. It never uploads, links, replaces or deletes `localStorage.dbdTrackerData`, or calls state/backup persistence APIs. There is no sign-up, reset, recovery, deletion or synchronization UI.

## Verification

```powershell
node --test tests/account.test.js tests/account-build.test.js
node tests/browser/account.mjs
npm test
npm run build
git diff --check
```

The standalone account browser test builds enabled and disabled bundles in memory and mocks every auth response. It covers errors, recognized/missing sessions, successful/failed sign-out, repeated submissions, close/reopen while pending, password clearing, keyboard/focus, 320/390/768/1440 layouts, offline export and direct-file startup. It compares a seeded save containing actual progression byte-for-byte across auth transitions and rejects any request to other APIs. Bundle tests inspect the browser dependency graph and scan both variants for server packages, database connection strings and server credential names. Existing browser smoke tests cover local tracking, editing, imports, exports and backups with the default gate.

Verification on Windows / Edge 156: 11 focused Node tests and all 492 Node tests passed; the account browser test, normal build, bundle scan, dependency audit (zero vulnerabilities), and whitespace checks passed. The default-off runtime also compared byte-identical to main when built without identifier minification. The first broad smoke attempt hit the inventory Browser Back assertion (23 versus 24); the unchanged main bundle passed that inventory regression in isolation, and the complete browser smoke suite passed on rerun. No unrelated inventory code was changed.

## Remaining acceptance and follow-up

Mocked verification does not establish live cookie issuance, delivery, provider availability or deployed Preview behavior. Live acceptance needs explicit approval, a Preview branch/deployment with the existing narrowly scoped backend credentials, and an approved verified test identity. Mailtrap additionally requires its exact existing branch and `example.invalid` recipient restrictions. Do not expand these scopes or run the deployed lifecycle verifier as part of this milestone.

The smallest follow-up is approved live Preview acceptance of these same three actions, with the gate kept off for normal and Production builds. Do not add synchronization or further account features before that acceptance.
