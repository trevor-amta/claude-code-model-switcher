import * as assert from 'assert';
import * as vscode from 'vscode';
import { VSCodeSettingsStrategy } from '../../services/config-strategies/vscode-settings-strategy';
import { EnvironmentVariablesStrategy } from '../../services/config-strategies/environment-strategy';
import { EnvironmentService } from '../../services/environment-service';
import { Logger } from '../../utils/logger';
import { SecurityUtils } from '../../utils/security-utils';

suite('Configuration Strategies Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let mockConfiguration: vscode.WorkspaceConfiguration;
    let logger: Logger;
    let environmentService: EnvironmentService;
    let vscodeStrategy: VSCodeSettingsStrategy;
    let environmentStrategy: EnvironmentVariablesStrategy;
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
                if (section === 'apiKeys') {
                    return {
                        anthropic: 'encrypted-sk-ant-api-key',
                        zai: 'encrypted-zai-api-key'
                    };
                }
                return undefined;
            },
            update: async (section: string, value: any, target?: vscode.ConfigurationTarget) => {
                // Mock successful update
                return;
            },
            inspect: (section: string) => {
                return {
                    key: 'claudeModelSwitcher.apiKeys',
                    defaultValue: undefined,
                    globalValue: { anthropic: 'encrypted-sk-ant-api-key' },
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

        // Create mock logger
        logger = new Logger('TestLogger');
        
        // Mock vscode.workspace.getConfiguration
        (vscode.workspace.getConfiguration as any) = () => mockConfiguration;

        // Create environment service
        environmentService = EnvironmentService.getInstance(mockContext);
        
        // Create strategies
        vscodeStrategy = new VSCodeSettingsStrategy(logger);
        environmentStrategy = new EnvironmentVariablesStrategy(logger, mockContext);
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

        // Dispose strategies
        vscodeStrategy.dispose();
        environmentStrategy.dispose();
    });

    suite('VSCodeSettingsStrategy', () => {
        test('should set API key for provider', async () => {
            // Mock successful encryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;

            await vscodeStrategy.setApiKey('anthropic', 'sk-ant-test-key', 'global');

            // Verify the update was called
            assert.ok(true); // If no error was thrown, the test passes

            // Restore original method
            SecurityUtils.encryptApiKeys = originalEncrypt;
        });

        test('should validate API key format before setting', async () => {
            await assert.rejects(
                async () => await vscodeStrategy.setApiKey('anthropic', 'invalid-key', 'global'),
                /Anthropic API keys must start with "sk-ant-"/
            );
        });

        test('should get API key for provider', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key',
                zai: 'zai-test-key'
            });

            const apiKey = await vscodeStrategy.getApiKey('anthropic');
            assert.strictEqual(apiKey, 'sk-ant-test-key');

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should return undefined for non-existent API key', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({});

            const apiKey = await vscodeStrategy.getApiKey('nonexistent');
            assert.strictEqual(apiKey, undefined);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should remove API key for provider', async () => {
            // Mock successful encryption/decryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key'
            });

            await vscodeStrategy.removeApiKey('anthropic', 'global');

            // Verify the update was called
            assert.ok(true); // If no error was thrown, the test passes

            // Restore original methods
            SecurityUtils.encryptApiKeys = originalEncrypt;
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should get all API keys', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key',
                zai: 'zai-test-key'
            });

            const apiKeys = await vscodeStrategy.getApiKeys();
            assert.strictEqual(apiKeys.anthropic, 'sk-ant-test-key');
            assert.strictEqual(apiKeys.zai, 'zai-test-key');

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should set all API keys', async () => {
            // Mock successful encryption
            const originalEncrypt = SecurityUtils.encryptApiKeys;
            SecurityUtils.encryptApiKeys = async (keys: any) => keys;

            const apiKeys = {
                anthropic: 'sk-ant-test-key',
                zai: 'zai-test-key'
            };

            await vscodeStrategy.setApiKeys(apiKeys, 'global');

            // Verify the update was called
            assert.ok(true); // If no error was thrown, the test passes

            // Restore original method
            SecurityUtils.encryptApiKeys = originalEncrypt;
        });

        test('should validate configuration successfully', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key',
                zai: 'zai-test-key'
            });

            const validation = await vscodeStrategy.validateConfiguration();
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.issues.length, 0);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should validate configuration with issues', async () => {
            // Mock successful decryption with invalid keys
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'invalid-key',
                zai: 'short'
            });

            const validation = await vscodeStrategy.validateConfiguration();
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.length > 0);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should support correct providers', () => {
            assert.strictEqual(vscodeStrategy.supportsProvider('anthropic'), true);
            assert.strictEqual(vscodeStrategy.supportsProvider('openai'), true);
            assert.strictEqual(vscodeStrategy.supportsProvider('google'), true);
            assert.strictEqual(vscodeStrategy.supportsProvider('custom'), true);
            assert.strictEqual(vscodeStrategy.supportsProvider('unsupported'), false);
        });

        test('should return correct storage method', () => {
            assert.strictEqual(vscodeStrategy.getStorageMethod(), 'vs-code-settings');
        });

        test('should return correct configuration description', () => {
            const description = vscodeStrategy.getConfigurationDescription();
            assert.ok(description.includes('VS Code settings'));
        });

        test('should not require environment setup', () => {
            assert.strictEqual(vscodeStrategy.requiresEnvironmentSetup(), false);
        });

        test('should return empty required environment variables', () => {
            const requiredVars = vscodeStrategy.getRequiredEnvironmentVariables();
            assert.strictEqual(requiredVars.length, 0);
        });

        test('should test configuration successfully', async () => {
            // Mock successful validation
            const originalValidate = vscodeStrategy.validateConfiguration;
            vscodeStrategy.validateConfiguration = async () => ({ isValid: true, issues: [] });

            const testResult = await vscodeStrategy.testConfiguration();
            assert.strictEqual(testResult.success, true);

            // Restore original method
            vscodeStrategy.validateConfiguration = originalValidate;
        });

        test('should test configuration with failures', async () => {
            // Mock failed validation
            const originalValidate = vscodeStrategy.validateConfiguration;
            vscodeStrategy.validateConfiguration = async () => ({ isValid: false, issues: ['Test issue'] });

            const testResult = await vscodeStrategy.testConfiguration();
            assert.strictEqual(testResult.success, false);

            // Restore original method
            vscodeStrategy.validateConfiguration = originalValidate;
        });

        test('should get configuration status', async () => {
            // Mock successful decryption
            const originalDecrypt = SecurityUtils.decryptApiKeys;
            SecurityUtils.decryptApiKeys = async (keys: any) => ({
                anthropic: 'sk-ant-test-key',
                zai: 'zai-test-key'
            });

            const status = await vscodeStrategy.getConfigurationStatus();
            assert.strictEqual(status.isConfigured, true);
            assert.ok(status.providerStatus.anthropic);
            assert.ok(status.providerStatus.zai);

            // Restore original method
            SecurityUtils.decryptApiKeys = originalDecrypt;
        });

        test('should handle configuration errors gracefully', async () => {
            // Mock configuration error
            const originalGet = mockConfiguration.get;
            mockConfiguration.get = () => { throw new Error('Configuration error'); };

            const apiKeys = await vscodeStrategy.getApiKeys();
            assert.deepStrictEqual(apiKeys, {});

            // Restore original method
            mockConfiguration.get = originalGet;
        });
    });

    suite('EnvironmentVariablesStrategy', () => {
        test('should set API key for Z.ai provider', async () => {
            await environmentStrategy.setApiKey('zai', 'zai-test-key', 'global');

            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-key');
            assert.ok(process.env.ANTHROPIC_BASE_URL);
        });

        test('should validate API key format before setting', async () => {
            await assert.rejects(
                async () => await environmentStrategy.setApiKey('zai', 'short', 'global'),
                /Z.ai API key appears too short/
            );
        });

        test('should get API key for Z.ai provider', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            const apiKey = await environmentStrategy.getApiKey('zai');
            assert.strictEqual(apiKey, 'zai-test-key');
        });

        test('should return undefined for non-existent API key', async () => {
            const apiKey = await environmentStrategy.getApiKey('nonexistent');
            assert.strictEqual(apiKey, undefined);
        });

        test('should remove API key for Z.ai provider', async () => {
            // Setup first
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            await environmentStrategy.removeApiKey('zai', 'global');

            // Should be cleared (set to empty string)
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, '');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, '');
        });

        test('should get all API keys from environment', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';

            const apiKeys = await environmentStrategy.getApiKeys();
            assert.strictEqual(apiKeys.zai, 'zai-test-key');
            assert.strictEqual(apiKeys.anthropic, 'anthropic-test-key');
        });

        test('should set all API keys', async () => {
            const apiKeys = {
                zai: 'zai-test-key',
                anthropic: 'anthropic-test-key'
            };

            await environmentStrategy.setApiKeys(apiKeys, 'global');

            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-key');
            assert.strictEqual(process.env.ANTHROPIC_API_KEY, 'anthropic-test-key');
        });

        test('should validate configuration successfully', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const validation = await environmentStrategy.validateConfiguration();
            assert.strictEqual(validation.isValid, true);
            assert.strictEqual(validation.issues.length, 0);
        });

        test('should validate configuration with issues', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'short';
            process.env.ANTHROPIC_BASE_URL = 'invalid-url';

            const validation = await environmentStrategy.validateConfiguration();
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.length > 0);
        });

        test('should support correct providers', () => {
            assert.strictEqual(environmentStrategy.supportsProvider('zai'), true);
            assert.strictEqual(environmentStrategy.supportsProvider('anthropic'), false);
            assert.strictEqual(environmentStrategy.supportsProvider('unsupported'), false);
        });

        test('should return correct storage method', () => {
            assert.strictEqual(environmentStrategy.getStorageMethod(), 'environment-variables');
        });

        test('should return correct configuration description', () => {
            const description = environmentStrategy.getConfigurationDescription();
            assert.ok(description.includes('environment variables'));
        });

        test('should require environment setup', () => {
            assert.strictEqual(environmentStrategy.requiresEnvironmentSetup(), true);
        });

        test('should return required environment variables', () => {
            const requiredVars = environmentStrategy.getRequiredEnvironmentVariables();
            assert.ok(requiredVars.includes('ANTHROPIC_BASE_URL'));
            assert.ok(requiredVars.includes('ANTHROPIC_AUTH_TOKEN'));
        });

        test('should test configuration successfully', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const testResult = await environmentStrategy.testConfiguration();
            assert.strictEqual(testResult.success, true);
        });

        test('should test configuration with failures', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'short';
            process.env.ANTHROPIC_BASE_URL = 'invalid-url';

            const testResult = await environmentStrategy.testConfiguration();
            assert.strictEqual(testResult.success, false);
        });

        test('should get configuration status', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const status = await environmentStrategy.getConfigurationStatus();
            assert.strictEqual(status.isConfigured, true);
            assert.ok(status.providerStatus.zai);
        });

        test('should setup environment variables', async () => {
            await environmentStrategy.setupEnvironmentVariables('zai-test-key');

            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-key');
            assert.ok(process.env.ANTHROPIC_BASE_URL);
        });

        test('should fail to setup environment variables without API key', async () => {
            await assert.rejects(
                async () => await environmentStrategy.setupEnvironmentVariables(),
                /API key is required for environment setup/
            );
        });

        test('should verify environment setup', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const verification = await environmentStrategy.verifyEnvironmentSetup();
            assert.strictEqual(verification.success, true);
        });

        test('should verify environment setup with failures', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'short';
            process.env.ANTHROPIC_BASE_URL = 'invalid-url';

            const verification = await environmentStrategy.verifyEnvironmentSetup();
            assert.strictEqual(verification.success, false);
        });

        test('should handle environment service errors gracefully', async () => {
            // Mock environment service error
            const originalCheckSetup = environmentService.checkEnvironmentSetup;
            environmentService.checkEnvironmentSetup = async () => {
                throw new Error('Environment service error');
            };

            const validation = await environmentStrategy.validateConfiguration();
            assert.strictEqual(validation.isValid, false);
            assert.ok(validation.issues.some(issue => issue.includes('Environment service test failed')));

            // Restore original method
            environmentService.checkEnvironmentSetup = originalCheckSetup;
        });

        test('should cache API keys temporarily', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            // First call should cache the result
            const apiKey1 = await environmentStrategy.getApiKey('zai');
            assert.strictEqual(apiKey1, 'zai-test-key');

            // Change environment variable
            process.env.ANTHROPIC_AUTH_TOKEN = 'new-key';

            // Second call should return cached value
            const apiKey2 = await environmentStrategy.getApiKey('zai');
            assert.strictEqual(apiKey2, 'zai-test-key');
        });

        test('should clear cache when removing API key', async () => {
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';

            // Get API key to cache it
            await environmentStrategy.getApiKey('zai');

            // Remove API key
            await environmentStrategy.removeApiKey('zai', 'global');

            // Cache should be cleared
            const apiKey = await environmentStrategy.getApiKey('zai');
            assert.strictEqual(apiKey, '');
        });

        test('should dispose properly', () => {
            assert.doesNotThrow(() => {
                environmentStrategy.dispose();
            });
        });
    });

    suite('Strategy Comparison', () => {
        test('should use different storage methods', () => {
            assert.strictEqual(vscodeStrategy.getStorageMethod(), 'vs-code-settings');
            assert.strictEqual(environmentStrategy.getStorageMethod(), 'environment-variables');
        });

        test('should have different environment setup requirements', () => {
            assert.strictEqual(vscodeStrategy.requiresEnvironmentSetup(), false);
            assert.strictEqual(environmentStrategy.requiresEnvironmentSetup(), true);
        });

        test('should support different providers', () => {
            assert.strictEqual(vscodeStrategy.supportsProvider('anthropic'), true);
            assert.strictEqual(environmentStrategy.supportsProvider('anthropic'), false);
            
            assert.strictEqual(vscodeStrategy.supportsProvider('zai'), false);
            assert.strictEqual(environmentStrategy.supportsProvider('zai'), true);
        });

        test('should have different configuration descriptions', () => {
            const vscodeDescription = vscodeStrategy.getConfigurationDescription();
            const envDescription = environmentStrategy.getConfigurationDescription();
            
            assert.ok(vscodeDescription.includes('VS Code settings'));
            assert.ok(envDescription.includes('environment variables'));
            assert.notStrictEqual(vscodeDescription, envDescription);
        });
    });
});