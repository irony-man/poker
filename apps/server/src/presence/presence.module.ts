import { Global, Module } from '@nestjs/common';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';

@Global()
@Module({
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
