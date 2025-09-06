// ESLint disabled: vscode import used in types
// import * as vscode from 'vscode';
import { ModelService } from '../services/model-service';
import { NotificationService } from '../services/notification-service';
import { Logger } from '../utils/logger';

export class SwitchModelCommand {
  private readonly logger: Logger;
  private readonly modelService: ModelService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.logger = new Logger('SwitchModelCommand');
    this.modelService = ModelService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public async execute(): Promise<void> {
    try {
      this.logger.info('Switch model command initiated');

      const selectedModel = await this.notificationService.showModelQuickPick();
      if (!selectedModel) {
        this.logger.debug('Model selection cancelled by user');
        return;
      }

      this.logger.info(`User selected model: ${selectedModel.name}`);

      const result = await this.notificationService.showProgress(
        `Switching to ${selectedModel.displayName}...`,
        async (progress) => {
          progress.report({ message: 'Validating model configuration...' });
          
          const switchResult = await this.modelService.switchModel(selectedModel.name, {
            showNotification: false
          });

          progress.report({ message: 'Updating configuration...', increment: 50 });
          
          return switchResult;
        }
      );

      await this.notificationService.showModelSwitchResult(result);

      if (result.success) {
        this.logger.info(`Successfully switched to model: ${result.newModel}`);
      } else {
        this.logger.error(`Model switch failed: ${result.error}`);
      }

    } catch (error) {
      this.logger.error('Switch model command failed', error);
      await this.notificationService.showError(
        'Failed to switch model',
        {
          detail: error instanceof Error ? error.message : 'Unknown error occurred',
          actions: ['Retry', 'Configure Models']
        }
      );
    }
  }
}

export async function switchModel(): Promise<void> {
  const command = new SwitchModelCommand();
  await command.execute();
}