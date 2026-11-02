CREATE TABLE IF NOT EXISTS ledger_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton = TRUE),
  revision BIGINT NOT NULL CHECK (revision > 0),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_revision BIGINT NOT NULL CHECK (source_revision > 0),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_ledger_backup_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_backups rows are immutable' USING ERRCODE = '55000';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ledger_backups_immutable ON ledger_backups;
CREATE TRIGGER ledger_backups_immutable
  BEFORE UPDATE OR DELETE ON ledger_backups
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_backup_mutation();
ALTER TABLE ledger_backups ENABLE ALWAYS TRIGGER ledger_backups_immutable;
