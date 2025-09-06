import * as vscode from 'vscode';
import { MigrationWizard } from '../wizards/migration-wizard';
import { Logger } from '../utils/logger';

/**
 * Command to run the migration wizard for Z.ai configuration
 */
export async function runMigration(): Promise<void> {
    const logger = new Logger('RunMigrationCommand');
    
    try {
        logger.info('Starting migration command');
        
        // Get the extension context
        const extension = vscode.extensions.getExtension('trevor-amta.claude-code-model-switcher');
        if (!extension) {
            throw new Error('Extension not found');
        }
        
        // For now, we'll disable this command as it needs context
        // Users can use the automatic migration detection or diagnostics
        await vscode.window.showInformationMessage(
            'Migration is handled automatically. Please restart VS Code to trigger migration detection, or run "Claude: Run Configuration Diagnostics".'
        );
        
        logger.info('Migration command completed successfully');
        
    } catch (error) {
        logger.error('Migration command failed', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        vscode.window.showErrorMessage(
            `Migration failed: ${errorMessage}`,
            'View Logs'
        ).then(selection => {
            if (selection === 'View Logs') {
                vscode.commands.executeCommand('workbench.action.toggleDevTools');
            }
        });
        
        throw error;
    }
}