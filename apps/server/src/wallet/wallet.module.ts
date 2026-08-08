import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
