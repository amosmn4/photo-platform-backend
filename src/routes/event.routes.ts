import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { UploadController } from '../controllers/upload.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadSingleImage } from '../middleware/upload.middleware';
import {
  createEventSchema,
  updateEventSchema,
  createSessionSchema,
  issueTokenSchema,
  startBatchSchema,
  confirmUploadSchema,
} from '../validators/event.validator';

const router = Router();

router.use(requireAuth);

router.post('/', validate({ body: createEventSchema }), EventController.create);
router.get('/', EventController.list);
router.get('/:eventId', EventController.get);
router.patch('/:eventId', validate({ body: updateEventSchema }), EventController.update);
router.post('/:eventId/publish', EventController.publish);
router.post('/:eventId/cover', uploadSingleImage, EventController.uploadCover);
router.get('/:eventId/processing-summary', EventController.processingSummary);

router.post('/:eventId/sessions', validate({ body: createSessionSchema }), EventController.addSession);
router.get('/:eventId/sessions', EventController.listSessions);

router.post('/:eventId/access-tokens', validate({ body: issueTokenSchema }), EventController.issueToken);
router.get('/:eventId/access-tokens', EventController.listTokens);
router.delete('/:eventId/access-tokens/:tokenId', EventController.revokeToken);
router.delete('/:eventId/access-tokens/:tokenId/purge', EventController.deleteToken);

router.post('/:eventId/uploads/start', validate({ body: startBatchSchema }), UploadController.start);
router.post('/:eventId/uploads/confirm', validate({ body: confirmUploadSchema }), UploadController.confirm);

router.get('/:eventId/photos', EventController.listPhotos);
router.get('/:eventId/photos/:photoId/download', EventController.getPhotoDownloadUrl);
router.delete('/:eventId/photos/:photoId', EventController.deletePhoto);

export default router;
