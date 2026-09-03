import sharp from 'sharp';
import exifr from 'exifr';
import { logger } from '../config/logger';

// Never serves originals to the gallery grid — generates three web-optimized webp variants per photo.
export const IMAGE_VARIANTS = {
  thumbnail: { width: 320, quality: 70 },
  medium: { width: 800, quality: 78 },
  large: { width: 1920, quality: 82 },
} as const;

export interface GeneratedVariant {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function generateVariant(
  originalBuffer: Buffer,
  variant: keyof typeof IMAGE_VARIANTS,
): Promise<GeneratedVariant> {
  const { width: targetWidth, quality } = IMAGE_VARIANTS[variant];

  const pipeline = sharp(originalBuffer)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality });

  const buffer = await pipeline.toBuffer();
  const metadata = await sharp(buffer).metadata();

  return { buffer, width: metadata.width ?? targetWidth, height: metadata.height ?? 0 };
}

// For single admin/photographer-uploaded images (logo, event cover) — resized, converted to webp.
export async function generateBrandingImage(originalBuffer: Buffer, maxWidth: number): Promise<GeneratedVariant> {
  const pipeline = sharp(originalBuffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 });

  const buffer = await pipeline.toBuffer();
  const metadata = await sharp(buffer).metadata();

  return { buffer, width: metadata.width ?? maxWidth, height: metadata.height ?? 0 };
}

// exifr doesn't guarantee a real Date — malformed EXIF can yield a string or invalid Date.
function normalizeExifDate(value: unknown): string | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export interface ExtractedExif {
  takenAt: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  orientation: number | null;
  raw: Record<string, unknown>;
}

// EXIF taken-at time is the primary customer filter, so extraction must be reliable.
export async function extractExif(originalBuffer: Buffer): Promise<ExtractedExif> {
  try {
    const data = await exifr.parse(originalBuffer, {
      tiff: true,
      exif: true,
      gps: true,
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'Make',
        'Model',
        'LensModel',
        'latitude',
        'longitude',
        'Orientation',
      ],
    });

    if (!data) {
      return {
        takenAt: null,
        cameraMake: null,
        cameraModel: null,
        lensModel: null,
        gpsLatitude: null,
        gpsLongitude: null,
        orientation: null,
        raw: {},
      };
    }

    const takenAt = normalizeExifDate(data.DateTimeOriginal) ?? normalizeExifDate(data.CreateDate);

    return {
      takenAt,
      cameraMake: data.Make ?? null,
      cameraModel: data.Model ?? null,
      lensModel: data.LensModel ?? null,
      gpsLatitude: typeof data.latitude === 'number' ? data.latitude : null,
      gpsLongitude: typeof data.longitude === 'number' ? data.longitude : null,
      orientation: typeof data.Orientation === 'number' ? data.Orientation : null,
      raw: data,
    };
  } catch (err) {
    // TEMP: debugging the worker — remove once EXIF failures stop being a mystery.
    logger.warn({ err }, 'EXIF extraction failed');
    return {
      takenAt: null,
      cameraMake: null,
      cameraModel: null,
      lensModel: null,
      gpsLatitude: null,
      gpsLongitude: null,
      orientation: null,
      raw: {},
    };
  }
}
