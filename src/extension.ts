import * as vscode from 'vscode';
import { CommandManager } from './commands';
import { StorageService } from './services/storage-service';
import { ConfigService } from './services/config-service';
import { ModelService } from './services/model-service';
import { NotificationService } from './services/notification-service';
import { MigrationService } from './services/migration-service';
import { MigrationWizard } from './wizards/migration-wizard';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';

let statusBarItem: vscode.StatusBarItem;
let configWatcher: vscode.Disposable;
let logger: Logger;
let commandManager: CommandManager;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    logger = new Logger('Extension');
    
    try {
        logger.info('Claude Model Switcher extension activating...');
        
        // Initialize services in correct order
        await initializeServices(context);
        
        // Register commands
        commandManager = new CommandManager();
        commandManager.registerCommands(context);
        
        // Set up status bar
        createStatusBarItem(context);
        
        // Set up configuration watchers
        setupConfigurationWatchers(context);
        
        // Initialize UI state
        await updateStatusBar();
        
        // Check for migration needs
        await checkMigrationNeeds(context);
        
        logger.info('Claude Model Switcher extension activated successfully');
        
        // Show activation notification if configured
        const configService = ConfigService.getInstance();
        const showActivationMessage = configService.get<boolean>('showActivationMessage', true);
        
        if (showActivationMessage) {
            const notificationService = NotificationService.getInstance();
            notificationService.showInfo('Claude Model Switcher extension is now active!');
        }
        
    } catch (error) {
        logger.error('Failed to activate extension', error);
        const errorMessage = ErrorHandler.getErrorMessage(error);
        
        vscode.window.showErrorMessage(
            `Claude Model Switcher activation failed: ${errorMessage}`,
            'View Logs'
        ).then(selection => {
            if (selection === 'View Logs') {
                vscode.commands.executeCommand('workbench.action.toggleDevTools');
            }
        });
        
        throw error;
    }
}

export function deactivate(): void {
    try {
        logger?.info('Claude Model Switcher extension deactivating...');
        
        // Dispose of resources
        if (statusBarItem) {
            statusBarItem.dispose();
        }
        
        if (configWatcher) {
            configWatcher.dispose();
        }
        
        if (commandManager) {
            commandManager.dispose();
        }
        
        // Dispose services
        const services = [
            StorageService.getInstance(),
            NotificationService.getInstance()
        ];
        
        services.forEach(service => {
            if (service && typeof service.dispose === 'function') {
                service.dispose();
            }
        });
        
        logger?.info('Claude Model Switcher extension deactivated successfully');
        
    } catch (error) {
        logger?.error('Error during extension deactivation', error);
    }
}

async function initializeServices(context: vscode.ExtensionContext): Promise<void> {
    try {
        logger.info('Initializing services...');
        
        // 1. StorageService requires explicit initialization with context
        StorageService.initialize(context);
        logger.debug('StorageService initialized');
        
        // 2. ConfigService is a singleton
        ConfigService.getInstance();
        logger.debug('ConfigService initialized');
        
        // 3. NotificationService needs initialization
        const notificationService = NotificationService.getInstance();
        notificationService.initialize();
        logger.debug('NotificationService initialized');
        
        // 4. ModelService is a singleton
        ModelService.getInstance();
        logger.debug('ModelService initialized');
        
        logger.info('All services initialized successfully');
        
    } catch (error) {
        logger.error('Failed to initialize services', error);
        throw error;
    }
}

function createStatusBarItem(context: vscode.ExtensionContext): void {
    try {
        statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        statusBarItem.name = 'Claude Model';
        statusBarItem.tooltip = 'Current Claude Model - Click to switch';
        statusBarItem.command = 'claudeModelSwitcher.switchModel';
        
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        
        logger.debug('Status bar item created');
        
    } catch (error) {
        logger.error('Failed to create status bar item', error);
        throw error;
    }
}

function setupConfigurationWatchers(context: vscode.ExtensionContext): void {
    try {
        configWatcher = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('claudeModelSwitcher')) {
                logger.info('Configuration changed, updating services');
                
                try {
                    // Reinitialize services that depend on configuration
                    const configService = ConfigService.getInstance();
                    const notificationService = NotificationService.getInstance();
                    
                    // Update status bar
                    await updateStatusBar();
                    
                    // Show notification if enabled
                    const showConfigChanges = configService.get<boolean>('showConfigurationChanges', false);
                    if (showConfigChanges) {
                        notificationService.showInfo('Configuration updated successfully');
                    }
                    
                } catch (error) {
                    logger.error('Failed to handle configuration change', error);
                    vscode.window.showWarningMessage(
                        `Failed to update configuration: ${ErrorHandler.getErrorMessage(error)}`
                    );
                }
            }
        });
        
        context.subscriptions.push(configWatcher);
        logger.debug('Configuration watcher set up');
        
    } catch (error) {
        logger.error('Failed to set up configuration watcher', error);
        throw error;
    }
}

