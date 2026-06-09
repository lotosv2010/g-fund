import { createDeepAgent, type DeepAgent, type DeepAgentTypeConfig } from 'deepagents';
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { buildSystemPrompt } from './prompt';

const AGENT_NAME = 'g-fund-analyst';

export type OnToolCallFn = (toolName: string, phase: 'call' | 'result', content: string) => Promise<void>;

export interface CreateAgentParams {
  readonly model: BaseLanguageModel;
  readonly tools: StructuredToolInterface[];
  readonly query: string;
  readonly maxIterations?: number;
  readonly onToolCall?: OnToolCallFn;
}

export interface AgentResult {
  readonly output: string;
  readonly messages: BaseMessage[];
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
  const wrappedParams = params.onToolCall
    ? { ...params, tools: wrapToolsWithCallback(params.tools, params.onToolCall) }
    : params;

  const agent = createAgent(wrappedParams.model, wrappedParams.tools);

  const messages: BaseMessage[] = [];
  const stream = await agent.stream(
    { messages: [new HumanMessage(params.query)] },
    { recursionLimit: params.maxIterations ?? 30 },
  );

  for await (const chunk of stream) {
    const nodeMessages: BaseMessage[] = Object.values(chunk).flatMap((v: unknown) => {
      const node = v as { messages?: BaseMessage[] };
      return node?.messages ?? [];
    });

    for (const msg of nodeMessages) {
      messages.push(msg);
      if (AIMessage.isInstance(msg) && params.onToolCall) {
        const text = extractText(msg.content);
        if (text) {
          await params.onToolCall('__thinking__', 'result', text.slice(0, 500)).catch(() => {});
        }
      }
    }
  }

  const lastAiMessage = [...messages].reverse().find(AIMessage.isInstance);
  const output = lastAiMessage ? extractText(lastAiMessage.content) : '';

  return { output, messages };
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

function wrapToolsWithCallback(
  tools: readonly StructuredToolInterface[],
  onToolCall: OnToolCallFn,
): StructuredToolInterface[] {
  return tools.map((t) => {
    const originalInvoke = t.invoke.bind(t);
    const wrapped = Object.create(t);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wrapped.invoke = async (input: any, config?: any) => {
      const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
      await onToolCall(t.name, 'call', inputStr.slice(0, 500)).catch(() => {});

      const result = await originalInvoke(input, config);

      let resultStr: string;
      if (typeof result === 'string') {
        resultStr = result;
      } else if (result && typeof result === 'object' && 'content' in result) {
        resultStr = String((result as { content: unknown }).content);
      } else {
        resultStr = JSON.stringify(result) ?? '';
      }
      await onToolCall(t.name, 'result', resultStr.slice(0, 2000)).catch(() => {});
      return result;
    };
    return wrapped as StructuredToolInterface;
  });
}
