import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [forwardRef(() => AuthModule), SiteConfigModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
