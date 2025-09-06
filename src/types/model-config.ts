export interface ModelProvider {
  name: string;
  displayName: string;
  baseUrl: string;
  requiresApiKey: boolean;
  description?: string;
}

export interface ModelConfig {
  name: string;
  displayName: string;
  description: string;
  endpoint: string;
  type: 'web' | 'api';
  provider?: string;
  capabilities?: ModelCapabilities;
  limits?: ModelLimits;
  metadata?: ModelMetadata;
  storageStrategy?: 'vs-code-settings' | 'environment-variables' | 'hybrid';
  requiresEnvironmentSetup?: boolean;
  environmentVariables?: Record<string, string>;
}

export interface ModelCapabilities {
  maxTokens?: number;
  supportsImages?: boolean;
  supportsFiles?: boolean;
  supportsCodeExecution?: boolean;
  supportsWebSearch?: boolean;
  contextWindow?: number;
}

export interface ModelLimits {
  requestsPerMinute?: number;
  requestsPerDay?: number;
  tokensPerMinute?: number;
  maxConcurrentRequests?: number;
}

export interface ModelMetadata {
  version?: string;
  releaseDate?: string;
  parameterCount?: string;
  trainingCutoff?: string;
  pricing?: {
    inputTokens?: number;
    outputTokens?: number;
    currency?: string;
    unit?: string;
  };
}

export interface ModelSwitchResult {
  success: boolean;
  previousModel: string;
  newModel: string;
  requiresReload: boolean;
  message?: string;
  error?: string;
}

export interface ModelValidationResult {
  isValid: boolean;
  model: ModelConfig;
  issues: string[];
  warnings: string[];
}

export interface ModelSwitchOptions {
  force?: boolean;
  skipValidation?: boolean;
  skipReload?: boolean;
  showNotification?: boolean;
  reason?: string;
}

export interface ValidationOptions {
  checkApiKey?: boolean;
  checkEndpoint?: boolean;
  testConnection?: boolean;
  timeout?: number;
}

export type ModelType = 'web' | 'api';
export type ReloadBehavior = 'prompt' | 'auto' | 'skip';

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    name: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    description: 'Latest Sonnet model for balanced performance',
    endpoint: 'https://api.anthropic.com',
    type: 'web',
    provider: 'anthropic',
    storageStrategy: 'vs-code-settings',
    capabilities: {
      maxTokens: 4096,
      supportsImages: true,
      supportsFiles: true,
      supportsCodeExecution: true,
      contextWindow: 200000
    }
  },
  {
    name: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    description: 'Fast and compact model for quick tasks',
    endpoint: 'https://api.anthropic.com',
    type: 'web',
    provider: 'anthropic',
    storageStrategy: 'vs-code-settings',
    capabilities: {
      maxTokens: 4096,
      supportsImages: true,
      supportsFiles: true,
      contextWindow: 200000
    }
  },
  {
    name: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    description: 'Most capable model for complex tasks',
    endpoint: 'https://api.anthropic.com',
    type: 'web',
    provider: 'anthropic',
    storageStrategy: 'vs-code-settings',
    capabilities: {
      maxTokens: 4096,
      supportsImages: true,
      supportsFiles: true,
      supportsCodeExecution: true,
      supportsWebSearch: true,
      contextWindow: 200000
    }
  },
  {
    name: 'glm-4.5',
    displayName: 'GLM-4.5',
    description: 'Z.ai\'s powerful reasoning model (355B params)',
    endpoint: 'https://api.z.ai/api/anthropic',
    type: 'api',
    provider: 'z-ai',
    storageStrategy: 'environment-variables',
    requiresEnvironmentSetup: true,
    environmentVariables: {
      ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
      ANTHROPIC_AUTH_TOKEN: ''
    },
    capabilities: {
      maxTokens: 4096,
      contextWindow: 128000
    },
    metadata: {
      parameterCount: '355B'
    }
  },
  {
    name: 'glm-4.5-air',
    displayName: 'GLM-4.5-Air',
    description: 'Z.ai\'s lightweight model (cost-effective)',
    endpoint: 'https://api.z.ai/api/anthropic',
    type: 'api',
    provider: 'z-ai',
    storageStrategy: 'environment-variables',
    requiresEnvironmentSetup: true,
    environmentVariables: {
      ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
      ANTHROPIC_AUTH_TOKEN: ''
    },
    capabilities: {
      maxTokens: 4096,
      contextWindow: 128000
    }
  }
];