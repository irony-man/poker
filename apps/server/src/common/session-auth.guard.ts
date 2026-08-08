import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  type CanActivate,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import type { User } from '../auth/auth.types.js';
import { bearerToken } from '../auth/bearer.js';

export const SESSION_USER_KEY = 'feltUser';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { [SESSION_USER_KEY]?: User }>();
    const token = bearerToken(req.header('authorization') ?? req.header('Authorization') ?? undefined);
    if (!token) {
      throw new UnauthorizedException({ error: 'Sign in required' });
    }
    const user = this.auth.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException({ error: 'Session expired or invalid' });
    }
    req[SESSION_USER_KEY] = user;
    return true;
  }
}

/** Current authenticated user (requires SessionAuthGuard). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<Request & { [SESSION_USER_KEY]?: User }>();
  const user = req[SESSION_USER_KEY];
  if (!user) {
    throw new UnauthorizedException({ error: 'Sign in required' });
  }
  return user;
});

/** User id only. */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request & { [SESSION_USER_KEY]?: User }>();
  const user = req[SESSION_USER_KEY];
  if (!user) {
    throw new UnauthorizedException({ error: 'Sign in required' });
  }
  return user.id;
});
