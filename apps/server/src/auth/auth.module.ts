import { Global, Module, forwardRef } from '@nestjs/common';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from '../common/session-auth.guard.js';

@Global()
@Module({
  imports: [forwardRef(() => SiteConfigModule)],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
