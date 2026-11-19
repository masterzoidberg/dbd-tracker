import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { Pool } from 'pg';
import { provisionPersonalAccount } from '../src/auth/personal-account.js';

const mode = process.argv[2];
if (!['create', 'recover'].includes(mode) || !process.stdin.isTTY || !process.env.DATABASE_URL) {
  console.error('Run node --env-file=<private-env-file> scripts/personal-account.mjs create|recover in an interactive terminal. DATABASE_URL must be an administrative connection.');
  process.exitCode = 1;
} else {
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  let pool;
  try {
    const target = new URL(process.env.DATABASE_URL);
    console.log(`Target database: ${target.hostname}${target.pathname}`);
    const confirmation = await prompt.question(`Type ${mode} to ${mode === 'create' ? 'create the sole owner' : 'reset the owner password and revoke sessions'}: `);
    if (confirmation !== mode) throw Error('Cancelled.');
    const email = await prompt.question('Owner sign-in email: ');
    process.stdout.write('Password (hidden): '); muted = true;
    const password = await prompt.question('');
    muted = false; process.stdout.write('\nConfirm password (hidden): '); muted = true;
    const confirmationPassword = await prompt.question('');
    muted = false; process.stdout.write('\n');
    if (password !== confirmationPassword) throw Error('Passwords did not match.');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try { await provisionPersonalAccount(client, { email, password, mode }); }
    finally { client.release(); }
    console.log(mode === 'create' ? 'Owner created. Sign in with the password you entered.' : 'Password changed; previous sessions revoked. Saves and backups preserved.');
  } catch (error) {
    // Database errors can include SQL values. Do not print driver messages.
    console.error(error.code ? 'Database operation failed; no account changes were committed.' : error.message);
    process.exitCode = 1;
  } finally { muted = false; prompt.close(); if (pool) await pool.end(); }
}
