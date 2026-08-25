import { ApiError } from './ApiError';

/**
 * Why keyset (cursor) pagination instead of OFFSET/LIMIT:
 *
 * An event can have 20,000+ photos. `OFFSET 19000 LIMIT 50` still has to
 * scan and discard the first 19,000 rows on every request — it gets slower
 * page by page. It's also unstable: if new photos are inserted while
 * someone is paging through the gallery, rows shift and they see
 * duplicates/skips.
 *
 * Keyset pagination instead says "give me the next 50 rows after
 * (taken_at, id) = (X, Y)", which the composite index
 * idx_photos_gallery_page (event_id, taken_at DESC, id DESC) answers in
 * O(log n) regardless of how deep into the gallery you are.
 *
 * The cursor is an opaque, base64-encoded token so the client never has to
 * know or construct it — it just round-trips whatever `nextCursor` the
 * previous response gave it.
 */

export interface PhotoCursor {
  takenAt: string | null; // ISO timestamp, or null if the photo has no EXIF date
  id: string;
}

export function encodeCursor(cursor: PhotoCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url');
}

export function decodeCursor(raw: string): PhotoCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    if (typeof parsed.id !== 'string') throw new Error('bad cursor');
    return { takenAt: parsed.takenAt ?? null, id: parsed.id };
  } catch {
    throw ApiError.badRequest('Invalid pagination cursor');
  }
}

export function parseLimit(raw: unknown, { def = 50, max = 100 } = {}): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}
