import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { AgentToolsService } from '../agent/agent-tools.service';
import { SettingsService } from '../settings/settings.service';
import { createLlmFromConfig } from '../agent/llm.factory';
import { runAgent, type OnStreamFn, type HistoryTurn } from '../agent/graph';

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
  ) {}

  stream(query: string, history?: HistoryTurn[]): Observable<StreamEvent> {
    return new Observable<StreamEvent>((subscriber) => {
      this.runStream(query, subscriber, history).catch((err) => {
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
    history?: HistoryTurn[],
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
      history,
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
    subscriber.complete();
  }

  async invoke(
    query: string,
    history?: HistoryTurn[],
  ): Promise<{ output: string; truncated: boolean }> {
    const aiConfig = await this.settingsService.getAiConfig();
    const model = createLlmFromConfig(aiConfig);

    const result = await runAgent({
      model,
      tools: this.toolsService.getTools(),
      query,
      history,
    });

    return { output: result.output, truncated: result.truncated };
  }
}
