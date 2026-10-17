import { Module } from '@nestjs/common';
import { TableChipsService } from './table-chips.service.js';
import { TableStakesService } from './table-stakes.service.js';

@Module({
  providers: [TableChipsService, TableStakesService],
  exports: [TableChipsService, TableStakesService],
})
export class TableChipsModule {}
