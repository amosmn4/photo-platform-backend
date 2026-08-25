import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { s3Client, BUCKET } from '../config/storage';
import { env } from '../config/env';

/**
 * All object-storage access goes through here. Nothing else in the app
 * touches @aws-sdk directly (product doc section 5-6: originals never
 * transit the app server, thumbnails/previews are separate objects, and
 * URLs are generated on read so switching buckets/CDN is a config change,
 * not a data migration).
 */

export function buildStorageKey(eventId: string, variant: 'original' | 'large' | 'medium' | 'thumbnail', ext: string) {
  const rand = crypto.randomBytes(8).toString('hex');
  return `events/${eventId}/${variant}/${rand}.${ext}`;
}

/**
 * Returns a presigned PUT URL the client (photographer's browser) uploads
 * the original file to directly. This is what makes 5,000-20,000 photo
 * uploads viable — the app server's job is to hand out URLs and later
 * process from storage, never to proxy 50MB RAW files through itself.
 */
export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3Client, command, { expiresIn: env.S3_SIGNED_URL_TTL_SECONDS });
}

export async function getPresignedDownloadUrl(key: string, downloadFilename?: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: downloadFilename ? `attachment; filename="${downloadFilename}"` : undefined,
  });
  return getSignedUrl(s3Client, command, { expiresIn: env.S3_SIGNED_URL_TTL_SECONDS });
}

/** Public read URL for gallery thumbnails/previews — served via CDN when configured. */
export function getPublicUrl(key: string): string {
  if (env.CDN_BASE_URL) return `${env.CDN_BASE_URL}/${key}`;
  // Fall back to a signed URL from the origin if no CDN is fronting storage.
  return `${env.S3_ENDPOINT ?? `https://${BUCKET}.s3.${env.S3_REGION}.amazonaws.com`}/${BUCKET}/${key}`;
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const result = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const stream = result.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

export async function putObjectBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await s3Client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
