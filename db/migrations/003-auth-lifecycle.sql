-- Preview-only account lifecycle storage and narrowly privileged account erasure.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledger_erasure_owner') THEN
    CREATE ROLE ledger_erasure_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'ledger_erasure_owner'
      AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'ledger_erasure_owner exists with unsafe role attributes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledger_erasure_login') THEN
    CREATE ROLE ledger_erasure_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'ledger_erasure_login'
      AND rolcanlogin AND NOT rolinherit AND NOT rolsuper
      AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'ledger_erasure_login exists with unsafe role attributes';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK (count > 0),
  last_request BIGINT NOT NULL CHECK (last_request > 0)
);

CREATE TABLE IF NOT EXISTS auth_email_verification_tokens (
  token_hash BYTEA PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  user_id TEXT NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_email_verification_tokens_expiry_idx
  ON auth_email_verification_tokens (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_rate_limits TO ledger_runtime;
GRANT INSERT, DELETE ON TABLE public.auth_email_verification_tokens TO ledger_runtime;

-- Better Auth account deletion is disabled. The runtime login must not be able
-- to bypass the erasure transaction by deleting the auth user directly.
REVOKE DELETE ON TABLE public."user" FROM ledger_runtime;

GRANT USAGE, CREATE ON SCHEMA public TO ledger_erasure_owner;
GRANT SELECT, DELETE ON TABLE public."user", public."session", public."account", public."verification" TO ledger_erasure_owner;
GRANT UPDATE (id) ON TABLE public."user", public."session" TO ledger_erasure_owner;
GRANT SELECT, DELETE ON TABLE public.ledger_user_state, public.ledger_user_backups TO ledger_erasure_owner;
GRANT SELECT, DELETE ON TABLE public.auth_email_verification_tokens TO ledger_erasure_owner;

ALTER TABLE public.ledger_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_user_state FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_user_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_user_backups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_user_state_erasure_owner_select ON public.ledger_user_state;
CREATE POLICY ledger_user_state_erasure_owner_select ON public.ledger_user_state
  FOR SELECT TO ledger_erasure_owner
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''));
DROP POLICY IF EXISTS ledger_user_state_erasure_owner ON public.ledger_user_state;
CREATE POLICY ledger_user_state_erasure_owner ON public.ledger_user_state
  FOR DELETE TO ledger_erasure_owner
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''));

DROP POLICY IF EXISTS ledger_user_backups_erasure_owner_select ON public.ledger_user_backups;
CREATE POLICY ledger_user_backups_erasure_owner_select ON public.ledger_user_backups
  FOR SELECT TO ledger_erasure_owner
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''));
DROP POLICY IF EXISTS ledger_user_backups_erasure_owner ON public.ledger_user_backups;
CREATE POLICY ledger_user_backups_erasure_owner ON public.ledger_user_backups
  FOR DELETE TO ledger_erasure_owner
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''));

CREATE OR REPLACE FUNCTION public.reject_ledger_user_backup_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_user = 'ledger_erasure_owner' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'ledger_user_backups rows are immutable' USING ERRCODE = '55000';
  RETURN OLD;
END;
$$;

-- Temporarily assume the no-login function owner so the migration remains
-- repeatable without leaving a role-membership path behind.
GRANT ledger_erasure_owner TO CURRENT_USER;
SET ROLE ledger_erasure_owner;

CREATE OR REPLACE FUNCTION public.erase_ledger_account_for_session(p_session_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  target_user_id TEXT;
  target_email TEXT;
BEGIN
  SELECT app_user.id, app_user.email
    INTO target_user_id, target_email
    FROM public."session" AS active_session
    JOIN public."user" AS app_user ON app_user.id = active_session."userId"
   WHERE active_session.id = p_session_id
     AND active_session."expiresAt" > pg_catalog.now()
   FOR UPDATE OF active_session, app_user;

  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_catalog.set_config('app.user_id', target_user_id, TRUE);

  DELETE FROM public.ledger_user_state WHERE user_id = target_user_id;
  DELETE FROM public.ledger_user_backups WHERE user_id = target_user_id;
  DELETE FROM public.auth_email_verification_tokens WHERE user_id = target_user_id;
  DELETE FROM public."verification"
   WHERE value = target_user_id OR pg_catalog.lower(identifier) = pg_catalog.lower(target_email);
  DELETE FROM public."user" WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.erase_ledger_account_for_session(TEXT) OWNER TO ledger_erasure_owner;
REVOKE ALL ON FUNCTION public.erase_ledger_account_for_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erase_ledger_account_for_session(TEXT) FROM ledger_runtime;
GRANT EXECUTE ON FUNCTION public.erase_ledger_account_for_session(TEXT) TO ledger_erasure_login;

RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM ledger_erasure_owner;
REVOKE ledger_erasure_owner FROM CURRENT_USER;

COMMIT;
