import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatStreamService } from './chat-stream.service';
import { AgentModule } from '../agent/agent.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AgentModule, SettingsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatStreamService],
  exports: [ChatService],
})
export class ChatModule {}
