import sharp from 'sharp';
import exifr from 'exifr';

/**
 * Product doc section 6: never serve originals to the gallery grid. We
 * generate three derived variants per photo, all web-optimized webp.
 */
export const IMAGE_VARIANTS = {
  thumbnail: { width: 320, quality: 70 },  // scroll grid
  medium: { width: 800, quality: 78 },     // tap-to-preview / lightbox default
  large: { width: 1920, quality: 82 },     // full lightbox / pre-download preview
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
    .rotate() // auto-orient using EXIF Orientation, then strip it below
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality });

  const buffer = await pipeline.toBuffer();
  const metadata = await sharp(buffer).metadata();

  return { buffer, width: metadata.width ?? targetWidth, height: metadata.height ?? 0 };
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

/**
 * Product doc section 8-9: EXIF date/time is the primary customer-facing
 * filter ("photos taken between 2-2:30pm"), so this has to be reliable, not
 * an afterthought. exifr handles the many vendor-specific quirks (Canon,
 * Nikon, Sony all encode slightly differently) that hand-rolled parsing
 * tends to miss.
 */
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

    const takenAtDate: Date | undefined = data.DateTimeOriginal ?? data.CreateDate;

    return {
      takenAt: takenAtDate ? takenAtDate.toISOString() : null,
      cameraMake: data.Make ?? null,
      cameraModel: data.Model ?? null,
      lensModel: data.LensModel ?? null,
      gpsLatitude: typeof data.latitude === 'number' ? data.latitude : null,
      gpsLongitude: typeof data.longitude === 'number' ? data.longitude : null,
      orientation: typeof data.Orientation === 'number' ? data.Orientation : null,
      raw: data,
    };
  } catch {
    // Corrupt/partial EXIF should never fail the whole upload pipeline —
    // fall back to upload time as taken_at (handled by caller).
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
