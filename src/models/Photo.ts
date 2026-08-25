import { query } from '../db/pool';
import { Photo, PhotoProcessingStatus } from '../types';
import { PhotoCursor } from '../utils/pagination';

export interface CreatePhotoInput {
  eventId: string;
  uploadedBy: string;
  sessionId?: string | null;
  uploadBatchId?: string | null;
  originalFilename: string;
  storageKeyOriginal: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
}

export const PhotoModel = {
  async create(input: CreatePhotoInput): Promise<Photo> {
    const { rows } = await query<Photo>(
      `INSERT INTO photos
         (event_id, uploaded_by, session_id, upload_batch_id, original_filename,
          storage_key_original, mime_type, file_size_bytes, checksum_sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (event_id, checksum_sha256) DO NOTHING
       RETURNING *`,
      [
        input.eventId,
        input.uploadedBy,
        input.sessionId ?? null,
        input.uploadBatchId ?? null,
        input.originalFilename,
        input.storageKeyOriginal,
        input.mimeType,
        input.fileSizeBytes,
        input.checksumSha256,
      ],
    );
    return rows[0]; // undefined on duplicate — caller decides how to treat that
  },

  async findById(id: string): Promise<Photo | null> {
    const { rows } = await query<Photo>(`SELECT * FROM photos WHERE id = $1 AND deleted_at IS NULL`, [id]);
    return rows[0] ?? null;
  },

  async markProcessing(id: string): Promise<void> {
    await query(`UPDATE photos SET processing_status = 'processing' WHERE id = $1`, [id]);
  },

  async markReady(
    id: string,
    fields: {
      storageKeyThumbnail: string;
      storageKeyMedium: string;
      storageKeyLarge: string;
      width: number;
      height: number;
      takenAt: string | null;
      cameraMake: string | null;
      cameraModel: string | null;
      lensModel: string | null;
      gpsLatitude: number | null;
      gpsLongitude: number | null;
      orientation: number | null;
      exifRaw: Record<string, unknown>;
    },
  ): Promise<void> {
    await query(
      `UPDATE photos SET
         processing_status = 'ready',
         processing_error = NULL,
         storage_key_thumbnail = $2,
         storage_key_medium = $3,
         storage_key_large = $4,
         width = $5,
         height = $6,
         taken_at = $7,
         camera_make = $8,
         camera_model = $9,
         lens_model = $10,
         gps_latitude = $11,
         gps_longitude = $12,
         orientation = $13,
         exif_raw = $14
       WHERE id = $1`,
      [
        id,
        fields.storageKeyThumbnail,
        fields.storageKeyMedium,
        fields.storageKeyLarge,
        fields.width,
        fields.height,
        fields.takenAt,
        fields.cameraMake,
        fields.cameraModel,
        fields.lensModel,
        fields.gpsLatitude,
        fields.gpsLongitude,
        fields.orientation,
        JSON.stringify(fields.exifRaw),
      ],
    );
  },

  async markFailed(id: string, error: string): Promise<void> {
    await query(`UPDATE photos SET processing_status = 'failed', processing_error = $2 WHERE id = $1`, [
      id,
      error,
    ]);
  },

  /**
   * The gallery feed. Keyset-paginated on (taken_at, id) — see
   * utils/pagination.ts for why. Served entirely by idx_photos_gallery_page.
   *
   * NULLS handling: photos without EXIF taken_at (edited screenshots, some
   * export pipelines) sort last, ordered by id, so they don't silently
   * vanish from pagination.
   */
  async listGalleryPage(params: {
    eventId: string;
    sessionId?: string | null;
    limit: number;
    cursor?: PhotoCursor | null;
  }): Promise<Photo[]> {
    const { eventId, sessionId, limit, cursor } = params;
    const conditions = [`event_id = $1`, `deleted_at IS NULL`, `is_hidden = false`, `processing_status = 'ready'`];
    const values: unknown[] = [eventId];

    if (sessionId) {
      values.push(sessionId);
      conditions.push(`session_id = $${values.length}`);
    }

    if (cursor) {
      // Keyset predicate for DESC ordering on (taken_at NULLS LAST, id DESC):
      // "rows strictly after the cursor row in that ordering."
      values.push(cursor.takenAt, cursor.id);
      const takenAtIdx = values.length - 1;
      const idIdx = values.length;
      conditions.push(`(
        (taken_at IS NOT NULL AND $${takenAtIdx}::timestamptz IS NOT NULL AND
          (taken_at < $${takenAtIdx}::timestamptz OR (taken_at = $${takenAtIdx}::timestamptz AND id < $${idIdx})))
        OR (taken_at IS NULL AND $${takenAtIdx}::timestamptz IS NULL AND id < $${idIdx})
        OR (taken_at IS NULL AND $${takenAtIdx}::timestamptz IS NOT NULL)
      )`);
    }

    values.push(limit);

    const { rows } = await query<Photo>(
      `SELECT * FROM photos
        WHERE ${conditions.join(' AND ')}
        ORDER BY taken_at DESC NULLS LAST, id DESC
        LIMIT $${values.length}`,
      values,
    );
    return rows;
  },

  /** "Find my photos" by a customer-provided time window (product doc option A). */
  async listByTimeRange(params: {
    eventId: string;
    fromIso: string;
    toIso: string;
    limit: number;
  }): Promise<Photo[]> {
    const { rows } = await query<Photo>(
      `SELECT * FROM photos
        WHERE event_id = $1 AND deleted_at IS NULL AND is_hidden = false
          AND processing_status = 'ready'
          AND taken_at BETWEEN $2 AND $3
        ORDER BY taken_at ASC
        LIMIT $4`,
      [params.eventId, params.fromIso, params.toIso, params.limit],
    );
    return rows;
  },

  async listStuckProcessing(olderThanMinutes = 30, limit = 200): Promise<Photo[]> {
    const { rows } = await query<Photo>(
      `SELECT * FROM photos
        WHERE processing_status IN ('uploaded', 'processing')
          AND created_at < now() - ($1 || ' minutes')::interval
        ORDER BY created_at ASC
        LIMIT $2`,
      [olderThanMinutes, limit],
    );
    return rows;
  },

  async countByStatus(eventId: string): Promise<Record<PhotoProcessingStatus, number>> {
    const { rows } = await query<{ processing_status: PhotoProcessingStatus; count: string }>(
      `SELECT processing_status, COUNT(*)::text AS count
         FROM photos WHERE event_id = $1 AND deleted_at IS NULL
        GROUP BY processing_status`,
      [eventId],
    );
    const out: Record<string, number> = { uploaded: 0, processing: 0, ready: 0, failed: 0 };
    for (const row of rows) out[row.processing_status] = Number(row.count);
    return out as Record<PhotoProcessingStatus, number>;
  },

  async incrementDownloadCount(id: string): Promise<void> {
    await query(`UPDATE photos SET download_count = download_count + 1 WHERE id = $1`, [id]);
  },

  async softDelete(id: string): Promise<void> {
    await query(`UPDATE photos SET deleted_at = now() WHERE id = $1`, [id]);
  },
};