async function updateStatusBar(): Promise<void> {
    if (!statusBarItem) {
        return;
    }
    
    try {
        const modelService = ModelService.getInstance();
        const currentModel = await modelService.getCurrentModel();
        
        if (currentModel) {
            const model = await modelService.getModelByName(currentModel);
            if (model) {
                // Get configuration status
                const validationResult = await modelService.validateModel(currentModel, {
                    checkApiKey: true,
                    checkEndpoint: true,
                    testConnection: false
                });
                
                // Determine status icon based on validation
                let statusIcon = '$(robot)';
                let statusText = '';
                
                if (validationResult.isValid) {
                    statusIcon = '$(check)';
                    statusText = '✓';
                } else if (validationResult.issues.length > 0) {
                    statusIcon = '$(error)';
                    statusText = '⚠';
                } else if (validationResult.warnings.length > 0) {
                    statusIcon = '$(warning)';
                    statusText = '!';
                }
                
                // Show configuration method for environment variable providers
                let configMethod = '';
                if (model.storageStrategy === 'environment-variables') {
                    configMethod = ' (Env)';
                } else if (model.storageStrategy === 'hybrid') {
                    configMethod = ' (Hybrid)';
                }
                
                statusBarItem.text = `${statusIcon} ${currentModel}${configMethod} ${statusText}`;
                statusBarItem.tooltip = `Current Claude Model: ${model.displayName}\nProvider: ${model.provider}\nConfiguration: ${model.storageStrategy}\nStatus: ${validationResult.isValid ? 'Valid' : 'Issues Found'}\n\nClick to switch models`;
            } else {
                statusBarItem.text = '$(robot) Claude (Unknown)';
                statusBarItem.tooltip = 'Current model not found in configuration - Click to choose a model';
            }
        } else {
            statusBarItem.text = '$(robot) Claude';
            statusBarItem.tooltip = 'No model selected - Click to choose a model';
        }
        
        logger.debug(`Status bar updated: ${statusBarItem.text}`);
        
    } catch (error) {
        logger.error('Failed to update status bar', error);
        statusBarItem.text = '$(robot) Claude (Error)';
        statusBarItem.tooltip = 'Error loading model information - Click to retry';
    }
}

/**
 * Check if migration is needed and prompt user
 */
async function checkMigrationNeeds(context: vscode.ExtensionContext): Promise<void> {
    try {
        logger.info('Checking for migration needs');
        
        const migrationService = new MigrationService(context);
        const migrationStatus = await migrationService.getMigrationStatus();
        
        if (migrationStatus.migrationNeeded) {
            logger.info('Migration needed, prompting user');
            
            const notificationService = NotificationService.getInstance();
            
            // Show migration notification
            const result = await notificationService.showWarning(
                'Z.ai Configuration Migration Required',
                { actions: ['Migrate Now', 'Learn More'] }
            );
            
            if (result === 'Migrate Now') {
                // Start migration wizard
                const migrationWizard = new MigrationWizard(context);
                await migrationWizard.start();
            } else if (result === 'Learn More') {
                // Show information about migration
                await showMigrationInformation();
            }
            
        } else if (migrationStatus.migrationCompleted) {
            logger.info('Migration already completed');
        } else {
            logger.info('No migration needed');
        }
        
    } catch (error) {
        logger.error('Failed to check migration needs', error);
        // Don't throw error here as it's not critical for extension activation
    }
}

/**
 * Show migration information to user
 */
async function showMigrationInformation(): Promise<void> {
    const message = `Z.ai Configuration Migration

The Claude Code Model Switcher has been updated to use environment variables for Z.ai integration instead of VS Code settings.

This change is required for proper Z.ai integration and follows Z.ai's official configuration method.

To migrate your existing Z.ai configuration:
1. Run "Claude: Setup Environment Variables" command
2. Follow the migration wizard steps
3. Your existing API key will be automatically detected

For more information, see the Z.ai Integration Guide in the documentation.`;

    await vscode.window.showInformationMessage(message, { modal: true }, 'OK');
}

// Export for testing
export { updateStatusBar, checkMigrationNeeds, showMigrationInformation };