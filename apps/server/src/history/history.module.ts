import { Module } from '@nestjs/common';
import { HistoryService } from './history.service.js';

@Module({
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
