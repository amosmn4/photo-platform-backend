import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { uploadSingleImage } from '../middleware/upload.middleware';
import { updateSiteSettingsSchema } from '../validators/admin.validator';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/users', AdminController.listUsers);
router.patch('/users/:userId/suspend', AdminController.suspendUser);
router.patch('/users/:userId/reactivate', AdminController.reactivateUser);
router.delete('/users/:userId', AdminController.deleteUser);

router.patch('/settings', validate({ body: updateSiteSettingsSchema }), AdminController.updateSettings);
router.post('/settings/logo', uploadSingleImage, AdminController.uploadLogo);

export default router;
