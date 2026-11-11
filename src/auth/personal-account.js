import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';

// Administrative connection only; never exposed as an HTTP endpoint.
export async function provisionPersonalAccount(client, { email, password, mode }) {
  email = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('A valid owner email is required.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw Error('Use a password between 12 and 128 characters.');
  if (!['create', 'recover'].includes(mode)) throw Error('Choose create or recover.');
  const hash = await hashPassword(password);
  await client.query('BEGIN');
  try {
    await client.query('LOCK TABLE "user", "account", "session" IN EXCLUSIVE MODE');
    const { rows: users } = await client.query('SELECT id, email FROM "user"');
    let userId;
    if (mode === 'create') {
      if (users.length) throw Error('An owner already exists. Use recover for that owner.');
      userId = randomUUID();
      await client.query('INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, FALSE, NOW(), NOW())', [userId, 'Owner', email]);
      await client.query('INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, $3, $2, $4, NOW(), NOW())', [randomUUID(), userId, 'credential', hash]);
    } else {
      if (users.length !== 1 || users[0].email.toLowerCase() !== email) throw Error('Recovery must match the sole existing owner.');
      userId = users[0].id;
      const { rows } = await client.query('UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = $3 RETURNING id', [hash, userId, 'credential']);
      if (rows.length !== 1) throw Error('Expected exactly one owner credential; nothing was changed.');
      await client.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "verification" WHERE identifier = $1 OR identifier LIKE $2', [email, 'reset-password:%']);
    }
    await client.query('COMMIT');
    return { userId, email, mode };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
