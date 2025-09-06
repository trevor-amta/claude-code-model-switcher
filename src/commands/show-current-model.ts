import * as vscode from 'vscode';
import { ModelService } from '../services/model-service';
import { NotificationService } from '../services/notification-service';
import { Logger } from '../utils/logger';

export class ShowCurrentModelCommand {
  private readonly logger: Logger;
  private readonly modelService: ModelService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.logger = new Logger('ShowCurrentModelCommand');
    this.modelService = ModelService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public async execute(): Promise<void> {
    try {
      this.logger.info('Show current model command initiated');

      const currentModelName = await this.modelService.getCurrentModel();
      if (!currentModelName) {
        await this.notificationService.showWarning(
          'No current model detected',
          {
            detail: 'Unable to determine the currently active Claude model',
            actions: ['Configure Models', 'Switch Model']
          }
        );
        return;
      }

      const model = await this.modelService.getModelByName(currentModelName);
      if (!model) {
        await this.notificationService.showWarning(
          `Current model '${currentModelName}' not found in configuration`,
          {
            detail: 'The active model is not in your configured models list',
            actions: ['Configure Models', 'Switch Model']
          }
        );
        return;
      }

      const validationResult = await this.modelService.validateModel(currentModelName, {
        checkApiKey: true,
        checkEndpoint: true,
        testConnection: false
      });

      const statusIcon = validationResult.isValid ? '✅' : '⚠️';
      const statusText = validationResult.isValid ? 'Valid' : 'Issues Found';

      const items = [
        {
          label: '$(symbol-class) Model Name',
          description: model.displayName,
          detail: currentModelName
        },
        {
          label: '$(info) Description',
          description: model.description || 'No description available'
        },
        {
          label: '$(link-external) Endpoint',
          description: model.endpoint
        },
        {
          label: '$(tag) Type',
          description: model.type === 'web' ? 'Web (Claude Code)' : 'API'
        },
        {
          label: `$(${validationResult.isValid ? 'check' : 'warning'}) Status`,
          description: statusText,
          detail: validationResult.isValid 
            ? 'Model configuration is valid'
            : validationResult.issues.join(', ')
        }
      ];

      if (model.capabilities) {
        const caps = model.capabilities;
        const capabilitiesList = [
          caps.maxTokens ? `Max tokens: ${caps.maxTokens}` : null,
          caps.contextWindow ? `Context window: ${caps.contextWindow.toLocaleString()}` : null,
          caps.supportsImages ? 'Images ✓' : null,
          caps.supportsFiles ? 'Files ✓' : null,
          caps.supportsCodeExecution ? 'Code execution ✓' : null,
          caps.supportsWebSearch ? 'Web search ✓' : null
        ].filter(Boolean).join(', ');

        if (capabilitiesList) {
          items.push({
            label: '$(settings-gear) Capabilities',
            description: capabilitiesList
          });
        }
      }

      if (validationResult.warnings.length > 0) {
        items.push({
          label: '$(warning) Warnings',
          description: validationResult.warnings.join(', ')
        });
      }

      await vscode.window.showQuickPick(items, {
        placeHolder: `${statusIcon} Current Model: ${model.displayName}`,
        matchOnDescription: true,
        canPickMany: false
      });

      this.logger.info(`Displayed current model info for: ${currentModelName}`);

    } catch (error) {
      this.logger.error('Show current model command failed', error);
      await this.notificationService.showError(
        'Failed to display current model information',
        {
          detail: error instanceof Error ? error.message : 'Unknown error occurred',
          actions: ['Retry']
        }
      );
    }
  }
}

export async function showCurrentModel(): Promise<void> {
  const command = new ShowCurrentModelCommand();
  await command.execute();
}