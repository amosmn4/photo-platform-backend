import IORedis from 'ioredis';
import { env } from './env';

// BullMQ requires this exact option — connections used for queues must not
// time out blocking commands.
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection error:', err.message);
});
