import { Module } from '@nestjs/common';
import { TableChipsService } from './table-chips.service.js';

@Module({
  providers: [TableChipsService],
  exports: [TableChipsService],
})
export class TableChipsModule {}
