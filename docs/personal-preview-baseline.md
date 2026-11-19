# Personal-use Preview baseline

Historical baseline: the email-based acceptance below is superseded by `personal-cloud-save.md`. Mailtrap is no longer required for the approved single-owner flow.

Checked 2026-11-11. Goal: personal access across devices with recoverable backups.

## Baseline prepared

- Fetched origin. Latest main: `4bdd9700c296b9e163449d203c3b13194e13c2df`.
- New worktree: `G:/Projects/dbd-tracker-personal`.
- New branch: `codex/personal-preview-baseline`, based on origin/main.
- Original checkout and its untracked files were preserved.
- Installed locked dependencies with `npm ci --no-fund --no-audit`.

## Checks performed

- Existing auth, auth lifecycle/provider/rate-limit/schema/verifier, account erasure, per-user persistence/runtime/repository/integration, and Mailtrap Node test files passed locally. These tests are not evidence of live authenticated requests.
- `npm run build` passed. Generated artifact diff reports no substantive changes.
- Existing account UI worktree at `6c097127ec1b0b3a23919471dcba7cc208a5628e`: account, account-build and Mailtrap tests passed.
- Its `node tests/browser/account.mjs` passed in Edge 157.0.4341.46, including mocked auth states, local-save preservation, keyboard/focus, offline export, responsive layout and direct-file behavior.

## Live evidence and corrected prior assumptions

- PR #21 is open: https://github.com/masterzoidberg/dbd-tracker/pull/21.
- Its exact Preview deployment remains READY: `dpl_GBhSpsbRxnS9b3F73qaPSFn5ZeKE`, commit `6c097127ec1b0b3a23919471dcba7cc208a5628e`.
- URL: https://dbd-tracker-o968rh4gi-nick-queens-projects.vercel.app.
- PR #21 records that this deployment already captured its required environment during a temporary branch-scope move. Current dashboard scopes do not mean the existing deployment lacks credentials. No redeployment or credential move is needed merely to resume this deployment's acceptance.
- Fresh read-only counts on Neon branch `br-sweet-grass-b83o4u2r`: 1 user, 0 verified users, 0 sessions, 0 user saves, 0 user backups.

## Remaining blocker

PR #21 records that its synthetic account's verification message reached Mailtrap Sandbox 4997408 (message 5798031417). The normal accessible message frame was blank, and browser URL security rejected opening the raw-message blob. No alternate token extraction or database verification override was attempted in this task.

The old verification token cannot be assumed usable: the configured lifetime is one hour, and the message dates from November 6. The old test password was ephemeral and is not available in this session. Continuing with this same account therefore requires normal fresh email-verification and password-recovery flows, with manual Mailtrap interaction where necessary. Do not ask for tokens/passwords in chat or record them here.

After account recovery, resume on the exact protected Preview: verified sign-in, session refresh, reload persistence, sign-out, invalid-credential feedback and cookie attributes; check local-save preservation and synthetic per-user state/backups. Complete synthetic-account cleanup through the authenticated erasure flow with the required authorization.

Status: baseline and local checks complete; live Preview acceptance remains incomplete. No production configuration, remote data, credentials, deployment protection, or application source was changed. No merge or deployment was performed.
