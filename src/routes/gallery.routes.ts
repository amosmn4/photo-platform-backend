import { Router } from 'express';
import { GalleryController } from '../controllers/gallery.controller';
import { DownloadController } from '../controllers/download.controller';
import { requireAccessToken } from '../middleware/accessToken.middleware';
import { publicGalleryLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import { galleryQuerySchema, findByTimeSchema } from '../validators/event.validator';

const router = Router();

// Mounted at /api/g/:token — this whole subtree is what a scanned QR hits.
router.use('/:token', publicGalleryLimiter, requireAccessToken);

router.get('/:token', GalleryController.getEvent);
router.get('/:token/sessions', GalleryController.listSessions);
router.get('/:token/photos', validate({ query: galleryQuerySchema }), GalleryController.browse);
router.get('/:token/find-by-time', validate({ query: findByTimeSchema }), GalleryController.findByTime);
router.get('/:token/photos/:photoId/download', DownloadController.download);

export default router;
