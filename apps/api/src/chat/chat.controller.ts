import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Sse,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatStreamService, type StreamEvent } from './chat-stream.service';
import {
  AppendMessageDto,
  CreateSessionDto,
  RenameSessionDto,
} from './dto/chat.dto';
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

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  private readonly pending = new Map<string, PendingSession>();

  constructor(
    private readonly chatService: ChatService,
    private readonly chatStreamService: ChatStreamService,
  ) {}

  // ── SSE 流式推理 ──────────────────────────────────

  @Post('stream/sessions')
  @ApiOperation({ summary: '创建流式会话（返回 sessionId 供 SSE 连接）' })
  createStreamSession(@Body() body: StreamBody): { sessionId: string } {
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
  @ApiOperation({ summary: 'SSE 流式推理' })
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
    return this.chatStreamService.stream(finalQuery, session?.history);
  }

  @Post('invoke')
  @ApiOperation({ summary: '同步推理（非流式）' })
  invoke(@Body() body: StreamBody) {
    return this.chatStreamService.invoke(body.query, body.history);
  }

  // ── 会话 CRUD ─────────────────────────────────────

  @Get('sessions')
  @ApiOperation({ summary: '会话列表' })
  list() {
    return this.chatService.listSessions();
  }

  @Post('sessions')
  @ApiOperation({ summary: '新建持久化会话' })
  create(@Body() dto: CreateSessionDto) {
    return this.chatService.createSession(dto.title);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: '会话详情（含全部消息）' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.getSession(id);
  }

  @Patch('sessions/:id')
  @ApiOperation({ summary: '重命名会话' })
  rename(@Param('id', ParseIntPipe) id: number, @Body() dto: RenameSessionDto) {
    return this.chatService.renameSession(id, dto.title);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '删除会话' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.deleteSession(id);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: '追加消息（前端 SSE 完成后调用）' })
  appendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AppendMessageDto,
  ) {
    return this.chatService.appendMessage(id, dto);
  }

  private gcExpired(): void {
    const now = Date.now();
    for (const [id, sess] of this.pending) {
      if (sess.expiresAt < now) this.pending.delete(id);
    }
  }
}
