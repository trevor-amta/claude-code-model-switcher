import * as vscode from 'vscode';
import { ModelService } from '../services/model-service';
import { ConfigService } from '../services/config-service';
import { NotificationService } from '../services/notification-service';
import { ModelConfig, ModelCapabilities, DEFAULT_MODELS } from '../types/model-config';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security-utils';

export class ConfigureModelsCommand {
  private readonly logger: Logger;
  private readonly modelService: ModelService;
  private readonly configService: ConfigService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.logger = new Logger('ConfigureModelsCommand');
    this.modelService = ModelService.getInstance();
    this.configService = ConfigService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public async execute(): Promise<void> {
    try {
      this.logger.info('Configure models command initiated');

      const action = await this.showMainMenu();
      if (!action) {
        return;
      }

      switch (action) {
        case 'list':
          await this.listModels();
          break;
        case 'add':
          await this.addModel();
          break;
        case 'edit':
          await this.editModel();
          break;
        case 'remove':
          await this.removeModel();
          break;
        case 'validate':
          await this.validateAllModels();
          break;
        case 'reset':
          await this.resetToDefaults();
          break;
        case 'import':
          await this.importModels();
          break;
        case 'export':
          await this.exportModels();
          break;
      }

    } catch (error) {
      this.logger.error('Configure models command failed', error);
      await this.notificationService.showError(
        'Failed to configure models',
        {
          detail: error instanceof Error ? error.message : 'Unknown error occurred',
          actions: ['Retry']
        }
      );
    }
  }

  private async showMainMenu(): Promise<string | undefined> {
    const models = await this.modelService.getAvailableModels();
    const currentModel = await this.modelService.getCurrentModel();

    const items = [
      {
        label: '$(list-unordered) List Models',
        description: 'View all configured models',
        detail: `${models.length} models configured`,
        value: 'list'
      },
      {
        label: '$(add) Add Model',
        description: 'Add a new model configuration',
        value: 'add'
      },
      {
        label: '$(edit) Edit Model',
        description: 'Modify an existing model configuration',
        value: 'edit'
      },
      {
        label: '$(trash) Remove Model',
        description: 'Delete a model configuration',
        value: 'remove'
      },
      {
        label: '$(check-all) Validate All',
        description: 'Check all model configurations',
        value: 'validate'
      },
      {
        label: '$(refresh) Reset to Defaults',
        description: 'Restore default model configurations',
        value: 'reset'
      },
      {
        label: '$(arrow-down) Import Models',
        description: 'Import model configurations from file',
        value: 'import'
      },
      {
        label: '$(arrow-up) Export Models',
        description: 'Export model configurations to file',
        value: 'export'
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: `Model Management • Current: ${currentModel || 'None'}`,
      matchOnDescription: true
    });

    return selection?.value;
  }

