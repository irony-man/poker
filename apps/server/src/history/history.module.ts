import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HistoryService } from './history.service.js';

@Module({
  imports: [AuthModule],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
