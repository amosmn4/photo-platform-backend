import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';

// Public, unauthenticated — header/footer render on pages with no session or access token.
const router = Router();
router.get('/', SettingsController.get);

export default router;
