import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

/**
 * One queue per job type keeps retry/concurrency policy independent —
 * thumbnailing is CPU-bound and cheap to retry, while (future) face
 * detection is heavier and should be throttled separately.
 */
export const photoProcessingQueue = new Queue('photo-processing', { connection: redisConnection });

export const QUEUE_NAMES = {
  PHOTO_PROCESSING: 'photo-processing',
} as const;
