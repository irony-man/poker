import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BotBanterController } from './bot-banter.controller.js';
import { BotBanterLlmService } from './bot-banter-llm.service.js';
import { BotChatController } from './bot-chat.controller.js';
import { BotChatService } from './bot-chat.service.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [BotBanterController, BotChatController],
  providers: [BotBanterLlmService, BotChatService],
  exports: [BotBanterLlmService, BotChatService],
})
export class BotBanterModule {}
