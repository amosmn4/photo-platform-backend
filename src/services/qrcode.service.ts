import QRCode from 'qrcode';
import { env } from '../config/env';

/**
 * Turns a raw access token into (a) the public gallery URL it points to and
 * (b) a QR code PNG (base64 data URL) the photographer can print/display.
 * The QR encodes ONLY the URL with the opaque token — never an event id,
 * per the access-token design in 004_access_tokens.sql.
 */
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
