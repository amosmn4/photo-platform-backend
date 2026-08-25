import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { PhotoService } from '../services/photo.service';
import { EventService } from '../services/event.service';

export const UploadController = {
  // POST /api/events/:eventId/uploads/start
  // Body: { files: [{ filename, mimeType, sizeBytes }, ...] }
  // -> { batchId, uploads: [{ filename, storageKey, uploadUrl }, ...] }
  // Client PUTs each file directly to `uploadUrl`, then calls /confirm.
  start: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id); // ownership check
    const result = await PhotoService.startBatch({
      eventId: req.params.eventId,
      photographerId: req.user!.id,
      files: req.body.files,
    });
    res.status(201).json(result);
  }),

  // POST /api/events/:eventId/uploads/confirm
  // Called once per file, right after its direct-to-storage PUT succeeds.
  confirm: asyncHandler(async (req: Request, res: Response) => {
    const result = await PhotoService.confirmUpload({
      eventId: req.params.eventId,
      uploadedBy: req.user!.id,
      ...req.body,
    });
    res.status(202).json({ result });
  }),

  // GET /api/uploads/:batchId/status — polled by the dashboard progress bar
  // (product doc section 7's "3,421 / 5,000 uploaded" UI).
  status: asyncHandler(async (req: Request, res: Response) => {
    const batch = await PhotoService.batchStatus(req.params.batchId);
    res.json({ batch });
  }),
};
