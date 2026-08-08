import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from '../common/session-auth.guard.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
