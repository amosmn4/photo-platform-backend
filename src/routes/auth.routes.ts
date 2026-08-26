import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), AuthController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), AuthController.login);
router.post('/refresh', validate({ body: refreshSchema.partial() }), AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), AuthController.verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validate({ body: resendVerificationSchema }),
  AuthController.resendVerification,
);

export default router;
