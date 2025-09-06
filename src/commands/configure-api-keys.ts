import * as vscode from 'vscode';
import { ConfigService } from '../services/config-service';
import { StorageService } from '../services/storage-service';
import { NotificationService } from '../services/notification-service';
import { EnvironmentService } from '../services/environment-service';
import { ApiKeyConfig } from '../types/claude-settings';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security-utils';
import { getProviderMetadata, StorageMethod } from '../types/provider-config';

interface ApiKeyProvider {
  key: keyof ApiKeyConfig;
  name: string;
  description: string;
  validation?: (key: string) => string | null;
  storageMethod?: StorageMethod;
}

export class ConfigureApiKeysCommand {
  private readonly logger: Logger;
  private readonly configService: ConfigService;
  private readonly storageService: StorageService;
  private readonly notificationService: NotificationService;

  private readonly providers: ApiKeyProvider[] = [
    {
      key: 'anthropic',
      name: 'Anthropic',
      description: 'API key for Claude models via Anthropic API',
      validation: (key: string) => {
        if (!key.startsWith('sk-ant-')) {
          return 'Anthropic API keys should start with "sk-ant-"';
        }
        if (key.length < 40) {
          return 'Anthropic API key appears to be too short';
        }
        return null;
      },
      storageMethod: StorageMethod.VS_CODE_SETTINGS
    },
    {
      key: 'zai',
      name: 'Z.ai',
      description: 'API key for GLM models via Z.ai API (requires environment variables)',
      validation: (key: string) => {
        if (key.length < 10) {
          return 'Z.ai API key appears to be too short';
        }
        return null;
      },
      storageMethod: StorageMethod.ENVIRONMENT_VARIABLES
    }
  ];

  constructor() {
    this.logger = new Logger('ConfigureApiKeysCommand');
    this.configService = ConfigService.getInstance();
    this.storageService = StorageService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public async execute(): Promise<void> {
    try {
      this.logger.info('Configure API keys command initiated');

      const action = await this.showMainMenu();
      if (!action) {
        return;
      }

      switch (action) {
        case 'configure':
          await this.configureKeys();
          break;
        case 'view':
          await this.viewKeys();
          break;
        case 'clear':
          await this.clearKeys();
          break;
        case 'storage':
          await this.configureStorageMethod();
          break;
      }

    } catch (error) {
      this.logger.error('Configure API keys command failed', error);
      await this.notificationService.showError(
        'Failed to configure API keys',
        {
          detail: error instanceof Error ? error.message : 'Unknown error occurred',
          actions: ['Retry']
        }
      );
    }
  }

  private async showMainMenu(): Promise<string | undefined> {
    const currentKeys = await this.configService.getApiKeys();
    const keyCount = this.getConfiguredKeyCount(currentKeys);

    const items = [
      {
        label: '$(key) Configure API Keys',
        description: 'Add or update API keys for different providers',
        detail: keyCount > 0 ? `${keyCount} keys currently configured` : 'No keys configured',
        value: 'configure'
      },
      {
        label: '$(eye) View Configured Keys',
        description: 'Show which API keys are currently set',
        detail: keyCount > 0 ? 'View masked key information' : 'No keys to view',
        value: 'view'
      },
      {
        label: '$(database) Storage Method',
        description: 'Configure where API keys are stored',
        detail: `Current: ${currentKeys?.storageMethod || 'workspace'}`,
        value: 'storage'
      },
      {
        label: '$(trash) Clear All Keys',
        description: 'Remove all configured API keys',
        detail: keyCount > 0 ? 'This will remove all API keys' : 'No keys to clear',
        value: 'clear'
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose API key management action',
      matchOnDescription: true
    });

    return selection?.value;
  }

  private async configureKeys(): Promise<void> {
    const currentKeys = await this.configService.getApiKeys() || {};

    for (const provider of this.providers) {
      const hasKey = !!(currentKeys[provider.key] as string);
      const action = await this.showProviderAction(provider, hasKey);

      if (action === 'set') {
        if (provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES) {
          await this.setupEnvironmentVariables(provider);
        } else {
          const newKey = await this.promptForApiKey(provider);
          if (newKey) {
            currentKeys[provider.key] = newKey as any;
          }
        }
      } else if (action === 'remove' && hasKey) {
        if (provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES) {
          await this.clearEnvironmentVariables(provider);
        } else {
          delete currentKeys[provider.key];
        }
        await this.notificationService.showInfo(`Removed ${provider.name} API key`);
      }
    }

    await this.handleCustomProviders(currentKeys);
    await this.configService.setApiKeys(currentKeys);
    await this.notificationService.showInfo('API key configuration completed');
  }

  private async showProviderAction(provider: ApiKeyProvider, hasKey: boolean): Promise<string | undefined> {
    const items = [
      {
        label: hasKey ? '$(edit) Update Key' : '$(add) Set Key',
        description: `${hasKey ? 'Update' : 'Add'} ${provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES ? 'Environment Variables' : 'API key'} for ${provider.name}`,
        value: 'set'
      }
    ];

    if (hasKey) {
      items.push({
        label: '$(trash) Remove Key',
        description: `Remove ${provider.name} ${provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES ? 'Environment Variables' : 'API key'}`,
        value: 'remove'
      });
    }

    if (provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES) {
      items.push({
        label: '$(check) Verify Setup',
        description: `Check if ${provider.name} environment variables are properly configured`,
        value: 'verify'
      });
    }

    items.push({
      label: '$(arrow-right) Skip',
      description: `Skip ${provider.name} configuration`,
      value: 'skip'
    });

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: `Configure ${provider.name} ${provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES ? 'Environment Variables' : 'API key'}`,
      ignoreFocusOut: true
    });

