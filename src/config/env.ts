import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// z.coerce.boolean() just runs JS's Boolean(x), so the string "false" coerces to true —
// this parses "true"/"1"/"yes" vs "false"/"0"/"no" (case-insensitive) instead.
function booleanEnv(defaultValue: boolean) {
  return z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    const normalized = val.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return val;
  }, z.boolean().default(defaultValue));
}

// Validates every environment variable here; nothing else should read process.env directly.
const schema = z.object({
  APP_NAME: z.string().min(1).default('PhotoDrop'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  PUBLIC_GALLERY_BASE_URL: z.string().url().default('http://localhost:5173/g'),

  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanEnv(true),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  CDN_BASE_URL: z.string().url().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('PhotoDrop <no-reply@localhost>'),

  MAX_UPLOAD_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(52_428_800),
  MAX_UPLOAD_BATCH_SIZE: z.coerce.number().int().positive().default(20000),

  DEFAULT_ACCESS_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),

  // How long a "removed" photo stays soft-deleted (recoverable in principle)
  // before the cleanup worker purges its storage objects and DB row for good.
  PHOTO_TRASH_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
