import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { PhotoService } from '../services/photo.service';
import { EventService } from '../services/event.service';

export const UploadController = {
  start: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id);
    const result = await PhotoService.startBatch({
      eventId: req.params.eventId,
      photographerId: req.user!.id,
      files: req.body.files,
    });
    res.status(201).json(result);
  }),

  confirm: asyncHandler(async (req: Request, res: Response) => {
    const result = await PhotoService.confirmUpload({
      eventId: req.params.eventId,
      uploadedBy: req.user!.id,
      ...req.body,
    });
    res.status(202).json({ result });
  }),

  status: asyncHandler(async (req: Request, res: Response) => {
    const batch = await PhotoService.batchStatus(req.params.batchId);
    res.json({ batch });
  }),
};
