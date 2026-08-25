import slugify from 'slugify';
import { EventModel } from '../models/Event';
import { PhotoModel } from '../models/Photo';
import { PhotoSessionModel } from '../models/PhotoSession';
import { TokenService } from './token.service';
import { ApiError } from '../utils/ApiError';
import { getPublicUrl } from './storage.service';
import { Event } from '../types';

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

    // Every event gets a default "find my photos" QR at creation time so
    // the photographer can print it immediately without a second step.
    const { rawToken, qrDataUrl, galleryUrl, token } = await TokenService.issue({
      eventId: event.id,
      createdBy: input.photographerId,
      label: 'Default QR',
    });

    return { event, defaultAccess: { token, rawToken, qrDataUrl, galleryUrl } };
  },

  async getOwned(eventId: string, photographerId: string): Promise<Event> {
    const event = await EventModel.findById(eventId);
    if (!event || event.photographer_id !== photographerId) throw ApiError.notFound('Event not found');
    return event;
  },

  async listForPhotographer(photographerId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const { events, total } = await EventModel.listForPhotographer(photographerId, { limit: pageSize, offset });
    const withCover = events.map((e) => ({
      ...e,
      cover_photo_url: null as string | null, // populated by controller if cover_photo_id resolves
    }));
    return { events: withCover, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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
