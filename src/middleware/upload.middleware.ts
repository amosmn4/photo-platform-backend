import multer from 'multer';
import { ApiError } from '../utils/ApiError';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Single small admin/photographer image uploads (logo, event cover) go through the server, unlike bulk photo uploads.
export const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(ApiError.badRequest('Image must be JPEG, PNG, or WebP'));
    }
    cb(null, true);
  },
}).single('image');
