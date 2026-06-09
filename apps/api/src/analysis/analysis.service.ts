import { Injectable, Inject, Logger } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import { AgentToolsService } from '../agent/agent-tools.service';
import { SettingsService } from '../settings/settings.service';
import { createLlmFromConfig } from '../agent/llm.factory';
import { runAgent, type OnStreamFn } from '../agent/graph';

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
        const message = (err as Error).message;
        this.logger.error(`Stream error: ${message}`);
        subscriber.next({
          type: 'message',
          data: JSON.stringify({ kind: 'error', content: message }),
        });
        subscriber.complete();
      });
    });
  }

  private async runStream(
    query: string,
    subscriber: Subscriber<StreamEvent>,
  ): Promise<void> {
    const aiConfig = await this.settingsService.getAiConfig();
    const model = createLlmFromConfig(aiConfig);

    const onStream: OnStreamFn = (event) => {
      subscriber.next({
        type: 'message',
        data: JSON.stringify(event),
      });
    };

    const result = await runAgent({
      model,
      tools: this.toolsService.getTools(),
      query,
      onStream,
    });

    subscriber.next({
      type: 'message',
      data: JSON.stringify({
        kind: 'result',
        content: result.output,
        truncated: result.truncated,
      }),
    });
    await this.persist(aiConfig.activeProvider, query, result.output);
    subscriber.complete();
  }

  async invoke(query: string): Promise<{ output: string; truncated: boolean }> {
    const aiConfig = await this.settingsService.getAiConfig();
    const model = createLlmFromConfig(aiConfig);

    const result = await runAgent({
      model,
      tools: this.toolsService.getTools(),
      query,
    });

    await this.persist(aiConfig.activeProvider, query, result.output);
    return { output: result.output, truncated: result.truncated };
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
