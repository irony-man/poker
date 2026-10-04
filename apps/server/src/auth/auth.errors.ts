import {
  BadRequestException,
  ConflictException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { GoogleAuthNotConfiguredError, InvalidGoogleTokenError } from './auth.google.js';
import { InstagramAuthNotConfiguredError, InvalidInstagramAuthError } from './auth.instagram.js';
import { AuthError } from './auth.types.js';

/** Map auth-domain errors to HTTP responses (`{ error }` body like the rest of the API). */
export function toAuthHttpError(err: unknown, fallback: string): HttpException {
  if (err instanceof HttpException) return err;
  if (err instanceof GoogleAuthNotConfiguredError) {
    return new ServiceUnavailableException({ error: err.message });
  }
  if (err instanceof InstagramAuthNotConfiguredError) {
    return new ServiceUnavailableException({ error: err.message });
  }
  if (err instanceof InvalidInstagramAuthError) {
    return new UnauthorizedException({ error: err.message });
  }
  if (err instanceof AuthError) {
    switch (err.code) {
      case 'username_taken':
      case 'email_taken':
      case 'google_taken':
      case 'instagram_taken':
        return new ConflictException({ error: err.message });
      case 'invalid_credentials':
        return new UnauthorizedException({ error: err.message });
      default:
        return new BadRequestException({ error: err.message });
    }
  }
  return new BadRequestException({ error: err instanceof Error ? err.message : fallback });
}
