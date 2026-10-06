import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../auth/auth.types.js';
import { SESSION_USER_KEY } from './session-auth.guard.js';

/** Requires SessionAuthGuard first (user already resolved), then `users.is_admin`. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { [SESSION_USER_KEY]?: User }>();
    const user = req[SESSION_USER_KEY];
    if (!user) {
      throw new UnauthorizedException({ error: 'Sign in required' });
    }
    if (!user.isAdmin) {
      throw new ForbiddenException({ error: 'Admin access required' });
    }
    return true;
  }
}
