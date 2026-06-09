import { Injectable, Inject, Logger } from '@nestjs/common';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Observable, Subscriber } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { LLM } from '../agent/agent.module';
import { AgentToolsService } from '../agent/agent-tools.service';
import { runAgent, type OnToolCallFn } from '../agent/graph';
import { Inject as InjectDB } from '@nestjs/common';

type DbType = NodePgDatabase<typeof schema>;

export interface StreamEvent {
  type: string;
  data: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(LLM) private readonly llm: BaseLanguageModel,
    private readonly toolsService: AgentToolsService,
    @InjectDB(DB) private readonly db: DbType,
  ) {}

  stream(query: string): Observable<StreamEvent> {
    return new Observable<StreamEvent>((subscriber) => {
      this.runStream(query, subscriber).catch((err) => {
        this.logger.error(`Stream error: ${(err as Error).message}`);
        subscriber.error(err);
      });
    });
  }

  private async runStream(
    query: string,
    subscriber: Subscriber<StreamEvent>,
  ): Promise<void> {
    const onToolCall: OnToolCallFn = async (toolName, phase, content) => {
      subscriber.next({
        type: phase === 'call' ? 'tool_call' : 'tool_result',
        data: JSON.stringify({ tool: toolName, phase, content }),
      });
    };

    const result = await runAgent({
      model: this.llm,
      tools: this.toolsService.getTools(),
      query,
      onToolCall,
    });

    subscriber.next({ type: 'result', data: result.output });
    await this.persist(query, result.output);
    subscriber.complete();
  }

  async invoke(query: string): Promise<{ output: string }> {
    const result = await runAgent({
      model: this.llm,
      tools: this.toolsService.getTools(),
      query,
    });

    await this.persist(query, result.output);
    return { output: result.output };
  }

  private async persist(query: string, output: string): Promise<void> {
    try {
      const provider = process.env.LLM_PROVIDER ?? 'deepseek';
      await this.db.insert(schema.analysisRecords).values({
        provider,
        inputSnapshot: { query },
        result: { output },
      });
    } catch (error) {
      this.logger.warn(`Failed to persist analysis: ${(error as Error).message}`);
    }
  }
}
