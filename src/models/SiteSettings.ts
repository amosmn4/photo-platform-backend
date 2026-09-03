import { query } from '../db/pool';
import { SiteSettings } from '../types';

export interface UpdateSiteSettingsInput {
  tagline?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  socialLinks?: Record<string, string>;
}

export const SiteSettingsModel = {
  async get(): Promise<SiteSettings> {
    const { rows } = await query<SiteSettings>(`SELECT * FROM site_settings WHERE id = 1`);
    return rows[0];
  },

  // Only keys actually present in input are updated — unlike COALESCE, this lets a field be cleared to null on purpose.
  async update(input: UpdateSiteSettingsInput): Promise<SiteSettings> {
    const fields: Record<string, unknown> = {};
    if (input.tagline !== undefined) fields.tagline = input.tagline;
    if (input.contactEmail !== undefined) fields.contact_email = input.contactEmail;
    if (input.contactPhone !== undefined) fields.contact_phone = input.contactPhone;
    if (input.contactAddress !== undefined) fields.contact_address = input.contactAddress;
    if (input.socialLinks !== undefined) fields.social_links = JSON.stringify(input.socialLinks);

    const keys = Object.keys(fields);
    if (keys.length === 0) return this.get();

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map((k) => fields[k]);

    const { rows } = await query<SiteSettings>(
      `UPDATE site_settings SET ${setClauses}, updated_at = now() WHERE id = 1 RETURNING *`,
      values,
    );
    return rows[0];
  },

  async setLogoKey(logoKey: string | null): Promise<SiteSettings> {
    const { rows } = await query<SiteSettings>(
      `UPDATE site_settings SET logo_key = $1, updated_at = now() WHERE id = 1 RETURNING *`,
      [logoKey],
    );
    return rows[0];
  },
};
