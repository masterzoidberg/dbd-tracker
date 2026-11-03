-- Run with psql against a disposable branch after migrations 001-003:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/003-auth-lifecycle.integration.sql
-- The branch must also have `ledger_preview` as a LOGIN inheriting only `ledger_runtime`.
-- All rows and temporary privilege changes are rolled back at the end.
BEGIN;

-- Clean up these reserved synthetic fixtures if a prior run stopped mid-test.
GRANT ledger_erasure_login TO CURRENT_USER;
SET LOCAL ROLE ledger_erasure_login;
SELECT public.erase_ledger_account_for_session('lifecycle-session-a');
SELECT public.erase_ledger_account_for_session('lifecycle-session-b');
RESET ROLE;
REVOKE ledger_erasure_login FROM CURRENT_USER;

DO $$
DECLARE
  runtime_role RECORD;
  runtime_login RECORD;
  erasure_owner RECORD;
  erasure_login RECORD;
BEGIN
  SELECT rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
    INTO runtime_role FROM pg_roles WHERE rolname = 'ledger_runtime';
  SELECT rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    INTO runtime_login FROM pg_roles WHERE rolname = 'ledger_preview';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'restricted Preview runtime login is missing';
  END IF;
  SELECT rolcanlogin, rolsuper, rolcreaterole, rolbypassrls, rolinherit
    INTO erasure_owner FROM pg_roles WHERE rolname = 'ledger_erasure_owner';
  SELECT rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
    INTO erasure_login FROM pg_roles WHERE rolname = 'ledger_erasure_login';

  IF runtime_role.rolcanlogin OR runtime_role.rolsuper OR runtime_role.rolcreaterole OR runtime_role.rolbypassrls THEN
    RAISE EXCEPTION 'runtime role has elevated role attributes';
  END IF;
  IF NOT runtime_login.rolcanlogin OR NOT runtime_login.rolinherit OR runtime_login.rolsuper OR
     runtime_login.rolcreatedb OR runtime_login.rolcreaterole OR runtime_login.rolreplication OR runtime_login.rolbypassrls OR
     NOT pg_has_role('ledger_preview', 'ledger_runtime', 'MEMBER') OR
     pg_has_role('ledger_preview', 'neon_superuser', 'MEMBER') THEN
    RAISE EXCEPTION 'Preview runtime login is elevated or does not inherit only the restricted runtime role';
  END IF;
  IF erasure_owner.rolcanlogin OR erasure_owner.rolsuper OR erasure_owner.rolcreaterole OR erasure_owner.rolbypassrls OR erasure_owner.rolinherit THEN
    RAISE EXCEPTION 'erasure owner has elevated role attributes';
  END IF;
  IF NOT erasure_login.rolcanlogin OR erasure_login.rolsuper OR erasure_login.rolcreaterole OR erasure_login.rolbypassrls THEN
    RAISE EXCEPTION 'erasure login has elevated role attributes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE (roleid = 'ledger_erasure_owner'::regrole AND member IN ('ledger_runtime'::regrole, 'ledger_erasure_login'::regrole))
       OR (roleid = 'ledger_runtime'::regrole AND member IN ('ledger_erasure_owner'::regrole, 'ledger_erasure_login'::regrole))
       OR (roleid = 'ledger_erasure_login'::regrole AND member IN ('ledger_runtime'::regrole, 'ledger_erasure_owner'::regrole))
  ) THEN
    RAISE EXCEPTION 'runtime and erasure roles have an unexpected membership path';
  END IF;

  IF (
    SELECT count(*) FROM pg_class AS relation
    WHERE relation.oid IN ('public.ledger_user_state'::regclass, 'public.ledger_user_backups'::regclass)
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
      AND relation.relowner NOT IN ('ledger_runtime'::regrole, 'ledger_preview'::regrole, 'ledger_erasure_login'::regrole)
  ) <> 2 THEN
    RAISE EXCEPTION 'forced RLS or non-runtime ownership is missing on a protected table';
  END IF;
  IF (
    SELECT count(*) FROM pg_policy
    WHERE polrelid IN ('public.ledger_user_state'::regclass, 'public.ledger_user_backups'::regclass)
      AND polcmd = 'r'
      AND 'ledger_erasure_owner'::regrole = ANY (polroles)
  ) <> 2 THEN
    RAISE EXCEPTION 'erasure owner is missing owner-scoped row visibility for delete predicates';
  END IF;

  IF has_table_privilege('ledger_runtime', 'public.ledger_user_backups', 'DELETE') OR
     has_table_privilege('ledger_runtime', 'public.ledger_user_backups', 'UPDATE') OR
     has_table_privilege('ledger_runtime', 'public.auth_email_verification_tokens', 'SELECT') OR
     has_column_privilege('ledger_runtime', 'public.auth_email_verification_tokens', 'token_hash', 'SELECT') OR
     NOT has_column_privilege('ledger_runtime', 'public.auth_email_verification_tokens', 'expires_at', 'SELECT') OR
     has_table_privilege('ledger_runtime', 'public."user"', 'DELETE') OR
     has_table_privilege('ledger_preview', 'public."user"', 'DELETE') OR
     has_table_privilege('ledger_preview', 'public.ledger_user_backups', 'DELETE') OR
     has_function_privilege('ledger_preview', 'public.erase_ledger_account_for_session(text)', 'EXECUTE') OR
     has_table_privilege('ledger_erasure_owner', 'public."user"', 'UPDATE') OR
     has_table_privilege('ledger_erasure_owner', 'public."session"', 'UPDATE') OR
     has_table_privilege('ledger_erasure_login', 'public."user"', 'SELECT') OR
     has_table_privilege('ledger_erasure_login', 'public.ledger_user_state', 'DELETE') OR
     has_table_privilege('ledger_erasure_login', 'public.ledger_user_backups', 'DELETE') OR
     has_function_privilege('ledger_runtime', 'public.erase_ledger_account_for_session(text)', 'EXECUTE') OR
     NOT has_function_privilege('ledger_erasure_login', 'public.erase_ledger_account_for_session(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runtime or erasure-login privileges are broader than intended';
  END IF;
  IF NOT has_column_privilege('ledger_erasure_owner', 'public."user"', 'id', 'UPDATE') OR
     NOT has_column_privilege('ledger_erasure_owner', 'public."session"', 'id', 'UPDATE') THEN
    RAISE EXCEPTION 'erasure owner cannot lock the auth rows by ID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.ledger_user_backups'::regclass
      AND trigger_row.tgname = 'ledger_user_backups_immutable'
      AND trigger_row.tgenabled = 'A'
  ) THEN
    RAISE EXCEPTION 'backup immutability trigger is not enabled ALWAYS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc AS function_row
    WHERE function_row.oid = 'public.erase_ledger_account_for_session(text)'::regprocedure
      AND function_row.proowner = 'ledger_erasure_owner'::regrole
      AND function_row.prosecdef
      AND array_to_string(function_row.proconfig, ',') = 'search_path=pg_catalog, pg_temp'
  ) THEN
    RAISE EXCEPTION 'erasure function owner or fixed search path is unsafe';
  END IF;
