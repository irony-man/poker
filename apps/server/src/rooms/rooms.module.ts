import { Module } from '@nestjs/common';
import { BotBanterModule } from '../bot/bot-banter.module.js';
import { HistoryModule } from '../history/history.module.js';
import { KvModule } from '../kv/kv.module.js';
import { TableChipsModule } from '../table-chips/table-chips.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    KvModule,
    HistoryModule,
    TableChipsModule,
    BotBanterModule,
    WalletModule,
  ],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
