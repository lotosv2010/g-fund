import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ConfigService } from '@nestjs/config';

type ModelId =
  | 'deepseek'
  | 'deepseek-reasoner'
  | 'gemini'
  | 'moonshot'
  | 'minimax'
  | 'ollama';

type ApiProtocol = 'deepseek' | 'openai' | 'google' | 'ollama';

interface ModelConfig {
  readonly protocol: ApiProtocol;
  readonly baseURL?: string;
  readonly apiKey?: string;
  readonly modelName: string;
  readonly extraKwargs?: Readonly<Record<string, unknown>>;
}

function buildRegistry(config: ConfigService): Record<ModelId, ModelConfig> {
  return {
    deepseek: {
      protocol: 'deepseek',
      baseURL: config.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
      apiKey: config.get<string>('DEEPSEEK_API_KEY'),
      modelName: config.get<string>('DEEPSEEK_MODEL', 'deepseek-chat'),
    },
    'deepseek-reasoner': {
      protocol: 'deepseek',
      baseURL: config.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
      apiKey: config.get<string>('DEEPSEEK_API_KEY'),
      modelName: config.get<string>('DEEPSEEK_REASONER_MODEL', 'deepseek-reasoner'),
    },
    gemini: {
      protocol: 'google',
      apiKey: config.get<string>('GEMINI_API_KEY'),
      modelName: config.get<string>('GEMINI_MODEL', 'gemini-2.0-flash'),
    },
    moonshot: {
      protocol: 'openai',
      baseURL: config.get<string>('MOONSHOT_BASE_URL', 'https://api.moonshot.cn/v1'),
      apiKey: config.get<string>('MOONSHOT_API_KEY'),
      modelName: config.get<string>('MOONSHOT_MODEL', 'moonshot-v1-auto'),
      extraKwargs: { thinking: { type: 'disabled' } },
    },
    minimax: {
      protocol: 'openai',
      baseURL: config.get<string>('MINIMAX_BASE_URL', 'https://api.minimax.chat/v1'),
      apiKey: config.get<string>('MINIMAX_API_KEY'),
      modelName: config.get<string>('MINIMAX_MODEL', 'MiniMax-Text-01'),
    },
    ollama: {
      protocol: 'ollama',
      baseURL: config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434'),
      modelName: config.get<string>('OLLAMA_MODEL', 'qwen3:latest'),
    },
  };
}

const CLIENT_FACTORY: Record<ApiProtocol, (config: ModelConfig) => BaseLanguageModel> = {
  deepseek: (c) =>
    new ChatDeepSeek({
      apiKey: c.apiKey,
      model: c.modelName,
      configuration: { baseURL: c.baseURL },
    }),

  openai: (c) =>
    new ChatOpenAI({
      model: c.modelName,
      apiKey: c.apiKey,
      configuration: { baseURL: c.baseURL },
      ...(c.extraKwargs ? { modelKwargs: c.extraKwargs } : {}),
    }),

  google: (c) =>
    new ChatGoogleGenerativeAI({
      apiKey: c.apiKey,
      model: c.modelName,
    }) as unknown as BaseLanguageModel,

  ollama: (c) =>
    new ChatOllama({
      model: c.modelName,
      baseUrl: c.baseURL,
      temperature: 0,
      maxRetries: 2,
    }),
};

export function createLlm(config: ConfigService): BaseLanguageModel {
  const id = (config.get<string>('LLM_PROVIDER') ?? 'deepseek') as ModelId;
  const registry = buildRegistry(config);
  const modelConfig = registry[id];
  if (!modelConfig) throw new Error(`Unknown LLM provider: ${id}`);

  if (modelConfig.protocol !== 'ollama' && !modelConfig.apiKey) {
    throw new Error(`Missing API key for provider "${id}"`);
  }

  const factory = CLIENT_FACTORY[modelConfig.protocol];
  console.log(`[agent] Using LLM provider=${id} model=${modelConfig.modelName}`);
  return factory(modelConfig);
}