END;
$$;

INSERT INTO public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES
  ('lifecycle-fixture-a', 'Synthetic A', 'lifecycle-a@example.invalid', TRUE, NOW(), NOW()),
  ('lifecycle-fixture-b', 'Synthetic B', 'lifecycle-b@example.invalid', TRUE, NOW(), NOW());
INSERT INTO public."session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES
  ('lifecycle-session-a', NOW() + INTERVAL '1 hour', 'lifecycle-token-a', NOW(), NOW(), 'lifecycle-fixture-a'),
  ('lifecycle-session-b', NOW() + INTERVAL '1 hour', 'lifecycle-token-b', NOW(), NOW(), 'lifecycle-fixture-b');
INSERT INTO public.ledger_user_state (user_id, revision, data) VALUES
  ('lifecycle-fixture-a', 1, '{"fixture":"a"}'),
  ('lifecycle-fixture-b', 1, '{"fixture":"b"}');
INSERT INTO public.ledger_user_backups (user_id, source_revision, data) VALUES
  ('lifecycle-fixture-a', 1, '{"fixture":"backup-a"}'),
  ('lifecycle-fixture-b', 1, '{"fixture":"backup-b"}');
INSERT INTO public.auth_email_verification_tokens (token_hash, user_id, expires_at) VALUES
  (decode(repeat('a', 64), 'hex'), 'lifecycle-fixture-a', NOW() + INTERVAL '1 hour'),
  (decode(repeat('b', 64), 'hex'), 'lifecycle-fixture-b', NOW() + INTERVAL '1 hour');
INSERT INTO public."verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt") VALUES
  ('lifecycle-verification-a', 'lifecycle-a@example.invalid', 'synthetic-verification-a', NOW() + INTERVAL '1 hour', NOW(), NOW()),
  ('lifecycle-verification-b', 'lifecycle-b@example.invalid', 'synthetic-verification-b', NOW() + INTERVAL '1 hour', NOW(), NOW());

DO $$
BEGIN
  BEGIN
    UPDATE public.ledger_user_backups SET data = '{}' WHERE user_id = 'lifecycle-fixture-a';
    RAISE EXCEPTION 'database owner updated an immutable backup';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.ledger_user_backups WHERE user_id = 'lifecycle-fixture-a';
    RAISE EXCEPTION 'database owner deleted an immutable backup';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
END;
$$;

GRANT ledger_runtime TO CURRENT_USER;
SET LOCAL ROLE ledger_runtime;
SELECT set_config('app.user_id', 'lifecycle-fixture-a', TRUE);
DELETE FROM public.auth_email_verification_tokens
WHERE expires_at <= NOW() AND FALSE;
DO $$
DECLARE
  visible_state INTEGER;
  visible_backups INTEGER;
  affected INTEGER;
