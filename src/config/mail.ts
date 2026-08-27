import nodemailer from 'nodemailer';
import { env } from './env';

/**
 * Single SMTP transport for the whole app. Works with any SMTP-speaking
 * provider (SendGrid, Mailgun, Postmark, AWS SES's SMTP interface, a
 * self-hosted relay, ...) by setting SMTP_HOST/PORT/USER/PASSWORD — no code
 * changes needed to switch providers.
 *
 * `mailTransport` is null when SMTP_HOST isn't set (e.g. credentials not
 * provisioned yet) — callers must go through MailService, which checks
 * `isMailConfigured` and logs instead of throwing when mail isn't set up.
 */
export const isMailConfigured = Boolean(env.SMTP_HOST);

export const mailTransport = isMailConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;
