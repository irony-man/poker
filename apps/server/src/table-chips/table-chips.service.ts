import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { PostgresTableChipStore, type TableChipStore } from './table-chips.store.js';

@Injectable()
export class TableChipsService implements TableChipStore {
  private readonly store: TableChipStore;

  constructor(@InjectDataSource() dataSource: DataSource) {
    this.store = new PostgresTableChipStore(dataSourceAsQueryable(dataSource));
  }

  asStore(): TableChipStore {
    return this.store;
  }

  reserve(tableId: string, userId: string, stack: number): Promise<void> {
    return this.store.reserve(tableId, userId, stack);
  }

  take(tableId: string, userId: string): Promise<number | null> {
    return this.store.take(tableId, userId);
  }
}
