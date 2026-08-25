import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);
router.get('/:batchId/status', UploadController.status);

export default router;
