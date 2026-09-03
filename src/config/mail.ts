import nodemailer from 'nodemailer';
import { env } from './env';

// mailTransport is null when SMTP_HOST is unset — callers must check isMailConfigured first.
export const isMailConfigured = Boolean(env.SMTP_HOST);

export const mailTransport = isMailConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;
