import * as vscode from 'vscode';
import { ClaudeExtensionSettings, ConfigurationTarget, ApiKeyConfig, UserPreferences, NotificationSettings } from '../types/claude-settings';
import { ModelConfig, DEFAULT_MODELS, ReloadBehavior } from '../types/model-config';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security-utils';

export class ConfigService {
  private static instance: ConfigService;
  private readonly logger: Logger;
  private configuration: vscode.WorkspaceConfiguration;

  private constructor() {
    this.logger = new Logger('ConfigService');
    this.configuration = vscode.workspace.getConfiguration('claudeModelSwitcher');
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
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
      const apiKeys = this.configuration.get<ApiKeyConfig>('apiKeys');
      if (apiKeys) {
        return await SecurityUtils.decryptApiKeys(apiKeys);
      }
      return undefined;
    } catch (error) {
      this.logger.error('Failed to get API keys', error);
      return undefined;
    }
  }

  public async setApiKeys(apiKeys: ApiKeyConfig, target: ConfigurationTarget = 'global'): Promise<void> {
    try {
      const encryptedKeys = await SecurityUtils.encryptApiKeys(apiKeys);
      const configTarget = this.getVSCodeConfigTarget(target);
      await this.configuration.update('apiKeys', encryptedKeys, configTarget);
      this.logger.info('API keys updated successfully');
    } catch (error) {
      this.logger.error('Failed to set API keys', error);
      throw new Error(`Failed to update API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      if (settings.apiKeys) {
        try {
          await SecurityUtils.decryptApiKeys(settings.apiKeys);
        } catch (error) {
          issues.push('API keys are corrupted or invalid');
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
    this.logger.info('ConfigService disposed');
  }
}