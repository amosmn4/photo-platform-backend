# API.md — PhotoDrop Backend API Reference

Base URL: `{APP_URL}/api`

Two audiences, two auth mechanisms:

- **Photographer routes** (`/auth`, `/events/*`, `/uploads/*`) — JWT bearer
  token, obtained via `/auth/login`.
- **Public gallery routes** (`/g/:token/*`) — no login. `:token` is the raw
  value encoded in the QR code. Every response is scoped to that token's
  single event; a token can never see or affect another event.

All error responses share this shape:
```json
{ "error": { "message": "...", "details": { } } }
```

---

## Auth

### `POST /auth/register`
Create a photographer account.
```json
// body
{ "email": "jane@studio.com", "password": "min8chars", "fullName": "Jane Doe", "businessName": "Jane Doe Photography" }
```
`201` → `{ "user": { ...publicUser } }`

### `POST /auth/login`
```json
{ "email": "jane@studio.com", "password": "..." }
```
`200` → `{ "user": {...}, "accessToken": "jwt..." }`. Also sets an
httpOnly `refreshToken` cookie (30 days).

### `POST /auth/refresh`
Rotates the refresh token (cookie, or `{ "refreshToken": "..." }` in body as
a fallback for non-browser clients) and returns a new access token.

### `POST /auth/logout`
Revokes the current refresh token. `204`.

---

## Events (JWT required — `Authorization: Bearer <accessToken>`)

### `POST /events`
Creates an event **and** a default access token/QR in one call.
```json
{ "name": "Beach Photos - 22 Aug 2026", "eventDate": "2026-08-22", "visibility": "find_my_photos" }
```
`201` →
```json
{
  "event": { "id": "...", "slug": "beach-photos-22-aug-2026", ... },
  "defaultAccess": {
    "token": { "id": "...", "expires_at": "..." },
    "rawToken": "opaque-value-shown-only-once",
    "qrDataUrl": "data:image/png;base64,...",
    "galleryUrl": "http://localhost:5173/g/opaque-value-shown-only-once"
  }
}
```
> `rawToken` / `qrDataUrl` are returned **once**, at creation. Save the QR
> image then — it cannot be regenerated from the DB (only its hash is
> stored). Issue a new token via `/events/:eventId/access-tokens` if needed.

### `GET /events?page=1&pageSize=20`
List the logged-in photographer's events.

### `GET /events/:eventId`
### `PATCH /events/:eventId`
### `POST /events/:eventId/publish`
### `GET /events/:eventId/processing-summary`
→ `{ "summary": { "uploaded": 12, "processing": 4, "ready": 4984, "failed": 0 } }` —
powers the upload progress bar.

### Sessions
- `POST /events/:eventId/sessions` — `{ "name": "Morning Session", "startsAt": "...", "endsAt": "..." }`
- `GET /events/:eventId/sessions`

### Access tokens (QR management)
- `POST /events/:eventId/access-tokens` — issue an additional QR
  ```json
  { "label": "Afternoon session QR", "scope": "session_only", "sessionId": "...", "ttlDays": 7, "maxUses": null }
  ```
  `ttlDays: null` = never expires (still revocable). Response shape matches
  `defaultAccess` above.
- `GET /events/:eventId/access-tokens` — list all tokens for an event, with
  `use_count`, `last_used_at`, `status` (never the raw token — only ever
  returned at issuance).
- `DELETE /events/:eventId/access-tokens/:tokenId` — revoke immediately.
  Body optional: `{ "reason": "..." }`.

### Bulk upload
- `POST /events/:eventId/uploads/start`
  ```json
  { "files": [{ "filename": "IMG_0001.jpg", "mimeType": "image/jpeg", "sizeBytes": 8345213 }, ...] }
  ```
  → `{ "batchId": "...", "uploads": [{ "filename", "storageKey", "uploadUrl" }, ...] }`.
  Client `PUT`s each file's bytes directly to its `uploadUrl` (presigned S3
  URL) — the API server never sees the image bytes.

- `POST /events/:eventId/uploads/confirm` — called once per file after its
  direct PUT succeeds.
  ```json
  {
    "batchId": "...", "storageKey": "events/.../original/xyz.jpg",
    "originalFilename": "IMG_0001.jpg", "mimeType": "image/jpeg",
    "sizeBytes": 8345213, "checksumSha256": "<sha256 of the file, client-computed>"
  }
  ```
  `202` — the photo row is created (`processing_status: 'uploaded'`) and a
  background job is queued for thumbnailing/EXIF. Re-confirming the same
  checksum for the same event is a safe no-op (idempotent retries).

### `GET /events/:eventId/photos?cursor=&limit=60&sessionId=`
Photographer's own management gallery — keyset-paginated, see "Pagination"
below.

### `GET /uploads/:batchId/status`
Poll target for the "3,421 / 5,000 uploaded" progress UI.
→ `{ "batch": { "total_files", "uploaded_files", "processed_files", "failed_files", "status" } }`

---

## Public gallery (no login — `:token` from the QR code)

All routes below require the token to be valid (not expired/revoked). On
failure: `404` (unknown token) or `403` (expired/revoked), with a
customer-friendly message.

### `GET /g/:token`
→ event summary: `{ "event": { "id", "name", "description", "eventDate", "photoCount", "photosAvailableUntil", "visibility" } }`

### `GET /g/:token/sessions`
List photographer-defined sessions (for session-based browsing).

### `GET /g/:token/photos?cursor=&limit=50&sessionId=`
The gallery feed. **Pagination is cursor-based, not page-number-based** —
see below. Response:
```json
{ "items": [{ "id", "takenAt", "width", "height", "thumbnailUrl", "mediumUrl", "largeUrl" }], "nextCursor": "opaque-or-null" }
```
Frontend: fetch with no `cursor` for page 1, then keep passing back the
previous response's `nextCursor` (an `IntersectionObserver` on the last grid
item triggers the next fetch — infinite scroll). `nextCursor: null` means
end of gallery.

### `GET /g/:token/find-by-time?from=ISO&to=ISO`
"I was photographed around 2pm" — product doc Option A. Returns up to 200
matching photos, ascending by capture time.

### `GET /g/:token/photos/:photoId/download?variant=original|large|medium`
→ `{ "url": "https://.../signed-url" }` — a short-lived (15 min default)
signed download URL. The frontend redirects/opens this directly; the API
server is not in the download's data path.

---

## Pagination — why cursor-based

Galleries can hold 20,000+ photos. `OFFSET`-based pagination degrades
linearly with depth and is unstable under concurrent inserts. Every list
endpoint above instead returns an opaque `nextCursor`; treat it as a black
box, always round-trip whatever the server gave you. See
`backend/src/utils/pagination.ts` for the implementation notes.

---

## Rate limits

- General API: 300 req / 15 min / IP.
- `/auth/login`, `/auth/register`: 20 req / 15 min / IP.
- `/g/:token/*`: 120 req / 5 min / IP — generous for normal browsing, tight
  enough to slow down scraping a leaked token.

## Image variants

Every ready photo has three derived variants, all `webp`:

| Variant | Width | Used for |
|---|---|---|
| `thumbnailUrl` | 320px | Grid / scroll view (lazy-loaded) |
| `mediumUrl` | 800px | Tap-to-preview / lightbox default |
| `largeUrl` | 1920px | Full lightbox zoom |

Downloads always serve the **original**, untouched file via
`/g/:token/photos/:photoId/download?variant=original`.
