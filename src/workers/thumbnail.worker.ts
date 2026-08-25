import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { QUEUE_NAMES } from '../queue/queues';
import { PhotoProcessingJobData } from '../queue/producers/photo.producer';
import { PhotoModel } from '../models/Photo';
import { UploadBatchModel } from '../models/UploadBatch';
import { getObjectBuffer, putObjectBuffer, buildStorageKey } from '../services/storage.service';
import { generateVariant, extractExif } from '../services/image.service';
import { logger } from '../config/logger';

/**
 * This is the "background it, never make the photographer wait" pipeline
 * from product doc section 7:
 *   original in storage -> download -> EXIF -> 3 resized webp variants
 *   -> upload variants -> mark photo 'ready' -> bump batch progress
 *
 * Concurrency is deliberately conservative (image processing is CPU-bound);
 * scale by running more worker processes/containers, not by raising this
 * number unboundedly on one box.
 */
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);

export const photoProcessingWorker = new Worker<PhotoProcessingJobData>(
  QUEUE_NAMES.PHOTO_PROCESSING,
  async (job: Job<PhotoProcessingJobData>) => {
    const { photoId } = job.data;
    const photo = await PhotoModel.findById(photoId);
    if (!photo) {
      logger.warn({ photoId }, 'Worker received job for photo that no longer exists');
      return;
    }

    await PhotoModel.markProcessing(photoId);

    try {
      const originalBuffer = await getObjectBuffer(photo.storage_key_original);

      const [exif, thumb, medium, large] = await Promise.all([
        extractExif(originalBuffer),
        generateVariant(originalBuffer, 'thumbnail'),
        generateVariant(originalBuffer, 'medium'),
        generateVariant(originalBuffer, 'large'),
      ]);

      const thumbKey = buildStorageKey(photo.event_id, 'thumbnail', 'webp');
      const mediumKey = buildStorageKey(photo.event_id, 'medium', 'webp');
      const largeKey = buildStorageKey(photo.event_id, 'large', 'webp');

      await Promise.all([
        putObjectBuffer(thumbKey, thumb.buffer, 'image/webp'),
        putObjectBuffer(mediumKey, medium.buffer, 'image/webp'),
        putObjectBuffer(largeKey, large.buffer, 'image/webp'),
      ]);

      await PhotoModel.markReady(photoId, {
        storageKeyThumbnail: thumbKey,
        storageKeyMedium: mediumKey,
        storageKeyLarge: largeKey,
        width: large.width,
        height: large.height,
        // Fall back to upload time when a photo carries no EXIF date at all
        // (edited exports, screenshots) so it still sorts sensibly instead
        // of vanishing from date-based filtering.
        takenAt: exif.takenAt ?? photo.created_at,
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        lensModel: exif.lensModel,
        gpsLatitude: exif.gpsLatitude,
        gpsLongitude: exif.gpsLongitude,
        orientation: exif.orientation,
        exifRaw: exif.raw,
      });

      if (photo.upload_batch_id) {
        await UploadBatchModel.incrementProcessed(photo.upload_batch_id, false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown processing error';
      await PhotoModel.markFailed(photoId, message);
      if (photo.upload_batch_id) {
        await UploadBatchModel.incrementProcessed(photo.upload_batch_id, true);
      }
      logger.error({ photoId, err }, 'Photo processing failed');
      throw err; // let BullMQ retry per the queue's backoff policy
    }
  },
  { connection: redisConnection, concurrency: CONCURRENCY },
);

photoProcessingWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Photo processing job failed permanently');
});
