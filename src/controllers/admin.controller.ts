import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AdminService } from '../services/admin.service';
import { SiteSettingsService } from '../services/siteSettings.service';
import { ApiError } from '../utils/ApiError';

export const AdminController = {
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
    const result = await AdminService.listUsers(page, pageSize);
    res.json(result);
  }),

  suspendUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await AdminService.suspendUser(req.params.userId);
    res.json({ user });
  }),

  reactivateUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await AdminService.reactivateUser(req.params.userId);
    res.json({ user });
  }),

  deleteUser: asyncHandler(async (req: Request, res: Response) => {
    await AdminService.deleteUser(req.params.userId);
    res.status(204).send();
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await SiteSettingsService.update(req.body);
    res.json({ settings });
  }),

  uploadLogo: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No image provided');
    const settings = await SiteSettingsService.uploadLogo(req.file.buffer);
    res.json({ settings });
  }),
};
