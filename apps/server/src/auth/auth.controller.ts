import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  GoneException,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginBodySchema, SignupBodySchema } from '@poker/protocol';
import type { Request } from 'express';
import { AuthError } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { bearerToken } from './bearer.js';

@Controller('api')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
      chipBalance: user.chipBalance,
    };
  }
}
