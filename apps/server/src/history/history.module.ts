import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';

@Module({
  imports: [AuthModule, SiteConfigModule, WalletModule],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
