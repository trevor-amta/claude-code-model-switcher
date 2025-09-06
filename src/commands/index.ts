import * as vscode from 'vscode';
import { switchModel } from './switch-model';
import { showCurrentModel } from './show-current-model';
import { configureApiKeys } from './configure-api-keys';
import { configureModels } from './configure-models';
import { Logger } from '../utils/logger';

export interface CommandRegistration {
  command: string;
  callback: (...args: any[]) => any;
  thisArg?: any;
}

export class CommandManager {
  private readonly logger: Logger;
  private readonly registrations: CommandRegistration[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.logger = new Logger('CommandManager');
    this.setupCommands();
  }

  private setupCommands(): void {
    this.registrations.push(
      {
        command: 'claudeModelSwitcher.switchModel',
        callback: this.wrapCommand('switchModel', switchModel)
      },
      {
        command: 'claudeModelSwitcher.showCurrentModel',
        callback: this.wrapCommand('showCurrentModel', showCurrentModel)
      },
      {
        command: 'claudeModelSwitcher.configureApiKeys',
        callback: this.wrapCommand('configureApiKeys', configureApiKeys)
      },
      {
        command: 'claudeModelSwitcher.configureModels',
        callback: this.wrapCommand('configureModels', configureModels)
      }
    );

    this.logger.info(`Prepared ${this.registrations.length} commands for registration`);
  }

  private wrapCommand(commandName: string, callback: () => Promise<void>): () => Promise<void> {
    return async () => {
      try {
        this.logger.info(`Executing command: ${commandName}`);
        const startTime = Date.now();
        
        await callback();
        
        const duration = Date.now() - startTime;
        this.logger.info(`Command ${commandName} completed in ${duration}ms`);
        
      } catch (error) {
        this.logger.error(`Command ${commandName} failed`, error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vscode.window.showErrorMessage(
          `Command failed: ${errorMessage}`,
          'View Logs'
        ).then(selection => {
          if (selection === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
          }
        });
        
        throw error;
      }
    };
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    try {
      this.logger.info('Registering extension commands');

      for (const registration of this.registrations) {
        const disposable = vscode.commands.registerCommand(
          registration.command,
          registration.callback,
          registration.thisArg
        );
        
        this.disposables.push(disposable);
        context.subscriptions.push(disposable);
        
        this.logger.debug(`Registered command: ${registration.command}`);
      }

      this.logger.info(`Successfully registered ${this.registrations.length} commands`);
      
    } catch (error) {
      this.logger.error('Failed to register commands', error);
      throw error;
    }
  }

  public getRegisteredCommands(): string[] {
    return this.registrations.map(reg => reg.command);
  }

  public async executeCommand(commandId: string, ...args: any[]): Promise<any> {
    try {
      this.logger.info(`Manually executing command: ${commandId}`);
      return await vscode.commands.executeCommand(commandId, ...args);
    } catch (error) {
      this.logger.error(`Failed to execute command ${commandId}`, error);
      throw error;
    }
  }

  public dispose(): void {
    this.logger.info('Disposing command manager');
    
    this.disposables.forEach(disposable => {
      try {
        disposable.dispose();
      } catch (error) {
        this.logger.warn('Error disposing command', error);
      }
    });
    
    this.disposables = [];
    this.logger.info('Command manager disposed');
  }
}

export {
  switchModel,
  showCurrentModel,
  configureApiKeys,
  configureModels
};