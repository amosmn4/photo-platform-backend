export type UserRole = 'photographer' | 'admin' | 'staff';
export type UserStatus = 'active' | 'suspended' | 'pending_verification';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  business_name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  storage_used_bytes: string; // BIGINT comes back as string from `pg`
  storage_quota_bytes: string;
  email_verified_at: string | null;
  email_verification_code_hash: string | null;
  email_verification_expires_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PublicUser = Omit<User, 'password_hash' | 'email_verification_code_hash' | 'email_verification_expires_at'>;

export type EventStatus = 'draft' | 'processing' | 'published' | 'archived';
export type GalleryVisibility = 'public' | 'private_by_token' | 'find_my_photos';

export interface Event {
  id: string;
  photographer_id: string;
  name: string;
  slug: string;
  description: string | null;
  event_date: string | null;
  photos_available_from: string | null;
  photos_available_until: string | null;
  visibility: GalleryVisibility;
  status: EventStatus;
  cover_photo_id: string | null;
  photo_count: number;
  total_size_bytes: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PhotoSession {
  id: string;
  event_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
}

export type PhotoProcessingStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface Photo {
  id: string;
  event_id: string;
  session_id: string | null;
  uploaded_by: string;
  original_filename: string;
  storage_key_original: string;
  storage_key_large: string | null;
  storage_key_medium: string | null;
  storage_key_thumbnail: string | null;
  mime_type: string;
  file_size_bytes: string;
  width: number | null;
  height: number | null;
  checksum_sha256: string | null;
  taken_at: string | null;
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  orientation: number | null;
  exif_raw: Record<string, unknown> | null;
  processing_status: PhotoProcessingStatus;
  processing_error: string | null;
  face_processed_at: string | null;
  is_hidden: boolean;
  download_count: number;
  upload_batch_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type AccessTokenStatus = 'active' | 'revoked' | 'expired';
export type AccessTokenScope = 'full_gallery' | 'session_only' | 'find_my_photos';

export interface AccessToken {
  id: string;
  event_id: string;
  session_id: string | null;
  token_hash: string;
  label: string | null;
  scope: AccessTokenScope;
  status: AccessTokenStatus;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_by: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  last_used_at: string | null;
  created_at: string;
}

export type UploadBatchStatus = 'uploading' | 'processing' | 'completed' | 'completed_with_errors';

export interface UploadBatch {
  id: string;
  event_id: string;
  created_by: string;
  status: UploadBatchStatus;
  total_files: number;
  uploaded_files: number;
  processed_files: number;
  failed_files: number;
  created_at: string;
  completed_at: string | null;
}

export interface JwtAccessPayload {
  sub: string; // user id
  role: UserRole;
}

export interface AuthenticatedRequestUser {
  id: string;
  role: UserRole;
}

// Extends Express's Request type with the authenticated user (set by
// auth.middleware.ts) and the resolved access token (set by
// accessToken.middleware.ts on public gallery routes).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedRequestUser;
      accessToken?: AccessToken;
    }
  }
}
