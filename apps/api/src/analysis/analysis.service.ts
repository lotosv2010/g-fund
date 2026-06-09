import { Injectable, Inject, Logger } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { AgentToolsService } from '../agent/agent-tools.service';
import { SettingsService } from '../settings/settings.service';
import { createLlmFromConfig } from '../agent/llm.factory';
import { runAgent, type OnToolCallFn } from '../agent/graph';

type DbType = NodePgDatabase<typeof schema>;

export interface StreamEvent {
  type: string;
  data: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly toolsService: AgentToolsService,
    private readonly settingsService: SettingsService,
    @Inject(DB) private readonly db: DbType,
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
    const aiConfig = await this.settingsService.getAiConfig();
    const model = createLlmFromConfig(aiConfig);

    const onToolCall: OnToolCallFn = async (toolName, phase, content) => {
      subscriber.next({
        type: phase === 'call' ? 'tool_call' : 'tool_result',
        data: JSON.stringify({ tool: toolName, phase, content }),
      });
    };

    const result = await runAgent({
      model,
      tools: this.toolsService.getTools(),
      query,
      onToolCall,
    });

    subscriber.next({ type: 'result', data: result.output });
    await this.persist(aiConfig.activeProvider, query, result.output);
    subscriber.complete();
  }

  async invoke(query: string): Promise<{ output: string }> {
    const aiConfig = await this.settingsService.getAiConfig();
    const model = createLlmFromConfig(aiConfig);

    const result = await runAgent({
      model,
      tools: this.toolsService.getTools(),
      query,
    });

    await this.persist(aiConfig.activeProvider, query, result.output);
    return { output: result.output };
  }

  private async persist(provider: string, query: string, output: string): Promise<void> {
    try {
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

