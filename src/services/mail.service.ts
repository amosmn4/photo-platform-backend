import { isMailConfigured, mailTransport } from '../config/mail';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const MailService = {
  async send(input: { to: string; subject: string; html: string; text: string }): Promise<void> {
    if (!isMailConfigured) {
      logger.warn({ to: input.to, subject: input.subject }, 'SMTP not configured, email not sent');
      return;
    }

    try {
      await mailTransport!.sendMail({ from: env.MAIL_FROM, ...input });
    } catch (err) {
      logger.error({ err, to: input.to, subject: input.subject }, 'Failed to send email');
    }
  },

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: `${env.APP_NAME} verification code`,
      text: `Your ${env.APP_NAME} verification code is ${code}. It expires in 15 minutes.`,
      html: `
        <p>Your ${env.APP_NAME} verification code is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${code}</p>
        <p>This code expires in 15 minutes.</p>
      `.trim(),
    });
  },
};
