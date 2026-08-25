import { Router } from 'express';
import authRoutes from './auth.routes';
import eventRoutes from './event.routes';
import galleryRoutes from './gallery.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/events', eventRoutes);       // photographer-facing, JWT-protected
router.use('/g', galleryRoutes);          // public, QR-token-gated
router.use('/uploads', uploadRoutes);     // batch status polling

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

export default router;
