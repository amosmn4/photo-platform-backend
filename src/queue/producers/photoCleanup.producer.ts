import { photoCleanupQueue } from '../queues';

// Registers the daily purge job; BullMQ dedupes repeatable jobs, so calling this on every worker boot is safe.
export async function schedulePhotoCleanup(): Promise<void> {
  await photoCleanupQueue.add(
    'purge-deleted-photos',
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      removeOnComplete: { age: 604_800 },
      removeOnFail: { age: 604_800 },
    },
  );
}
