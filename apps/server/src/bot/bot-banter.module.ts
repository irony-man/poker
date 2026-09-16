import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BotBanterController } from './bot-banter.controller.js';
import { BotBanterLlmService } from './bot-banter-llm.service.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [BotBanterController],
  providers: [BotBanterLlmService],
  exports: [BotBanterLlmService],
})
export class BotBanterModule {}
