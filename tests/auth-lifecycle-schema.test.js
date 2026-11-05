import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../db/migrations/003-auth-lifecycle.sql', import.meta.url), 'utf8');

test('lifecycle migration is atomic so failures cannot leave the erasure function publicly executable', () => {
  assert.match(sql, /^\s*--[^\n]*\n\s*BEGIN\s*;/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.erase_ledger_account_for_session\(TEXT\)\s+FROM\s+PUBLIC[\s\S]+COMMIT\s*;\s*$/i);
});

test('lifecycle storage keeps only hashed rate keys and expiring digest-only verification claims', () => {
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+auth_rate_limits\s*\([\s\S]+key_hash\s+TEXT\s+PRIMARY\s+KEY[\s\S]+count\s+INTEGER[\s\S]+last_request\s+BIGINT/i);
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+auth_email_verification_tokens\s*\([\s\S]+token_hash\s+BYTEA\s+PRIMARY\s+KEY[\s\S]+user_id\s+TEXT\s+NOT\s+NULL\s+REFERENCES\s+public\."user"\s*\(id\)\s+ON\s+DELETE\s+CASCADE[\s\S]+expires_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /octet_length\(token_hash\)\s*=\s*32/i);
  assert.match(sql, /GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLE\s+public\.auth_rate_limits\s+TO\s+ledger_runtime/i);
  assert.match(sql, /GRANT\s+INSERT\s*,\s*DELETE\s+ON\s+TABLE\s+public\.auth_email_verification_tokens\s+TO\s+ledger_runtime/i);
  assert.match(sql, /GRANT\s+SELECT\s*\(\s*expires_at\s*\)\s+ON\s+TABLE\s+public\.auth_email_verification_tokens\s+TO\s+ledger_runtime/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:SELECT|ALL(?:\s+PRIVILEGES)?)\s+ON\s+TABLE\s+public\.auth_email_verification_tokens\s+TO\s+ledger_runtime/i);
});

test('only the no-login erasure owner can delete backups under forced RLS, while runtime cannot delete auth users', () => {
  assert.match(sql, /CREATE\s+ROLE\s+ledger_erasure_owner\s+NOLOGIN\s+NOINHERIT\s+NOSUPERUSER\s+NOCREATEDB\s+NOCREATEROLE\s+NOREPLICATION\s+NOBYPASSRLS/i);
  assert.match(sql, /ALTER\s+TABLE\s+public\.ledger_user_backups\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
  assert.match(sql, /CREATE\s+POLICY\s+ledger_user_state_erasure_owner_select\s+ON\s+public\.ledger_user_state\s+FOR\s+SELECT\s+TO\s+ledger_erasure_owner[\s\S]+current_setting\('app\.user_id'/i);
  assert.match(sql, /CREATE\s+POLICY\s+ledger_user_backups_erasure_owner_select\s+ON\s+public\.ledger_user_backups\s+FOR\s+SELECT\s+TO\s+ledger_erasure_owner[\s\S]+current_setting\('app\.user_id'/i);
  assert.match(sql, /CREATE\s+POLICY\s+ledger_user_state_erasure_owner\s+ON\s+public\.ledger_user_state\s+FOR\s+DELETE\s+TO\s+ledger_erasure_owner[\s\S]+current_setting\('app\.user_id'/i);
  assert.match(sql, /CREATE\s+POLICY\s+ledger_user_backups_erasure_owner\s+ON\s+public\.ledger_user_backups\s+FOR\s+DELETE\s+TO\s+ledger_erasure_owner[\s\S]+current_setting\('app\.user_id'/i);
  assert.match(sql, /REVOKE\s+DELETE\s+ON\s+TABLE\s+public\."user"\s+FROM\s+ledger_runtime/i);
  assert.match(sql, /IF\s+TG_OP\s*=\s*'DELETE'\s+AND\s+current_user\s*=\s*'ledger_erasure_owner'\s+THEN\s+RETURN\s+OLD/i);
  assert.match(sql, /RAISE\s+EXCEPTION\s+'ledger_user_backups rows are immutable'/i);
});

test('erasure function resolves ownership from a live database session and exposes only EXECUTE to a dedicated login', () => {
  const functionBody = sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.erase_ledger_account_for_session[\s\S]*?\n\$\$;/i)?.[0];
  assert.ok(functionBody);
  assert.match(functionBody, /SECURITY\s+DEFINER/i);
  assert.match(functionBody, /SET\s+search_path\s*=\s*pg_catalog\s*,\s*pg_temp/i);
  assert.match(functionBody, /FROM\s+public\."session"[\s\S]+JOIN\s+public\."user"[\s\S]+active_session\.id\s*=\s*p_session_id/i);
  assert.match(functionBody, /active_session\."expiresAt"\s*>\s*pg_catalog\.now\(\)/i);
  assert.match(functionBody, /set_config\('app\.user_id',\s*target_user_id,\s*TRUE\)/i);
  assert.match(functionBody, /DELETE\s+FROM\s+public\.ledger_user_state[\s\S]+DELETE\s+FROM\s+public\.ledger_user_backups[\s\S]+DELETE\s+FROM\s+public\."user"/i);
  assert.match(sql, /ALTER\s+FUNCTION\s+public\.erase_ledger_account_for_session\(TEXT\)\s+OWNER\s+TO\s+ledger_erasure_owner/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.erase_ledger_account_for_session\(TEXT\)\s+FROM\s+PUBLIC/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.erase_ledger_account_for_session\(TEXT\)\s+FROM\s+ledger_runtime/i);
  assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.erase_ledger_account_for_session\(TEXT\)\s+TO\s+ledger_erasure_login/i);
});
