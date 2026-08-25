import { query } from '../db/pool';
import { PhotoSession } from '../types';

export const PhotoSessionModel = {
  async create(input: {
    eventId: string;
    name: string;
    startsAt?: string | null;
    endsAt?: string | null;
    sortOrder?: number;
  }): Promise<PhotoSession> {
    const { rows } = await query<PhotoSession>(
      `INSERT INTO photo_sessions (event_id, name, starts_at, ends_at, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0))
       RETURNING *`,
      [input.eventId, input.name, input.startsAt ?? null, input.endsAt ?? null, input.sortOrder ?? null],
    );
    return rows[0];
  },

  async listForEvent(eventId: string): Promise<PhotoSession[]> {
    const { rows } = await query<PhotoSession>(
      `SELECT * FROM photo_sessions WHERE event_id = $1 ORDER BY sort_order, starts_at`,
      [eventId],
    );
    return rows;
  },

  async findById(id: string): Promise<PhotoSession | null> {
    const { rows } = await query<PhotoSession>(`SELECT * FROM photo_sessions WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },
};
