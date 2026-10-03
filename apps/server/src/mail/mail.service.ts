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

const BRAND_PURPLE = '#5b21b6';
const FONT_STACK = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';

/** Table layout + inline styles: the subset Gmail/Outlook/Apple Mail all render. */
function actionEmail(opts: {
  logoUrl: string;
  homeUrl: string;
  greeting: string;
  intro: string;
  actionLabel: string;
  url: string;
  outro: string;
}): { text: string; html: string } {
  const text = `${opts.greeting}\n\n${opts.intro}\n\n${opts.url}\n\n${opts.outro}\n`;
  const url = escapeHtml(opts.url);
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f1f8">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1f8">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
          <tr>
            <td align="center" bgcolor="${BRAND_PURPLE}" style="background:${BRAND_PURPLE};padding:22px 24px">
              <a href="${escapeHtml(opts.homeUrl)}" style="text-decoration:none">
                <img src="${escapeHtml(opts.logoUrl)}" width="150" alt="POKR" style="display:block;width:150px;max-width:100%;height:auto;border:0;outline:none;color:#ffffff;font:700 28px ${FONT_STACK}">
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:${FONT_STACK};color:#1d0432;font-size:15px;line-height:1.55">
              <p style="margin:0 0 14px">${escapeHtml(opts.greeting)}</p>
              <p style="margin:0 0 22px">${escapeHtml(opts.intro)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px">
                <tr>
                  <td bgcolor="${BRAND_PURPLE}" style="border-radius:999px">
                    <a href="${url}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:${BRAND_PURPLE};color:#ffffff;text-decoration:none;font-weight:600;font-family:${FONT_STACK}">${escapeHtml(opts.actionLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px;font-size:13px;color:#555">Or paste this link into your browser:</p>
              <p style="margin:0 0 18px;font-size:13px;word-break:break-all"><a href="${url}" style="color:${BRAND_PURPLE}">${url}</a></p>
              <p style="margin:0 0 20px;font-size:13px;color:#555">${escapeHtml(opts.outro)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:12px;color:#8a7f96">Pokr · <a href="${escapeHtml(opts.homeUrl)}" style="color:#8a7f96">${escapeHtml(opts.homeUrl.replace(/^https?:\/\//, ''))}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  /** Shared header/footer bits for every templated email. White logo — shown on the purple header band. */
  private brand(): { logoUrl: string; homeUrl: string } {
    return { logoUrl: this.webLink('/pokr-logo.png'), homeUrl: this.webUrl };
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
        ...this.brand(),
        greeting: `Hi ${username},`,
        intro: 'Confirm this address so you can reset your Pokr password if you ever lose it.',
        actionLabel: 'Confirm email',
        url,
        outro: "This link expires in 24 hours. If you didn't add this email, you can ignore this message.",
      }),
    });
  }

  /** New-account welcome. With `confirmToken`, the button confirms the recovery email too. */
  async sendWelcome(to: string, username: string, confirmToken: string | null): Promise<void> {
    const confirmUrl = confirmToken
      ? this.webLink(`/verify-email?token=${encodeURIComponent(confirmToken)}`)
      : null;
    await this.send({
      to,
      subject: 'Welcome to Pokr',
      ...actionEmail({
        ...this.brand(),
        greeting: `Welcome to Pokr, ${username}!`,
        intro: confirmUrl
          ? 'Your account is ready. Host a table, join friends with a room code, or jump into a contest. First, confirm this email so you can reset your password if you ever lose it.'
          : 'Your account is ready. Host a table, join friends with a room code, or jump into a contest. Your chips are waiting.',
        actionLabel: confirmUrl ? 'Confirm email' : 'Start playing',
        url: confirmUrl ?? this.webLink('/'),
        outro: confirmUrl
          ? "The confirm link expires in 24 hours. If you didn't create this account, you can ignore this email."
          : "If you didn't create this account, you can ignore this email.",
      }),
    });
  }

  async sendPasswordReset(to: string, username: string, token: string): Promise<void> {
    const url = this.webLink(`/reset-password?token=${encodeURIComponent(token)}`);
    await this.send({
      to,
      subject: 'Reset your Pokr password',
      ...actionEmail({
        ...this.brand(),
        greeting: `Hi ${username},`,
        intro: 'Someone asked to reset the password for your Pokr account. Use the button below to choose a new one.',
        actionLabel: 'Reset password',
        url,
        outro: "This link expires in 1 hour. If you didn't ask for this, you can ignore this email.",
      }),
    });
  }
}
