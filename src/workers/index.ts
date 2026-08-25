import './thumbnail.worker';
import { logger } from '../config/logger';

logger.info('Photo processing worker started');

process.on('SIGTERM', () => {
  logger.info('Worker received SIGTERM, shutting down');
  process.exit(0);
});
