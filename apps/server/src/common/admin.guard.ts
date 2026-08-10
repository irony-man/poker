import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isAdminUsername, parseAdminUsernames } from '../admin/admin-allowlist.js';
import type { User } from '../auth/auth.types.js';
import { SESSION_USER_KEY } from './session-auth.guard.js';

/**
 * Requires SessionAuthGuard first (user already resolved), then admin allowlist.
 * Empty ADMIN_USERNAMES → no one is admin (fail closed).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { [SESSION_USER_KEY]?: User }>();
    const user = req[SESSION_USER_KEY];
    if (!user) {
      throw new UnauthorizedException({ error: 'Sign in required' });
    }
    const allowlist = parseAdminUsernames(this.config.get<string>('ADMIN_USERNAMES'));
    if (!isAdminUsername(user.username, allowlist)) {
      throw new ForbiddenException({ error: 'Admin access required' });
    }
    return true;
  }
}
