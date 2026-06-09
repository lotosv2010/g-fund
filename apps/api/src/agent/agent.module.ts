import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { AgentToolsService } from './agent-tools.service';
import { createLlm } from './llm.factory';

export const LLM = Symbol('LLM');

@Module({
  providers: [
    AgentToolsService,
    {
      provide: LLM,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BaseLanguageModel => createLlm(config),
    },
  ],
  exports: [LLM, AgentToolsService],
})
export class AgentModule {}
