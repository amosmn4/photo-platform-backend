import { photoProcessingQueue } from '../queues';

export interface PhotoProcessingJobData {
  photoId: string;
}

export async function enqueuePhotoProcessing(data: PhotoProcessingJobData): Promise<void> {
  await photoProcessingQueue.add('process-photo', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
  });
}
