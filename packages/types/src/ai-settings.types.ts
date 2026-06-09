export type AiProvider = 'deepseek' | 'moonshot' | 'minimax' | 'xiaomi';

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  deepseek: 'DeepSeek',
  moonshot: 'Kimi',
  minimax: 'MiniMax',
  xiaomi: '小米AI',
};

export const PROVIDER_MODEL_PRESETS: Record<AiProvider, string[]> = {
  deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  moonshot: ['kimi-k2.6', 'kimi-k2.5'],
  minimax: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.5'],
  xiaomi: ['mimo-v2.5-pro', 'mimo-v2-pro', 'mimo-v2.5'],
};

export const AI_PROVIDER_DEFAULTS: Record<AiProvider, ProviderConfig> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    apiKey: '',
    modelName: 'deepseek-v4-pro',
    temperature: 1,
    thinking: false,
  },
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    apiKey: '',
    modelName: 'kimi-k2.6',
    temperature: 1,
    thinking: false,
  },
  minimax: {
    baseURL: 'https://api.minimaxi.com/v1',
    apiKey: '',
    modelName: 'MiniMax-M3',
    temperature: 1,
    thinking: false,
  },
  xiaomi: {
    baseURL: 'https://token-plan-cn.xiaomimimo.com/v1',
    apiKey: '',
    modelName: 'mimo-v2.5-pro',
    temperature: 1,
    thinking: false,
  },
};

export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  thinking: boolean;
}

export interface AiConfig {
  activeProvider: AiProvider;
  providers: Record<AiProvider, ProviderConfig>;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  enabled: boolean;
}

export type McpConfig = McpServer[];

export const DEFAULT_AI_CONFIG: AiConfig = {
  activeProvider: 'deepseek',
  providers: { ...AI_PROVIDER_DEFAULTS },
};

export const DEFAULT_MCP_CONFIG: McpConfig = [];
