import * as vscode from 'vscode';
import { ConfigurationStrategy } from './base-strategy';
import { ApiKeyConfig, ConfigurationTarget } from '../../types/claude-settings';
import { Logger } from '../../utils/logger';
import { SecurityUtils } from '../../utils/security-utils';

export class VSCodeSettingsStrategy extends ConfigurationStrategy {
  private configuration: vscode.WorkspaceConfiguration;

  constructor(logger: Logger) {
    super(logger);
    this.configuration = vscode.workspace.getConfiguration('claudeModelSwitcher');
  }

  public async setApiKey(provider: string, apiKey: string, target: ConfigurationTarget): Promise<void> {
    try {
      const validation = this.validateApiKeyFormat(apiKey, provider);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      const currentKeys = await this.getApiKeys();
      const updatedKeys: ApiKeyConfig = { ...currentKeys, [provider]: apiKey };
      
      await this.setApiKeys(updatedKeys, target);
      this.logConfigurationChange('set API key', provider);
    } catch (error) {
      this.handleConfigurationError(error, 'set API key', provider);
    }
  }

  public async getApiKey(provider: string): Promise<string | undefined> {
    try {
      const apiKeys = await this.getApiKeys();
      return apiKeys[provider as keyof ApiKeyConfig] as string | undefined;
    } catch (error) {
      this.logger.error(`Failed to get API key for provider: ${provider}`, error);
      return undefined;
    }
  }

  public async removeApiKey(provider: string, target: ConfigurationTarget): Promise<void> {
    try {
      const currentKeys = await this.getApiKeys();
      delete currentKeys[provider as keyof ApiKeyConfig];
      
      await this.setApiKeys(currentKeys, target);
      this.logConfigurationChange('removed API key', provider);
    } catch (error) {
      this.handleConfigurationError(error, 'remove API key', provider);
    }
  }

  public async getApiKeys(): Promise<ApiKeyConfig> {
    try {
      const encryptedKeys = this.configuration.get<ApiKeyConfig>('apiKeys');
      if (encryptedKeys) {
        return await SecurityUtils.decryptApiKeys(encryptedKeys);
      }
      return {};
    } catch (error) {
      this.logger.error('Failed to get API keys from VS Code settings', error);
      return {};
    }
  }

  public async setApiKeys(apiKeys: ApiKeyConfig, target: ConfigurationTarget): Promise<void> {
    try {
      const encryptedKeys = await SecurityUtils.encryptApiKeys(apiKeys);
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('apiKeys', encryptedKeys, configTarget);
      this.logConfigurationChange('set API keys', 'all providers');
    } catch (error) {
      this.handleConfigurationError(error, 'set API keys', 'all providers');
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

      // Test if we can access the configuration
      try {
        this.configuration.get('apiKeys');
      } catch (error) {
        issues.push('Cannot access VS Code settings configuration');
      }

    } catch (error) {
      issues.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  public supportsProvider(provider: string): boolean {
    // VS Code settings strategy supports all providers that use API keys
    const supportedProviders = ['anthropic', 'openai', 'google', 'custom'];
    return supportedProviders.includes(provider.toLowerCase());
  }

  public getStorageMethod(): 'vs-code-settings' | 'environment-variables' | 'hybrid' {
    return 'vs-code-settings';
  }

  public getConfigurationDescription(): string {
    return 'API keys are stored securely in VS Code settings with encryption';
  }

  public requiresEnvironmentSetup(): boolean {
    return false;
  }

  public getRequiredEnvironmentVariables(): string[] {
    return [];
  }

  public async testConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
      const validation = await this.validateConfiguration();
      if (validation.isValid) {
        return { success: true, message: 'VS Code settings configuration is valid' };
      } else {
        return { 
          success: false, 
          message: `Configuration issues: ${validation.issues.join(', ')}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
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
            message: validation.isValid ? 'API key format is valid' : validation.message
          };
          if (validation.isValid) {
            isConfigured = true;
          }
        } else {
          providerStatus[provider] = {
            configured: false,
            message: 'No API key configured'
          };
        }
      }
    } catch (error) {
      this.logger.error('Failed to get configuration status', error);
    }

    return { isConfigured, providerStatus };
  }

  public dispose(): void {
    // No specific cleanup needed for VS Code settings strategy
    this.logger.info('VS Code settings strategy disposed');
  }

  private getVSCodeConfigTarget(target: ConfigurationTarget): vscode.ConfigurationTarget {
    switch (target) {
      case 'global':
        return vscode.ConfigurationTarget.Global;
      case 'workspace':
        return vscode.ConfigurationTarget.Workspace;
      case 'workspaceFolder':
        return vscode.ConfigurationTarget.WorkspaceFolder;
      default:
        return vscode.ConfigurationTarget.Global;
    }
  }

  private refreshConfiguration(): void {
    this.configuration = vscode.workspace.getConfiguration('claudeModelSwitcher');
  }
}