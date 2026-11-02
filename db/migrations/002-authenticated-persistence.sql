-- Better Auth 1.7.15 PostgreSQL schema generated from src/auth/config.js.
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" (identifier);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ledger_runtime') THEN
    EXECUTE 'CREATE ROLE ledger_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';
  ELSE
    EXECUTE 'ALTER ROLE ledger_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS ledger_user_state (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE RESTRICT,
  revision BIGINT NOT NULL CHECK (revision > 0),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_user_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE RESTRICT,
  source_revision BIGINT NOT NULL CHECK (source_revision > 0),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ledger_user_backups_owner_created_idx
  ON ledger_user_backups (user_id, created_at DESC);

ALTER TABLE ledger_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_user_state FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledger_user_state_owner ON ledger_user_state;
CREATE POLICY ledger_user_state_owner ON ledger_user_state
  TO ledger_runtime
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));

ALTER TABLE ledger_user_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_user_backups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledger_user_backups_owner ON ledger_user_backups;
CREATE POLICY ledger_user_backups_owner ON ledger_user_backups
  TO ledger_runtime
  USING (user_id = NULLIF(current_setting('app.user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), ''));

CREATE OR REPLACE FUNCTION reject_ledger_user_backup_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_user_backups rows are immutable' USING ERRCODE = '55000';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ledger_user_backups_immutable ON ledger_user_backups;
CREATE TRIGGER ledger_user_backups_immutable
  BEFORE UPDATE OR DELETE ON ledger_user_backups
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_user_backup_mutation();
ALTER TABLE ledger_user_backups ENABLE ALWAYS TRIGGER ledger_user_backups_immutable;

GRANT USAGE ON SCHEMA public TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user", "session", "account", "verification" TO ledger_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE ledger_user_state TO ledger_runtime;
GRANT SELECT, INSERT ON TABLE ledger_user_backups TO ledger_runtime;
