import { ChatOpenAI } from '@langchain/openai';
import type { AiConfig } from '@g-fund/types';

export function createLlmFromConfig(aiConfig: AiConfig): ChatOpenAI {
  const { activeProvider, providers } = aiConfig;
  const p = providers[activeProvider];

  console.log(`[agent] provider=${activeProvider} model=${p.modelName}`);

  return new ChatOpenAI({
    model: p.modelName,
    apiKey: p.apiKey,
    temperature: p.temperature,
    configuration: { baseURL: p.baseURL },
    ...(p.thinking
      ? { modelKwargs: { thinking: { type: 'enabled' }, reasoning_effort: 'high' } }
      : {}),
  });
}
