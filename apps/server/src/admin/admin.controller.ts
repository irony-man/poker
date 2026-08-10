import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { AdminGuard } from '../common/admin.guard.js';
import { SessionAuthGuard } from '../common/session-auth.guard.js';
import { ContestsService } from '../contests/contests.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { WalletError } from '../wallet/wallet.constants.js';
import { WalletService } from '../wallet/wallet.service.js';

const AnnouncementBody = z.object({
  enabled: z.boolean(),
  text: z.string().max(2000),
});

const EconomyBody = z.object({
  startingChipGrant: z.number().int().positive().optional(),
  refillThreshold: z.number().int().positive().optional(),
  refillGrant: z.number().int().positive().optional(),
});

const RoomSettingsBody = z.object({
  inactivityMinutes: z.number().int().min(1).max(24 * 60),
});

const CreditBody = z.object({
  amount: z.number().int().positive().max(100_000_000),
});

const HomeFeatureBody = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  cta: z.string().min(1).max(80),
  href: z.string().min(1).max(500),
  image: z.string().min(1).max(500),
  imageAlt: z.string().min(1).max(200),
  imageFirst: z.boolean(),
});

const HomeFeaturesBody = z.object({
  features: z.array(HomeFeatureBody).min(1).max(12),
});

const PageCopyBody = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(2000),
});

const PagesBody = z.object({
  pages: z.object({
    host: PageCopyBody,
    join: PageCopyBody,
    public: PageCopyBody,
    contests: PageCopyBody,
    friends: PageCopyBody,
    solo: PageCopyBody,
    signIn: PageCopyBody,
    signUp: PageCopyBody,
    homeAuthFooter: PageCopyBody,
  }),
});

@Controller('api/admin')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly site: SiteConfigService,
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly rooms: RoomsService,
    private readonly contests: ContestsService,
  ) {}

  @Get('overview')
  overview() {
    const snap = this.site.getSnapshot();
    return {
      userCount: this.auth.listUsers().length,
      economy: snap.economy,
      announcement: snap.announcement,
      liveTables: this.rooms.listAllAdmin().length,
      liveContests: this.contests.listAll().length,
    };
  }

  @Get('announcement')
  getAnnouncement() {
    return this.site.getAnnouncement();
  }

  @Patch('announcement')
  async patchAnnouncement(@Body() body: unknown) {
    const parsed = AnnouncementBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    return this.site.setAnnouncement(parsed.data);
  }

  @Get('economy')
  getEconomy() {
    return this.site.getEconomy();
  }

  @Patch('economy')
  async patchEconomy(@Body() body: unknown) {
    const parsed = EconomyBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    if (
      parsed.data.startingChipGrant === undefined &&
      parsed.data.refillThreshold === undefined &&
      parsed.data.refillGrant === undefined
    ) {
      throw new BadRequestException({ error: 'No economy fields provided' });
    }
    return this.site.setEconomy(parsed.data);
  }

  @Get('room-settings')
  getRoomSettings() {
    return this.site.getRoomSettings();
  }

  @Patch('room-settings')
  async patchRoomSettings(@Body() body: unknown) {
    const parsed = RoomSettingsBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    return this.site.setRoomSettings(parsed.data);
  }

  @Get('home-features')
  getHomeFeatures() {
    return { features: this.site.getHomeFeatures() };
  }

  @Patch('home-features')
  async patchHomeFeatures(@Body() body: unknown) {
    const parsed = HomeFeaturesBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const features = await this.site.setHomeFeatures(parsed.data.features);
    return { features };
  }

  @Get('pages')
  getPages() {
    return { pages: this.site.getPages() };
  }

  @Patch('pages')
  async patchPages(@Body() body: unknown) {
    const parsed = PagesBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const pages = await this.site.setPages(parsed.data.pages);
    return { pages };
  }

  @Get('users')
  listUsers(@Query('q') q?: string) {
    const query = (q ?? '').trim().toLowerCase();
    let users = this.auth.listUsers();
    if (query) {
      users = users.filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.name.toLowerCase().includes(query) ||
          u.id.toLowerCase().includes(query),
      );
    }
    users = users
      .slice()
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 50);
    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatarId: u.avatarId,
        chipBalance: this.wallet.getBalance(u.id),
        createdAt: u.createdAt,
      })),
    };
  }

  @Post('users/:userId/credit')
  async creditUser(@Param('userId') userId: string, @Body() body: unknown) {
    const parsed = CreditBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const user = this.auth.getUser(userId);
    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }
    try {
      const result = await this.wallet.credit(userId, parsed.data.amount, 'admin_credit');
      return {
        ok: true as const,
        userId,
        username: user.username,
        balance: result.balance,
        credited: parsed.data.amount,
      };
    } catch (err) {
      if (err instanceof WalletError) {
        throw new BadRequestException({ error: err.message, code: err.code });
      }
      throw err;
    }
  }

  /**
   * Reset bankroll to the configured starting grant (admin_reset ledger delta).
   */
  @Post('users/:userId/reset-chips')
  async resetUserChips(@Param('userId') userId: string) {
    const user = this.auth.getUser(userId);
    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }
    const target = this.site.getEconomy().startingChipGrant;
    const current = this.wallet.getBalance(userId);
    const delta = target - current;
    try {
      if (delta > 0) {
        await this.wallet.credit(userId, delta, 'admin_reset');
      } else if (delta < 0) {
        await this.wallet.debit(userId, -delta, 'admin_reset');
      }
      return {
        ok: true as const,
        userId,
        username: user.username,
        balance: this.wallet.getBalance(userId),
        previousBalance: current,
        resetTo: target,
      };
    } catch (err) {
      if (err instanceof WalletError) {
        throw new BadRequestException({ error: err.message, code: err.code });
      }
      throw err;
    }
  }

  @Get('games')
  listGames() {
    return {
      tables: this.rooms.listAllAdmin(),
      contests: this.contests.listAll(),
    };
  }
}
