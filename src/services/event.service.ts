import crypto from 'crypto';
import slugify from 'slugify';
import { EventModel } from '../models/Event';
import { PhotoModel } from '../models/Photo';
import { PhotoSessionModel } from '../models/PhotoSession';
import { TokenService } from './token.service';
import { ApiError } from '../utils/ApiError';
import { getPublicUrl, getPresignedDownloadUrl, putObjectBuffer, deleteObject } from './storage.service';
import { generateBrandingImage } from './image.service';
import { Event } from '../types';

const COVER_MAX_WIDTH = 1200;

async function uniqueSlug(photographerId: string, name: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true }).slice(0, 60) || 'event';
  let candidate = base;
  let n = 1;
  while (await EventModel.findByPhotographerAndSlug(photographerId, candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

// Dashboard cards need a stable-enough URL for the duration of a page view; presigned GET matches every other owned-photo URL.
async function withCoverUrl(event: Event) {
  return {
    ...event,
    coverImageUrl: event.cover_image_key ? await getPresignedDownloadUrl(event.cover_image_key) : null,
  };
}

export const EventService = {
  async create(input: {
    photographerId: string;
    name: string;
    description?: string;
    eventDate?: string;
    visibility?: Event['visibility'];
  }) {
    const slug = await uniqueSlug(input.photographerId, input.name);
    const event = await EventModel.create({
      photographerId: input.photographerId,
      name: input.name,
      slug,
      description: input.description ?? null,
      eventDate: input.eventDate ?? null,
      visibility: input.visibility,
    });

    const { rawToken, qrDataUrl, galleryUrl, token } = await TokenService.issue({
      eventId: event.id,
      createdBy: input.photographerId,
      label: 'Default QR',
    });

    return { event: await withCoverUrl(event), defaultAccess: { token, rawToken, qrDataUrl, galleryUrl } };
  },

  async getOwned(eventId: string, photographerId: string): Promise<Event> {
    const event = await EventModel.findById(eventId);
    if (!event || event.photographer_id !== photographerId) throw ApiError.notFound('Event not found');
    return event;
  },

  async getOwnedDto(eventId: string, photographerId: string) {
    return withCoverUrl(await this.getOwned(eventId, photographerId));
  },

  async listForPhotographer(photographerId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const { events, total } = await EventModel.listForPhotographer(photographerId, { limit: pageSize, offset });
    const withCover = await Promise.all(events.map((e) => withCoverUrl(e)));
    return { events: withCover, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  // Uploaded at event creation or updated later; replaces the previous cover image in storage.
  async uploadCoverImage(eventId: string, photographerId: string, buffer: Buffer) {
    const event = await this.getOwned(eventId, photographerId);
    const { buffer: resized } = await generateBrandingImage(buffer, COVER_MAX_WIDTH);
    const key = `events/${eventId}/cover/${crypto.randomBytes(8).toString('hex')}.webp`;

    await putObjectBuffer(key, resized, 'image/webp');
    const updated = await EventModel.setCoverImageKey(eventId, key);

    if (event.cover_image_key) {
      await deleteObject(event.cover_image_key).catch(() => {}); // best-effort cleanup of the old cover
    }

    return withCoverUrl(updated!);
  },

  async addSession(eventId: string, photographerId: string, input: { name: string; startsAt?: string; endsAt?: string }) {
    await this.getOwned(eventId, photographerId);
    return PhotoSessionModel.create({
      eventId,
      name: input.name,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });
  },

  async listSessions(eventId: string) {
    return PhotoSessionModel.listForEvent(eventId);
  },

  async processingSummary(eventId: string, photographerId: string) {
    await this.getOwned(eventId, photographerId);
    return PhotoModel.countByStatus(eventId);
  },

  async publish(eventId: string, photographerId: string) {
    await this.getOwned(eventId, photographerId);
    await EventModel.updateStatus(eventId, 'published');
  },
};

export { getPublicUrl };
