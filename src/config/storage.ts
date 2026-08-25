import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

/**
 * Single S3 client for the whole app. Works against real AWS S3 (leave
 * S3_ENDPOINT unset) or any S3-compatible store — MinIO locally, DigitalOcean
 * Spaces, Backblaze B2, etc — by setting S3_ENDPOINT + S3_FORCE_PATH_STYLE.
 *
 * Nothing outside src/services/storage.service.ts should import this
 * directly — go through the service so signing/key-naming stays consistent.
 */
export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export const BUCKET = env.S3_BUCKET;
