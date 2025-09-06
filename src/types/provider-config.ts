import { ModelConfig } from './model-config';

export enum StorageMethod {
  VS_CODE_SETTINGS = 'vs-code-settings',
  ENVIRONMENT_VARIABLES = 'environment-variables',
  HYBRID = 'hybrid'
}

export interface ProviderMetadata {
  id: string;
  name: string;
  displayName: string;
  description: string;
  storageMethod: StorageMethod;
  requiredEnvironmentVariables?: string[];
  supportsApiKeyStorage?: boolean;
  requiresEnvironmentSetup?: boolean;
  baseUrl?: string;
  documentationUrl?: string;
  icon?: string;
  category?: 'official' | 'third-party' | 'custom';
}

export interface ProviderConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  storageMethod: StorageMethod;
  environmentVariables?: Record<string, string>;
  customSettings?: Record<string, any>;
  isConfigured: boolean;
  lastValidated?: Date;
  validationStatus?: 'valid' | 'invalid' | 'pending' | 'unknown';
}

export interface ProviderValidationResult {
  isValid: boolean;
  provider: string;
  issues: string[];
  warnings: string[];
  suggestions: string[];
  canAutoFix?: boolean;
}

export interface ProviderSetupOptions {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  environmentVariables?: Record<string, string>;
  storageMethod?: StorageMethod;
  autoValidate?: boolean;
  skipRestartPrompt?: boolean;
}

export interface ProviderSetupResult {
  success: boolean;
  provider: string;
  message: string;
  requiresRestart?: boolean;
  validationResults?: ProviderValidationResult;
  nextSteps?: string[];
}

export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  'anthropic': {
    id: 'anthropic',
    name: 'anthropic',
    displayName: 'Anthropic',
    description: 'Official Anthropic API provider',
    storageMethod: StorageMethod.VS_CODE_SETTINGS,
    supportsApiKeyStorage: true,
    baseUrl: 'https://api.anthropic.com',
    documentationUrl: 'https://docs.anthropic.com/claude/docs',
    category: 'official'
  },
  'z-ai': {
    id: 'z-ai',
    name: 'z-ai',
    displayName: 'Z.ai',
    description: 'Z.ai third-party provider with Anthropic compatibility',
    storageMethod: StorageMethod.ENVIRONMENT_VARIABLES,
    requiredEnvironmentVariables: ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'],
    requiresEnvironmentSetup: true,
    baseUrl: 'https://api.z.ai/api/anthropic',
    documentationUrl: 'https://z.ai/docs',
    category: 'third-party'
  },
  'custom': {
    id: 'custom',
    name: 'custom',
    displayName: 'Custom Provider',
    description: 'Custom API provider configuration',
    storageMethod: StorageMethod.HYBRID,
    supportsApiKeyStorage: true,
    category: 'custom'
  }
};

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    provider: 'anthropic',
    storageMethod: StorageMethod.VS_CODE_SETTINGS,
    isConfigured: false,
    validationStatus: 'unknown'
  },
  {
    provider: 'z-ai',
    storageMethod: StorageMethod.ENVIRONMENT_VARIABLES,
    isConfigured: false,
    validationStatus: 'unknown'
  }
];

export function getProviderMetadata(provider: string): ProviderMetadata | undefined {
  return PROVIDER_METADATA[provider];
}

export function getProviderConfig(provider: string): ProviderMetadata | undefined {
  return PROVIDER_METADATA[provider];
}

export function getProviderStorageMethod(provider: string): StorageMethod {
  const metadata = getProviderMetadata(provider);
  return metadata?.storageMethod || StorageMethod.VS_CODE_SETTINGS;
}

export function getRequiredEnvironmentVariables(provider: string): string[] {
  const metadata = getProviderMetadata(provider);
  return metadata?.requiredEnvironmentVariables || [];
}

export function requiresEnvironmentSetup(provider: string): boolean {
  const metadata = getProviderMetadata(provider);
  return metadata?.requiresEnvironmentSetup || false;
}

export function supportsApiKeyStorage(provider: string): boolean {
  const metadata = getProviderMetadata(provider);
  return metadata?.supportsApiKeyStorage || false;
}

export function getProviderForModel(model: ModelConfig): string {
  return model.provider || 'anthropic';
}

export function getModelsByProvider(models: ModelConfig[], provider: string): ModelConfig[] {
  return models.filter(model => model.provider === provider);
}

export function validateProviderConfig(config: ProviderConfig): ProviderValidationResult {
  const result: ProviderValidationResult = {
    isValid: true,
    provider: config.provider,
    issues: [],
    warnings: [],
    suggestions: []
  };

  const metadata = getProviderMetadata(config.provider);
  if (!metadata) {
    result.isValid = false;
    result.issues.push(`Unknown provider: ${config.provider}`);
    return result;
  }

  switch (metadata.storageMethod) {
    case StorageMethod.VS_CODE_SETTINGS:
      if (!config.apiKey && metadata.supportsApiKeyStorage) {
        result.isValid = false;
        result.issues.push('API key is required for this provider');
        result.suggestions.push('Configure API key in extension settings');
      }
      break;

    case StorageMethod.ENVIRONMENT_VARIABLES:
      if (metadata.requiredEnvironmentVariables) {
        const missingVars = metadata.requiredEnvironmentVariables.filter(
          varName => !config.environmentVariables?.[varName]
        );
        
        if (missingVars.length > 0) {
          result.isValid = false;
          result.issues.push(`Missing environment variables: ${missingVars.join(', ')}`);
          result.suggestions.push('Set up environment variables for this provider');
          result.canAutoFix = true;
        }
      }
      break;

    case StorageMethod.HYBRID:
      if (!config.apiKey && !config.environmentVariables) {
        result.warnings.push('No API key or environment variables configured');
        result.suggestions.push('Configure either API key or environment variables');
      }
      break;
  }

  if (config.baseUrl && !config.baseUrl.startsWith('http')) {
    result.isValid = false;
    result.issues.push('Invalid base URL format');
  }

  return result;
}

export function createProviderConfig(options: ProviderSetupOptions): ProviderConfig {
  const metadata = getProviderMetadata(options.provider);
  const storageMethod = options.storageMethod || metadata?.storageMethod || StorageMethod.VS_CODE_SETTINGS;

  return {
    provider: options.provider,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl || metadata?.baseUrl,
    storageMethod,
    environmentVariables: options.environmentVariables,
    customSettings: {},
    isConfigured: false,
    validationStatus: 'pending'
  };
}