import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { PhotoModel } from '../models/Photo';
import { PhotoService } from '../services/photo.service';
import { ApiError } from '../utils/ApiError';

export const DownloadController = {
  download: asyncHandler(async (req: Request, res: Response) => {
    const photo = await PhotoModel.findById(req.params.photoId);
    if (!photo || photo.event_id !== req.accessToken!.event_id) {
      throw ApiError.notFound('Photo not found');
    }

    if (req.accessToken!.scope === 'session_only' && photo.session_id !== req.accessToken!.session_id) {
      throw ApiError.forbidden('This photo is outside your access scope');
    }

    const variant = (req.query.variant as 'original' | 'large' | 'medium') ?? 'original';
    const url = await PhotoService.getDownloadUrl(photo.id, variant);
    res.json({ url });
  }),
};
