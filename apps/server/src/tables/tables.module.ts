import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { HistoryModule } from '../history/history.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { TablesController } from './tables.controller.js';

@Module({
  imports: [
    RoomsModule,
    HistoryModule,
    forwardRef(() => FriendsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [TablesController],
})
export class TablesModule {}
