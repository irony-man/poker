import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  GoneException,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ForgotPasswordBodySchema,
  GoogleAuthBodySchema,
  LoginBodySchema,
  ResetPasswordBodySchema,
  SignupBodySchema,
  VerifyEmailBodySchema,
} from '@poker/protocol';
import type { Request } from 'express';
import { AuthError } from './auth.types.js';
import { toAuthHttpError } from './auth.errors.js';
import { GoogleIdTokenVerifier } from './auth.google.js';
import { AuthService } from './auth.service.js';
import { bearerToken } from './bearer.js';

@Controller('api')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleIdTokenVerifier,
  ) {}

  /** Public auth options so clients don't need the Google client id baked in at build time. */
  @Get('auth/config')
  config() {
    return { googleClientId: this.google.webClientId() };
  }

  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async signup(@Body() body: unknown) {
    const parsed = SignupBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const session = await this.auth.signup(
        parsed.data.username,
        parsed.data.password,
        parsed.data.avatarId,
      );
      return session;
    } catch (err) {
      if (err instanceof AuthError && err.code === 'username_taken') {
        throw new ConflictException({ error: err.message });
      }
      throw new BadRequestException({
        error: err instanceof Error ? err.message : 'Signup failed',
      });
    }
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(@Body() body: unknown) {
    const parsed = LoginBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      return await this.auth.login(parsed.data.username, parsed.data.password);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid_credentials') {
        throw new UnauthorizedException({ error: err.message });
      }
      throw new BadRequestException({
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  }

  /** Sign in (or sign up) with a Google ID token. New users get `{ needsUsername }` first. */
  @Post('auth/google')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async googleSignIn(@Body() body: unknown) {
    const parsed = GoogleAuthBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const result = await this.auth.googleSignIn(parsed.data.idToken, {
        username: parsed.data.username,
        avatarId: parsed.data.avatarId,
      });
      if (result.kind === 'needs_username') {
        return {
          needsUsername: true,
          suggestedUsername: result.suggestedUsername,
          email: result.email ?? null,
        };
      }
      return result.session;
    } catch (err) {
      throw toAuthHttpError(err, 'Google sign-in failed');
    }
  }

  @Post('auth/verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async verifyEmail(@Body() body: unknown) {
    const parsed = VerifyEmailBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: 'This link is invalid or has expired' });
    }
    try {
      const user = await this.auth.verifyEmail(parsed.data.token);
      return { ok: true, email: user.email };
    } catch (err) {
      throw toAuthHttpError(err, 'Could not verify email');
    }
  }

  /** Always 200 so the response never reveals whether an account or email exists. */
  @Post('auth/forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() body: unknown) {
    const parsed = ForgotPasswordBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: 'Enter your username or email' });
    }
    void this.auth.requestPasswordReset(parsed.data.identifier).catch(() => undefined);
    return { ok: true };
  }

  /** Lets the reset page show "link expired" up front instead of after the user types a password. */
  @Post('auth/reset-password/check')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async checkResetToken(@Body() body: unknown) {
    const parsed = VerifyEmailBodySchema.safeParse(body);
    if (!parsed.success) return { valid: false };
    return { valid: await this.auth.isResetTokenValid(parsed.data.token) };
  }

  @Post('auth/reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(@Body() body: unknown) {
    const parsed = ResetPasswordBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const user = await this.auth.resetPassword(parsed.data.token, parsed.data.password);
      return { ok: true, username: user.username };
    } catch (err) {
      throw toAuthHttpError(err, 'Could not reset password');
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    const token = bearerToken(req.header('authorization') ?? req.header('Authorization') ?? undefined);
    if (token) await this.auth.revokeSession(token);
    return { ok: true };
  }

  @Post('register')
  register() {
    throw new GoneException({
      error: 'Anonymous register removed. Use /api/signup or /api/login.',
    });
  }

  @Post('ticket')
  async ticket(@Req() req: Request) {
    const token = bearerToken(req.header('authorization') ?? req.header('Authorization') ?? undefined);
    if (!token) {
      throw new UnauthorizedException({ error: 'Sign in required' });
    }
    const user = this.auth.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException({ error: 'Session expired or invalid' });
    }
    const ticket = await this.auth.issueTicketAndPersist(user.id);
    return {
      ticket,
      userId: user.id,
      name: user.name,
      username: user.username,
      avatarId: user.avatarId,
      avatarUrl: user.avatarUrl,
      chipBalance: user.chipBalance,
      whuffieBalance: user.whuffieBalance,
    };
  }
}
