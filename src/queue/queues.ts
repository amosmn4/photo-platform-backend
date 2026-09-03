import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// One queue per job type keeps retry/concurrency policy independent.
export const photoProcessingQueue = new Queue('photo-processing', { connection: redisConnection });
export const photoCleanupQueue = new Queue('photo-cleanup', { connection: redisConnection });

export const QUEUE_NAMES = {
  PHOTO_PROCESSING: 'photo-processing',
  PHOTO_CLEANUP: 'photo-cleanup',
} as const;
