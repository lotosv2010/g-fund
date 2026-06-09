import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, asc, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@g-fund/db';
import { DB } from '../db/db.module';
import type {
  ChatMessage,
  ChatSessionDetail,
  ChatSessionSummary,
  PersistChatMessageDto,
} from '@g-fund/types';

type DbType = NodePgDatabase<typeof schema>;
type SessionRow = typeof schema.chatSessions.$inferSelect;
type MessageRow = typeof schema.chatMessages.$inferSelect;

const TITLE_MAX_LEN = 40;

function toSummary(r: SessionRow): ChatSessionSummary {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toMessage(r: MessageRow): ChatMessage {
  const ts = r.createdAt.getTime();
  const id = String(r.id);
  switch (r.kind) {
    case 'user':
      return { kind: 'user', id, content: r.content, timestamp: ts };
    case 'assistant':
      return {
        kind: 'assistant',
        id,
        content: r.content,
        timestamp: ts,
        truncated: r.truncated,
      };
    case 'thinking':
      return { kind: 'thinking', id, content: r.content, timestamp: ts };
    case 'tool_call':
      return { kind: 'tool_call', id, tool: r.tool ?? 'tool', content: r.content, timestamp: ts };
    case 'tool_result':
      return { kind: 'tool_result', id, tool: r.tool ?? 'tool', content: r.content, timestamp: ts };
    case 'error':
      return { kind: 'error', id, content: r.content, timestamp: ts };
    default:
      return { kind: 'assistant', id, content: r.content, timestamp: ts };
  }
}

function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '新对话';
  return trimmed.length > TITLE_MAX_LEN ? `${trimmed.slice(0, TITLE_MAX_LEN)}…` : trimmed;
}

@Injectable()
export class ChatService {
  constructor(@Inject(DB) private readonly db: DbType) {}

  async listSessions(): Promise<ChatSessionSummary[]> {
    const rows = await this.db
      .select()
      .from(schema.chatSessions)
      .orderBy(desc(schema.chatSessions.updatedAt));
    return rows.map(toSummary);
  }

  async createSession(title?: string): Promise<ChatSessionSummary> {
    const [row] = await this.db
      .insert(schema.chatSessions)
      .values({ title: title?.trim() || '新对话' })
      .returning();
    return toSummary(row);
  }

  async getSession(id: number): Promise<ChatSessionDetail> {
    const [session] = await this.db
      .select()
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.id, id));
    if (!session) throw new NotFoundException(`会话 #${id} 不存在`);
    const messages = await this.db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, id))
      .orderBy(asc(schema.chatMessages.id));
    return { ...toSummary(session), messages: messages.map(toMessage) };
  }

  async renameSession(id: number, title: string): Promise<ChatSessionSummary> {
    const trimmed = title.trim();
    if (!trimmed) throw new NotFoundException('标题不能为空');
    const [row] = await this.db
      .update(schema.chatSessions)
      .set({ title: trimmed.slice(0, 120), updatedAt: new Date() })
      .where(eq(schema.chatSessions.id, id))
      .returning();
    if (!row) throw new NotFoundException(`会话 #${id} 不存在`);
    return toSummary(row);
  }

  async deleteSession(id: number): Promise<void> {
    const result = await this.db
      .delete(schema.chatSessions)
      .where(eq(schema.chatSessions.id, id))
      .returning({ id: schema.chatSessions.id });
    if (result.length === 0) throw new NotFoundException(`会话 #${id} 不存在`);
  }

  async appendMessage(
    sessionId: number,
    dto: PersistChatMessageDto,
  ): Promise<ChatMessage> {
    const [session] = await this.db
      .select({ id: schema.chatSessions.id, title: schema.chatSessions.title })
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.id, sessionId));
    if (!session) throw new NotFoundException(`会话 #${sessionId} 不存在`);

    const [row] = await this.db
      .insert(schema.chatMessages)
      .values({
        sessionId,
        role: dto.role,
        kind: dto.kind,
        content: dto.content,
        tool: dto.tool ?? null,
        truncated: dto.truncated ?? false,
      })
      .returning();

    const updates: Partial<typeof schema.chatSessions.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (session.title === '新对话' && dto.role === 'user' && dto.content.trim()) {
      updates.title = deriveTitle(dto.content);
    }
    await this.db
      .update(schema.chatSessions)
      .set(updates)
      .where(eq(schema.chatSessions.id, sessionId));

    return toMessage(row);
  }
}