  private async listModels(): Promise<void> {
    const models = await this.modelService.getAvailableModels();
    const currentModel = await this.modelService.getCurrentModel();

    if (models.length === 0) {
      await this.notificationService.showInfo('No models configured');
      return;
    }

    const items = models.map(model => ({
      label: `${model.name === currentModel ? '$(check)' : '$(circle-outline)'} ${model.displayName}`,
      description: model.name,
      detail: `${model.type.toUpperCase()} • ${model.description}`,
      model
    }));

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Available Models (✓ = current)',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selection) {
      await this.showModelDetails(selection.model);
    }
  }

  private async showModelDetails(model: ModelConfig): Promise<void> {
    const validation = await this.modelService.validateModel(model.name);
    const statusIcon = validation.isValid ? '✅' : '⚠️';

    const items = [
      {
        label: '$(tag) Name',
        description: model.name,
        detail: 'Model identifier'
      },
      {
        label: '$(symbol-class) Display Name',
        description: model.displayName,
        detail: 'Human-readable name'
      },
      {
        label: '$(info) Description',
        description: model.description,
        detail: 'Model description'
      },
      {
        label: '$(link-external) Endpoint',
        description: model.endpoint,
        detail: 'API endpoint URL'
      },
      {
        label: '$(tag) Type',
        description: model.type === 'web' ? 'Web (Claude Code)' : 'API',
        detail: 'Connection type'
      },
      {
        label: `$(${validation.isValid ? 'check' : 'warning'}) Status`,
        description: validation.isValid ? 'Valid' : 'Issues Found',
        detail: validation.isValid 
          ? 'Configuration is valid' 
          : validation.issues.join(', ')
      }
    ];

    if (model.capabilities) {
      items.push({
        label: '$(settings-gear) Capabilities',
        description: this.formatCapabilities(model.capabilities),
        detail: 'Model features and limits'
      });
    }

    if (validation.warnings.length > 0) {
      items.push({
        label: '$(warning) Warnings',
        description: validation.warnings.join(', '),
        detail: 'Configuration warnings'
      });
    }

    const actions = [
      { label: '$(edit) Edit This Model', description: 'Modify this model configuration', detail: 'Open editor for this model', value: 'edit' },
      { label: '$(play) Switch to This Model', description: 'Make this the active model', detail: 'Switch to this model now', value: 'switch' },
      { label: '$(check-all) Test Connection', description: 'Test model connectivity', detail: 'Verify this model works', value: 'test' },
      { label: '$(trash) Remove This Model', description: 'Delete this model', detail: 'Remove from available models', value: 'remove' }
    ];

    items.push(
      { label: '', description: '────────────────', detail: 'Actions' },
      ...actions.map(action => ({
        label: action.label,
        description: action.description,
        detail: action.detail
      }))
    );

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: `${statusIcon} ${model.displayName} - Model Details`
    });

    if (selection) {
      const actionValue = actions.find(a => a.label === selection.label)?.value;
      if (actionValue) {
        switch (actionValue) {
          case 'edit':
            await this.editSpecificModel(model);
            break;
          case 'switch':
            await this.modelService.switchModel(model.name);
            break;
          case 'test':
            await this.testModelConnection(model);
            break;
          case 'remove':
            await this.removeSpecificModel(model);
            break;
        }
      }
    }
  }

  private async addModel(): Promise<void> {
    const model: Partial<ModelConfig> = {};

    model.name = await this.promptForInput(
      'Model Name',
      'Enter unique model identifier (e.g., claude-4, gpt-4)',
      (value) => {
        if (!value || !/^[a-z0-9-._]+$/i.test(value)) {
          return 'Name must contain only letters, numbers, hyphens, dots, and underscores';
        }
        return null;
      }
    );
    if (!model.name) return;

    model.displayName = await this.promptForInput(
      'Display Name',
      'Enter human-readable name (e.g., Claude 4)',
      (value) => value && value.trim().length > 0 ? null : 'Display name is required'
    );
    if (!model.displayName) return;

    model.description = await this.promptForInput(
      'Description',
      'Enter model description'
    ) || '';

    model.endpoint = await this.promptForInput(
      'Endpoint URL',
      'Enter API endpoint URL (e.g., https://api.anthropic.com)',
      (value) => {
        if (!value) return 'Endpoint URL is required';
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return 'URL must use http or https protocol';
          }
        } catch {
          return 'Invalid URL format';
        }
        return null;
      }
    );
    if (!model.endpoint) return;

    const typeItems = [
      { label: 'Web (Claude Code)', description: 'Direct Claude Code integration', detail: 'Uses built-in Claude Code integration', value: 'web' },
      { label: 'API', description: 'External API endpoint', detail: 'Connects to external API service', value: 'api' }
    ];
    const typeSelection = await vscode.window.showQuickPick(typeItems, {
      placeHolder: 'Select model type'
    });
    model.type = typeSelection?.value as 'web' | 'api';
    if (!model.type) return;

    if (model.type === 'api') {
      model.provider = await this.promptForInput(
        'Provider',
        'Enter provider name (e.g., anthropic, z-ai, openrouter)'
      ) || 'custom';
    }

    const addCapabilities = await vscode.window.showQuickPick([
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ], {
      placeHolder: 'Add capability information?'
    });

    if (addCapabilities?.value) {
      model.capabilities = await this.promptForCapabilities();
    }

    try {
      await this.modelService.addModel(model as ModelConfig);
      await this.notificationService.showInfo(`Model '${model.displayName}' added successfully`);
    } catch (error) {
      await this.notificationService.showError(
        'Failed to add model',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async editModel(): Promise<void> {
    const models = await this.modelService.getAvailableModels();
    const items = models.map(model => ({
      label: model.displayName,
      description: model.name,
      detail: model.description,
      model
    }));

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select model to edit'
    });

    if (selection) {
      await this.editSpecificModel(selection.model);
    }
  }

  private async editSpecificModel(model: ModelConfig): Promise<void> {
    const fields = [
      { label: 'Display Name', key: 'displayName', current: model.displayName },
      { label: 'Description', key: 'description', current: model.description },
      { label: 'Endpoint URL', key: 'endpoint', current: model.endpoint },
      { label: 'Provider', key: 'provider', current: model.provider || '' },
      { label: 'Capabilities', key: 'capabilities', current: 'Click to edit' }
    ];

    const selection = await vscode.window.showQuickPick(fields, {
      placeHolder: `Edit ${model.displayName} - Select field to modify`
    });

    if (!selection) return;

    const updatedModel = { ...model };
    
    switch (selection.key) {
      case 'displayName':
        const newDisplayName = await this.promptForInput(
          'Display Name',
          'Enter new display name',
          (value) => value && value.trim().length > 0 ? null : 'Display name is required',
          model.displayName
        );
        if (newDisplayName) updatedModel.displayName = newDisplayName;
        break;

      case 'description':
        const newDescription = await this.promptForInput(
          'Description',
          'Enter new description',
          undefined,
          model.description
        );
        if (newDescription !== undefined) updatedModel.description = newDescription;
        break;

      case 'endpoint':
        const newEndpoint = await this.promptForInput(
          'Endpoint URL',
          'Enter new endpoint URL',
          (value) => {
            if (!value) return 'Endpoint URL is required';
            try {
              new URL(value);
            } catch {
              return 'Invalid URL format';
            }
            return null;
          },
          model.endpoint
        );
        if (newEndpoint) updatedModel.endpoint = newEndpoint;
        break;

      case 'provider':
        const newProvider = await this.promptForInput(
          'Provider',
          'Enter provider name',
          undefined,
          model.provider
        );
        if (newProvider !== undefined) updatedModel.provider = newProvider;
        break;

      case 'capabilities':
        const newCapabilities = await this.promptForCapabilities(model.capabilities);
        if (newCapabilities) updatedModel.capabilities = newCapabilities;
        break;
    }

    try {
      await this.modelService.addModel(updatedModel);
      await this.notificationService.showInfo(`Model '${updatedModel.displayName}' updated successfully`);
    } catch (error) {
      await this.notificationService.showError(
        'Failed to update model',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async removeModel(): Promise<void> {
    const models = await this.modelService.getAvailableModels();
    const currentModel = await this.modelService.getCurrentModel();

    const items = models.map(model => ({
      label: model.displayName,
      description: model.name,
      detail: model.name === currentModel ? 'Current model - will switch to another' : model.description,
      model
    }));

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select model to remove'
    });

    if (selection) {
      await this.removeSpecificModel(selection.model);
    }
  }

  private async removeSpecificModel(model: ModelConfig): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      `Remove model '${model.displayName}'?`,
      { modal: true },
      'Remove',
      'Cancel'
    );

    if (confirm === 'Remove') {
      try {
        await this.modelService.removeModel(model.name);
        await this.notificationService.showInfo(`Model '${model.displayName}' removed successfully`);
      } catch (error) {
        await this.notificationService.showError(
          'Failed to remove model',
          { detail: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }

  private async validateAllModels(): Promise<void> {
    const results = await this.notificationService.showProgress(
      'Validating all models...',
      async (_progress) => {
        return await this.modelService.validateAllModels();
      }
    );

    const items = Object.entries(results).map(([modelName, result]) => {
      const statusIcon = result.isValid ? '✅' : '❌';
      const _issues = result.issues.length > 0 ? ` (${result.issues.length} issues)` : '';
      const warnings = result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : '';
      
      return {
        label: `${statusIcon} ${result.model.displayName}`,
        description: modelName,
        detail: result.isValid 
          ? `Valid${warnings}` 
          : `Issues: ${result.issues.join(', ')}${warnings}`
      };
    });

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Model Validation Results',
      canPickMany: false
    });
  }

  private async resetToDefaults(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'This will replace all current models with defaults. Continue?',
      { modal: true },
      'Reset',
      'Cancel'
    );

    if (confirm === 'Reset') {
      await this.configService.setAvailableModels(DEFAULT_MODELS);
      await this.notificationService.showInfo('Models reset to defaults successfully');
    }
  }

  private async importModels(): Promise<void> {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectMany: false,
      filters: {
        'JSON Files': ['json']
      },
      title: 'Import Model Configurations'
    });

    if (fileUri && fileUri[0]) {
      try {
        const content = await vscode.workspace.fs.readFile(fileUri[0]);
        const models: ModelConfig[] = JSON.parse(content.toString());
        
        if (!Array.isArray(models)) {
          throw new Error('File must contain an array of model configurations');
        }

        await this.configService.setAvailableModels(models);
        await this.notificationService.showInfo(`Imported ${models.length} model configurations`);
      } catch (error) {
        await this.notificationService.showError(
          'Failed to import models',
          { detail: error instanceof Error ? error.message : 'Invalid file format' }
        );
      }
    }
  }

  private async exportModels(): Promise<void> {
    const models = await this.modelService.getAvailableModels();
    const fileUri = await vscode.window.showSaveDialog({
      filters: {
        'JSON Files': ['json']
      },
      defaultUri: vscode.Uri.file('claude-models.json'),
      title: 'Export Model Configurations'
    });

    if (fileUri) {
      try {
        const content = JSON.stringify(models, null, 2);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
        await this.notificationService.showInfo(`Exported ${models.length} model configurations`);
      } catch (error) {
        await this.notificationService.showError(
          'Failed to export models',
          { detail: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }
  }

  private async testModelConnection(model: ModelConfig): Promise<void> {
    const result = await this.notificationService.showProgress(
      `Testing connection to ${model.displayName}...`,
      async () => {
        return await this.modelService.testModelConnection(model, 10000);
      }
    );

    if (result.success) {
      await this.notificationService.showInfo(`Connection test passed for ${model.displayName}`);
    } else {
      await this.notificationService.showError(
        `Connection test failed for ${model.displayName}`,
        { detail: result.error || 'Unknown error' }
      );
    }
  }

  private async promptForInput(
    title: string,
    prompt: string,
    validator?: (value: string) => string | null,
    defaultValue?: string
  ): Promise<string | undefined> {
    const result = await vscode.window.showInputBox({
      prompt,
      value: defaultValue,
      validateInput: validator ? (value) => {
        if (!value) return null;
        return validator(SecurityUtils.sanitizeInput(value.trim()));
      } : undefined,
      ignoreFocusOut: true
    });

    return result ? SecurityUtils.sanitizeInput(result.trim()) : undefined;
  }

  private async promptForCapabilities(current?: ModelCapabilities): Promise<ModelCapabilities | undefined> {
    const capabilities: ModelCapabilities = { ...current };

    const maxTokens = await this.promptForInput(
      'Max Tokens',
      'Maximum tokens per request (leave empty for default)',
      (value) => {
        const num = parseInt(value);
        return isNaN(num) || num <= 0 ? 'Must be a positive number' : null;
      },
      current?.maxTokens?.toString()
    );

    if (maxTokens) {
      capabilities.maxTokens = parseInt(maxTokens);
    }

    const contextWindow = await this.promptForInput(
      'Context Window',
      'Context window size (leave empty for default)',
      (value) => {
        const num = parseInt(value);
        return isNaN(num) || num <= 0 ? 'Must be a positive number' : null;
      },
      current?.contextWindow?.toString()
    );

    if (contextWindow) {
      capabilities.contextWindow = parseInt(contextWindow);
    }

    const booleanCapabilities = [
      { key: 'supportsImages', label: 'Supports Images' },
      { key: 'supportsFiles', label: 'Supports Files' },
      { key: 'supportsCodeExecution', label: 'Supports Code Execution' },
      { key: 'supportsWebSearch', label: 'Supports Web Search' }
    ];

    for (const cap of booleanCapabilities) {
      const _current_value = (capabilities as any)[cap.key];
      const capabilityItems = [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
        { label: 'Unknown', value: undefined }
      ];
      
      const selection = await vscode.window.showQuickPick(capabilityItems, {
        placeHolder: `${cap.label}?`
      });

      if (selection !== undefined) {
        (capabilities as any)[cap.key] = selection.value;
      }
    }

    return capabilities;
  }

  private formatCapabilities(capabilities: ModelCapabilities): string {
    const items = [];
    
    if (capabilities.maxTokens) items.push(`${capabilities.maxTokens} tokens`);
    if (capabilities.contextWindow) items.push(`${capabilities.contextWindow.toLocaleString()} context`);
    if (capabilities.supportsImages) items.push('Images');
    if (capabilities.supportsFiles) items.push('Files');
    if (capabilities.supportsCodeExecution) items.push('Code');
    if (capabilities.supportsWebSearch) items.push('Web');

    return items.join(', ') || 'Basic';
  }
}

export async function configureModels(): Promise<void> {
  const command = new ConfigureModelsCommand();
  await command.execute();
}