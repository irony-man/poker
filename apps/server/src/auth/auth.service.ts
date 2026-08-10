import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { AuthStore } from './auth.store.js';
import type { AuthSessionPayload, PublicUser, User } from './auth.types.js';

/**
 * Nest-managed AuthStore wired to TypeORM on boot.
 * File-backed AuthStore remains available for unit tests via direct construction.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly store: AuthStore;

  constructor(
    private readonly config: ConfigService,
    private readonly siteConfig: SiteConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    const dataDir = this.config.get<string>('DATA_DIR') ?? `${process.cwd()}/data`;
    this.store = new AuthStore(dataDir);
    this.store.setPool(dataSourceAsQueryable(this.dataSource));
    this.store.setEconomyProvider(() => this.siteConfig.getEconomy());
  }

  async onModuleInit(): Promise<void> {
    // Ensure site config defaults are loaded before any signup uses the grant.
    await this.siteConfig.asStore().init();
    this.store.setEconomyProvider(() => this.siteConfig.getEconomy());
    await this.store.init();
  }

  /** Escape hatch for modules that still take AuthStore (friends profiles). */
  asStore(): AuthStore {
    return this.store;
  }

  signup(username: string, password: string, avatarId?: number): Promise<AuthSessionPayload> {
    return this.store.signup(username, password, avatarId);
  }

  login(username: string, password: string): Promise<AuthSessionPayload> {
    return this.store.login(username, password);
  }

  resolveSession(token: string): User | null {
    return this.store.resolveSession(token);
  }

  revokeSession(token: string): Promise<void> {
    return this.store.revokeSession(token);
  }

  getUser(id: string): User | undefined {
    return this.store.getUser(id);
  }

  hasUser(userId: string): boolean {
    return this.store.hasUser(userId);
  }

  getChipBalance(userId: string): number | undefined {
    return this.store.getChipBalance(userId);
  }

  setChipBalance(userId: string, balance: number): Promise<void> {
    return this.store.setChipBalance(userId, balance);
  }

  setAvatarId(userId: string, avatarId: number): Promise<User | null> {
    return this.store.setAvatarId(userId, avatarId);
  }

  setTableColorId(userId: string, tableColorId: number): Promise<User | null> {
    return this.store.setTableColorId(userId, tableColorId);
  }

  getUserByUsername(username: string): User | undefined {
    return this.store.getUserByUsername(username);
  }

  getPublicUser(id: string): PublicUser | undefined {
    return this.store.getPublicUser(id);
  }

  listUsers(): User[] {
    return this.store.listUsers();
  }

  issueTicket(userId: string, ttlMs?: number, persist?: boolean): string {
    return this.store.issueTicket(userId, ttlMs, persist);
  }

  issueTicketAndPersist(userId: string, ttlMs?: number): Promise<string> {
    return this.store.issueTicketAndPersist(userId, ttlMs);
  }

  consumeTicket(ticket: string): User | null {
    return this.store.consumeTicket(ticket);
  }
}
