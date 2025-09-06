import * as vscode from 'vscode';
import { ClaudeExtensionSettings, ConfigurationTarget, ApiKeyConfig, UserPreferences, NotificationSettings } from '../types/claude-settings';
import { ModelConfig, DEFAULT_MODELS, ReloadBehavior } from '../types/model-config';
import { Logger } from '../utils/logger';
import { ConfigurationStrategy } from './config-strategies/base-strategy';
import { VSCodeSettingsStrategy } from './config-strategies/vscode-settings-strategy';
import { EnvironmentVariablesStrategy } from './config-strategies/environment-strategy';

export class ConfigService {
  private static instance: ConfigService;
  private readonly logger: Logger;
  private configuration: vscode.WorkspaceConfiguration;
  private strategies!: Map<string, ConfigurationStrategy>;
  private defaultStrategy!: ConfigurationStrategy;

  private constructor() {
    this.logger = new Logger('ConfigService');
    this.configuration = vscode.workspace.getConfiguration('claudeModelSwitcher');
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies = new Map();
    
    // Initialize VS Code settings strategy (default)
    const vscodeStrategy = new VSCodeSettingsStrategy(this.logger);
    this.strategies.set('vs-code-settings', vscodeStrategy);
    this.defaultStrategy = vscodeStrategy;
    
    // Initialize environment variables strategy
    const envStrategy = new EnvironmentVariablesStrategy(this.logger);
    this.strategies.set('environment-variables', envStrategy);
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get the appropriate configuration strategy for a provider
   */
  public getConfigurationStrategy(provider: string, storageMethod?: string): ConfigurationStrategy {
    if (storageMethod) {
      const strategy = this.strategies.get(storageMethod);
      if (strategy && strategy.supportsProvider(provider)) {
        return strategy;
      }
    }

    // Fallback to provider-specific strategy selection
    if (provider.toLowerCase() === 'zai') {
      const envStrategy = this.strategies.get('environment-variables');
      if (envStrategy) return envStrategy;
    }

    // Default to VS Code settings strategy
    return this.defaultStrategy;
  }

  /**
   * Get all available configuration strategies
   */
  public getAvailableStrategies(): ConfigurationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy by storage method
   */
  public getStrategyByStorageMethod(storageMethod: string): ConfigurationStrategy | undefined {
    return this.strategies.get(storageMethod);
  }

  public get<T>(key: string, defaultValue?: T): T {
    try {
      return this.configuration.get<T>(key, defaultValue as T);
    } catch (error) {
      this.logger.error(`Failed to get configuration key: ${key}`, error);
      return defaultValue as T;
    }
  }

  public async getDefaultModel(): Promise<string> {
    try {
      const defaultModel = this.configuration.get<string>('defaultModel');
      if (!defaultModel) {
        this.logger.warn('No default model configured, using fallback');
        return 'claude-sonnet-4-20250514';
      }
      return defaultModel;
    } catch (error) {
      this.logger.error('Failed to get default model', error);
      return 'claude-sonnet-4-20250514';
    }
  }

  public async setDefaultModel(modelName: string, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('defaultModel', modelName, configTarget);
      this.logger.info(`Default model set to: ${modelName}`);
    } catch (error) {
      this.logger.error(`Failed to set default model to ${modelName}`, error);
      throw new Error(`Failed to update default model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getAvailableModels(): Promise<ModelConfig[]> {
    try {
      const models = this.configuration.get<ModelConfig[]>('availableModels');
      if (!models || models.length === 0) {
        this.logger.warn('No available models configured, using defaults');
        return DEFAULT_MODELS;
      }
      return models;
    } catch (error) {
      this.logger.error('Failed to get available models', error);
      return DEFAULT_MODELS;
    }
  }

  public async setAvailableModels(models: ModelConfig[], target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('availableModels', models, configTarget);
      this.logger.info(`Available models updated: ${models.length} models configured`);
    } catch (error) {
      this.logger.error('Failed to set available models', error);
      throw new Error(`Failed to update available models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getShowStatusBar(): Promise<boolean> {
    try {
      return this.configuration.get<boolean>('showStatusBar', true);
    } catch (error) {
      this.logger.error('Failed to get showStatusBar setting', error);
      return true;
    }
  }

  public async setShowStatusBar(show: boolean, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('showStatusBar', show, configTarget);
      this.logger.info(`Status bar visibility set to: ${show}`);
    } catch (error) {
      this.logger.error(`Failed to set showStatusBar to ${show}`, error);
      throw new Error(`Failed to update status bar setting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getReloadBehavior(): Promise<ReloadBehavior> {
    try {
      const behavior = this.configuration.get<ReloadBehavior>('reloadBehavior');
      if (!behavior || !['prompt', 'auto', 'skip'].includes(behavior)) {
        this.logger.warn('Invalid reload behavior, using default');
        return 'prompt';
      }
      return behavior;
    } catch (error) {
      this.logger.error('Failed to get reload behavior', error);
      return 'prompt';
    }
  }

  public async setReloadBehavior(behavior: ReloadBehavior, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('reloadBehavior', behavior, configTarget);
      this.logger.info(`Reload behavior set to: ${behavior}`);
    } catch (error) {
      this.logger.error(`Failed to set reload behavior to ${behavior}`, error);
      throw new Error(`Failed to update reload behavior: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getDebugMode(): Promise<boolean> {
    try {
      return this.configuration.get<boolean>('debugMode', false);
    } catch (error) {
      this.logger.error('Failed to get debug mode setting', error);
      return false;
    }
  }

  public async setDebugMode(debug: boolean, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('debugMode', debug, configTarget);
      this.logger.info(`Debug mode set to: ${debug}`);
    } catch (error) {
      this.logger.error(`Failed to set debug mode to ${debug}`, error);
      throw new Error(`Failed to update debug mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getApiKeys(): Promise<ApiKeyConfig | undefined> {
    try {
      // Get API keys from all strategies and merge them
      const allApiKeys: ApiKeyConfig = {};
      
      for (const strategy of this.strategies.values()) {
        const strategyKeys = await strategy.getApiKeys();
        Object.assign(allApiKeys, strategyKeys);
      }
      
      return Object.keys(allApiKeys).length > 0 ? allApiKeys : undefined;
    } catch (error) {
      this.logger.error('Failed to get API keys', error);
      return undefined;
    }
  }

  public async setApiKeys(apiKeys: ApiKeyConfig, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const promises: Promise<void>[] = [];
      
      // Distribute API keys to appropriate strategies
      for (const [provider, apiKey] of Object.entries(apiKeys)) {
        if (apiKey) {
          const strategy = this.getConfigurationStrategy(provider);
          promises.push(strategy.setApiKey(provider, apiKey, target));
        }
      }
      
      await Promise.all(promises);
      this.logger.info('API keys updated successfully');
    } catch (error) {
      this.logger.error('Failed to set API keys', error);
      throw new Error(`Failed to update API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get API key for a specific provider using the appropriate strategy
   */
  public async getApiKeyForProvider(provider: string): Promise<string | undefined> {
    try {
      const strategy = this.getConfigurationStrategy(provider);
      return await strategy.getApiKey(provider);
    } catch (error) {
      this.logger.error(`Failed to get API key for provider: ${provider}`, error);
      return undefined;
    }
  }

  /**
   * Set API key for a specific provider using the appropriate strategy
   */
  public async setApiKeyForProvider(provider: string, apiKey: string, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const strategy = this.getConfigurationStrategy(provider);
      await strategy.setApiKey(provider, apiKey, target);
      this.logger.info(`API key for provider ${provider} updated successfully`);
    } catch (error) {
      this.logger.error(`Failed to set API key for provider: ${provider}`, error);
      throw new Error(`Failed to update API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove API key for a specific provider using the appropriate strategy
   */
  public async removeApiKeyForProvider(provider: string, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const strategy = this.getConfigurationStrategy(provider);
      await strategy.removeApiKey(provider, target);
      this.logger.info(`API key for provider ${provider} removed successfully`);
    } catch (error) {
      this.logger.error(`Failed to remove API key for provider: ${provider}`, error);
      throw new Error(`Failed to remove API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getUserPreferences(): Promise<UserPreferences> {
    try {
      return this.configuration.get<UserPreferences>('preferences', {});
    } catch (error) {
      this.logger.error('Failed to get user preferences', error);
      return {};
    }
  }

  public async setUserPreferences(preferences: UserPreferences, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('preferences', preferences, configTarget);
      this.logger.info('User preferences updated successfully');
    } catch (error) {
      this.logger.error('Failed to set user preferences', error);
      throw new Error(`Failed to update user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      return this.configuration.get<NotificationSettings>('notifications', {
        showSwitchConfirmation: true,
        showReloadPrompt: true,
        showErrorNotifications: true,
        showSuccessNotifications: true,
        notificationDuration: 5000
      });
    } catch (error) {
      this.logger.error('Failed to get notification settings', error);
      return {
        showSwitchConfirmation: true,
        showReloadPrompt: true,
        showErrorNotifications: true,
        showSuccessNotifications: true,
        notificationDuration: 5000
      };
    }
  }

  public async setNotificationSettings(settings: NotificationSettings, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('notifications', settings, configTarget);
      this.logger.info('Notification settings updated successfully');
    } catch (error) {
      this.logger.error('Failed to set notification settings', error);
      throw new Error(`Failed to update notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getAllSettings(): Promise<ClaudeExtensionSettings> {
    try {
      const [
        defaultModel,
        showStatusBar,
        reloadBehavior,
        debugMode,
        availableModels,
        apiKeys,
        preferences,
        notifications
      ] = await Promise.all([
        this.getDefaultModel(),
        this.getShowStatusBar(),
        this.getReloadBehavior(),
        this.getDebugMode(),
        this.getAvailableModels(),
        this.getApiKeys(),
        this.getUserPreferences(),
        this.getNotificationSettings()
      ]);

      return {
        defaultModel,
        showStatusBar,
        reloadBehavior,
        debugMode,
        availableModels,
        apiKeys,
        preferences,
        notifications
      };
    } catch (error) {
      this.logger.error('Failed to get all settings', error);
      throw new Error(`Failed to retrieve settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async resetToDefaults(target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const configTarget = this.getVSCodeConfigTarget(target);
      
      await Promise.all([
        this.configuration.update('defaultModel', 'claude-sonnet-4-20250514', configTarget),
        this.configuration.update('showStatusBar', true, configTarget),
        this.configuration.update('reloadBehavior', 'prompt', configTarget),
        this.configuration.update('debugMode', false, configTarget),
        this.configuration.update('availableModels', DEFAULT_MODELS, configTarget),
        this.configuration.update('apiKeys', undefined, configTarget),
        this.configuration.update('preferences', {}, configTarget),
        this.configuration.update('notifications', {
          showSwitchConfirmation: true,
          showReloadPrompt: true,
          showErrorNotifications: true,
          showSuccessNotifications: true,
          notificationDuration: 5000
        }, configTarget)
      ]);

      this.logger.info('Configuration reset to defaults');
    } catch (error) {
      this.logger.error('Failed to reset configuration to defaults', error);
      throw new Error(`Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async validateConfiguration(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const settings = await this.getAllSettings();
      
      if (!settings.defaultModel) {
        issues.push('Default model is not set');
      }

      if (!settings.availableModels || settings.availableModels.length === 0) {
        issues.push('No available models configured');
      } else {
        const defaultModelExists = settings.availableModels.some(model => model.name === settings.defaultModel);
        if (!defaultModelExists) {
          issues.push('Default model is not in available models list');
        }
      }

      if (settings.reloadBehavior && !['prompt', 'auto', 'skip'].includes(settings.reloadBehavior)) {
        issues.push('Invalid reload behavior setting');
      }

      // Validate all strategies
      for (const strategy of this.strategies.values()) {
        const strategyValidation = await strategy.validateConfiguration();
        if (!strategyValidation.isValid) {
          issues.push(...strategyValidation.issues.map(issue => `${strategy.getStorageMethod()}: ${issue}`));
        }
      }

    } catch (error) {
      issues.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate configuration for a specific provider
   */
  public async validateProviderConfiguration(provider: string): Promise<{ isValid: boolean; issues: string[] }> {
    try {
      const strategy = this.getConfigurationStrategy(provider);
      return await strategy.validateConfiguration();
    } catch (error) {
      return {
        isValid: false,
        issues: [`Provider validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Test configuration for a specific provider
   */
  public async testProviderConfiguration(provider: string): Promise<{ success: boolean; message: string }> {
    try {
      const strategy = this.getConfigurationStrategy(provider);
      return await strategy.testConfiguration();
    } catch (error) {
      return {
        success: false,
        message: `Provider test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get configuration status for all strategies
   */
  public async getConfigurationStatus(): Promise<{
    overallConfigured: boolean;
    strategies: Record<string, {
      isConfigured: boolean;
      providerStatus: Record<string, { configured: boolean; lastTested?: number; message?: string }>;
      description: string;
    }>;
  }> {
    const strategies: Record<string, any> = {};
    let overallConfigured = false;

    for (const [storageMethod, strategy] of this.strategies.entries()) {
      const status = await strategy.getConfigurationStatus();
      strategies[storageMethod] = {
        isConfigured: status.isConfigured,
        providerStatus: status.providerStatus,
        description: strategy.getConfigurationDescription()
      };
      if (status.isConfigured) {
        overallConfigured = true;
      }
    }

    return { overallConfigured, strategies };
  }

  public onConfigurationChange(callback: (event: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('claudeModelSwitcher')) {
        this.logger.debug('Configuration changed');
        callback(event);
      }
    });
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

  public dispose(): void {
    // Dispose all strategies
    for (const strategy of this.strategies.values()) {
      try {
        strategy.dispose();
      } catch (error) {
        this.logger.error('Error disposing strategy', error);
      }
    }
    this.strategies.clear();
    this.logger.info('ConfigService disposed');
  }
}