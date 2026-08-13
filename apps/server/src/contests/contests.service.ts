import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { TournamentManager, type CreateContestOpts, type ContestState } from './tournament.js';

@Injectable()
export class ContestsService implements OnModuleInit {
  private tournaments!: TournamentManager;

  constructor(
    private readonly rooms: RoomsService,
    private readonly wallet: WalletService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.tournaments = new TournamentManager(this.rooms.asManager(), this.wallet.asStore());
    this.tournaments.setListChangeHandler((c) => this.onContestListChange(c));
    if (this.realtime) {
      this.realtime.setMyContestsLoader((userId) => this.listForUser(userId));
      this.realtime.setPublicContests(this.listPublic());
    }
  }

  private onContestListChange(c: ContestState): void {
    if (!this.realtime) return;
    const userIds = [c.hostUserId, ...c.entrants.map((e) => e.userId)];
    this.realtime.notifyContestLists(this.listPublic(), userIds);
  }

  asManager(): TournamentManager {
    return this.tournaments;
  }

  create(opts: CreateContestOpts) {
    return this.tournaments.create(opts);
  }

  get(id: string) {
    return this.tournaments.get(id);
  }

  recordPendingInvites(id: string, invites: Array<{ userId: string; name: string }>) {
    return this.tournaments.recordPendingInvites(id, invites);
  }

  getByInvite(code: string) {
    return this.tournaments.getByInvite(code);
  }

  listPublic() {
    return this.tournaments.listPublic();
  }

  listAll() {
    return this.tournaments.listAll();
  }

  listLive() {
    return this.tournaments.listLive();
  }

  listForUser(userId: string) {
    return this.tournaments.listForUser(userId);
  }

  register(id: string, userId: string, name: string) {
    return this.tournaments.register(id, userId, name);
  }

  unregister(id: string, userId: string) {
    return this.tournaments.unregister(id, userId);
  }

  start(id: string, userId: string) {
    return this.tournaments.start(id, userId);
  }

  attachWatcher(contestId: string, userId: string, send: (msg: unknown) => void) {
    return this.tournaments.attachWatcher(contestId, userId, send);
  }

  detachWatcher(contestId: string, userId: string) {
    return this.tournaments.detachWatcher(contestId, userId);
  }

  detachWatcherAll(userId: string) {
    return this.tournaments.detachWatcherAll(userId);
  }

  /** Drop a deleted account from open contests (refunds registering buy-ins). */
  removeUser(userId: string) {
    return this.tournaments.removeUser(userId);
  }
}
