/**
 * Seeds the admin account. Idempotent — skips if an account with the target
 * email already exists rather than erroring or overwriting it.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Override the defaults via env vars for a non-default account:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run seed:admin
 */
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@photodrop.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Photodrop@2026!';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Export it, or put it in backend/.env, and try again.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    if (rows.length > 0) {
      console.log(`Admin account "${ADMIN_EMAIL}" already exists — skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, status, email_verified_at)
       VALUES ($1, $2, $3, 'admin', 'active', now())`,
      [ADMIN_EMAIL, passwordHash, 'Admin'],
    );

    console.log(`Admin account created: ${ADMIN_EMAIL}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('Using the default seed password — sign in and change it before going live.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
