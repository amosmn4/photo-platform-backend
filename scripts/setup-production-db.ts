// Production DB bootstrap: creates the target DB if missing, then runs the standard migration runner.
import { Client } from 'pg';
import readline from 'readline';
import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SAFE_DB_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function confirm(message: string): Promise<boolean> {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  if (!process.stdin.isTTY) return true;
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
