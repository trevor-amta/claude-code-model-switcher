import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigService } from '../../services/config-service';
import { VSCodeSettingsStrategy } from '../../services/config-strategies/vscode-settings-strategy';
import { EnvironmentVariablesStrategy } from '../../services/config-strategies/environment-strategy';
import { ConfigurationStrategy } from '../../services/config-strategies/base-strategy';
import { ApiKeyConfig, ConfigurationTarget } from '../../types/claude-settings';
import { Logger } from '../../utils/logger';
import { SecurityUtils } from '../../utils/security-utils';

suite('Provider-Specific API Key Handling Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let mockConfiguration: vscode.WorkspaceConfiguration;
    let configService: ConfigService;
    let logger: Logger;
    let originalEnv: NodeJS.ProcessEnv;

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
                        return [
                            {
                                name: 'claude-sonnet-4-20250514',
                                displayName: 'Claude Sonnet 4',
                                description: 'Latest Sonnet model',
                                endpoint: 'https://api.anthropic.com',
                                type: 'web'
                            },
                            {
                                name: 'glm-4.5',
                                displayName: 'GLM-4.5',
                                description: 'Z.ai model',
                                endpoint: 'https://api.z.ai/api/anthropic',
                                type: 'api',
                                storageStrategy: 'environment-variables'
                            }
                        ];
                    case 'apiKeys':
                        return {
                            anthropic: 'encrypted-sk-ant-api-key',
                            openai: 'encrypted-openai-key'
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

        // Mock vscode.workspace.getConfiguration
        (vscode.workspace.getConfiguration as any) = () => mockConfiguration;
    });

    setup(() => {
        // Reset environment before each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('ANTHROPIC_') || key.startsWith('ZAI_') || key.startsWith('OPENAI_') || key.startsWith('CLAUDE_')) {
                delete process.env[key];
            }
        });

        // Reset config service singleton
        (ConfigService as any).instance = undefined;
        
        // Create logger
        logger = new Logger('TestLogger');
        
        // Create config service
        configService = ConfigService.getInstance();
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

        // Dispose config service
        configService.dispose();
    });

    suite('Provider Strategy Selection', () => {
        test('should select environment strategy for Z.ai provider', () => {
            const strategy = configService.getConfigurationStrategy('zai');
            assert.ok(strategy instanceof EnvironmentVariablesStrategy);
        });

        test('should select VS Code settings strategy for Anthropic provider', () => {
            const strategy = configService.getConfigurationStrategy('anthropic');
            assert.ok(strategy instanceof VSCodeSettingsStrategy);
        });

        test('should select VS Code settings strategy for unsupported providers', () => {
            const strategy = configService.getConfigurationStrategy('unsupported');
            assert.ok(strategy instanceof VSCodeSettingsStrategy);
        });

        test('should respect specified storage method', () => {
            const strategy = configService.getConfigurationStrategy('anthropic', 'environment-variables');
            assert.ok(strategy instanceof EnvironmentVariablesStrategy);
        });

        test('should fallback to provider-specific strategy when specified method is unsupported', () => {
            const strategy = configService.getConfigurationStrategy('zai', 'unsupported-method');
            assert.ok(strategy instanceof EnvironmentVariablesStrategy);
        });
    });

    suite('Provider-Specific API Key Operations', () => {
        test('should get API key for Anthropic provider using VS Code settings', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            const apiKey = await configService.getApiKeyForProvider('anthropic');
            assert.strictEqual(apiKey, 'sk-ant-test-key');

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should get API key for Z.ai provider using environment variables', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            const apiKey = await configService.getApiKeyForProvider('zai');
            assert.strictEqual(apiKey, 'zai-test-key');
        });

        test('should set API key for Anthropic provider using VS Code settings', async () => {
            // Mock successful encryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;

            await configService.setApiKeyForProvider('anthropic', 'sk-ant-new-key', 'global');

            // Verify no error was thrown
            assert.ok(true);

            // Restore original method
            SecurityUtils.encryptApiKeys = originalEncrypt;
        });

        test('should set API key for Z.ai provider using environment variables', async () => {
            await configService.setApiKeyForProvider('zai', 'zai-new-key', 'global');

            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-new-key');
            assert.ok(process.env.ANTHROPIC_BASE_URL);
        });

        test('should remove API key for Anthropic provider using VS Code settings', async () => {
            // Mock successful encryption/decryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            await configService.removeApiKeyForProvider('anthropic', 'global');

            // Verify no error was thrown
            assert.ok(true);

            // Restore original methods
            SecurityUtils.encryptApiKeys = originalEncrypt;
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should remove API key for Z.ai provider using environment variables', async () => {
            // Setup first
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            await configService.removeApiKeyForProvider('zai', 'global');

            // Should be cleared
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, '');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, '');
        });

        test('should handle API key operations gracefully when strategy fails', async () => {
            // Mock strategy failure
            const originalGetStrategy = configService.getConfigurationStrategy;
            configService.getConfigurationStrategy = () => {
                const strategy = originalGetStrategy.call(configService, 'anthropic');
                const originalSetApiKey = strategy.setApiKey;
                strategy.setApiKey = async () => { throw new Error('Strategy failed'); };
                return strategy;
            };

            await assert.rejects(
                async () => await configService.setApiKeyForProvider('anthropic', 'test-key', 'global'),
                /Failed to update API key for anthropic/
            );

            // Restore original method
            configService.getConfigurationStrategy = originalGetStrategy;
        });
    });

    suite('Provider-Specific Validation', () => {
        test('should validate Anthropic provider configuration', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            const validation = await configService.validateProviderConfiguration('anthropic');
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.issues.length, 0);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should validate Z.ai provider configuration', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const validation = await configService.validateProviderConfiguration('zai');
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.issues.length, 0);
        });

        test('should detect validation issues for Anthropic provider', async () => {
            // Mock successful decryption with invalid key
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'invalid-key'
            });

            const validation = await configService.validateProviderConfiguration('anthropic');
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.length > 0);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should detect validation issues for Z.ai provider', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'short';
            process.env.ANTHROPIC_BASE_URL = 'invalid-url';

            const validation = await configService.validateProviderConfiguration('zai');
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.length > 0);
        });

        test('should handle validation errors gracefully', async () => {
            // Mock strategy failure
            const originalGetStrategy = configService.getConfigurationStrategy;
            configService.getConfigurationStrategy = () => {
                const strategy = originalGetStrategy.call(configService, 'anthropic');
                const originalValidate = strategy.validateConfiguration;
                strategy.validateConfiguration = async () => { throw new Error('Validation failed'); };
                return strategy;
            };

            const validation = await configService.validateProviderConfiguration('anthropic');
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.some(issue => issue.includes('Provider validation failed')));

            // Restore original method
            configService.getConfigurationStrategy = originalGetStrategy;
        });
    });

    suite('Provider-Specific Testing', () => {
        test('should test Anthropic provider configuration successfully', async () => {
            // Mock successful validation
            const originalGetStrategy = configService.getConfigurationStrategy;
            configService.getConfigurationStrategy = () => {
                const strategy = originalGetStrategy.call(configService, 'anthropic');
                const originalTest = strategy.testConfiguration;
                strategy.testConfiguration = async () => ({ success: true, message: 'Test passed' });
                return strategy;
            };

            const testResult = await configService.testProviderConfiguration('anthropic');
            assert.strictEqual(testResult.success, true);

            // Restore original method
            configService.getConfigurationStrategy = originalGetStrategy;
        });

        test('should test Z.ai provider configuration successfully', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const testResult = await configService.testProviderConfiguration('zai');
            assert.strictEqual(testResult.success, true);
        });

        test('should handle test failures gracefully', async () => {
            // Mock strategy failure
            const originalGetStrategy = configService.getConfigurationStrategy;
            configService.getConfigurationStrategy = () => {
                const strategy = originalGetStrategy.call(configService, 'anthropic');
                const originalTest = strategy.testConfiguration;
                strategy.testConfiguration = async () => ({ success: false, message: 'Test failed' });
                return strategy;
            };

            const testResult = await configService.testProviderConfiguration('anthropic');
            assert.strictEqual(testResult.success, false);

            // Restore original method
            configService.getConfigurationStrategy = originalGetStrategy;
        });
    });

    suite('Multi-Provider API Key Management', () => {
        test('should get API keys from all strategies', async () => {
            // Mock successful decryption for VS Code settings
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key',
                openai: 'openai-test-key'
            });

            // Set environment variables for Z.ai
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            const apiKeys = await configService.getApiKeys();
            
            assert.strictEqual(apiKeys.anthropic, 'sk-ant-test-key');
            assert.strictEqual(apiKeys.openai, 'openai-test-key');
            assert.strictEqual(apiKeys.zai, 'zai-test-key');

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should set API keys for multiple providers', async () => {
            // Mock successful encryption for VS Code settings
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;

            const apiKeys: ApiKeyConfig = {
                anthropic: 'sk-ant-new-key',
                zai: 'zai-new-key'
            };

            await configService.setApiKeys(apiKeys, 'global');

            // Verify both strategies were used
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-new-key');
            assert.ok(process.env.ANTHROPIC_BASE_URL);

            // Restore original method
            SecurityUtils.encryptApiKeys = originalEncrypt;
        });

        test('should handle mixed provider API key operations', async () => {
            // Mock successful encryption/decryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Set environment variables for Z.ai
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            // Test getting keys from both strategies
            const keys = await configService.getApiKeys();
            assert.strictEqual(keys.anthropic, 'sk-ant-test-key');
            assert.strictEqual(keys.zai, 'zai-test-key');

            // Test setting keys for both providers
            await configService.setApiKeyForProvider('anthropic', 'sk-ant-new-key', 'global');
            await configService.setApiKeyForProvider('zai', 'zai-new-key', 'global');

            // Verify both were updated
            const updatedKeys = await configService.getApiKeys();
            assert.strictEqual(updatedKeys.anthropic, 'sk-ant-new-key');
            assert.strictEqual(updatedKeys.zai, 'zai-new-key');

            // Restore original methods
            SecurityUtils.encryptApiKeys = originalEncrypt;
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });

    suite('Provider Configuration Status', () => {
        test('should get configuration status for all strategies', async () => {
            // Mock successful decryption for VS Code settings
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Set environment variables for Z.ai
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const status = await configService.getConfigurationStatus();

            assert.strictEqual(status.overallConfigured, true);
            assert.ok(status.strategies['vs-code-settings']);
            assert.ok(status.strategies['environment-variables']);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should handle partial configuration status', async () => {
            // Mock successful decryption for VS Code settings
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Don't set environment variables for Z.ai
            delete process.env.ANTHROPIC_AUTH_TOKEN;
            delete process.env.ANTHROPIC_BASE_URL;

            const status = await configService.getConfigurationStatus();

            assert.strictEqual(status.overallConfigured, true); // VS Code settings is configured
            assert.ok(status.strategies['vs-code-settings'].isConfigured);
            assert.strictEqual(status.strategies['environment-variables'].isConfigured, false);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });

    suite('Error Handling and Edge Cases', () => {
        test('should handle unknown provider gracefully', async () => {
            const apiKey = await configService.getApiKeyForProvider('unknown-provider');
            assert.strictEqual(apiKey, undefined);
        });

        test('should handle strategy selection errors gracefully', async () => {
            // Mock strategy selection error
            const originalGetStrategy = configService.getConfigurationStrategy;
            configService.getConfigurationStrategy = () => {
                throw new Error('Strategy selection failed');
            };

            const apiKey = await configService.getApiKeyForProvider('anthropic');
            assert.strictEqual(apiKey, undefined);

            // Restore original method
            configService.getConfigurationStrategy = originalGetStrategy;
        });

        test('should handle configuration update errors gracefully', async () => {
            // Mock configuration update error
            const originalUpdate = mockConfiguration.update;
            mockConfiguration.update = async () => {
                throw new Error('Configuration update failed');
            };

            await assert.rejects(
                async () => await configService.setApiKeyForProvider('anthropic', 'test-key', 'global'),
                /Failed to update API key for anthropic/
            );

            // Restore original method
            mockConfiguration.update = originalUpdate;
        });

        test('should handle configuration read errors gracefully', async () => {
            // Mock configuration read error
            const originalGet = mockConfiguration.get;
            mockConfiguration.get = () => {
                throw new Error('Configuration read failed');
            };

            const apiKey = await configService.getApiKeyForProvider('anthropic');
            assert.strictEqual(apiKey, undefined);

            // Restore original method
            mockConfiguration.get = originalGet;
        });

        test('should handle concurrent API key operations', async () => {
            // Mock successful encryption/decryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            // Set environment variables for Z.ai
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            // Test concurrent operations
            const promises = [
                configService.getApiKeyForProvider('anthropic'),
                configService.getApiKeyForProvider('zai'),
                configService.setApiKeyForProvider('anthropic', 'sk-ant-new-key', 'global'),
                configService.setApiKeyForProvider('zai', 'zai-new-key', 'global')
            ];

            await Promise.all(promises);

            // Verify operations completed successfully
            const finalKeys = await configService.getApiKeys();
            assert.strictEqual(finalKeys.anthropic, 'sk-ant-new-key');
            assert.strictEqual(finalKeys.zai, 'zai-new-key');

            // Restore original methods
            SecurityUtils.encryptApiKeys = originalEncrypt;
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });
});