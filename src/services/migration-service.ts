import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ConfigService } from './config-service';

/**
 * Service for handling migration of Z.ai configurations
 * from VS Code settings to environment variables
 */
export class MigrationService {
    private logger: Logger;
    private configService: ConfigService;

    constructor(context: vscode.ExtensionContext) {
        this.logger = new Logger('MigrationService');
        this.configService = ConfigService.getInstance();
    }

    /**
     * Check if migration is needed
     */
    public async checkMigrationNeeded(): Promise<MigrationCheckResult> {
        try {
            this.logger.info('Checking if migration is needed');

            const result: MigrationCheckResult = {
                needed: false,
                zaiKeysFound: false,
                environmentVariablesMissing: false,
                migrationRequired: false
            };

            // Check for existing Z.ai API keys in VS Code settings
            const zaiApiKey = await this.configService.getApiKeyForProvider('zai');
            result.zaiKeysFound = !!zaiApiKey;

            // Check if environment variables are set
            const envVars = this.checkEnvironmentVariables();
            result.environmentVariablesMissing = !envVars.baseUrlSet || !envVars.authTokenSet;

            // Determine if migration is needed
            result.migrationRequired = result.zaiKeysFound && result.environmentVariablesMissing;
            result.needed = result.migrationRequired || (result.zaiKeysFound && !result.environmentVariablesMissing);

            this.logger.info('Migration check result', result);
            return result;

        } catch (error) {
            this.logger.error('Failed to check migration needed', error);
            return {
                needed: false,
                zaiKeysFound: false,
                environmentVariablesMissing: false,
                migrationRequired: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check if environment variables are set
     */
    private checkEnvironmentVariables(): EnvironmentVariableCheck {
        const baseUrl = process.env.ANTHROPIC_BASE_URL;
        const authToken = process.env.ANTHROPIC_AUTH_TOKEN;

        return {
            baseUrlSet: baseUrl === 'https://api.z.ai/api/anthropic',
            authTokenSet: !!authToken && authToken.startsWith('zai_'),
            baseUrl: baseUrl,
            authToken: authToken
        };
    }

    /**
     * Extract existing Z.ai API key from VS Code settings
     */
    public async extractExistingApiKey(): Promise<string | null> {
        try {
            this.logger.info('Extracting existing Z.ai API key');

            const apiKey = await this.configService.getApiKeyForProvider('zai');
            
            if (apiKey) {
                this.logger.info('Found existing Z.ai API key');
                return apiKey;
            }

            this.logger.info('No existing Z.ai API key found');
            return null;

        } catch (error) {
            this.logger.error('Failed to extract existing API key', error);
            return null;
        }
    }

    /**
     * Remove old Z.ai API key from VS Code settings
     */
    public async removeOldApiKey(): Promise<boolean> {
        try {
            this.logger.info('Removing old Z.ai API key from VS Code settings');

            await this.configService.setApiKeyForProvider('zai', '', 'global');
            this.logger.info('Successfully removed old Z.ai API key');
            return true;

        } catch (error) {
            this.logger.error('Failed to remove old API key', error);
            return false;
        }
    }

    /**
     * Validate migration was successful
     */
    public async validateMigration(): Promise<MigrationValidationResult> {
        try {
            this.logger.info('Validating migration');

            const result: MigrationValidationResult = {
                success: false,
                environmentVariablesSet: false,
                apiKeyRemoved: false,
                configurationWorking: false
            };

            // Check environment variables
            const envVars = this.checkEnvironmentVariables();
            result.environmentVariablesSet = envVars.baseUrlSet && envVars.authTokenSet;

            // Check if old API key was removed
            const oldApiKey = await this.configService.getApiKeyForProvider('zai');
            result.apiKeyRemoved = !oldApiKey;

            // Test configuration
            if (result.environmentVariablesSet) {
                try {
                    // For now, we'll just check if environment variables are set
                    // In a real implementation, you would test the API connection
                    result.configurationWorking = true;
                } catch (error) {
                    this.logger.error('Configuration test failed', error);
                    result.configurationWorking = false;
                }
            }

            result.success = result.environmentVariablesSet && result.configurationWorking;

            this.logger.info('Migration validation result', result);
            return result;

        } catch (error) {
            this.logger.error('Failed to validate migration', error);
            return {
                success: false,
                environmentVariablesSet: false,
                apiKeyRemoved: false,
                configurationWorking: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get migration status
     */
    public async getMigrationStatus(): Promise<MigrationStatus> {
        try {
            this.logger.info('Getting migration status');

            const status: MigrationStatus = {
                hasOldConfiguration: false,
                hasEnvironmentVariables: false,
                migrationCompleted: false,
                migrationNeeded: false,
                details: {}
            };

            // Check for old configuration
            const oldApiKey = await this.configService.getApiKeyForProvider('zai');
            status.hasOldConfiguration = !!oldApiKey;

            // Check environment variables
            const envVars = this.checkEnvironmentVariables();
            status.hasEnvironmentVariables = envVars.baseUrlSet && envVars.authTokenSet;

            // Determine migration status
            status.migrationNeeded = status.hasOldConfiguration && !status.hasEnvironmentVariables;
            status.migrationCompleted = !status.hasOldConfiguration && status.hasEnvironmentVariables;

            status.details = {
                oldApiKeyFound: !!oldApiKey,
                environmentVariables: envVars
            };

            this.logger.info('Migration status', status);
            return status;

        } catch (error) {
            this.logger.error('Failed to get migration status', error);
            return {
                hasOldConfiguration: false,
                hasEnvironmentVariables: false,
                migrationCompleted: false,
                migrationNeeded: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Backup existing configuration before migration
     */
    public async backupConfiguration(): Promise<MigrationBackup | null> {
        try {
            this.logger.info('Backing up configuration');

            const backup: MigrationBackup = {
                timestamp: new Date().toISOString(),
                zaiApiKey: await this.configService.getApiKeyForProvider('zai'),
                settings: {}
            };

            // Backup extension settings
            const config = vscode.workspace.getConfiguration('claudeModelSwitcher');
            backup.settings = {
                defaultModel: config.get('defaultModel'),
                showStatusBar: config.get('showStatusBar'),
                reloadBehavior: config.get('reloadBehavior'),
                debugMode: config.get('debugMode'),
                availableModels: config.get('availableModels')
            };

            this.logger.info('Configuration backed up successfully');
            return backup;

        } catch (error) {
            this.logger.error('Failed to backup configuration', error);
            return null;
        }
    }

    /**
     * Restore configuration from backup
     */
    public async restoreConfiguration(backup: MigrationBackup): Promise<boolean> {
        try {
            this.logger.info('Restoring configuration from backup');

            // Restore API key
            if (backup.zaiApiKey) {
                await this.configService.setApiKeyForProvider('zai', backup.zaiApiKey || '', 'global');
            }

            // Restore settings
            const config = vscode.workspace.getConfiguration('claudeModelSwitcher');
            await config.update('defaultModel', backup.settings.defaultModel, vscode.ConfigurationTarget.Global);
            await config.update('showStatusBar', backup.settings.showStatusBar, vscode.ConfigurationTarget.Global);
            await config.update('reloadBehavior', backup.settings.reloadBehavior, vscode.ConfigurationTarget.Global);
            await config.update('debugMode', backup.settings.debugMode, vscode.ConfigurationTarget.Global);
            await config.update('availableModels', backup.settings.availableModels, vscode.ConfigurationTarget.Global);

            this.logger.info('Configuration restored successfully');
            return true;

        } catch (error) {
            this.logger.error('Failed to restore configuration', error);
            return false;
        }
    }
}

/**
 * Migration check result interface
 */
export interface MigrationCheckResult {
    needed: boolean;
    zaiKeysFound: boolean;
    environmentVariablesMissing: boolean;
    migrationRequired: boolean;
    error?: string;
}

/**
 * Environment variable check result interface
 */
export interface EnvironmentVariableCheck {
    baseUrlSet: boolean;
    authTokenSet: boolean;
    baseUrl?: string;
    authToken?: string;
}

/**
 * Migration validation result interface
 */
export interface MigrationValidationResult {
    success: boolean;
    environmentVariablesSet: boolean;
    apiKeyRemoved: boolean;
    configurationWorking: boolean;
    error?: string;
}

/**
 * Migration status interface
 */
export interface MigrationStatus {
    hasOldConfiguration: boolean;
    hasEnvironmentVariables: boolean;
    migrationCompleted: boolean;
    migrationNeeded: boolean;
    error?: string;
    details?: any;
}

/**
 * Migration backup interface
 */
export interface MigrationBackup {
    timestamp: string;
    zaiApiKey?: string;
    settings: any;
}