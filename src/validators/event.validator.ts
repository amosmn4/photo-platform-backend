import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  eventDate: z.string().date().optional(),
  visibility: z.enum(['public', 'private_by_token', 'find_my_photos']).optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  eventDate: z.string().date().optional(),
  visibility: z.enum(['public', 'private_by_token', 'find_my_photos']).optional(),
});

export const createSessionSchema = z.object({
  name: z.string().min(1).max(200),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const issueTokenSchema = z.object({
  label: z.string().max(200).optional(),
  scope: z.enum(['full_gallery', 'session_only', 'find_my_photos']).optional(),
  sessionId: z.string().uuid().optional(),
  ttlDays: z.number().int().positive().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
});

export const startBatchSchema = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/tiff']),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const confirmUploadSchema = z.object({
  batchId: z.string().uuid(),
  storageKey: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  checksumSha256: z.string().length(64),
  sessionId: z.string().uuid().optional(),
});

export const galleryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sessionId: z.string().uuid().optional(),
});

export const findByTimeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
