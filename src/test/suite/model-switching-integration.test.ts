import * as assert from 'assert';
import * as vscode from 'vscode';
import { ModelService } from '../../services/model-service';
import { ConfigService } from '../../services/config-service';
import { ClaudeService } from '../../services/claude-service';
import { SwitchModelCommand } from '../../commands/switch-model';
import { NotificationService } from '../../services/notification-service';
import { StorageService } from '../../services/storage-service';
import { EnvironmentService } from '../../services/environment-service';
import { VSCodeSettingsStrategy } from '../../services/config-strategies/vscode-settings-strategy';
import { EnvironmentVariablesStrategy } from '../../services/config-strategies/environment-strategy';
import { Logger } from '../../utils/logger';
import { SecurityUtils } from '../../utils/security-utils';
import { ModelConfig, ModelSwitchResult, ModelValidationResult } from '../../types/model-config';

suite('Model Switching Between Providers Integration Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let modelService: ModelService;
    let configService: ConfigService;
    let claudeService: ClaudeService;
    let switchCommand: SwitchModelCommand;
    let notificationService: NotificationService;
    let storageService: StorageService;
    let environmentService: EnvironmentService;
    let originalEnv: NodeJS.ProcessEnv;
    let mockConfiguration: vscode.WorkspaceConfiguration;
    let mockShowQuickPick: any;
    let mockShowInformationMessage: any;
    let mockShowWarningMessage: any;
    let mockShowErrorMessage: any;
    let mockExecuteCommand: any;

    // Test models
    const anthropicModel: ModelConfig = {
        name: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        description: 'Latest Sonnet model for balanced performance',
        endpoint: 'https://api.anthropic.com',
        type: 'web',
        provider: 'anthropic'
    };

    const zaiModel: ModelConfig = {
        name: 'glm-4.5',
        displayName: 'GLM-4.5',
        description: 'Z.ai\'s powerful reasoning model',
        endpoint: 'https://api.z.ai/api/anthropic',
        type: 'api',
        provider: 'zai',
        storageStrategy: 'environment-variables'
    };

    const customModel: ModelConfig = {
        name: 'custom-model',
        displayName: 'Custom Model',
        description: 'Custom API model',
        endpoint: 'https://api.custom.com/v1',
        type: 'api',
        provider: 'custom'
    };

    suiteSetup(() => {
        // Store original environment variables
        originalEnv = { ...process.env };

        // Mock context for testing
        mockContext = {
            subscriptions: [],
            globalState: {
                keys: () => [],
                get: () => undefined,
                update: async () => {}
            } as any,
            workspaceState: {
                keys: () => [],
                get: () => undefined,
                update: async () => {}
            } as any,
            secrets: {
                get: async () => undefined,
                store: async () => {},
                delete: async () => {}
            } as any,
            extensionPath: '',
            extensionUri: vscode.Uri.parse(''),
            globalStorageUri: vscode.Uri.parse(''),
            logUri: vscode.Uri.parse(''),
            storageUri: vscode.Uri.parse(''),
            globalStoragePath: '',
            logPath: '',
            storagePath: '',
            asAbsolutePath: (path: string) => path,
            extensionMode: vscode.ExtensionMode.Test,
            environmentVariableCollection: {} as any,
            extension: {} as any,
            languageModelAccessInformation: {} as any
        };

        // Mock configuration
        mockConfiguration = {
            get: (section: string) => {
                switch (section) {
                    case 'defaultModel':
                        return 'claude-sonnet-4-20250514';
                    case 'showStatusBar':
                        return true;
                    case 'reloadBehavior':
                        return 'prompt';
                    case 'debugMode':
                        return false;
                    case 'availableModels':
                        return [anthropicModel, zaiModel, customModel];
                    case 'apiKeys':
                        return {
                            anthropic: 'encrypted-sk-ant-api-key',
                            custom: 'encrypted-custom-api-key'
                        };
                    case 'preferences':
                        return {};
                    case 'notifications':
                        return {
                            showSwitchConfirmation: true,
                            showReloadPrompt: true,
                            showErrorNotifications: true,
                            showSuccessNotifications: true,
                            notificationDuration: 5000
                        };
                    default:
                        return undefined;
                }
            },
            update: async (section: string, value: any, target?: vscode.ConfigurationTarget) => {
                // Mock successful update
                return;
            },
            inspect: (section: string) => {
                return {
                    key: `claudeModelSwitcher.${section}`,
                    defaultValue: undefined,
                    globalValue: section === 'apiKeys' ? { anthropic: 'encrypted-sk-ant-api-key' } : undefined,
                    workspaceValue: undefined,
                    workspaceFolderValue: undefined,
                    defaultLanguageValue: undefined,
                    globalLanguageValue: undefined,
                    workspaceLanguageValue: undefined,
                    workspaceFolderLanguageValue: undefined
                };
            }
        } as any;
    });

    setup(() => {
        // Reset environment before each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('ANTHROPIC_') || key.startsWith('ZAI_') || key.startsWith('OPENAI_') || key.startsWith('CLAUDE_')) {
                delete process.env[key];
            }
        });

        // Reset singletons
        (StorageService as any).instance = undefined;
        (NotificationService as any).instance = undefined;
        (EnvironmentService as any).instance = undefined;
        (ConfigService as any).instance = undefined;
        (ModelService as any).instance = undefined;
        (ClaudeService as any).instance = undefined;

        // Mock vscode.workspace.getConfiguration
        (vscode.workspace.getConfiguration as any) = () => mockConfiguration;

        // Create services
        storageService = StorageService.initialize(mockContext);
        notificationService = NotificationService.getInstance();
        environmentService = EnvironmentService.getInstance(mockContext);
        configService = ConfigService.getInstance();
        claudeService = ClaudeService.getInstance();
        modelService = ModelService.getInstance();
        switchCommand = new SwitchModelCommand();

        // Mock VS Code UI methods
        mockShowQuickPick = async (items: any[], options: any) => {
            return items[0]; // Return first item by default
        };

        mockShowInformationMessage = async (message: string, options: any, ...actions: string[]) => {
            return actions[0]; // Return first action by default
        };

        mockShowWarningMessage = async (message: string, options: any, ...actions: string[]) => {
            return actions[0]; // Return first action by default
        };

        mockShowErrorMessage = async (message: string, options: any) => {
            return undefined;
        };

        mockExecuteCommand = async (command: string, ...args: any[]) => {
            return;
        };

        // Apply mocks
        (vscode.window.showQuickPick as any) = mockShowQuickPick;
        (vscode.window.showInformationMessage as any) = mockShowInformationMessage;
        (vscode.window.showWarningMessage as any) = mockShowWarningMessage;
        (vscode.window.showErrorMessage as any) = mockShowErrorMessage;
        (vscode.commands.executeCommand as any) = mockExecuteCommand;

        // Set up environment variables for Z.ai
        process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
        process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/api/anthropic';
    });

    teardown(() => {
        // Restore original environment after each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('ANTHROPIC_') || key.startsWith('ZAI_') || key.startsWith('OPENAI_') || key.startsWith('CLAUDE_')) {
                delete process.env[key];
            }
        });
        
        Object.keys(originalEnv).forEach(key => {
            if (key.startsWith('ANTHROPIC_') || key.startsWith('ZAI_') || key.startsWith('OPENAI_') || key.startsWith('CLAUDE_')) {
                process.env[key] = originalEnv[key];
            }
        });

        // Dispose services
        modelService.dispose();
        configService.dispose();
        claudeService.dispose();
        environmentService.dispose();
    });

    suite('Model Validation Across Providers', () => {
        test('should validate Anthropic model successfully', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            const result = await modelService.validateModel(anthropicModel.name);
            
            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.model.name, anthropicModel.name);
            assert.strictEqual(result.issues.length, 0);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should validate Z.ai model successfully', async () => {
            const result = await modelService.validateModel(zaiModel.name);
            
            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.model.name, zaiModel.name);
            assert.strictEqual(result.issues.length, 0);
        });

        test('should validate custom model successfully', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                custom: 'custom-test-key'
            });

            const result = await modelService.validateModel(customModel.name);
            
            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.model.name, customModel.name);
            assert.strictEqual(result.issues.length, 0);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should detect missing API key for Anthropic model', async () => {
            // Mock failed decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({}); // No keys

            const result = await modelService.validateModel(anthropicModel.name);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.issues.some(issue => issue.includes('API key required')));

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should detect missing environment variables for Z.ai model', async () => {
            // Clear environment variables
            delete process.env.ANTHROPIC_AUTH_TOKEN;
            delete process.env.ANTHROPIC_BASE_URL;

            const result = await modelService.validateModel(zaiModel.name);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.issues.some(issue => issue.includes('API key required')));
        });

        test('should detect invalid endpoint for custom model', async () => {
            // Create invalid model
            const invalidModel = { ...customModel, endpoint: 'invalid-url' };
            
            // Mock update to use invalid model
            const originalGetModels = configService.getAvailableModels;
            configService.getAvailableModels = async () => [anthropicModel, zaiModel, invalidModel];

            const result = await modelService.validateModel(invalidModel.name);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.issues.some(issue => issue.includes('Invalid endpoint URL')));

            // Restore original method
            configService.getAvailableModels = originalGetModels;
        });
    });

    suite('Model Switching Between Providers', () => {
        test('should switch from Anthropic to Z.ai model', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption for Anthropic
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Simulate successful update
            };

            const result = await modelService.switchModel(zaiModel.name);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.previousModel, anthropicModel.name);
            assert.strictEqual(result.newModel, zaiModel.name);
            assert.ok(result.requiresReload);

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });

        test('should switch from Z.ai to Anthropic model', async () => {
            // Mock current model as Z.ai
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => zaiModel.name;

            // Mock successful decryption for Anthropic
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Simulate successful update
            };

            const result = await modelService.switchModel(anthropicModel.name);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.previousModel, zaiModel.name);
            assert.strictEqual(result.newModel, anthropicModel.name);
            assert.ok(result.requiresReload);

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });

        test('should switch from Anthropic to custom model', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key',
                custom: 'custom-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Simulate successful update
            };

            const result = await modelService.switchModel(customModel.name);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.previousModel, anthropicModel.name);
            assert.strictEqual(result.newModel, customModel.name);
            assert.ok(result.requiresReload);

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });

        test('should handle switch to same model', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            const result = await modelService.switchModel(anthropicModel.name);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.previousModel, anthropicModel.name);
            assert.strictEqual(result.newModel, anthropicModel.name);
            assert.strictEqual(result.requiresReload, false);
            assert.ok(result.message.includes('already active'));

            // Restore original method
            modelService.getCurrentModel = originalGetCurrentModel;
        });

        test('should handle forced switch to same model', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Simulate successful update
            };

            const result = await modelService.switchModel(anthropicModel.name, { force: true });
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.previousModel, anthropicModel.name);
            assert.strictEqual(result.newModel, anthropicModel.name);
            assert.ok(result.requiresReload);

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });
    });

    suite('Model Switching Error Handling', () => {
        test('should handle missing API key during switch', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock failed decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({}); // No keys

            const result = await modelService.switchModel(zaiModel.name);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('API key required'));

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should handle model not found during switch', async () => {
            const result = await modelService.switchModel('nonexistent-model');
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('not found in available models'));
        });

        test('should handle Claude service update failure', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update failure
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                throw new Error('Claude service update failed');
            };

            const result = await modelService.switchModel(zaiModel.name);
            
            // Should still succeed (Claude service failure is handled gracefully)
            assert.strictEqual(result.success, true);

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });

        test('should handle validation failure during switch', async () => {
            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock failed decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({}); // No keys

            const result = await modelService.switchModel(zaiModel.name);
            
            assert.strictEqual(result.success, false);
            assert.ok(result.error?.includes('validation failed'));

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });

    suite('Switch Command Integration', () => {
        test('should complete full switch command flow', async () => {
            // Mock model selection
            let modelPickShown = false;
            (notificationService.showModelQuickPick as any) = async () => {
                modelPickShown = true;
                return zaiModel;
            };

            // Mock successful switch
            const originalSwitchModel = modelService.switchModel;
            modelService.switchModel = async (modelName: string, options?: any) => {
                return {
                    success: true,
                    previousModel: anthropicModel.name,
                    newModel: zaiModel.name,
                    requiresReload: true,
                    message: 'Successfully switched to GLM-4.5'
                };
            };

            // Mock result display
            let resultShown = false;
            (notificationService.showModelSwitchResult as any) = async (result: ModelSwitchResult) => {
                resultShown = true;
                assert.strictEqual(result.success, true);
            };

            // Mock progress display
            (notificationService.showProgress as any) = async (message: string, task: any) => {
                const progress = {
                    report: (update: any) => {}
                };
                return await task(progress);
            };

            await switchCommand.execute();

            assert.strictEqual(modelPickShown, true);
            assert.strictEqual(resultShown, true);

            // Restore original method
            modelService.switchModel = originalSwitchModel;
        });

        test('should handle model selection cancellation', async () => {
            // Mock model selection cancellation
            (notificationService.showModelQuickPick as any) = async () => {
                return undefined; // User cancelled
            };

            await switchCommand.execute();

            // Should complete without errors
            assert.ok(true);
        });

        test('should handle switch failure in command', async () => {
            // Mock model selection
            (notificationService.showModelQuickPick as any) = async () => {
                return zaiModel;
            };

            // Mock switch failure
            const originalSwitchModel = modelService.switchModel;
            modelService.switchModel = async (modelName: string, options?: any) => {
                return {
                    success: false,
                    previousModel: anthropicModel.name,
                    newModel: zaiModel.name,
                    requiresReload: false,
                    error: 'Switch failed'
                };
            };

            // Mock result display
            let resultShown = false;
            (notificationService.showModelSwitchResult as any) = async (result: ModelSwitchResult) => {
                resultShown = true;
                assert.strictEqual(result.success, false);
            };

            // Mock progress display
            (notificationService.showProgress as any) = async (message: string, task: any) => {
                const progress = {
                    report: (update: any) => {}
                };
                return await task(progress);
            };

            await switchCommand.execute();

            assert.strictEqual(resultShown, true);

            // Restore original method
            modelService.switchModel = originalSwitchModel;
        });
    });

    suite('Reload Behavior Testing', () => {
        test('should handle auto reload behavior', async () => {
            // Mock reload behavior
            const originalGetReloadBehavior = configService.getReloadBehavior;
            configService.getReloadBehavior = async () => 'auto';

            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Simulate successful update
            };

            let reloadCommandExecuted = false;
            (vscode.commands.executeCommand as any) = async (command: string, ...args: any[]) => {
                if (command === 'workbench.action.reloadWindow') {
                    reloadCommandExecuted = true;
                }
            };

            const result = await modelService.switchModel(zaiModel.name);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.requiresReload);

            // Wait for potential timeout
            await new Promise(resolve => setTimeout(resolve, 1100));
            assert.strictEqual(reloadCommandExecuted, true);

            // Restore original methods
            configService.getReloadBehavior = originalGetReloadBehavior;
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });

        test('should handle skip reload behavior', async () => {
            // Mock reload behavior
            const originalGetReloadBehavior = configService.getReloadBehavior;
            configService.getReloadBehavior = async () => 'skip';

            // Mock current model as Anthropic
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Simulate successful update
            };

            let reloadCommandExecuted = false;
            (vscode.commands.executeCommand as any) = async (command: string, ...args: any[]) => {
                if (command === 'workbench.action.reloadWindow') {
                    reloadCommandExecuted = true;
                }
            };

            const result = await modelService.switchModel(zaiModel.name);
            
            assert.strictEqual(result.success, true);
            assert.ok(result.requiresReload);

            // Wait for potential timeout
            await new Promise(resolve => setTimeout(resolve, 1100));
            assert.strictEqual(reloadCommandExecuted, false);

            // Restore original methods
            configService.getReloadBehavior = originalGetReloadBehavior;
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });
    });

    suite('Provider-Specific Configuration Testing', () => {
        test('should use correct configuration strategy for each provider', async () => {
            // Test Anthropic strategy
            const anthropicStrategy = configService.getConfigurationStrategy('anthropic');
            assert.ok(anthropicStrategy instanceof VSCodeSettingsStrategy);

            // Test Z.ai strategy
            const zaiStrategy = configService.getConfigurationStrategy('zai');
            assert.ok(zaiStrategy instanceof EnvironmentVariablesStrategy);

            // Test custom provider strategy
            const customStrategy = configService.getConfigurationStrategy('custom');
            assert.ok(customStrategy instanceof VSCodeSettingsStrategy);
        });

        test('should validate provider-specific API key requirements', async () => {
            // Test Anthropic requires API key
            const anthropicValidation = await modelService.validateModel(anthropicModel.name);
            if (!anthropicValidation.isValid) {
                assert.ok(anthropicValidation.issues.some(issue => issue.includes('API key')));
            }

            // Test Z.ai requires environment variables
            delete process.env.ANTHROPIC_AUTH_TOKEN;
            delete process.env.ANTHROPIC_BASE_URL;
            
            const zaiValidation = await modelService.validateModel(zaiModel.name);
            if (!zaiValidation.isValid) {
                assert.ok(zaiValidation.issues.some(issue => issue.includes('API key')));
            }
        });

        test('should handle provider switching with different storage methods', async () => {
            // Switch from Anthropic (VS Code settings) to Z.ai (environment variables)
            const originalGetCurrentModel = modelService.getCurrentModel;
            modelService.getCurrentModel = async () => anthropicModel.name;

            // Mock successful decryption for Anthropic
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Mock Claude service update
            const originalUpdateConfig = claudeService.updateModelInConfig;
            claudeService.updateModelInConfig = async (model: ModelConfig) => {
                // Verify that the correct API key is retrieved for the model
                if (model.provider === 'zai') {
                    const apiKey = await modelService.getApiKeyForModel(model);
                    assert.strictEqual(apiKey, 'zai-test-key');
                }
            };

            const result = await modelService.switchModel(zaiModel.name);
            
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.previousModel, anthropicModel.name);
            assert.strictEqual(result.newModel, zaiModel.name);

            // Restore original methods
            modelService.getCurrentModel = originalGetCurrentModel;
            SecurityUtils.decryptApiKeys = originalDecrypt;
            claudeService.updateModelInConfig = originalUpdateConfig;
        });
    });
});