import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { EventService } from '../services/event.service';
import { EventModel } from '../models/Event';
import { TokenService } from '../services/token.service';
import { PhotoService } from '../services/photo.service';
import { parseLimit } from '../utils/pagination';

export const EventController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const result = await EventService.create({ photographerId: req.user!.id, ...req.body });
    res.status(201).json(result);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
    const result = await EventService.listForPhotographer(req.user!.id, page, pageSize);
    res.json(result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const event = await EventService.getOwned(req.params.eventId, req.user!.id);
    res.json({ event });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id); // ownership check
    const event = await EventModel.update(req.params.eventId, req.body);
    res.json({ event });
  }),

  processingSummary: asyncHandler(async (req: Request, res: Response) => {
    const summary = await EventService.processingSummary(req.params.eventId, req.user!.id);
    res.json({ summary });
  }),

  publish: asyncHandler(async (req: Request, res: Response) => {
    await EventService.publish(req.params.eventId, req.user!.id);
    res.status(204).send();
  }),

  addSession: asyncHandler(async (req: Request, res: Response) => {
    const session = await EventService.addSession(req.params.eventId, req.user!.id, req.body);
    res.status(201).json({ session });
  }),

  listSessions: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id); // ownership check
    const sessions = await EventService.listSessions(req.params.eventId);
    res.json({ sessions });
  }),

  issueToken: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id); // ownership check
    const result = await TokenService.issue({
      eventId: req.params.eventId,
      createdBy: req.user!.id,
      ...req.body,
    });
    res.status(201).json(result);
  }),

  listTokens: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id);
    const tokens = await TokenService.listForEvent(req.params.eventId);
    res.json({ tokens });
  }),

  revokeToken: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id);
    await TokenService.revoke(req.params.eventId, req.params.tokenId, req.body?.reason);
    res.status(204).send();
  }),

  // Photographer's own dashboard gallery — same keyset pagination as the
  // public one, ownership-gated. Frontend uses this for the "manage
  // photos" grid (with lazy-loaded thumbnails and infinite scroll).
  listPhotos: asyncHandler(async (req: Request, res: Response) => {
    await EventService.getOwned(req.params.eventId, req.user!.id);
    const limit = parseLimit(req.query.limit, { def: 60, max: 150 });
    const page = await PhotoService.galleryPage({
      eventId: req.params.eventId,
      sessionId: (req.query.sessionId as string) || null,
      limit,
      cursor: req.query.cursor as string | undefined,
    });
    res.json(page);
  }),
};
