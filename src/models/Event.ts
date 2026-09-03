import { query } from '../db/pool';
import { Event, EventStatus, GalleryVisibility } from '../types';

export const EventModel = {
  async create(input: {
    photographerId: string;
    name: string;
    slug: string;
    description?: string | null;
    eventDate?: string | null;
    visibility?: GalleryVisibility;
    photosAvailableFrom?: string | null;
    photosAvailableUntil?: string | null;
  }): Promise<Event> {
    const { rows } = await query<Event>(
      `INSERT INTO events
         (photographer_id, name, slug, description, event_date, visibility,
          photos_available_from, photos_available_until)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::gallery_visibility, 'find_my_photos'), $7, $8)
       RETURNING *`,
      [
        input.photographerId,
        input.name,
        input.slug,
        input.description ?? null,
        input.eventDate ?? null,
        input.visibility ?? null,
        input.photosAvailableFrom ?? null,
        input.photosAvailableUntil ?? null,
      ],
    );
    return rows[0];
  },

  async findById(id: string): Promise<Event | null> {
    const { rows } = await query<Event>(`SELECT * FROM events WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return rows[0] ?? null;
  },

  async findByPhotographerAndSlug(photographerId: string, slug: string): Promise<Event | null> {
    const { rows } = await query<Event>(
      `SELECT * FROM events WHERE photographer_id = $1 AND slug = $2 AND deleted_at IS NULL`,
      [photographerId, slug],
    );
    return rows[0] ?? null;
  },

  async listForPhotographer(
    photographerId: string,
    { limit, offset }: { limit: number; offset: number },
  ): Promise<{ events: Event[]; total: number }> {
    const [listResult, countResult] = await Promise.all([
      query<Event>(
        `SELECT * FROM events
          WHERE photographer_id = $1 AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3`,
        [photographerId, limit, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM events WHERE photographer_id = $1 AND deleted_at IS NULL`,
        [photographerId],
      ),
    ]);
    return { events: listResult.rows, total: Number(countResult.rows[0].count) };
  },

  async updateStatus(id: string, status: EventStatus): Promise<void> {
    await query(`UPDATE events SET status = $2 WHERE id = $1`, [id, status]);
  },

  async update(
    id: string,
    fields: Partial<
      Pick<
        Event,
        'name' | 'description' | 'event_date' | 'visibility' | 'photos_available_from' | 'photos_available_until'
      >
    >,
  ): Promise<Event | null> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map((k) => (fields as Record<string, unknown>)[k]);

    const { rows } = await query<Event>(
      `UPDATE events SET ${setClauses} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, ...values],
    );
    return rows[0] ?? null;
  },

  async softDelete(id: string): Promise<void> {
    await query(`UPDATE events SET deleted_at = now() WHERE id = $1`, [id]);
  },

  async setCoverImageKey(id: string, coverImageKey: string | null): Promise<Event | null> {
    const { rows } = await query<Event>(
      `UPDATE events SET cover_image_key = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, coverImageKey],
    );
    return rows[0] ?? null;
  },
};