BEGIN
  SELECT count(*) INTO visible_state FROM public.ledger_user_state;
  SELECT count(*) INTO visible_backups FROM public.ledger_user_backups;
  IF visible_state <> 1 OR visible_backups <> 1 THEN
    RAISE EXCEPTION 'forced RLS did not isolate the runtime to fixture A';
  END IF;

  UPDATE public.ledger_user_state SET revision = 2 WHERE user_id = 'lifecycle-fixture-b';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'runtime updated another user state'; END IF;
  BEGIN
    DELETE FROM public."user" WHERE id = 'lifecycle-fixture-a';
    RAISE EXCEPTION 'runtime deleted an auth user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF has_function_privilege(current_user, 'public.erase_ledger_account_for_session(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'runtime can execute the erasure function';
  END IF;
END;
$$;
RESET ROLE;
REVOKE ledger_runtime FROM CURRENT_USER;

REVOKE DELETE ON TABLE public.ledger_user_backups FROM ledger_erasure_owner;
GRANT ledger_erasure_login TO CURRENT_USER;
SET LOCAL ROLE ledger_erasure_login;
DO $$
BEGIN
  BEGIN
    IF public.erase_ledger_account_for_session('lifecycle-session-a') THEN
      RAISE EXCEPTION 'erasure unexpectedly succeeded while backup deletion was denied';
    END IF;
    RAISE EXCEPTION 'erasure did not fail at the denied backup deletion';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
REVOKE ledger_erasure_login FROM CURRENT_USER;

DO $$
BEGIN

  IF NOT EXISTS (SELECT 1 FROM public."user" WHERE id = 'lifecycle-fixture-a') OR
     NOT EXISTS (SELECT 1 FROM public."session" WHERE id = 'lifecycle-session-a') OR
     NOT EXISTS (SELECT 1 FROM public.ledger_user_state WHERE user_id = 'lifecycle-fixture-a') OR
     NOT EXISTS (SELECT 1 FROM public.ledger_user_backups WHERE user_id = 'lifecycle-fixture-a') OR
     NOT EXISTS (SELECT 1 FROM public.auth_email_verification_tokens WHERE user_id = 'lifecycle-fixture-a') OR
     NOT EXISTS (SELECT 1 FROM public."verification" WHERE identifier = 'lifecycle-a@example.invalid') THEN
    RAISE EXCEPTION 'failed account erasure did not roll back all earlier deletions';
  END IF;
END;
$$;
GRANT DELETE ON TABLE public.ledger_user_backups TO ledger_erasure_owner;

GRANT ledger_erasure_login TO CURRENT_USER;
SET LOCAL ROLE ledger_erasure_login;
DO $$
BEGIN
  IF NOT public.erase_ledger_account_for_session('lifecycle-session-a') THEN
    RAISE EXCEPTION 'valid synthetic session did not erase its account';
  END IF;
  IF public.erase_ledger_account_for_session('lifecycle-session-a') THEN
    RAISE EXCEPTION 'repeated erasure unexpectedly found a deleted session';
  END IF;
END;
$$;
RESET ROLE;
REVOKE ledger_erasure_login FROM CURRENT_USER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."user" WHERE id = 'lifecycle-fixture-a') OR
     EXISTS (SELECT 1 FROM public."session" WHERE id = 'lifecycle-session-a') OR
     EXISTS (SELECT 1 FROM public.ledger_user_state WHERE user_id = 'lifecycle-fixture-a') OR
     EXISTS (SELECT 1 FROM public.ledger_user_backups WHERE user_id = 'lifecycle-fixture-a') OR
     EXISTS (SELECT 1 FROM public.auth_email_verification_tokens WHERE user_id = 'lifecycle-fixture-a') OR
     EXISTS (SELECT 1 FROM public."verification" WHERE identifier = 'lifecycle-a@example.invalid') THEN
    RAISE EXCEPTION 'account erasure left owned rows behind';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public."user" WHERE id = 'lifecycle-fixture-b') OR
     NOT EXISTS (SELECT 1 FROM public.ledger_user_state WHERE user_id = 'lifecycle-fixture-b') OR
     NOT EXISTS (SELECT 1 FROM public.ledger_user_backups WHERE user_id = 'lifecycle-fixture-b') OR
     NOT EXISTS (SELECT 1 FROM public.auth_email_verification_tokens WHERE user_id = 'lifecycle-fixture-b') THEN
    RAISE EXCEPTION 'account erasure affected another user';
  END IF;
END;
$$;

GRANT ledger_erasure_login TO CURRENT_USER;
SET LOCAL ROLE ledger_erasure_login;
DO $$
BEGIN
  IF NOT public.erase_ledger_account_for_session('lifecycle-session-b') THEN
    RAISE EXCEPTION 'valid synthetic session B did not erase its account';
  END IF;
END;
$$;
RESET ROLE;
REVOKE ledger_erasure_login FROM CURRENT_USER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."user" WHERE id LIKE 'lifecycle-fixture-%') OR
     EXISTS (SELECT 1 FROM public.ledger_user_state WHERE user_id LIKE 'lifecycle-fixture-%') OR
     EXISTS (SELECT 1 FROM public.ledger_user_backups WHERE user_id LIKE 'lifecycle-fixture-%') THEN
    RAISE EXCEPTION 'synthetic lifecycle fixtures were not fully removed';
  END IF;
END;
$$;

ROLLBACK;
