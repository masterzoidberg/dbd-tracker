import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { verifyPassword } from 'better-auth/crypto';
import { provisionPersonalAccount } from '../src/auth/personal-account.js';

test('administrative provisioning creates only one owner; recovery preserves identity and revokes sessions', async () => {
  const db = new DatabaseSync(':memory:');
  await (await getMigrations({ database: db })).runMigrations();
  const client = { async query(sql, params = []) {
    if (sql.startsWith('LOCK TABLE')) return { rows: [] };
    const ordered = [];
    const sqlite = sql.replace(/\$(\d+)/g, (_, number) => { ordered.push(params[Number(number) - 1]); return '?'; }).replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP');
    return { rows: db.prepare(sqlite).all(...ordered) };
  } };
  try {
    const first = await provisionPersonalAccount(client, { email: 'owner@example.invalid', password: 'Synthetic-Passphrase-1', mode: 'create' });
    const user = db.prepare('SELECT * FROM user').get();
    assert.equal(first.userId, user.id);
    assert.equal(user.email, 'owner@example.invalid');
    const credential = db.prepare('SELECT * FROM account').get();
    assert.equal(await verifyPassword({ password: 'Synthetic-Passphrase-1', hash: credential.password }), true);
    await assert.rejects(provisionPersonalAccount(client, { email: 'stranger@example.invalid', password: 'Synthetic-Passphrase-2', mode: 'create' }), /already|owner/i);
    await assert.rejects(provisionPersonalAccount(client, { email: 'stranger@example.invalid', password: 'Synthetic-Passphrase-2', mode: 'recover' }), /match|owner/i);
    db.prepare('INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run('session-1', 'synthetic-token', user.id, 9999999999, 1, 1);
    await provisionPersonalAccount(client, { email: user.email, password: 'Synthetic-Passphrase-2', mode: 'recover' });
    assert.equal(db.prepare('SELECT id FROM user').get().id, user.id);
    assert.equal(db.prepare('SELECT count(*) AS count FROM session').get().count, 0);
    assert.equal(await verifyPassword({ password: 'Synthetic-Passphrase-2', hash: db.prepare('SELECT password FROM account').get().password }), true);
    assert.equal(db.prepare('SELECT count(*) AS count FROM user').get().count, 1);
  } finally { db.close(); }
});
