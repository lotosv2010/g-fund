import { Module } from '@nestjs/common';
import { AgentToolsService } from './agent-tools.service';

@Module({
  providers: [AgentToolsService],
  exports: [AgentToolsService],
})
export class AgentModule {}
