import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { QUEUE_NAMES } from '../queue/queues';
import { PhotoModel } from '../models/Photo';
import { deleteObject } from '../services/storage.service';
import { env } from '../config/env';
import { logger } from '../config/logger';

const BATCH_SIZE = 500;

// Purges storage objects + DB rows for photos soft-deleted past PHOTO_TRASH_RETENTION_DAYS.
export const photoCleanupWorker = new Worker(
  QUEUE_NAMES.PHOTO_CLEANUP,
  async () => {
    const cutoff = new Date(Date.now() - env.PHOTO_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let purged = 0;

    while (true) {
      const batch = await PhotoModel.listSoftDeletedBefore(cutoff, BATCH_SIZE);
      if (batch.length === 0) break;

      let purgedThisBatch = 0;
      for (const photo of batch) {
        try {
          const keys = [
            photo.storage_key_original,
            photo.storage_key_thumbnail,
            photo.storage_key_medium,
            photo.storage_key_large,
          ].filter((k): k is string => Boolean(k));

          await Promise.all(keys.map((key) => deleteObject(key)));
          await PhotoModel.hardDelete(photo.id);
          purged += 1;
          purgedThisBatch += 1;
        } catch (err) {
          // Left soft-deleted — deleted_at doesn't change, so the next run retries it automatically.
          logger.error({ err, photoId: photo.id }, 'Failed to purge deleted photo');
        }
      }

      if (batch.length < BATCH_SIZE) break;
      // A full batch with zero progress means every photo is failing — stop rather than loop forever.
      if (purgedThisBatch === 0) break;
    }

    if (purged > 0) logger.info({ purged }, 'Purged soft-deleted photos past retention period');
  },
  { connection: redisConnection, concurrency: 1 },
);

photoCleanupWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Photo cleanup job failed');
});
