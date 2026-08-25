import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Every environment variable the app touches is declared and validated
 * here, once. Nothing else in the codebase should read `process.env`
 * directly — that's what causes "works on my machine, undefined in prod"
 * bugs. If a required var is missing, the process refuses to boot with a
 * clear message instead of failing weirdly three requests later.
 */
const schema = z.object({
  APP_NAME: z.string().min(1).default('PhotoDrop'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  // Public-facing gallery URL base — printed under the QR code, e.g.
  // https://photos.example.com/g/<token>
  PUBLIC_GALLERY_BASE_URL: z.string().url().default('http://localhost:5173/g'),

  // Database
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),

  // Redis / queue
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  // Object storage (S3-compatible: AWS S3, MinIO, DigitalOcean Spaces, etc.)
  S3_ENDPOINT: z.string().optional(), // omit for real AWS S3
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true), // required for MinIO
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  // CDN in front of object storage, if configured — signed URLs fall back
  // to direct storage endpoints when unset.
  CDN_BASE_URL: z.string().url().optional(),

  // Upload limits
  MAX_UPLOAD_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(52_428_800), // 50MB/photo
  MAX_UPLOAD_BATCH_SIZE: z.coerce.number().int().positive().default(20000),

  // Access tokens
  DEFAULT_ACCESS_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),

  // Rate limiting
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loud — this is a deploy-blocking error, not something to
  // limp along with defaults.
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
