import './thumbnail.worker';
import './photoCleanup.worker';
import { schedulePhotoCleanup } from '../queue/producers/photoCleanup.producer';
import { logger } from '../config/logger';

logger.info('Photo processing worker started');

schedulePhotoCleanup().catch((err) => logger.error({ err }, 'Failed to schedule photo cleanup'));

process.on('SIGTERM', () => {
  logger.info('Worker received SIGTERM, shutting down');
  process.exit(0);
});
