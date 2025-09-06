import * as vscode from 'vscode';
import { StatusBarConfig, NotificationSettings } from '../types/claude-settings';
import { ModelConfig, ModelSwitchResult } from '../types/model-config';
import { Logger } from '../utils/logger';
import { ConfigService } from './config-service';

export interface NotificationOptions {
  modal?: boolean;
  detail?: string;
  actions?: string[];
  timeout?: number;
}

export class NotificationService {
  private static instance: NotificationService;
  private readonly logger: Logger;
  private readonly configService: ConfigService;
  private statusBarItem: vscode.StatusBarItem | undefined;
  private activeNotifications: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.logger = new Logger('NotificationService');
    this.configService = ConfigService.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const showStatusBar = await this.configService.getShowStatusBar();
      if (showStatusBar) {
        await this.createStatusBarItem();
        await this.updateStatusBar();
      }
      this.logger.info('NotificationService initialized');
    } catch (error) {
      this.logger.error('Failed to initialize NotificationService', error);
      throw error;
    }
  }

  public async showInfo(
    message: string, 
    options: NotificationOptions = {}
  ): Promise<string | undefined> {
    try {
      const settings = await this.configService.getNotificationSettings();
      if (!settings.showSuccessNotifications) {
        return undefined;
      }

      this.logger.debug(`Showing info notification: ${message}`);
      return await this.showNotification('info', message, options, settings);
    } catch (error) {
      this.logger.error('Failed to show info notification', error);
      return undefined;
    }
  }

  public async showWarning(
    message: string, 
    options: NotificationOptions = {}
  ): Promise<string | undefined> {
    try {
      this.logger.debug(`Showing warning notification: ${message}`);
      const settings = await this.configService.getNotificationSettings();
      return await this.showNotification('warning', message, options, settings);
    } catch (error) {
      this.logger.error('Failed to show warning notification', error);
      return undefined;
    }
  }

  public async showError(
    message: string, 
    options: NotificationOptions = {}
  ): Promise<string | undefined> {
    try {
      const settings = await this.configService.getNotificationSettings();
      if (!settings.showErrorNotifications) {
        return undefined;
      }

      this.logger.error(`Showing error notification: ${message}`);
      return await this.showNotification('error', message, options, settings);
    } catch (error) {
      this.logger.error('Failed to show error notification', error);
      return undefined;
    }
  }

  public async showModelSwitchResult(result: ModelSwitchResult): Promise<void> {
    try {
      const settings = await this.configService.getNotificationSettings();
      
      if (result.success) {
        if (settings.showSwitchConfirmation) {
          const message = result.message || `Switched to ${result.newModel}`;
          
          const actions: string[] = [];
          if (result.requiresReload) {
            actions.push('Reload Window');
          }
          
          const action = await this.showInfo(message, { actions, timeout: 8000 });
          
          if (action === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        }
        
        await this.updateStatusBar(result.newModel);
      } else {
        const errorMessage = result.error || 'Model switch failed';
        await this.showError(errorMessage, {
          actions: ['Retry', 'Configure Models'],
          detail: `Failed to switch from ${result.previousModel} to ${result.newModel}`
        });
      }
    } catch (error) {
      this.logger.error('Failed to show model switch result', error);
    }
  }

  public async showReloadPrompt(modelName: string): Promise<boolean> {
    try {
      const settings = await this.configService.getNotificationSettings();
      if (!settings.showReloadPrompt) {
        return false;
      }

      const message = `Model switched to ${modelName}. Reload window to apply changes?`;
      const action = await this.showInfo(message, {
        actions: ['Reload Now', 'Later'],
        modal: true
      });

      if (action === 'Reload Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Failed to show reload prompt', error);
      return false;
    }
  }

  public async createStatusBarItem(): Promise<void> {
    try {
      if (this.statusBarItem) {
        return;
      }

      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      
      this.statusBarItem.command = 'claudeModelSwitcher.switchModel';
      this.statusBarItem.show();
      
      this.logger.debug('Status bar item created');
    } catch (error) {
      this.logger.error('Failed to create status bar item', error);
      throw error;
    }
  }

  public async updateStatusBar(modelName?: string): Promise<void> {
    try {
      if (!this.statusBarItem) {
        return;
      }

      const showStatusBar = await this.configService.getShowStatusBar();
      if (!showStatusBar) {
        this.hideStatusBar();
        return;
      }

      if (!modelName) {
        const ModelService = (await import('./model-service')).ModelService;
        const modelService = ModelService.getInstance();
        const currentModel = await modelService.getCurrentModel();
        const model = currentModel ? await modelService.getModelByName(currentModel) : null;
        modelName = model?.displayName || currentModel || 'Unknown';
      }

      const config = await this.getStatusBarConfig(modelName);
      this.statusBarItem.text = config.text;
      this.statusBarItem.tooltip = config.tooltip;
      this.statusBarItem.color = config.color;
      this.statusBarItem.backgroundColor = config.backgroundColor 
        ? new vscode.ThemeColor(config.backgroundColor) 
        : undefined;

      this.statusBarItem.show();
      this.logger.debug(`Status bar updated: ${config.text}`);
    } catch (error) {
      this.logger.error('Failed to update status bar', error);
    }
  }

  public hideStatusBar(): void {
    if (this.statusBarItem) {
      this.statusBarItem.hide();
      this.logger.debug('Status bar hidden');
    }
  }

  public async showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
      },
      async (progress) => {
        try {
          this.logger.debug(`Starting progress: ${title}`);
          const result = await task(progress);
          this.logger.debug(`Progress completed: ${title}`);
          return result;
        } catch (error) {
          this.logger.error(`Progress failed: ${title}`, error);
          throw error;
        }
      }
    );
  }

  public async showApiKeyInput(provider: string): Promise<string | undefined> {
    try {
      const result = await vscode.window.showInputBox({
        prompt: `Enter API key for ${provider}`,
        password: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'API key cannot be empty';
          }
          if (value.length < 10) {
            return 'API key appears to be too short';
          }
          return null;
        }
      });

      return result?.trim();
    } catch (error) {
      this.logger.error(`Failed to show API key input for ${provider}`, error);
      return undefined;
    }
  }

  public async showModelQuickPick(): Promise<ModelConfig | undefined> {
    try {
      const ModelService = (await import('./model-service')).ModelService;
      const modelService = ModelService.getInstance();
      const items = await modelService.getQuickPickItems();

      if (items.length === 0) {
        await this.showWarning('No models available. Please configure models first.');
        return undefined;
      }

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a Claude model',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selection) {
        return undefined;
      }

      const models = await modelService.getAvailableModels();
      return models.find(m => m.name === selection.description);
    } catch (error) {
      this.logger.error('Failed to show model quick pick', error);
      return undefined;
    }
  }

  public async dismissNotification(id: string): Promise<void> {
    const timeout = this.activeNotifications.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.activeNotifications.delete(id);
      this.logger.debug(`Dismissed notification: ${id}`);
    }
  }

  private async showNotification(
    type: 'info' | 'warning' | 'error',
    message: string,
    options: NotificationOptions,
    settings: NotificationSettings
  ): Promise<string | undefined> {
    const notificationId = `${type}-${Date.now()}`;
    
    try {
      let showFunction: (message: string, ...items: string[]) => Thenable<string | undefined>;
      
      switch (type) {
        case 'info':
          showFunction = options.modal 
            ? vscode.window.showInformationMessage 
            : vscode.window.showInformationMessage;
          break;
        case 'warning':
          showFunction = options.modal 
            ? vscode.window.showWarningMessage 
            : vscode.window.showWarningMessage;
          break;
        case 'error':
          showFunction = options.modal 
            ? vscode.window.showErrorMessage 
            : vscode.window.showErrorMessage;
          break;
      }

      const fullMessage = options.detail ? `${message}\n\n${options.detail}` : message;
      const actions = options.actions || [];
      
      const resultPromise = showFunction(fullMessage, ...actions);
      
      const timeout = options.timeout || settings.notificationDuration || 5000;
      if (timeout > 0 && !options.modal) {
        const timeoutId = setTimeout(() => {
          this.activeNotifications.delete(notificationId);
        }, timeout);
        
        this.activeNotifications.set(notificationId, timeoutId);
      }

      const result = await resultPromise;
      
      this.dismissNotification(notificationId);
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to show ${type} notification`, error);
      this.dismissNotification(notificationId);
      return undefined;
    }
  }

  private async getStatusBarConfig(modelName: string): Promise<StatusBarConfig> {
    try {
      const _preferences = await this.configService.getUserPreferences();
      const displayName = this.getDisplayName(modelName);
      
      return {
        text: `$(symbol-class) ${displayName}`,
        tooltip: `Current Claude Model: ${displayName}\nClick to switch models`,
        color: this.getModelColor(modelName),
        alignment: 'right',
        priority: 100
      };
    } catch (error) {
      this.logger.error('Failed to get status bar config', error);
      return {
        text: `$(symbol-class) ${modelName}`,
        tooltip: 'Claude Model Switcher',
        alignment: 'right',
        priority: 100
      };
    }
  }

  private getDisplayName(modelName: string): string {
    const shortNames: Record<string, string> = {
      'claude-sonnet-4-20250514': 'Sonnet 4',
      'claude-3-5-haiku-20241022': 'Haiku 3.5',
      'claude-opus-4-20250514': 'Opus 4',
      'glm-4.5': 'GLM-4.5',
      'glm-4.5-air': 'GLM-4.5-Air'
    };
    
    return shortNames[modelName] || modelName;
  }

  private getModelColor(modelName: string): string | undefined {
    if (modelName.includes('opus')) {
      return 'statusBarItem.prominentForeground';
    } else if (modelName.includes('sonnet')) {
      return 'statusBarItem.foreground';
    } else if (modelName.includes('haiku')) {
      return 'statusBarItem.foreground';
    } else if (modelName.includes('glm')) {
      return 'statusBarItem.foreground';
    }
    return undefined;
  }

  public dispose(): void {
    for (const [_id, timeout] of this.activeNotifications) {
      clearTimeout(timeout);
    }
    this.activeNotifications.clear();

    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
    }

    this.logger.info('NotificationService disposed');
  }
}