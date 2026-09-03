import crypto from 'crypto';
import { SiteSettingsModel, UpdateSiteSettingsInput } from '../models/SiteSettings';
import { generateBrandingImage } from './image.service';
import { putObjectBuffer, deleteObject, getPublicUrl } from './storage.service';
import { SiteSettings } from '../types';

const LOGO_MAX_WIDTH = 480;

// The logo renders on public, unauthenticated pages and needs a stable long-lived
// URL, unlike per-photo presigned GETs — so it uses the public bucket path, not a signed one.
function toPublicSettings(settings: SiteSettings) {
  return {
    logoUrl: settings.logo_key ? getPublicUrl(settings.logo_key) : null,
    tagline: settings.tagline,
    contactEmail: settings.contact_email,
    contactPhone: settings.contact_phone,
    contactAddress: settings.contact_address,
    socialLinks: settings.social_links,
  };
}

export const SiteSettingsService = {
  async get() {
    return toPublicSettings(await SiteSettingsModel.get());
  },

  async update(input: UpdateSiteSettingsInput) {
    return toPublicSettings(await SiteSettingsModel.update(input));
  },

  async uploadLogo(buffer: Buffer) {
    const current = await SiteSettingsModel.get();
    const { buffer: resized } = await generateBrandingImage(buffer, LOGO_MAX_WIDTH);
    const key = `site/logo-${crypto.randomBytes(8).toString('hex')}.webp`;

    await putObjectBuffer(key, resized, 'image/webp');
    const updated = await SiteSettingsModel.setLogoKey(key);

    if (current.logo_key) {
      await deleteObject(current.logo_key).catch(() => {}); // best-effort cleanup of the old logo
    }

    return toPublicSettings(updated);
  },
};
