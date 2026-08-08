import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { HandHistoryRow } from '@poker/db';
import { dataSourceAsQueryable } from '../database/queryable.js';
import type { TableMeta } from '../rooms/room.js';
import {
  FileHistoryStore,
  PostgresHistoryStore,
  type HandHistoryStore,
  writeSchemaDoc,
} from './history.store.js';

@Injectable()
export class HistoryService implements HandHistoryStore, OnModuleInit {
  private store!: HandHistoryStore;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.store = new PostgresHistoryStore(dataSourceAsQueryable(this.dataSource));
  }

  async onModuleInit(): Promise<void> {
    const dataDir = this.config.get<string>('DATA_DIR') ?? `${process.cwd()}/data`;
    await writeSchemaDoc(dataDir);
  }

  asStore(): HandHistoryStore {
    return this.store;
  }

  recordTable(meta: TableMeta): Promise<void> {
    return this.store.recordTable(meta);
  }

  recordHand(input: {
    tableId: string;
    handId: string;
    startedAt: number;
    endedAt: number;
    result: unknown;
  }): Promise<void> {
    return this.store.recordHand(input);
  }

  listHands(tableId: string, limit?: number): Promise<HandHistoryRow[]> {
    return this.store.listHands(tableId, limit);
  }
}

export { FileHistoryStore, type HandHistoryStore };
