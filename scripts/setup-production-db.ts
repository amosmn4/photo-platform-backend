/**
 * Production database bootstrap: creates the target database if it doesn't
 * already exist yet, then applies every pending migration via the same
 * runner `npm run migrate` uses locally — just pointed at a production
 * DATABASE_URL instead of the local docker-compose Postgres.
 *
 * Usage (run from backend/):
 *   DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run db:deploy
 *
 * Or with a real .env file already in place on the box:
 *   npm run db:deploy
 *
 * Flags:
 *   --yes / -y   skip the confirmation prompt (for CI/non-interactive use;
 *                also skipped automatically when stdin isn't a TTY)
 *
 * SSL: if your host requires it (RDS, Supabase, Neon, Railway, etc.), add
 * `?sslmode=require` (or `?sslmode=no-verify` for a self-signed cert) to
 * DATABASE_URL — `pg` parses that directly from the connection string, no
 * code change needed here or in src/db/pool.ts.
 *
 * pgvector note: migration 006_faces_phase2.sql requires the `vector`
 * extension. If your production Postgres doesn't have it installed, that
 * migration (and this script) will fail there — see that file's header
 * comment; it's Phase 2 schema with no Phase 1 dependents, so the fix is
 * either installing pgvector on the server or deleting that one migration
 * file for this deployment.
 */
import { Client } from 'pg';
import readline from 'readline';
import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SAFE_DB_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function confirm(message: string): Promise<boolean> {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  if (!process.stdin.isTTY) return true; // non-interactive (CI) — proceed
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(message, resolve));
  rl.close();
  return answer.trim().toLowerCase() === 'yes';
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Export it, or put it in backend/.env, and try again.');
    process.exit(1);
  }

  const target = new URL(databaseUrl);
  const dbName = decodeURIComponent(target.pathname.replace(/^\//, ''));

  if (!dbName || !SAFE_DB_NAME.test(dbName)) {
    console.error(`Refusing to proceed: "${dbName}" doesn't look like a safe database name.`);
    process.exit(1);
  }

  console.log(`Target: database "${dbName}" on ${target.hostname}:${target.port || '5432'}`);
  const proceed = await confirm(
    'This will create that database if it does not exist, then apply all pending migrations. Continue? (yes/no) ',
  );
  if (!proceed) {
    console.log('Aborted — nothing was changed.');
    process.exit(1);
  }

  // Connect to the server's default maintenance DB to check/create the
  // target — you can't CREATE DATABASE while connected to the DB you're
  // creating (or one that doesn't exist yet).
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length > 0) {
      console.log(`Database "${dbName}" already exists — skipping creation.`);
    } else {
      console.log(`Creating database "${dbName}" ...`);
      // CREATE DATABASE can't take a bound parameter for the identifier —
      // dbName is validated against SAFE_DB_NAME above, so this is safe.
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log('Database created.');
    }
  } finally {
    await admin.end();
  }

  console.log('Applying migrations ...');
  execSync('npm run migrate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
