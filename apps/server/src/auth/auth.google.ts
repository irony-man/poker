import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleIdentity } from './auth.types.js';

export class GoogleAuthNotConfiguredError extends Error {
  constructor() {
    super('Google sign-in is not configured');
    this.name = 'GoogleAuthNotConfiguredError';
  }
}

export class InvalidGoogleTokenError extends Error {
  constructor() {
    super('Google sign-in failed. Please try again.');
    this.name = 'InvalidGoogleTokenError';
  }
}

/**
 * Verifies Google ID tokens. Accepted audiences come from `GOOGLE_CLIENT_ID`
 * (comma-separated); Android requests tokens with the web client id as
 * `serverClientId`, so one web client id covers both apps.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly audiences: string[];
  private readonly client = new OAuth2Client();

  constructor(config: ConfigService) {
    this.audiences = (config.get<string>('GOOGLE_CLIENT_ID') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  isConfigured(): boolean {
    return this.audiences.length > 0;
  }

  /** Web client id clients should request ID tokens for (first `GOOGLE_CLIENT_ID` entry). */
  webClientId(): string | null {
    return this.audiences[0] ?? null;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.isConfigured()) throw new GoogleAuthNotConfiguredError();
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences });
      payload = ticket.getPayload();
    } catch {
      throw new InvalidGoogleTokenError();
    }
    if (!payload?.sub) throw new InvalidGoogleTokenError();
    return {
      sub: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.given_name ?? null,
    };
  }
}
