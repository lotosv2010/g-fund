import { createDeepAgent, type DeepAgent, type DeepAgentTypeConfig } from 'deepagents';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { buildSystemPrompt } from './prompt';

const AGENT_NAME = 'g-fund-analyst';
const DEFAULT_RECURSION_LIMIT = 50;

export type StreamEventKind = 'thinking' | 'tool_call' | 'tool_result';

export interface StreamEvent {
  readonly kind: StreamEventKind;
  readonly tool?: string;
  readonly content: string;
}

export type OnStreamFn = (event: StreamEvent) => Promise<void> | void;

export interface CreateAgentParams {
  readonly model: BaseLanguageModel;
  readonly tools: StructuredToolInterface[];
  readonly query: string;
  readonly maxIterations?: number;
  readonly onStream?: OnStreamFn;
}

export interface AgentResult {
  readonly output: string;
  readonly messages: BaseMessage[];
  readonly truncated: boolean;
}

export function createAgent(
  model: BaseLanguageModel,
  tools: StructuredToolInterface[],
): DeepAgent<DeepAgentTypeConfig> {
  return createDeepAgent({
    model,
    name: AGENT_NAME,
    tools,
    systemPrompt: buildSystemPrompt(),
  });
}

export async function runAgent(params: CreateAgentParams): Promise<AgentResult> {
  const agent = createAgent(params.model, params.tools);
  const recursionLimit = params.maxIterations ?? DEFAULT_RECURSION_LIMIT;

  const messages: BaseMessage[] = [];
  const seenIds = new Set<string>();
  let truncated = false;

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(params.query)] },
      { recursionLimit },
    );

    for await (const chunk of stream) {
      const nodeMessages: BaseMessage[] = Object.values(chunk).flatMap((v: unknown) => {
        const node = v as { messages?: BaseMessage[] };
        return node?.messages ?? [];
      });

      for (const msg of nodeMessages) {
        const key = messageKey(msg);
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        messages.push(msg);

        if (params.onStream) {
          await dispatchEvent(msg, params.onStream).catch(() => {});
        }
      }
    }
  } catch (err) {
    if (isRecursionLimitError(err)) {
      truncated = true;
    } else {
      throw err;
    }
  }

  const lastAiMessage = [...messages].reverse().find(AIMessage.isInstance);
  let output = lastAiMessage ? extractText(lastAiMessage.content) : '';
  if (truncated) {
    const tail = '\n\n> ⚠️ 已达到最大推理步数，以上为当前阶段性结论。';
    output = output ? output + tail : '已达到最大推理步数，未能完成分析。';
  }

  return { output, messages, truncated };
}

async function dispatchEvent(msg: BaseMessage, onStream: OnStreamFn): Promise<void> {
  if (AIMessage.isInstance(msg)) {
    const text = extractText(msg.content);
    if (text.trim()) {
      await onStream({ kind: 'thinking', content: text });
    }
    const toolCalls = msg.tool_calls ?? [];
    for (const call of toolCalls) {
      await onStream({
        kind: 'tool_call',
        tool: call.name,
        content: safeStringify(call.args).slice(0, 800),
      });
    }
    return;
  }

  if (ToolMessage.isInstance(msg)) {
    await onStream({
      kind: 'tool_result',
      tool: msg.name ?? 'tool',
      content: extractText(msg.content).slice(0, 2000),
    });
  }
}

function messageKey(msg: BaseMessage): string {
  if (msg.id) return msg.id;
  return `${msg.getType()}:${extractText(msg.content).slice(0, 64)}:${Math.random()}`;
}

function extractText(content: BaseMessage['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block): block is { type: 'text'; text: string } =>
        typeof block === 'object' && block !== null && block.type === 'text',
      )
      .map((block) => block.text)
      .join('\n');
  }
  return String(content);
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecursionLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /recursion limit/i.test(err.message);
}
