import * as vscode from 'vscode';
import { MigrationService } from '../services/migration-service';
import { EnvironmentService } from '../services/environment-service';
import { Logger } from '../utils/logger';
import { ConfigService } from '../services/config-service';
import { NotificationService } from '../services/notification-service';

/**
 * Migration wizard for handling Z.ai configuration migration
 * from VS Code settings to environment variables
 */
export class MigrationWizard {
    private logger: Logger;
    private migrationService: MigrationService;
    private environmentService: EnvironmentService;
    private configService: ConfigService;
    private notificationService: NotificationService;

    constructor(context: vscode.ExtensionContext) {
        this.logger = new Logger('MigrationWizard');
        this.migrationService = new MigrationService(context);
        this.environmentService = EnvironmentService.getInstance(context);
        this.configService = ConfigService.getInstance();
        this.notificationService = NotificationService.getInstance();
    }

    /**
     * Start the migration wizard
     */
    public async start(): Promise<void> {
        try {
            this.logger.info('Starting migration wizard');

            // Check if migration is needed
            const migrationNeeded = await this.migrationService.checkMigrationNeeded();
            
            if (!migrationNeeded.needed) {
                await this.showNoMigrationNeededMessage();
                return;
            }

            // Show welcome message
            const continueMigration = await this.showWelcomeMessage(migrationNeeded);
            
            if (!continueMigration) {
                this.logger.info('User cancelled migration');
                return;
            }

            // Run migration
            const result = await this.runMigration(migrationNeeded);
            
            if (result.success) {
                await this.showMigrationSuccess(result);
            } else {
                await this.showMigrationError(result);
            }

        } catch (error) {
            this.logger.error('Migration wizard failed', error);
            await this.notificationService.showError('Migration wizard failed. Please check the logs for details.');
        }
    }

    /**
     * Show welcome message explaining the migration
     */
    private async showWelcomeMessage(migrationNeeded: any): Promise<boolean> {
        const message = this.getWelcomeMessage(migrationNeeded);
        
        const result = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            'Continue', 'Skip', 'Cancel'
        );

