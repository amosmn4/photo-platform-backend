import { ApiError } from './ApiError';

// Uses keyset (cursor) pagination, not OFFSET/LIMIT, since offset scanning slows down and destabilizes at scale.
export interface PhotoCursor {
  takenAt: string | null;
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
