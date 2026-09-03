import { Router } from 'express';
import authRoutes from './auth.routes';
import eventRoutes from './event.routes';
import galleryRoutes from './gallery.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/g', galleryRoutes);
router.use('/uploads', uploadRoutes);

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

export default router;
