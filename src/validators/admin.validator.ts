import { z } from 'zod';

export const updateSiteSettingsSchema = z.object({
  tagline: z.string().max(300).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  contactAddress: z.string().max(300).nullable().optional(),
  socialLinks: z.record(z.string().url()).optional(),
});
