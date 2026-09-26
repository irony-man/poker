import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BotBanterController } from './bot-banter.controller.js';
import { BotBanterLlmService } from './bot-banter-llm.service.js';
import { BotChatController } from './bot-chat.controller.js';
import { BotChatService } from './bot-chat.service.js';
import { PlayerExploitLlmService } from './player-exploit-llm.service.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [BotBanterController, BotChatController],
  providers: [BotBanterLlmService, BotChatService, PlayerExploitLlmService],
  exports: [BotBanterLlmService, BotChatService, PlayerExploitLlmService],
})
export class BotBanterModule {}
