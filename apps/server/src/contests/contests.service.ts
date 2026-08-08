import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoomsService } from '../rooms/rooms.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { TournamentManager, type CreateContestOpts } from './tournament.js';

@Injectable()
export class ContestsService implements OnModuleInit {
  private tournaments!: TournamentManager;

  constructor(
    private readonly rooms: RoomsService,
    private readonly wallet: WalletService,
  ) {}

  onModuleInit(): void {
    this.tournaments = new TournamentManager(this.rooms.asManager(), this.wallet.asStore());
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

  getByInvite(code: string) {
    return this.tournaments.getByInvite(code);
  }

  listPublic() {
    return this.tournaments.listPublic();
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
}
