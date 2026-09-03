import { query } from '../db/pool';
import { UploadBatch } from '../types';

export const UploadBatchModel = {
  async create(input: { eventId: string; createdBy: string; totalFiles: number }): Promise<UploadBatch> {
    const { rows } = await query<UploadBatch>(
      `INSERT INTO upload_batches (event_id, created_by, total_files)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.eventId, input.createdBy, input.totalFiles],
    );
    return rows[0];
  },

  async findById(id: string): Promise<UploadBatch | null> {
    const { rows } = await query<UploadBatch>(`SELECT * FROM upload_batches WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async incrementUploaded(id: string): Promise<void> {
    await query(`UPDATE upload_batches SET uploaded_files = uploaded_files + 1 WHERE id = $1`, [id]);
  },

  async incrementProcessed(id: string, failed = false): Promise<void> {
    if (failed) {
      await query(`UPDATE upload_batches SET failed_files = failed_files + 1 WHERE id = $1`, [id]);
    } else {
      await query(`UPDATE upload_batches SET processed_files = processed_files + 1 WHERE id = $1`, [id]);
    }
    await query(
      `UPDATE upload_batches
          SET status = CASE WHEN failed_files > 0 THEN 'completed_with_errors' ELSE 'completed' END::upload_batch_status,
              completed_at = now()
        WHERE id = $1 AND (processed_files + failed_files) >= total_files AND completed_at IS NULL`,
      [id],
    );
  },
};
