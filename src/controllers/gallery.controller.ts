import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { PhotoService } from '../services/photo.service';
import { EventModel } from '../models/Event';
import { PhotoSessionModel } from '../models/PhotoSession';
import { ApiError } from '../utils/ApiError';
import { parseLimit } from '../utils/pagination';

// Handlers trust req.accessToken for the event id, never req.params or req.query.
export const GalleryController = {
  getEvent: asyncHandler(async (req: Request, res: Response) => {
    const event = await EventModel.findById(req.accessToken!.event_id);
    if (!event) throw ApiError.notFound('Event not found');
    res.json({
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        eventDate: event.event_date,
        photoCount: event.photo_count,
        photosAvailableUntil: event.photos_available_until,
        visibility: event.visibility,
      },
    });
  }),

  listSessions: asyncHandler(async (req: Request, res: Response) => {
    const sessions = await PhotoSessionModel.listForEvent(req.accessToken!.event_id);
    res.json({ sessions });
  }),

  browse: asyncHandler(async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit, { def: 50, max: 100 });
    const page = await PhotoService.galleryPage({
      eventId: req.accessToken!.event_id,
      sessionId: (req.query.sessionId as string) || null,
      limit,
      cursor: req.query.cursor as string | undefined,
    });
    res.json(page);
  }),

  findByTime: asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from: string; to: string };
    const items = await PhotoService.findByTimeRange(req.accessToken!.event_id, from, to);
    res.json({ items });
  }),
};
