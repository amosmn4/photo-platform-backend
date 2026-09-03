import QRCode from 'qrcode';
import { env } from '../config/env';

// Builds the gallery URL for a token — never encodes the event id, per design.
export function buildGalleryUrl(rawToken: string): string {
  return `${env.PUBLIC_GALLERY_BASE_URL}/${rawToken}`;
}

export async function generateQrDataUrl(rawToken: string): Promise<string> {
  const url = buildGalleryUrl(rawToken);
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 512,
  });
}
