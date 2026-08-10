import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import {
  type WalletMutationResult,
  type WalletReason,
  type WalletStore,
} from './wallet.constants.js';
import { AuthWalletStore } from './wallet.store.js';

@Injectable()
export class WalletService implements WalletStore, OnModuleInit {
  private readonly store: AuthWalletStore;

  constructor(
    private readonly auth: AuthService,
    private readonly siteConfig: SiteConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.store = new AuthWalletStore(this.auth);
    this.store.setEconomyProvider(() => this.siteConfig.getEconomy());
  }

  onModuleInit(): void {
    this.store.setPool(dataSourceAsQueryable(this.dataSource));
    this.store.setEconomyProvider(() => this.siteConfig.getEconomy());
  }

  asStore(): WalletStore {
    return this.store;
  }

  getBalance(userId: string): number {
    return this.store.getBalance(userId);
  }

  ensureStartingBalance(userId: string): Promise<number> {
    return this.store.ensureStartingBalance(userId);
  }

  debit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult> {
    return this.store.debit(userId, amount, reason, tableId);
  }

  credit(
    userId: string,
    amount: number,
    reason: WalletReason,
    tableId?: string,
  ): Promise<WalletMutationResult> {
    return this.store.credit(userId, amount, reason, tableId);
  }

  claimRefill(userId: string): Promise<WalletMutationResult> {
    return this.store.claimRefill(userId);
  }

  refillInfo(userId: string) {
    return this.store.refillInfo(userId);
  }
}
