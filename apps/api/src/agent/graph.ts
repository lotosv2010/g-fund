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
const MAX_HISTORY_TURNS = 20;

export type StreamEventKind = 'thinking' | 'tool_call' | 'tool_result';

export interface StreamEventMetadata {
  readonly fundCode?: string;
  readonly phase?: string;
  readonly signal?: string;
}

export interface StreamEvent {
  readonly kind: StreamEventKind;
  readonly tool?: string;
  readonly content: string;
  readonly metadata?: StreamEventMetadata;
}

export type OnStreamFn = (event: StreamEvent) => Promise<void> | void;

export interface HistoryTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface CreateAgentParams {
  readonly model: BaseLanguageModel;
  readonly tools: StructuredToolInterface[];
  readonly query: string;
  readonly history?: ReadonlyArray<HistoryTurn>;
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

  const initialMessages = buildInitialMessages(params.history, params.query);

  try {
    const stream = await agent.stream(
      { messages: initialMessages },
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

function buildInitialMessages(
  history: ReadonlyArray<HistoryTurn> | undefined,
  query: string,
): BaseMessage[] {
  const turns = (history ?? []).slice(-MAX_HISTORY_TURNS);
  const result: BaseMessage[] = [];
  for (const turn of turns) {
    if (!turn.content?.trim()) continue;
    result.push(
      turn.role === 'assistant'
        ? new AIMessage(turn.content)
        : new HumanMessage(turn.content),
    );
  }
  result.push(new HumanMessage(query));
  return result;
}

async function dispatchEvent(msg: BaseMessage, onStream: OnStreamFn): Promise<void> {
  if (AIMessage.isInstance(msg)) {
    const text = extractText(msg.content);
    if (text.trim()) {
      await onStream({ kind: 'thinking', content: text });
    }
    const toolCalls = msg.tool_calls ?? [];
    for (const call of toolCalls) {
      const metadata = extractMetadataFromArgs(call.name, call.args);
      await onStream({
        kind: 'tool_call',
        tool: call.name,
        content: safeStringify(call.args).slice(0, 800),
        metadata,
      });
    }
    return;
  }

  if (ToolMessage.isInstance(msg)) {
    const content = extractText(msg.content);
    const metadata = extractMetadataFromResult(msg.name, content);
    await onStream({
      kind: 'tool_result',
      tool: msg.name ?? 'tool',
      content: content.slice(0, 2000),
      metadata,
    });
  }
}

function extractMetadataFromArgs(toolName: string, args: Record<string, unknown> | undefined): StreamEventMetadata | undefined {
  if (!args) return undefined;
  const fundCode = extractFundCodeFromArgs(args);
  if (!fundCode) return undefined;

  const phase = inferPhaseFromTool(toolName);
  return { fundCode, phase };
}

function extractFundCodeFromArgs(args: Record<string, unknown>): string | undefined {
  if (typeof args.fundCode === 'string') return args.fundCode;
  if (typeof args.fundCodes === 'string') return args.fundCodes;
  if (Array.isArray(args.fundCodes) && args.fundCodes.length > 0) return String(args.fundCodes[0]);
  return undefined;
}

function inferPhaseFromTool(toolName: string): string | undefined {
  if (toolName === 'getDcaPlan') return 'dca';
  if (toolName === 'getStopLossSignals' || toolName === 'getDeepLossDiagnosis') return 'holding';
  if (toolName === 'getFundStage') return undefined;
  return undefined;
}

function extractMetadataFromResult(toolName: string | undefined, content: string): StreamEventMetadata | undefined {
  if (!toolName) return undefined;

  try {
    const parsed = JSON.parse(content);

    if (toolName === 'getDcaPlan' && Array.isArray(parsed) && parsed.length > 0) {
      return { fundCode: parsed[0].fundCode, phase: 'dca' };
    }

    if ((toolName === 'getStopLossSignals' || toolName === 'getDeepLossDiagnosis') && Array.isArray(parsed) && parsed.length > 0) {
      return { fundCode: parsed[0].fundCode, signal: parsed[0].signalType };
    }

    if (toolName === 'getFundStage' && parsed.lifecycleStage) {
      return { phase: parsed.lifecycleStage };
    }
  } catch {
    // non-JSON result, skip metadata extraction
  }

  return undefined;
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
