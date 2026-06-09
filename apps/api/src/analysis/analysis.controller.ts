import { Controller, Post, Get, Body, Query, Sse, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AnalysisService, type StreamEvent } from './analysis.service';
import type { HistoryTurn } from '../agent/graph';

interface StreamBody {
  readonly query: string;
  readonly history?: HistoryTurn[];
}

interface PendingSession {
  readonly query: string;
  readonly history?: HistoryTurn[];
  readonly expiresAt: number;
}

const SESSION_TTL_MS = 60_000;

@Controller('analysis')
export class AnalysisController {
  private readonly pending = new Map<string, PendingSession>();

  constructor(private readonly analysisService: AnalysisService) {}

  @Post('sessions')
  createSession(@Body() body: StreamBody): { sessionId: string } {
    if (!body?.query?.trim()) {
      throw new BadRequestException('query 不能为空');
    }
    this.gcExpired();
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.pending.set(sessionId, {
      query: body.query.trim(),
      history: body.history,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return { sessionId };
  }

  @Sse('stream')
  stream(
    @Query('sessionId') sessionId?: string,
    @Query('query') query?: string,
  ): Observable<StreamEvent> {
    const session = sessionId ? this.pending.get(sessionId) : undefined;
    if (sessionId) this.pending.delete(sessionId);

    const finalQuery = session?.query ?? query;
    if (!finalQuery?.trim()) {
      throw new BadRequestException('query 不能为空');
    }
    return this.analysisService.stream(finalQuery, session?.history);
  }

  @Post('invoke')
  invoke(@Body() body: StreamBody) {
    return this.analysisService.invoke(body.query, body.history);
  }

  private gcExpired(): void {
    const now = Date.now();
    for (const [id, sess] of this.pending) {
      if (sess.expiresAt < now) this.pending.delete(id);
    }
  }
}