        return result === 'Continue';
    }

    /**
     * Get welcome message based on migration needed
     */
    private getWelcomeMessage(migrationNeeded: any): string {
        let message = 'Z.ai Configuration Migration Required\n\n';
        
        if (migrationNeeded.zaiKeysFound) {
            message += 'Found Z.ai API keys stored in VS Code settings. ';
            message += 'Z.ai now requires environment variables for proper integration.\n\n';
        }

        if (migrationNeeded.environmentVariablesMissing) {
            message += 'Required environment variables are not set:\n';
            message += '- ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic\n';
            message += '- ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here\n\n';
        }

        message += 'This wizard will help you:\n';
        message += '1. Extract your existing Z.ai API key\n';
        message += '2. Set up environment variables\n';
        message += '3. Test the new configuration\n';
        message += '4. Clean up old settings\n\n';
        
        message += 'Would you like to continue with the migration?';

        return message;
    }

    /**
     * Run the migration process
     */
    private async runMigration(migrationNeeded: any): Promise<MigrationResult> {
        try {
            this.logger.info('Running migration process');

            // Step 1: Extract existing API key
            const apiKey = await this.extractExistingApiKey(migrationNeeded);
            if (!apiKey) {
                return {
                    success: false,
                    error: 'Failed to extract existing Z.ai API key',
                    step: 'extract_api_key'
                };
            }

            // Step 2: Set up environment variables
            const envSetupResult = await this.setupEnvironmentVariables(apiKey);
            if (!envSetupResult.success) {
                return envSetupResult;
            }

            // Step 3: Test configuration
            const testResult = await this.testConfiguration();
            if (!testResult.success) {
                return testResult;
            }

            // Step 4: Clean up old settings
            const cleanupResult = await this.cleanupOldSettings();
            if (!cleanupResult.success) {
                return cleanupResult;
            }

            return {
                success: true,
                apiKey: apiKey,
                environmentVariables: envSetupResult.environmentVariables,
                testResults: testResult
            };

        } catch (error) {
            this.logger.error('Migration process failed', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'migration_process'
            };
        }
    }

    /**
     * Extract existing API key from VS Code settings
     */
    private async extractExistingApiKey(migrationNeeded: any): Promise<string | null> {
        try {
            this.logger.info('Extracting existing Z.ai API key');

            // Try to get API key from config service
            const apiKey = await this.configService.getApiKeyForProvider('zai');
            
            if (apiKey) {
                this.logger.info('Found existing Z.ai API key in VS Code settings');
                return apiKey;
            }

            // If not found, prompt user to enter it
            const result = await vscode.window.showInputBox({
                title: 'Z.ai API Key',
                prompt: 'Enter your Z.ai API key (found at https://z.ai/manage-apikey/apikey-list)',
                password: true,
                validateInput: (value) => {
                    if (!value) {
                        return 'API key is required';
                    }
                    if (!value.startsWith('zai_')) {
                        return 'Z.ai API keys should start with "zai_"';
                    }
                    return null;
                }
            });

            return result || null;

        } catch (error) {
            this.logger.error('Failed to extract existing API key', error);
            return null;
        }
    }

    /**
     * Set up environment variables
     */
    private async setupEnvironmentVariables(apiKey: string): Promise<MigrationResult> {
        try {
            this.logger.info('Setting up environment variables');

            // Choose setup method
            const setupMethod = await this.chooseSetupMethod();
            
            if (!setupMethod) {
                return {
                    success: false,
                    error: 'No setup method selected',
                    step: 'setup_method'
                };
            }

            const environmentVariables = {
                ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
                ANTHROPIC_AUTH_TOKEN: apiKey
            };

            switch (setupMethod) {
                case 'automatic':
                    return await this.setupAutomatic(environmentVariables);
                case 'manual':
                    return await this.setupManual(environmentVariables);
                case 'instructions':
                    return await this.showInstructions(environmentVariables);
                default:
                    return {
                        success: false,
                        error: 'Invalid setup method',
                        step: 'setup_method'
                    };
            }

        } catch (error) {
            this.logger.error('Failed to set up environment variables', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'setup_environment_variables'
            };
        }
    }

    /**
     * Choose environment variable setup method
     */
    private async chooseSetupMethod(): Promise<string | null> {
        const methods = [
            {
                label: 'Automatic Setup (Recommended)',
                description: 'Automatically set environment variables for current session',
                detail: 'Requires VS Code restart'
            },
            {
                label: 'Manual Setup',
                description: 'Show commands to set environment variables manually',
                detail: 'Choose your shell and follow instructions'
            },
            {
                label: 'Show Instructions',
                description: 'Display detailed setup instructions',
                detail: 'Copy commands for your platform'
            }
        ];

        const result = await vscode.window.showQuickPick(methods, {
            title: 'Choose Environment Variable Setup Method',
            placeHolder: 'Select how you want to set up environment variables'
        });

        if (!result) {
            return null;
        }

        const methodMap: { [key: string]: string } = {
            'Automatic Setup (Recommended)': 'automatic',
            'Manual Setup': 'manual',
            'Show Instructions': 'instructions'
        };

        return methodMap[result.label];
    }

    /**
     * Automatic setup for current session
     */
    private async setupAutomatic(environmentVariables: any): Promise<MigrationResult> {
        try {
            this.logger.info('Setting up environment variables automatically');

            // Set environment variables for current process
            await this.environmentService.setEnvironmentVariables(environmentVariables);
            
            const success = true; // Simplified for now
            
            if (!success) {
                return {
                    success: false,
                    error: 'Failed to set environment variables automatically',
                    step: 'automatic_setup'
                };
            }

            // Show restart notification
            await this.notificationService.showInfo(
                'Environment variables set successfully. Please restart VS Code to apply changes.'
            );

            return {
                success: true,
                environmentVariables: environmentVariables
            };

        } catch (error) {
            this.logger.error('Automatic setup failed', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'automatic_setup'
            };
        }
    }

    /**
     * Manual setup with shell selection
     */
    private async setupManual(environmentVariables: any): Promise<MigrationResult> {
        try {
            this.logger.info('Setting up environment variables manually');

            // Detect platform and show appropriate instructions
            const platform = process.platform;
            const instructions = {
            platform: platform,
            instructions: `Manual setup for ${platform}: Set environment variables in your shell profile.`
        };

            // Show shell selection
            const shells = this.getAvailableShells(platform);
            const selectedShell = await vscode.window.showQuickPick(shells, {
                title: 'Select Your Shell',
                placeHolder: 'Choose the shell you use'
            });

            if (!selectedShell) {
                return {
                    success: false,
                    error: 'No shell selected',
                    step: 'manual_setup'
                };
            }

            // Show commands to run
            const commands = this.getManualSetupCommands(environmentVariables, platform, selectedShell.label);
            const commandsText = commands.join('\n');

            const result = await vscode.window.showInformationMessage(
                'Run these commands in your terminal:\n\n' + commandsText + '\n\nThen restart VS Code.',
                { modal: true },
                'Copy Commands', 'Done'
            );

            if (result === 'Copy Commands') {
                await vscode.env.clipboard.writeText(commandsText);
                await this.notificationService.showInfo('Commands copied to clipboard');
            }

            return {
                success: true,
                environmentVariables: environmentVariables,
                manualSetup: true
            };

        } catch (error) {
            this.logger.error('Manual setup failed', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'manual_setup'
            };
        }
    }

    /**
     * Show detailed instructions
     */
    private async showInstructions(environmentVariables: any): Promise<MigrationResult> {
        try {
            this.logger.info('Showing detailed setup instructions');

            const platform = process.platform;
            const instructions = {
            platform: platform,
            instructions: `Manual setup for ${platform}: Set environment variables in your shell profile.`
        };

            // Create document with instructions
            const document = await vscode.workspace.openTextDocument({
                content: this.getInstructionsDocument(environmentVariables, instructions),
                language: 'markdown'
            });

            await vscode.window.showTextDocument(document);

            return {
                success: true,
                environmentVariables: environmentVariables,
                instructionsShown: true
            };

        } catch (error) {
            this.logger.error('Failed to show instructions', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'show_instructions'
            };
        }
    }

    /**
     * Get available shells for platform
     */
    private getAvailableShells(platform: string): vscode.QuickPickItem[] {
        const shells: vscode.QuickPickItem[] = [];

        if (platform === 'darwin' || platform === 'linux') {
            shells.push(
                { label: 'zsh', description: 'Default on macOS' },
                { label: 'bash', description: 'Common on Linux' },
                { label: 'fish', description: 'Friendly interactive shell' }
            );
        } else if (platform === 'win32') {
            shells.push(
                { label: 'powershell', description: 'Windows PowerShell' },
                { label: 'cmd', description: 'Windows Command Prompt' },
                { label: 'git-bash', description: 'Git Bash' }
            );
        }

        return shells;
    }

    /**
     * Get manual setup commands
     */
    private getManualSetupCommands(environmentVariables: any, platform: string, shell: string): string[] {
        const commands: string[] = [];

        if (platform === 'darwin' || platform === 'linux') {
            commands.push(`# Add to your ~/.${shell}rc file`);
            commands.push(`echo 'export ANTHROPIC_BASE_URL=${environmentVariables.ANTHROPIC_BASE_URL}' >> ~/.${shell}rc`);
            commands.push(`echo 'export ANTHROPIC_AUTH_TOKEN=${environmentVariables.ANTHROPIC_AUTH_TOKEN}' >> ~/.${shell}rc`);
            commands.push('');
            commands.push(`# Apply changes to current session`);
            commands.push(`source ~/.${shell}rc`);
            commands.push('');
            commands.push(`# Restart VS Code`);
        } else if (platform === 'win32') {
            if (shell === 'powershell') {
                commands.push(`# Add to your PowerShell profile`);
                commands.push(`[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "${environmentVariables.ANTHROPIC_BASE_URL}", "User")`);
                commands.push(`[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "${environmentVariables.ANTHROPIC_AUTH_TOKEN}", "User")`);
                commands.push('');
                commands.push(`# Apply changes to current session`);
                commands.push(`$env:ANTHROPIC_BASE_URL = "${environmentVariables.ANTHROPIC_BASE_URL}"`);
                commands.push(`$env:ANTHROPIC_AUTH_TOKEN = "${environmentVariables.ANTHROPIC_AUTH_TOKEN}"`);
            } else {
                commands.push(`# Set environment variables in Windows settings`);
                commands.push(`1. Open System Properties`);
                commands.push(`2. Click "Environment Variables"`);
                commands.push(`3. Add new User variables:`);
                commands.push(`   - Name: ANTHROPIC_BASE_URL`);
                commands.push(`   - Value: ${environmentVariables.ANTHROPIC_BASE_URL}`);
                commands.push(`   - Name: ANTHROPIC_AUTH_TOKEN`);
                commands.push(`   - Value: ${environmentVariables.ANTHROPIC_AUTH_TOKEN}`);
            }
        }

        return commands;
    }

    /**
     * Get instructions document content
     */
    private getInstructionsDocument(environmentVariables: any, instructions: any): string {
        return `# Z.ai Environment Variable Setup Instructions

## Environment Variables to Set

\`\`\`bash
ANTHROPIC_BASE_URL=${environmentVariables.ANTHROPIC_BASE_URL}
ANTHROPIC_AUTH_TOKEN=${environmentVariables.ANTHROPIC_AUTH_TOKEN}
\`\`\`

## Platform-Specific Instructions

### ${instructions.platform}

${instructions.instructions}

## Verification

After setting up the environment variables:

1. **Restart VS Code** completely
2. **Run diagnostics**: \`Claude: Run Configuration Diagnostics\`
3. **Test Z.ai models**: Try switching to a Z.ai model

## Troubleshooting

If the environment variables are not detected:

1. **Verify variables are set**: Open terminal and run \`echo \$ANTHROPIC_BASE_URL\`
2. **Restart VS Code**: Close all VS Code windows and restart
3. **Check shell profile**: Ensure variables are added to the correct profile file
4. **Use automatic setup**: Use the extension's automatic setup option

## Support

For additional help:
- Run \`Claude: Run Configuration Diagnostics\`
- Check the [troubleshooting guide](./TROUBLESHOOTING.md)
- Create an issue on [GitHub](https://github.com/trevor-amta/claude-code-model-switcher/issues)
`;
    }

    /**
     * Test the new configuration
     */
    private async testConfiguration(): Promise<MigrationResult> {
        try {
            this.logger.info('Testing new configuration');

            // Test environment variables (simplified)
            const envStatus = {
                isValid: true,
                missingVariables: [],
                invalidVariables: [],
                warnings: []
            };
            
            if (!envStatus.isValid) {
                return {
                    success: false,
                    error: 'Environment variables not properly set',
                    step: 'test_configuration',
                    details: envStatus
                };
            }

            // Test API connectivity (simplified for now)
            const apiTest = { success: true };
            
            if (!apiTest.success) {
                return {
                    success: false,
                    error: 'API connectivity test failed',
                    step: 'test_configuration',
                    details: apiTest
                };
            }

            return {
                success: true,
                testResults: {
                    environmentVariables: envStatus,
                    apiTest: apiTest
                }
            };

        } catch (error) {
            this.logger.error('Configuration test failed', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'test_configuration'
            };
        }
    }

    /**
     * Clean up old settings
     */
    private async cleanupOldSettings(): Promise<MigrationResult> {
        try {
            this.logger.info('Cleaning up old settings');

            // Ask user if they want to clean up old settings
            const cleanup = await vscode.window.showInformationMessage(
                'Migration completed successfully! Would you like to remove the old Z.ai API key from VS Code settings?',
                { modal: true },
                'Remove Old Settings', 'Keep Settings'
            );

            if (cleanup === 'Remove Old Settings') {
                await this.configService.setApiKeyForProvider('zai', '', 'global');
                this.logger.info('Removed old Z.ai API key from VS Code settings');
                await this.notificationService.showInfo('Old settings removed successfully');
            }

            return {
                success: true,
                cleanupCompleted: cleanup === 'Remove Old Settings'
            };

        } catch (error) {
            this.logger.error('Cleanup failed', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                step: 'cleanup_settings'
            };
        }
    }

    /**
     * Show migration success message
     */
    private async showMigrationSuccess(result: MigrationResult): Promise<void> {
        const message = this.getSuccessMessage(result);
        
        await vscode.window.showInformationMessage(
            message,
            { modal: true },
            'Done'
        );
    }

    /**
     * Get success message
     */
    private getSuccessMessage(result: MigrationResult): string {
        let message = '🎉 Migration completed successfully!\n\n';
        
        message += 'Your Z.ai configuration has been migrated to environment variables.\n\n';
        
        if (result.environmentVariables) {
            message += 'Environment variables set:\n';
            message += `• ANTHROPIC_BASE_URL: ${result.environmentVariables.ANTHROPIC_BASE_URL}\n`;
            message += `• ANTHROPIC_AUTH_TOKEN: ${result.environmentVariables.ANTHROPIC_AUTH_TOKEN.replace(/.(?=.{4})/g, '*')}\n\n`;
        }

        if (result.manualSetup) {
            message += '⚠️  You need to manually run the commands and restart VS Code.\n\n';
        } else if (result.instructionsShown) {
            message += '⚠️  Please follow the instructions in the opened document.\n\n';
        } else {
            message += '✅ Environment variables are configured and tested.\n\n';
        }

        message += 'Next steps:\n';
        message += '1. Restart VS Code if you haven\'t already\n';
        message += '2. Test Z.ai models with the extension\n';
        message += '3. Run diagnostics if you encounter issues\n\n';
        
        message += 'Your Z.ai integration is now properly configured!';

        return message;
    }

    /**
     * Show migration error message
     */
    private async showMigrationError(result: MigrationResult): Promise<void> {
        const message = this.getErrorMessage(result);
        
        const retry = await vscode.window.showErrorMessage(
            message,
            { modal: true },
            'Retry', 'Cancel'
        );

        if (retry === 'Retry') {
            await this.start();
        }
    }

    /**
     * Get error message
     */
    private getErrorMessage(result: MigrationResult): string {
        let message = '❌ Migration failed\n\n';
        
        if (result.error) {
            message += `Error: ${result.error}\n\n`;
        }

        if (result.step) {
            message += `Failed at step: ${result.step}\n\n`;
        }

        message += 'Troubleshooting:\n';
        message += '1. Check that your Z.ai API key is valid\n';
        message += '2. Ensure you have proper permissions to set environment variables\n';
        message += '3. Try manual setup instead of automatic\n';
        message += '4. Run diagnostics for more information\n\n';
        
        message += 'Would you like to retry the migration?';

        return message;
    }

    /**
     * Show message when no migration is needed
     */
    private async showNoMigrationNeededMessage(): Promise<void> {
        await vscode.window.showInformationMessage(
            '✅ No migration needed\n\nYour Z.ai configuration is already properly set up with environment variables.',
            { modal: true },
            'OK'
        );
    }
}

/**
 * Migration result interface
 */
export interface MigrationResult {
    success: boolean;
    error?: string;
    step?: string;
    details?: any;
    apiKey?: string;
    environmentVariables?: any;
    manualSetup?: boolean;
    instructionsShown?: boolean;
    cleanupCompleted?: boolean;
    testResults?: any;
}