    if (selection?.value === 'verify') {
      await this.verifyEnvironmentSetup(provider);
      return 'skip';
    }

    return selection?.value;
  }

  private async promptForApiKey(provider: ApiKeyProvider): Promise<string | undefined> {
    const key = await vscode.window.showInputBox({
      prompt: `Enter ${provider.name} API key`,
      password: true,
      placeHolder: provider.name === 'Anthropic' ? 'sk-ant-...' : 'Enter your API key',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }

        const sanitized = SecurityUtils.sanitizeInput(value.trim());
        if (sanitized !== value.trim()) {
          return 'API key contains invalid characters';
        }

        return provider.validation ? provider.validation(value.trim()) : null;
      },
      ignoreFocusOut: true
    });

    if (key) {
      const sanitized = SecurityUtils.sanitizeInput(key.trim());
      await this.notificationService.showInfo(`${provider.name} API key configured successfully`);
      return sanitized;
    }

    return undefined;
  }

  private async handleCustomProviders(currentKeys: ApiKeyConfig): Promise<void> {
    const addCustom = await vscode.window.showQuickPick([
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], {
      placeHolder: 'Add custom provider API keys?'
    });

    if (addCustom?.value) {
      const providerName = await vscode.window.showInputBox({
        prompt: 'Enter custom provider name',
        placeHolder: 'e.g., openrouter, together-ai',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Provider name cannot be empty';
          }
          if (!/^[a-z0-9-_]+$/i.test(value)) {
            return 'Provider name can only contain letters, numbers, hyphens, and underscores';
          }
          return null;
        }
      });

      if (providerName) {
        const apiKey = await vscode.window.showInputBox({
          prompt: `Enter API key for ${providerName}`,
          password: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'API key cannot be empty';
            }
            return null;
          }
        });

        if (apiKey) {
          if (!currentKeys.custom) {
            currentKeys.custom = {};
          }
          currentKeys.custom[providerName] = SecurityUtils.sanitizeInput(apiKey.trim());
          await this.notificationService.showInfo(`Custom provider ${providerName} configured`);
        }
      }
    }
  }

  private async viewKeys(): Promise<void> {
    const currentKeys = await this.configService.getApiKeys();
    if (!currentKeys || this.getConfiguredKeyCount(currentKeys) === 0) {
      await this.notificationService.showInfo('No API keys configured');
      return;
    }

    const items = [];

    for (const provider of this.providers) {
      const key = currentKeys[provider.key] as string;
      if (key) {
        items.push({
          label: `$(key) ${provider.name}`,
          description: provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES ? 'Environment Variables' : this.maskApiKey(key),
          detail: provider.description + (provider.storageMethod === StorageMethod.ENVIRONMENT_VARIABLES ? ' (Environment Variables)' : '')
        });
      }
    }

    if (currentKeys.custom) {
      for (const [providerName, key] of Object.entries(currentKeys.custom)) {
        items.push({
          label: `$(key) ${providerName} (Custom)`,
          description: this.maskApiKey(key),
          detail: 'Custom provider API key'
        });
      }
    }

    items.push({
      label: `$(database) Storage Method`,
      description: currentKeys.storageMethod || 'workspace',
      detail: 'Where API keys are stored'
    });

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Currently configured API keys',
      canPickMany: false
    });
  }

  private async clearKeys(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'This will remove all configured API keys. Are you sure?',
      { modal: true },
      'Yes, Clear All',
      'Cancel'
    );

    if (confirm === 'Yes, Clear All') {
      await this.configService.setApiKeys({});
      await this.notificationService.showInfo('All API keys cleared successfully');
    }
  }

  private async configureStorageMethod(): Promise<void> {
    const items = [
      {
        label: 'Workspace',
        description: 'Store in VS Code workspace settings',
        detail: 'Keys are stored in .vscode/settings.json (visible to project)',
        value: 'workspace'
      },
      {
        label: 'Global',
        description: 'Store in VS Code global settings',
        detail: 'Keys are stored globally for all workspaces',
        value: 'global'
      },
      {
        label: 'Keychain',
        description: 'Store in system keychain (macOS/Windows)',
        detail: 'Most secure option using OS credential storage',
        value: 'keychain'
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose API key storage method'
    });

    if (selection) {
      const currentKeys = await this.configService.getApiKeys() || {};
      currentKeys.storageMethod = selection.value as any;
      await this.configService.setApiKeys(currentKeys);
      await this.notificationService.showInfo(`Storage method set to: ${selection.label}`);
    }
  }

  private getConfiguredKeyCount(keys: ApiKeyConfig | null | undefined): number {
    if (!keys) return 0;

    let count = 0;
    for (const provider of this.providers) {
      if (keys[provider.key]) count++;
    }
    if (keys.custom) {
      count += Object.keys(keys.custom).length;
    }
    return count;
  }

  private maskApiKey(key: string): string {
    if (!key || key.length < 8) {
      return '****';
    }
    
    const start = key.substring(0, 4);
    const end = key.substring(key.length - 4);
    const middle = '*'.repeat(Math.min(key.length - 8, 20));
    
    return `${start}${middle}${end}`;
  }

  private async setupEnvironmentVariables(provider: ApiKeyProvider): Promise<void> {
    let environmentService: EnvironmentService;
    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
    } catch (error) {
      await this.notificationService.showError(
        'Environment service not available. Please restart VS Code and try again.',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
      return;
    }

    const providerMetadata = getProviderMetadata(provider.key as string);

    if (!providerMetadata) {
      await this.notificationService.showError(`Unknown provider: ${provider.name}`);
      return;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: `Enter ${provider.name} API key`,
      password: true,
      placeHolder: 'Enter your API key',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        return provider.validation ? provider.validation(value.trim()) : null;
      },
      ignoreFocusOut: true
    });

    if (!apiKey) {
      return;
    }

    const baseUrl = await vscode.window.showInputBox({
      prompt: `Enter ${provider.name} Base URL`,
      placeHolder: 'https://api.z.ai/v1',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Base URL cannot be empty';
        }
        try {
          new URL(value.trim());
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      },
      ignoreFocusOut: true
    });

    if (!baseUrl) {
      return;
    }

    const success = await environmentService.setupZaiEnvironment(apiKey.trim(), baseUrl.trim());
    
    if (success) {
      const restart = await vscode.window.showInformationMessage(
        `${provider.name} environment variables configured successfully. VS Code needs to restart for changes to take effect.`,
        { modal: true },
        'Restart Now',
        'Restart Later'
      );

      if (restart === 'Restart Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } else {
      await this.notificationService.showError(`Failed to set up ${provider.name} environment variables`);
    }
  }

  private async clearEnvironmentVariables(provider: ApiKeyProvider): Promise<void> {
    let environmentService: EnvironmentService;
    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
    } catch (error) {
      await this.notificationService.showError(
        'Environment service not available. Please restart VS Code and try again.',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
      return;
    }

    const success = await environmentService.clearZaiEnvironment();

    if (success) {
      await this.notificationService.showInfo(`${provider.name} environment variables cleared`);
      
      const restart = await vscode.window.showInformationMessage(
        `${provider.name} environment variables cleared. VS Code needs to restart for changes to take effect.`,
        { modal: true },
        'Restart Now',
        'Restart Later'
      );

      if (restart === 'Restart Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } else {
      await this.notificationService.showError(`Failed to clear ${provider.name} environment variables`);
    }
  }

  private async verifyEnvironmentSetup(provider: ApiKeyProvider): Promise<void> {
    let environmentService: EnvironmentService;
    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
    } catch (error) {
      await this.notificationService.showError(
        'Environment service not available. Please restart VS Code and try again.',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
      return;
    }

    const providerMetadata = getProviderMetadata(provider.key as string);

    if (!providerMetadata) {
      await this.notificationService.showError(`Unknown provider: ${provider.name}`);
      return;
    }

    const status = await environmentService.getZaiEnvironmentStatus();

    if (status.isConfigured) {
      await this.notificationService.showInfo(
        `${provider.name} environment variables are properly configured:\n\n` +
        `• ANTHROPIC_AUTH_TOKEN: ${status.authToken ? '✅ Set' : '❌ Missing'}\n` +
        `• ANTHROPIC_BASE_URL: ${status.baseUrl ? '✅ Set' : '❌ Missing'}\n` +
        `• Platform: ${status.platform}\n` +
        `• Shell: ${status.shell}`
      );
    } else {
      await this.notificationService.showWarning(
        `${provider.name} environment variables are not properly configured. Please set up the environment variables first.`
      );
    }
  }
}

export async function configureApiKeys(): Promise<void> {
  const command = new ConfigureApiKeysCommand();
  await command.execute();
}