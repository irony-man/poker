import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { MailService } from '../mail/mail.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { GoogleIdTokenVerifier } from './auth.google.js';
import { AuthStore } from './auth.store.js';
import type {
  AuthSessionPayload,
  GoogleSignInResult,
  PublicUser,
  User,
} from './auth.types.js';

/**
 * Nest-managed AuthStore wired to TypeORM on boot.
 * File-backed AuthStore remains available for unit tests via direct construction.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly store: AuthStore;

  constructor(
    private readonly config: ConfigService,
    private readonly siteConfig: SiteConfigService,
    private readonly google: GoogleIdTokenVerifier,
    private readonly mail: MailService,
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

  async googleSignIn(
    idToken: string,
    opts: { username?: string; avatarId?: number },
  ): Promise<GoogleSignInResult & { email?: string | null }> {
    const identity = await this.google.verify(idToken);
    const result = await this.store.googleSignIn(identity, opts);
    return result.kind === 'needs_username' ? { ...result, email: identity.email } : result;
  }

  async linkGoogle(userId: string, idToken: string): Promise<User> {
    const identity = await this.google.verify(idToken);
    return this.store.linkGoogle(userId, identity);
  }

  unlinkGoogle(userId: string): Promise<User> {
    return this.store.unlinkGoogle(userId);
  }

  /** Save a recovery email and send a confirmation link (no-op send if already verified). */
  async setEmail(userId: string, email: string): Promise<User> {
    const user = await this.store.setEmail(userId, email);
    if (!user.emailVerified) await this.sendVerification(user);
    return user;
  }

  async resendVerification(userId: string): Promise<User | null> {
    const user = this.store.getUser(userId);
    if (!user?.email || user.emailVerified) return user ?? null;
    await this.sendVerification(user);
    return user;
  }

  private async sendVerification(user: User): Promise<void> {
    if (!user.email) return;
    const token = await this.store.createEmailToken(user.id, 'verify_email', user.email);
    await this.mail.sendVerifyEmail(user.email, user.username, token);
  }

  verifyEmail(token: string): Promise<User> {
    return this.store.verifyEmail(token);
  }

  /** Emails a reset link when the account has a verified email; silently does nothing otherwise. */
  async requestPasswordReset(identifier: string): Promise<void> {
    const user = this.store.findRecoverableUser(identifier);
    if (!user?.email) return;
    const token = await this.store.createEmailToken(user.id, 'reset_password', user.email);
    try {
      await this.mail.sendPasswordReset(user.email, user.username, token);
    } catch (err) {
      this.logger.error(`Password reset email failed for user ${user.id}`, err as Error);
    }
  }

  isResetTokenValid(token: string): Promise<boolean> {
    return this.store.isResetTokenValid(token);
  }

  resetPassword(token: string, password: string): Promise<User> {
    return this.store.resetPassword(token, password);
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

  getWhuffieBalance(userId: string): number | undefined {
    return this.store.getWhuffieBalance(userId);
  }

  setWhuffieBalance(userId: string, balance: number): Promise<void> {
    return this.store.setWhuffieBalance(userId, balance);
  }

  setAvatarId(userId: string, avatarId: number): Promise<User | null> {
    return this.store.setAvatarId(userId, avatarId);
  }

  setAvatarUrl(userId: string, avatarUrl: string | null): Promise<User | null> {
    return this.store.setAvatarUrl(userId, avatarUrl);
  }

  setTableColorId(userId: string, tableColorId: number): Promise<User | null> {
    return this.store.setTableColorId(userId, tableColorId);
  }

  setCardThemeId(userId: string, cardThemeId: string): Promise<User | null> {
    return this.store.setCardThemeId(userId, cardThemeId);
  }

  setUiTheme(userId: string, uiTheme: string): Promise<User | null> {
    return this.store.setUiTheme(userId, uiTheme);
  }

  setTableLayout(userId: string, tableLayout: string): Promise<User | null> {
    return this.store.setTableLayout(userId, tableLayout);
  }

  setSfxMuted(userId: string, sfxMuted: boolean): Promise<User | null> {
    return this.store.setSfxMuted(userId, sfxMuted);
  }

  setKeyboardShortcuts(
    userId: string,
    shortcuts: Record<string, string>,
  ): Promise<User | null> {
    return this.store.setKeyboardShortcuts(userId, shortcuts);
  }

  incrementHandsPlayed(userId: string): Promise<void> {
    return this.store.incrementHandsPlayed(userId);
  }

  applyHandsPlayedCounts(counts: Map<string, number>): Promise<void> {
    return this.store.applyHandsPlayedCounts(counts);
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

  deleteUser(userId: string): Promise<User | null> {
    return this.store.deleteUser(userId);
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
