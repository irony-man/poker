import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function actionEmail(opts: {
  greeting: string;
  intro: string;
  actionLabel: string;
  url: string;
  outro: string;
}): { text: string; html: string } {
  const text = `${opts.greeting}\n\n${opts.intro}\n\n${opts.url}\n\n${opts.outro}\n`;
  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d0432;line-height:1.5">
  <p>${escapeHtml(opts.greeting)}</p>
  <p>${escapeHtml(opts.intro)}</p>
  <p><a href="${escapeHtml(opts.url)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#5b21b6;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(opts.actionLabel)}</a></p>
  <p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${escapeHtml(opts.url)}</p>
  <p style="font-size:13px;color:#555">${escapeHtml(opts.outro)}</p>
</body></html>`;
  return { text, html };
}

/** SMTP mailer (nodemailer). Without SMTP_HOST, messages are logged so local dev still works. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const secureRaw = this.config.get<string>('SMTP_SECURE');
    const secure = secureRaw ? secureRaw === 'true' : port === 465;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');
    this.from = this.config.get<string>('SMTP_FROM')?.trim() || user || 'Pokr <no-reply@pokr.site>';
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number.isFinite(port) ? port : 587,
          secure,
          auth: user ? { user, pass } : undefined,
        })
      : null;

    const firstOrigin = (this.config.get<string>('WEB_ORIGIN') ?? '').split(',')[0]?.trim();
    this.webUrl = (
      this.config.get<string>('PUBLIC_WEB_URL')?.trim() ||
      firstOrigin ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  webLink(pathWithQuery: string): string {
    return `${this.webUrl}${pathWithQuery.startsWith('/') ? '' : '/'}${pathWithQuery}`;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured; would send "${message.subject}" to ${message.to}:\n${message.text}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }

  async sendVerifyEmail(to: string, username: string, token: string): Promise<void> {
    const url = this.webLink(`/verify-email?token=${encodeURIComponent(token)}`);
    await this.send({
      to,
      subject: 'Confirm your Pokr recovery email',
      ...actionEmail({
        greeting: `Hi ${username},`,
        intro: 'Confirm this address so you can reset your Pokr password if you ever lose it.',
        actionLabel: 'Confirm email',
        url,
        outro: "This link expires in 24 hours. If you didn't add this email, you can ignore this message.",
      }),
    });
  }

  async sendPasswordReset(to: string, username: string, token: string): Promise<void> {
    const url = this.webLink(`/reset-password?token=${encodeURIComponent(token)}`);
    await this.send({
      to,
      subject: 'Reset your Pokr password',
      ...actionEmail({
        greeting: `Hi ${username},`,
        intro: 'Someone asked to reset the password for your Pokr account. Use the button below to choose a new one.',
        actionLabel: 'Reset password',
        url,
        outro: "This link expires in 1 hour. If you didn't ask for this, you can ignore this email.",
      }),
    });
  }
}
