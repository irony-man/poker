import { Module, forwardRef } from '@nestjs/common';
import { HistoryModule } from '../history/history.module.js';
import { KvModule } from '../kv/kv.module.js';
import { TableChipsModule } from '../table-chips/table-chips.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { PublicTablesBootstrap } from '../public-tables/public-tables.bootstrap.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    KvModule,
    HistoryModule,
    TableChipsModule,
    forwardRef(() => WalletModule),
  ],
  providers: [RoomsService, PublicTablesBootstrap],
  exports: [RoomsService],
})
export class RoomsModule {}
