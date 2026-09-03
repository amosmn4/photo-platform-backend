import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { SiteSettingsService } from '../services/siteSettings.service';

export const SettingsController = {
  get: asyncHandler(async (_req: Request, res: Response) => {
    const settings = await SiteSettingsService.get();
    res.json({ settings });
  }),
};
