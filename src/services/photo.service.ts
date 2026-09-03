import { EventModel } from '../models/Event';
import { PhotoModel } from '../models/Photo';
import { UploadBatchModel } from '../models/UploadBatch';
import { UserModel } from '../models/User';
import { buildStorageKey, getPresignedUploadUrl, getPresignedDownloadUrl } from './storage.service';
import { enqueuePhotoProcessing } from '../queue/producers/photo.producer';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { Photo } from '../types';
import { decodeCursor, encodeCursor, PhotoCursor } from '../utils/pagination';

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/tiff': 'tiff',
  };
  return map[mime] ?? 'jpg';
}

export const PhotoService = {
  // Client requests presigned PUT URLs and uploads directly; the server never receives file bytes.
  async startBatch(input: {
    eventId: string;
    photographerId: string;
    files: { filename: string; mimeType: string; sizeBytes: number }[];
  }) {
    const event = await EventModel.findById(input.eventId);
    if (!event || event.photographer_id !== input.photographerId) {
      throw ApiError.notFound('Event not found');
    }

    if (input.files.length === 0) {
      throw ApiError.badRequest('No files provided');
    }

    if (input.files.length > env.MAX_UPLOAD_BATCH_SIZE) {
      throw ApiError.badRequest(
        `A single batch is limited to ${env.MAX_UPLOAD_BATCH_SIZE} files`,
      );
    }

    const usage = await UserModel.getStorageUsage(input.photographerId);
    const incomingBytes = input.files.reduce(
      (sum, f) => sum + f.sizeBytes,
      0,
    );

    if (
      usage &&
      BigInt(usage.used) + BigInt(incomingBytes) > BigInt(usage.quota)
    ) {
      throw ApiError.forbidden('This upload would exceed your storage quota');
    }

    for (const f of input.files) {
      if (f.sizeBytes > env.MAX_UPLOAD_FILE_SIZE_BYTES) {
        throw ApiError.badRequest(
          `${f.filename} exceeds the maximum file size`,
        );
      }
    }

    const batch = await UploadBatchModel.create({
      eventId: input.eventId,
      createdBy: input.photographerId,
      totalFiles: input.files.length,
    });

    const uploads = await Promise.all(
      input.files.map(async (f) => {
        const key = buildStorageKey(
          input.eventId,
          'original',
          extFromMime(f.mimeType),
        );

        const uploadUrl = await getPresignedUploadUrl(
          key,
          f.mimeType,
        );

        return {
          filename: f.filename,
          storageKey: key,
          uploadUrl,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
        };
      }),
    );

    return {
      batchId: batch.id,
      uploads,
    };
  },

  // Called after a direct-to-storage upload succeeds; creates the photo row and enqueues processing.
  async confirmUpload(input: {
    eventId: string;
    uploadedBy: string;
    batchId: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    sessionId?: string | null;
  }): Promise<Photo | { duplicate: true }> {
    const photo = await PhotoModel.create({
      eventId: input.eventId,
      uploadedBy: input.uploadedBy,
      sessionId: input.sessionId,
      uploadBatchId: input.batchId,
      originalFilename: input.originalFilename,
      storageKeyOriginal: input.storageKey,
      mimeType: input.mimeType,
      fileSizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
    });

    await UploadBatchModel.incrementUploaded(input.batchId);

    if (!photo) {
      await UploadBatchModel.incrementProcessed(input.batchId);
      return { duplicate: true };
    }

    await enqueuePhotoProcessing({ photoId: photo.id });

    return photo;
  },

  async batchStatus(batchId: string) {
    const batch = await UploadBatchModel.findById(batchId);

    if (!batch) {
      throw ApiError.notFound('Upload batch not found');
    }

    return batch;
  },

  // Serializes a photo row for the gallery; S3 is private, so URLs are presigned GETs.
  async toGalleryDto(photo: Photo) {
    const [thumbnailUrl, mediumUrl, largeUrl] = await Promise.all([
      photo.storage_key_thumbnail
        ? getPresignedDownloadUrl(photo.storage_key_thumbnail)
        : Promise.resolve(null),

      photo.storage_key_medium
        ? getPresignedDownloadUrl(photo.storage_key_medium)
        : Promise.resolve(null),

      photo.storage_key_large
        ? getPresignedDownloadUrl(photo.storage_key_large)
        : Promise.resolve(null),
    ]);

    return {
      id: photo.id,
      takenAt: photo.taken_at,
      width: photo.width,
      height: photo.height,
      thumbnailUrl,
      mediumUrl,
      largeUrl,
    };
  },

  async galleryPage(params: {
    eventId: string;
    sessionId?: string | null;
    limit: number;
    cursor?: string;
  }) {
    let cursor: PhotoCursor | null = null;

    if (params.cursor) {
      cursor = decodeCursor(params.cursor);
    }

    const photos = await PhotoModel.listGalleryPage({
      eventId: params.eventId,
      sessionId: params.sessionId,
      limit: params.limit,
      cursor,
    });

    const items = await Promise.all(
      photos.map((p) => this.toGalleryDto(p)),
    );

    const last = photos[photos.length - 1];

    const nextCursor =
      photos.length === params.limit && last
        ? encodeCursor({
            takenAt: last.taken_at,
            id: last.id,
          })
        : null;

    return {
      items,
      nextCursor,
    };
  },

  async findByTimeRange(
    eventId: string,
    fromIso: string,
    toIso: string,
  ) {
    const photos = await PhotoModel.listByTimeRange({
      eventId,
      fromIso,
      toIso,
      limit: 200,
    });

    return Promise.all(
      photos.map((p) => this.toGalleryDto(p)),
    );
  },

  async getDownloadUrl(
    photoId: string,
    variant: 'original' | 'large' | 'medium' = 'original',
  ) {
    const photo = await PhotoModel.findById(photoId);

    if (!photo || photo.processing_status !== 'ready') {
      throw ApiError.notFound('Photo not available');
    }

    const keyMap = {
      original: photo.storage_key_original,
      large: photo.storage_key_large,
      medium: photo.storage_key_medium,
    } as const;

    const key = keyMap[variant];

    if (!key) {
      throw ApiError.notFound('Requested variant not available');
    }

    await PhotoModel.incrementDownloadCount(photoId);

    return getPresignedDownloadUrl(
      key,
      photo.original_filename,
    );
  },

  // Ownership-checked getDownloadUrl variant for the photographer's gallery, not the public token-scoped route.
  async getOwnedDownloadUrl(
    eventId: string,
    photographerId: string,
    photoId: string,
    variant: 'original' | 'large' | 'medium' = 'original',
  ) {
    const event = await EventModel.findById(eventId);

    if (!event || event.photographer_id !== photographerId) {
      throw ApiError.notFound('Event not found');
    }

    const photo = await PhotoModel.findById(photoId);

    if (!photo || photo.event_id !== eventId) {
      throw ApiError.notFound('Photo not found');
    }

    return this.getDownloadUrl(photoId, variant);
  },

  async deleteOwnedPhoto(
    eventId: string,
    photographerId: string,
    photoId: string,
  ): Promise<void> {
    const event = await EventModel.findById(eventId);

    if (!event || event.photographer_id !== photographerId) {
      throw ApiError.notFound('Event not found');
    }

    const photo = await PhotoModel.findById(photoId);

    if (!photo || photo.event_id !== eventId) {
      throw ApiError.notFound('Photo not found');
    }

    await PhotoModel.softDelete(photoId);
  },
};
