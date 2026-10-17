import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { PostgresTableStakeStore, type TableStakeStore } from './table-stakes.store.js';

@Injectable()
export class TableStakesService {
  private readonly store: TableStakeStore;

  constructor(@InjectDataSource() dataSource: DataSource) {
    this.store = new PostgresTableStakeStore(dataSourceAsQueryable(dataSource));
  }

  asStore(): TableStakeStore {
    return this.store;
  }
}
