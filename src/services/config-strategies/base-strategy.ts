import { ApiKeyConfig, ConfigurationTarget } from '../../types/claude-settings';
import { Logger } from '../../utils/logger';

export abstract class ConfigurationStrategy {
  protected readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Set an API key for a specific provider
   */
  public abstract setApiKey(provider: string, apiKey: string, target: ConfigurationTarget): Promise<void>;

  /**
   * Get an API key for a specific provider
   */
  public abstract getApiKey(provider: string): Promise<string | undefined>;

  /**
   * Remove an API key for a specific provider
   */
  public abstract removeApiKey(provider: string, target: ConfigurationTarget): Promise<void>;

  /**
   * Get all API keys
   */
  public abstract getApiKeys(): Promise<ApiKeyConfig>;

  /**
   * Set all API keys
   */
  public abstract setApiKeys(apiKeys: ApiKeyConfig, target: ConfigurationTarget): Promise<void>;

  /**
   * Validate the configuration for this strategy
   */
  public abstract validateConfiguration(): Promise<{ isValid: boolean; issues: string[] }>;

  /**
   * Check if the strategy supports a specific provider
   */
  public abstract supportsProvider(provider: string): boolean;

  /**
   * Get the storage method used by this strategy
   */
  public abstract getStorageMethod(): 'vs-code-settings' | 'environment-variables' | 'hybrid';

  /**
   * Get configuration description for UI display
   */
  public abstract getConfigurationDescription(): string;

  /**
   * Check if the strategy requires environment setup
   */
  public abstract requiresEnvironmentSetup(): boolean;

  /**
   * Get required environment variables for this strategy
   */
  public abstract getRequiredEnvironmentVariables(): string[];

  /**
   * Test if the configuration is working
   */
  public abstract testConfiguration(): Promise<{ success: boolean; message: string }>;

  /**
   * Get configuration status for UI
   */
  public abstract getConfigurationStatus(): Promise<{
    isConfigured: boolean;
    providerStatus: Record<string, { configured: boolean; lastTested?: number; message?: string }>;
  }>;

  /**
   * Clean up resources used by this strategy
   */
  public abstract dispose(): void;

  /**
   * Helper method to validate API key format
   */
  protected validateApiKeyFormat(apiKey: string, provider: string): { isValid: boolean; message: string } {
    if (!apiKey || apiKey.trim().length === 0) {
      return { isValid: false, message: 'API key cannot be empty' };
    }

    switch (provider.toLowerCase()) {
      case 'anthropic':
        if (!apiKey.startsWith('sk-ant-')) {
          return { isValid: false, message: 'Anthropic API keys must start with "sk-ant-"' };
        }
        if (apiKey.length < 20) {
          return { isValid: false, message: 'Anthropic API key appears too short' };
        }
        break;
      
      case 'zai':
        // Z.ai keys are typically UUIDs or similar format
        if (apiKey.length < 10) {
          return { isValid: false, message: 'Z.ai API key appears too short' };
        }
        break;
      
      default:
        // Basic validation for other providers
        if (apiKey.length < 5) {
          return { isValid: false, message: 'API key appears too short' };
        }
    }

    return { isValid: true, message: 'API key format is valid' };
  }

  /**
   * Helper method to log configuration changes
   */
  protected logConfigurationChange(action: string, provider: string, details?: any): void {
    this.logger.info(`Configuration ${action} for provider: ${provider}`, details);
  }

  /**
   * Helper method to handle configuration errors
   */
  protected handleConfigurationError(error: any, operation: string, provider: string): never {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Failed to ${operation} for provider ${provider}`, error);
    throw new Error(`Failed to ${operation} for ${provider}: ${message}`);
  }
}