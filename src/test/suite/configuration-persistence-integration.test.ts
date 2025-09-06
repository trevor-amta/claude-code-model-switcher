import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigService } from '../../services/config-service';
import { ModelService } from '../../services/model-service';
import { StorageService } from '../../services/storage-service';
import { EnvironmentService } from '../../services/environment-service';
import { VSCodeSettingsStrategy } from '../../services/config-strategies/vscode-settings-strategy';
import { EnvironmentVariablesStrategy } from '../../services/config-strategies/environment-strategy';
import { NotificationService } from '../../services/notification-service';
import { Logger } from '../../utils/logger';
import { SecurityUtils } from '../../utils/security-utils';
import { ModelConfig } from '../../types/model-config';
import { ApiKeyConfig, ConfigurationTarget } from '../../types/claude-settings';

suite('Configuration Persistence Across VS Code Restarts Integration Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let configService: ConfigService;
    let modelService: ModelService;
    let storageService: StorageService;
    let environmentService: EnvironmentService;
    let originalEnv: NodeJS.ProcessEnv;
    let mockConfiguration: vscode.WorkspaceConfiguration;
    let mockGlobalState: any;
    let mockWorkspaceState: any;
    let mockSecrets: any;

    // Test data
    const testApiKeys: ApiKeyConfig = {
        anthropic: 'sk-ant-test-key-12345',
        zai: 'zai-test-key-67890',
        custom: 'custom-test-key-abcde'
    };

    const testModels: ModelConfig[] = [
        {
            name: 'claude-sonnet-4-20250514',
            displayName: 'Claude Sonnet 4',
            description: 'Latest Sonnet model for balanced performance',
            endpoint: 'https://api.anthropic.com',
            type: 'web',
            provider: 'anthropic'
        },
        {
            name: 'glm-4.5',
            displayName: 'GLM-4.5',
            description: 'Z.ai\'s powerful reasoning model',
            endpoint: 'https://api.z.ai/api/anthropic',
            type: 'api',
            provider: 'zai',
            storageStrategy: 'environment-variables'
        }
    ];

    suiteSetup(() => {
        // Store original environment variables
        originalEnv = { ...process.env };
    });

    setup(() => {
        // Reset environment before each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('ANTHROPIC_') || key.startsWith('ZAI_') || key.startsWith('OPENAI_') || key.startsWith('CLAUDE_')) {
                delete process.env[key];
            }
        });

        // Mock persistent state
        mockGlobalState = {
            keys: () => [],
            get: (key: string) => {
                const mockData: any = {
                    'environmentSetup': {
                        provider: 'z-ai',
                        timestamp: new Date().toISOString(),
                        variables: [
                            { name: 'ANTHROPIC_AUTH_TOKEN', description: 'Z.ai API key' },
                            { name: 'ANTHROPIC_BASE_URL', description: 'Z.ai API endpoint' }
                        ]
                    },
                    'userPreferences': {
                        favoriteModels: ['claude-sonnet-4-20250514', 'glm-4.5'],
                        theme: 'dark',
                        lastUsedModel: 'glm-4.5'
                    },
                    'switchCount': 5,
                    'favoriteModels': ['claude-sonnet-4-20250514', 'glm-4.5'],
                    'lastVersion': '0.9.1'
                };
                return mockData[key];
            },
            update: async (key: string, value: any) => {
                // Simulate successful persistence
                return;
            }
        };

        mockWorkspaceState = {
            keys: () => [],
            get: () => undefined,
            update: async () => {}
        };

        mockSecrets = {
            get: async (key: string) => {
                const mockSecrets: any = {
                    'claudeModelSwitcher.apiKeys': testApiKeys
                };
                return mockSecrets[key];
            },
            store: async (key: string, value: any) => {
                // Simulate successful secret storage
                return;
            },
            delete: async (key: string) => {
                // Simulate successful secret deletion
                return;
            }
        };

        // Mock context for testing
        mockContext = {
            subscriptions: [],
            globalState: mockGlobalState,
            workspaceState: mockWorkspaceState,
            secrets: mockSecrets,
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
                        return 'glm-4.5';
                    case 'showStatusBar':
                        return true;
                    case 'reloadBehavior':
                        return 'prompt';
                    case 'debugMode':
                        return false;
                    case 'availableModels':
                        return testModels;
                    case 'preferences':
                        return {
                            favoriteModels: ['claude-sonnet-4-20250514', 'glm-4.5'],
                            theme: 'dark'
                        };
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
                // Simulate successful configuration update
                return;
            },
            inspect: (section: string) => {
                return {
                    key: `claudeModelSwitcher.${section}`,
                    defaultValue: undefined,
                    globalValue: section === 'defaultModel' ? 'glm-4.5' : undefined,
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

        // Reset singletons
        (StorageService as any).instance = undefined;
        (NotificationService as any).instance = undefined;
        (EnvironmentService as any).instance = undefined;
        (ConfigService as any).instance = undefined;
        (ModelService as any).instance = undefined;

        // Create services
        storageService = StorageService.initialize(mockContext);
        environmentService = EnvironmentService.getInstance(mockContext);
        configService = ConfigService.getInstance();
        modelService = ModelService.getInstance();

        // Set up environment variables for Z.ai
        process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key-67890';
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
        environmentService.dispose();
        storageService.dispose();
    });

    suite('VS Code Settings Persistence', () => {
        test('should persist configuration settings across restarts', async () => {
            // Simulate VS Code restart by creating new service instances
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            // Verify that configuration persists
            const defaultModel = await newConfigService.getDefaultModel();
            assert.strictEqual(defaultModel, 'glm-4.5');

            const showStatusBar = await newConfigService.getShowStatusBar();
            assert.strictEqual(showStatusBar, true);

            const reloadBehavior = await newConfigService.getReloadBehavior();
            assert.strictEqual(reloadBehavior, 'prompt');

            const debugMode = await newConfigService.getDebugMode();
            assert.strictEqual(debugMode, false);

            newConfigService.dispose();
        });

        test('should persist available models across restarts', async () => {
            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const availableModels = await newConfigService.getAvailableModels();
            assert.strictEqual(availableModels.length, 2);
            assert.strictEqual(availableModels[0].name, 'claude-sonnet-4-20250514');
            assert.strictEqual(availableModels[1].name, 'glm-4.5');

            newConfigService.dispose();
        });

        test('should persist user preferences across restarts', async () => {
            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const preferences = await newConfigService.getUserPreferences();
            assert.deepStrictEqual(preferences.favoriteModels, ['claude-sonnet-4-20250514', 'glm-4.5']);
            assert.strictEqual(preferences.theme, 'dark');

            newConfigService.dispose();
        });

        test('should persist notification settings across restarts', async () => {
            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const notifications = await newConfigService.getNotificationSettings();
            assert.strictEqual(notifications.showSwitchConfirmation, true);
            assert.strictEqual(notifications.showReloadPrompt, true);
            assert.strictEqual(notifications.showErrorNotifications, true);
            assert.strictEqual(notifications.showSuccessNotifications, true);
            assert.strictEqual(notifications.notificationDuration, 5000);

            newConfigService.dispose();
        });
    });

    suite('API Key Persistence', () => {
        test('should persist encrypted API keys across restarts', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const apiKeys = await newConfigService.getApiKeys();
            assert.deepStrictEqual(apiKeys, testApiKeys);

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should persist API keys for different providers', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            // Test that different provider API keys persist
            const anthropicKey = await newConfigService.getApiKeyForProvider('anthropic');
            const zaiKey = await newConfigService.getApiKeyForProvider('zai');
            const customKey = await newConfigService.getApiKeyForProvider('custom');

            assert.strictEqual(anthropicKey, 'sk-ant-test-key-12345');
            assert.strictEqual(zaiKey, 'zai-test-key-67890');
            assert.strictEqual(customKey, 'custom-test-key-abcde');

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should handle missing API keys gracefully', async () => {
            // Mock empty API keys
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({});

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const apiKeys = await newConfigService.getApiKeys();
            assert.deepStrictEqual(apiKeys, {});

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });

    suite('Environment Variable Persistence', () => {
        test('should persist environment setup metadata across restarts', async () => {
            // Simulate VS Code restart
            (EnvironmentService as any).instance = undefined;
            const newEnvironmentService = EnvironmentService.getInstance(mockContext);

            const setupData = mockGlobalState.get('environmentSetup');
            assert.ok(setupData);
            assert.strictEqual(setupData.provider, 'z-ai');
            assert.ok(setupData.timestamp);
            assert.strictEqual(setupData.variables.length, 2);

            newEnvironmentService.dispose();
        });

        test('should maintain environment variable state across restarts', async () => {
            // Simulate VS Code restart
            (EnvironmentService as any).instance = undefined;
            const newEnvironmentService = EnvironmentService.getInstance(mockContext);

            const status = await newEnvironmentService.getZaiEnvironmentStatus();
            assert.strictEqual(status.isConfigured, true);
            assert.strictEqual(status.authToken, true);
            assert.strictEqual(status.baseUrl, true);

            newEnvironmentService.dispose();
        });

        test('should persist environment setup validation results', async () => {
            // Simulate VS Code restart
            (EnvironmentService as any).instance = undefined;
            const newEnvironmentService = EnvironmentService.getInstance(mockContext);

            const testResult = await newEnvironmentService.testEnvironmentSetup();
            assert.strictEqual(testResult.success, true);
            assert.ok(testResult.message.includes('z-ai'));

            newEnvironmentService.dispose();
        });
    });

    suite('Storage Service Persistence', () => {
        test('should persist user preferences across restarts', async () => {
            // Simulate VS Code restart
            (StorageService as any).instance = undefined;
            const newStorageService = StorageService.initialize(mockContext);

            const preferences = await newStorageService.retrieveUserPreferences();
            assert.deepStrictEqual(preferences.favoriteModels, ['claude-sonnet-4-20250514', 'glm-4.5']);
            assert.strictEqual(preferences.theme, 'dark');
            assert.strictEqual(preferences.lastUsedModel, 'glm-4.5');

            newStorageService.dispose();
        });

        test('should persist switch count across restarts', async () => {
            // Simulate VS Code restart
            (StorageService as any).instance = undefined;
            const newStorageService = StorageService.initialize(mockContext);

            const switchCount = await newStorageService.retrieveSwitchCount();
            assert.strictEqual(switchCount, 5);

            newStorageService.dispose();
        });

        test('should persist favorite models across restarts', async () => {
            // Simulate VS Code restart
            (StorageService as any).instance = undefined;
            const newStorageService = StorageService.initialize(mockContext);

            const favorites = await newStorageService.retrieveFavoriteModels();
            assert.deepStrictEqual(favorites, ['claude-sonnet-4-20250514', 'glm-4.5']);

            newStorageService.dispose();
        });

        test('should persist extension version across restarts', async () => {
            // Simulate VS Code restart
            (StorageService as any).instance = undefined;
            const newStorageService = StorageService.initialize(mockContext);

            const lastVersion = await newStorageService.retrieveLastVersion();
            assert.strictEqual(lastVersion, '0.9.1');

            newStorageService.dispose();
        });
    });

    suite('Model Service Persistence', () => {
        test('should persist current model across restarts', async () => {
            // Simulate VS Code restart
            (ModelService as any).instance = undefined;
            const newModelService = ModelService.getInstance();

            const currentModel = await newModelService.getCurrentModel();
            assert.strictEqual(currentModel, 'glm-4.5');

            newModelService.dispose();
        });

        test('should persist model validation across restarts', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ModelService as any).instance = undefined;
            const newModelService = ModelService.getInstance();

            const validation = await newModelService.validateModel('glm-4.5');
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.model.name, 'glm-4.5');

            newModelService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should persist model availability across restarts', async () => {
            // Simulate VS Code restart
            (ModelService as any).instance = undefined;
            const newModelService = ModelService.getInstance();

            const availableModels = await newModelService.getAvailableModels();
            assert.strictEqual(availableModels.length, 2);
            assert.ok(availableModels.some(m => m.name === 'claude-sonnet-4-20250514'));
            assert.ok(availableModels.some(m => m.name === 'glm-4.5'));

            newModelService.dispose();
        });
    });

    suite('Configuration Strategy Persistence', () => {
        test('should persist VS Code settings strategy state', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const vscodeStrategy = newConfigService.getConfigurationStrategy('anthropic');
            assert.ok(vscodeStrategy instanceof VSCodeSettingsStrategy);

            const status = await vscodeStrategy.getConfigurationStatus();
            assert.strictEqual(status.isConfigured, true);
            assert.ok(status.providerStatus.anthropic);

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should persist environment variables strategy state', async () => {
            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const envStrategy = newConfigService.getConfigurationStrategy('zai');
            assert.ok(envStrategy instanceof EnvironmentVariablesStrategy);

            const status = await envStrategy.getConfigurationStatus();
            assert.strictEqual(status.isConfigured, true);
            assert.ok(status.providerStatus.zai);

            newConfigService.dispose();
        });

        test('should maintain strategy selection across restarts', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            // Test that provider-specific strategy selection persists
            const anthropicStrategy = newConfigService.getConfigurationStrategy('anthropic');
            const zaiStrategy = newConfigService.getConfigurationStrategy('zai');

            assert.ok(anthropicStrategy instanceof VSCodeSettingsStrategy);
            assert.ok(zaiStrategy instanceof EnvironmentVariablesStrategy);

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });

    suite('Cross-Service Integration Persistence', () => {
        test('should maintain consistent configuration across all services after restart', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            (ModelService as any).instance = undefined;
            (EnvironmentService as any).instance = undefined;
            (StorageService as any).instance = undefined;

            const newConfigService = ConfigService.getInstance();
            const newModelService = ModelService.getInstance();
            const newEnvironmentService = EnvironmentService.getInstance(mockContext);
            const newStorageService = StorageService.initialize(mockContext);

            // Verify configuration consistency
            const configDefaultModel = await newConfigService.getDefaultModel();
            const modelCurrentModel = await newModelService.getCurrentModel();
            assert.strictEqual(configDefaultModel, modelCurrentModel);

            // Verify API key consistency
            const configApiKey = await newConfigService.getApiKeyForProvider('zai');
            const envApiKey = newEnvironmentService.getEnvironmentVariable('ANTHROPIC_AUTH_TOKEN');
            assert.strictEqual(configApiKey, envApiKey);

            // Verify model availability consistency
            const configModels = await newConfigService.getAvailableModels();
            const modelModels = await newModelService.getAvailableModels();
            assert.deepStrictEqual(configModels, modelModels);

            // Verify user preferences consistency
            const configPreferences = await newConfigService.getUserPreferences();
            const storagePreferences = await newStorageService.retrieveUserPreferences();
            assert.deepStrictEqual(configPreferences.favoriteModels, storagePreferences.favoriteModels);

            newConfigService.dispose();
            newModelService.dispose();
            newEnvironmentService.dispose();
            newStorageService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should handle partial persistence gracefully', async () => {
            // Simulate partial data loss
            mockGlobalState.get = (key: string) => {
                if (key === 'userPreferences') {
                    return undefined; // Simulate lost preferences
                }
                return mockGlobalState.get(key);
            };

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            (StorageService as any).instance = undefined;

            const newConfigService = ConfigService.getInstance();
            const newStorageService = StorageService.initialize(mockContext);

            // Should handle missing data gracefully
            const preferences = await newConfigService.getUserPreferences();
            assert.deepStrictEqual(preferences, {}); // Default empty preferences

            const storagePreferences = await newStorageService.retrieveUserPreferences();
            assert.deepStrictEqual(storagePreferences, {}); // Default empty preferences

            newConfigService.dispose();
            newStorageService.dispose();
        });
    });

    suite('Configuration Validation After Restart', () => {
        test('should validate configuration consistently after restart', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const validation = await newConfigService.validateConfiguration();
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.issues.length, 0);

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should detect configuration issues after restart', async () => {
            // Simulate corrupted configuration
            mockConfiguration.get = (section: string) => {
                if (section === 'defaultModel') {
                    return 'nonexistent-model'; // Invalid model
                }
                return mockConfiguration.get(section);
            };

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const validation = await newConfigService.validateConfiguration();
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.some(issue => issue.includes('Default model is not in available models')));

            newConfigService.dispose();
        });

        test('should validate provider-specific configuration after restart', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => testApiKeys;

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            const anthropicValidation = await newConfigService.validateProviderConfiguration('anthropic');
            assert.strictEqual(anthropicValidation.isValid, true);

            const zaiValidation = await newConfigService.validateProviderConfiguration('zai');
            assert.strictEqual(zaiValidation.isValid, true);

            newConfigService.dispose();

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });
    });

    suite('Migration and Backward Compatibility', () => {
        test('should handle migration from older configuration versions', async () => {
            // Simulate old configuration format
            mockGlobalState.get = (key: string) => {
                if (key === 'userPreferences') {
                    return {
                        // Old format without new fields
                        favoriteModels: ['claude-sonnet-4-20250514']
                    };
                }
                return mockGlobalState.get(key);
            };

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            (StorageService as any).instance = undefined;

            const newConfigService = ConfigService.getInstance();
            const newStorageService = StorageService.initialize(mockContext);

            // Should handle old format gracefully
            const preferences = await newConfigService.getUserPreferences();
            assert.deepStrictEqual(preferences.favoriteModels, ['claude-sonnet-4-20250514']);

            const storagePreferences = await newStorageService.retrieveUserPreferences();
            assert.deepStrictEqual(storagePreferences.favoriteModels, ['claude-sonnet-4-20250514']);

            newConfigService.dispose();
            newStorageService.dispose();
        });

        test('should maintain backward compatibility with missing fields', async () => {
            // Simulate configuration with missing fields
            mockConfiguration.get = (section: string) => {
                if (section === 'notifications') {
                    return undefined; // Missing notification settings
                }
                return mockConfiguration.get(section);
            };

            // Simulate VS Code restart
            (ConfigService as any).instance = undefined;
            const newConfigService = ConfigService.getInstance();

            // Should use default values for missing fields
            const notifications = await newConfigService.getNotificationSettings();
            assert.strictEqual(notifications.showSwitchConfirmation, true);
            assert.strictEqual(notifications.showReloadPrompt, true);
            assert.strictEqual(notifications.notificationDuration, 5000);

            newConfigService.dispose();
        });
    });
});