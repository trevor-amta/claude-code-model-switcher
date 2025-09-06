import * as vscode from 'vscode';
import { ConfigurationStrategy } from './base-strategy';
import { ApiKeyConfig, ConfigurationTarget } from '../../types/claude-settings';
import { Logger } from '../../utils/logger';
import { EnvironmentService } from '../environment-service';

export class EnvironmentVariablesStrategy extends ConfigurationStrategy {
  private environmentService: EnvironmentService;
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(logger: Logger, context?: vscode.ExtensionContext) {
    super(logger);
    try {
      this.environmentService = EnvironmentService.getInstance(context);
    } catch (error) {
      this.logger.warn('EnvironmentService not properly initialized, using fallback methods');
      this.environmentService = this.createFallbackEnvironmentService();
    }
  }

  private createFallbackEnvironmentService(): any {
    // Create a minimal implementation for when context is not available
    return {
      getEnvironmentVariable: (name: string) => process.env[name],
      setEnvironmentVariable: async (name: string, value: string) => {
        process.env[name] = value;
      },
      setupZaiEnvironment: async (_apiKey: string) => {
        throw new Error('Environment setup requires extension context');
      },
      checkEnvironmentSetup: async () => ({ isSetup: false, issues: ['Environment service not properly initialized'] }),
      dispose: () => {}
    };
  }

  public async setApiKey(provider: string, apiKey: string, _target: ConfigurationTarget): Promise<void> {
    try {
      const validation = this.validateApiKeyFormat(apiKey, provider);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // For Z.ai, we need to set specific environment variables
      if (provider.toLowerCase() === 'zai') {
        await this.setZaiEnvironmentVariables(apiKey);
      } else {
        // For other providers, set generic environment variable
        const envVarName = this.getEnvironmentVariableName(provider);
        await this.environmentService.setEnvironmentVariable(envVarName, apiKey);
      }

      // Cache the API key
      this.cache.set(provider, { value: apiKey, timestamp: Date.now() });
      
      this.logConfigurationChange('set API key in environment', provider);
      
      // Show restart notification
      await this.showRestartNotification(provider);
    } catch (error) {
      this.handleConfigurationError(error, 'set API key in environment', provider);
    }
  }

  public async getApiKey(provider: string): Promise<string | undefined> {
    try {
      // Check cache first
      const cached = this.cache.get(provider);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.value;
      }

      // For Z.ai, check specific environment variables
      if (provider.toLowerCase() === 'zai') {
        const zaiKey = await this.getZaiApiKey();
        if (zaiKey) {
          this.cache.set(provider, { value: zaiKey, timestamp: Date.now() });
        }
        return zaiKey;
      }

      // For other providers, check generic environment variable
      const envVarName = this.getEnvironmentVariableName(provider);
      const value = this.environmentService.getEnvironmentVariable(envVarName);
      
      if (value) {
        this.cache.set(provider, { value, timestamp: Date.now() });
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Failed to get API key from environment for provider: ${provider}`, error);
      return undefined;
    }
  }

  public async removeApiKey(provider: string, _target: ConfigurationTarget): Promise<void> {
    try {
      if (provider.toLowerCase() === 'zai') {
        await this.removeZaiEnvironmentVariables();
      } else {
        const envVarName = this.getEnvironmentVariableName(provider);
        // Note: EnvironmentService doesn't have removeEnvironmentVariable method
        // We'll set it to empty string instead
        await this.environmentService.setEnvironmentVariable(envVarName, '');
      }

      this.cache.delete(provider);
      this.logConfigurationChange('removed API key from environment', provider);
      
      // Show restart notification
      await this.showRestartNotification(provider);
    } catch (error) {
      this.handleConfigurationError(error, 'remove API key from environment', provider);
    }
  }

  public async getApiKeys(): Promise<ApiKeyConfig> {
    const apiKeys: ApiKeyConfig = {};

    try {
      // Check for Z.ai configuration
      const zaiKey = await this.getZaiApiKey();
      if (zaiKey) {
        apiKeys.zai = zaiKey;
      }

      // Check for other providers (could be extended as needed)
      const providers = ['anthropic', 'openai', 'google'];
      for (const provider of providers) {
        const envVarName = this.getEnvironmentVariableName(provider);
        const value = this.environmentService.getEnvironmentVariable(envVarName);
        if (value) {
          if (provider === 'anthropic' || provider === 'zai') {
            (apiKeys as any)[provider] = value;
          } else {
            // For other providers, store in custom field
            if (!apiKeys.custom) {
              apiKeys.custom = {};
            }
            apiKeys.custom[provider] = value;
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to get API keys from environment variables', error);
    }

    return apiKeys;
  }

  public async setApiKeys(apiKeys: ApiKeyConfig, target: ConfigurationTarget): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      for (const [provider, apiKey] of Object.entries(apiKeys)) {
        if (apiKey) {
          promises.push(this.setApiKey(provider, apiKey, target));
        }
      }

      await Promise.all(promises);
      this.logConfigurationChange('set API keys in environment', 'all providers');
    } catch (error) {
      this.handleConfigurationError(error, 'set API keys in environment', 'all providers');
    }
  }

  public async validateConfiguration(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const apiKeys = await this.getApiKeys();
      
      // Validate each provider's API key
      for (const [provider, apiKey] of Object.entries(apiKeys)) {
        if (apiKey) {
          const validation = this.validateApiKeyFormat(apiKey, provider);
          if (!validation.isValid) {
            issues.push(`${provider}: ${validation.message}`);
          }
        }
      }

      // Check if environment service is working
      try {
        const envServiceStatus = await this.environmentService.checkEnvironmentSetup();
        if (!envServiceStatus.isSetup) {
          issues.push(...envServiceStatus.issues);
        }
      } catch (error) {
        issues.push(`Environment service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Special validation for Z.ai
      if (apiKeys.zai) {
        const zaiValidation = await this.validateZaiSetup();
        if (!zaiValidation.isValid) {
          issues.push(...zaiValidation.issues);
        }
      }

    } catch (error) {
      issues.push(`Environment configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  public supportsProvider(provider: string): boolean {
    // Environment variables strategy primarily supports Z.ai
    // but can be extended for other providers
    const supportedProviders = ['zai'];
    return supportedProviders.includes(provider.toLowerCase());
  }

  public getStorageMethod(): 'vs-code-settings' | 'environment-variables' | 'hybrid' {
    return 'environment-variables';
  }

  public getConfigurationDescription(): string {
    return 'API keys are stored in environment variables. Z.ai requires ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN.';
  }

  public requiresEnvironmentSetup(): boolean {
    return true;
  }

  public getRequiredEnvironmentVariables(): string[] {
    return ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'];
  }

  public async testConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      const validation = await this.validateConfiguration();
      if (validation.isValid) {
        return { success: true, message: 'Environment variables configuration is valid' };
      } else {
        return { 
          success: false, 
          message: `Environment configuration issues: ${validation.issues.join(', ')}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Environment configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  public async getConfigurationStatus(): Promise<{
    isConfigured: boolean;
    providerStatus: Record<string, { configured: boolean; lastTested?: number; message?: string }>;
  }> {
    const providerStatus: Record<string, { configured: boolean; lastTested?: number; message?: string }> = {};
    let isConfigured = false;

    try {
      const apiKeys = await this.getApiKeys();
      const now = Date.now();

      for (const [provider, apiKey] of Object.entries(apiKeys)) {
        if (apiKey) {
          const validation = this.validateApiKeyFormat(apiKey, provider);
          providerStatus[provider] = {
            configured: validation.isValid,
            lastTested: now,
            message: validation.isValid ? 'Environment variable is set and valid' : validation.message
          };
          if (validation.isValid) {
            isConfigured = true;
          }
        } else {
          providerStatus[provider] = {
            configured: false,
            message: 'Environment variable not set'
          };
        }
      }
    } catch (error) {
      this.logger.error('Failed to get environment configuration status', error);
    }

    return { isConfigured, providerStatus };
  }

  public async setupEnvironmentVariables(apiKey?: string): Promise<void> {
    try {
      if (apiKey) {
        await this.environmentService.setupZaiEnvironment(apiKey);
      } else {
        throw new Error('API key is required for environment setup');
      }
      this.logConfigurationChange('setup environment variables', 'Z.ai');
    } catch (error) {
      this.handleConfigurationError(error, 'setup environment variables', 'Z.ai');
    }
  }

  public async verifyEnvironmentSetup(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.environmentService.checkEnvironmentSetup();
      return {
        success: result.isSetup,
        message: result.isSetup ? 'Environment setup is valid' : result.issues.join(', ')
      };
    } catch (error) {
      return {
        success: false,
        message: `Environment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  public dispose(): void {
    this.cache.clear();
    this.environmentService.dispose();
    this.logger.info('Environment variables strategy disposed');
  }

  private async setZaiEnvironmentVariables(apiKey: string): Promise<void> {
    const baseUrl = 'https://api.z.ai/v1';
    
    await Promise.all([
      this.environmentService.setEnvironmentVariable('ANTHROPIC_BASE_URL', baseUrl),
      this.environmentService.setEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', apiKey)
    ]);
  }

  private async removeZaiEnvironmentVariables(): Promise<void> {
    await Promise.all([
      this.environmentService.setEnvironmentVariable('ANTHROPIC_BASE_URL', ''),
      this.environmentService.setEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', '')
    ]);
  }

  private async getZaiApiKey(): Promise<string | undefined> {
    try {
      const authToken = this.environmentService.getEnvironmentVariable('ANTHROPIC_AUTH_TOKEN');
      return authToken;
    } catch (error) {
      this.logger.error('Failed to get Z.ai API key from environment', error);
      return undefined;
    }
  }

  private async validateZaiSetup(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const baseUrl = this.environmentService.getEnvironmentVariable('ANTHROPIC_BASE_URL');
      const authToken = this.environmentService.getEnvironmentVariable('ANTHROPIC_AUTH_TOKEN');

      if (!baseUrl) {
        issues.push('ANTHROPIC_BASE_URL environment variable is not set');
      } else if (!baseUrl.includes('z.ai')) {
        issues.push('ANTHROPIC_BASE_URL should point to Z.ai API endpoint');
      }

      if (!authToken) {
        issues.push('ANTHROPIC_AUTH_TOKEN environment variable is not set');
      } else {
        const validation = this.validateApiKeyFormat(authToken, 'zai');
        if (!validation.isValid) {
          issues.push(`ANTHROPIC_AUTH_TOKEN: ${validation.message}`);
        }
      }
    } catch (error) {
      issues.push(`Z.ai setup validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  private getEnvironmentVariableName(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return 'ANTHROPIC_API_KEY';
      case 'openai':
        return 'OPENAI_API_KEY';
      case 'google':
        return 'GOOGLE_API_KEY';
      case 'zai':
        return 'ANTHROPIC_AUTH_TOKEN';
      default:
        return `${provider.toUpperCase()}_API_KEY`;
    }
  }

  private async showRestartNotification(provider: string): Promise<void> {
    const message = `Environment variables for ${provider} have been updated. VS Code needs to be restarted for changes to take effect.`;
    const restart = 'Restart VS Code';
    
    const result = await vscode.window.showInformationMessage(message, restart);
    if (result === restart) {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }
}