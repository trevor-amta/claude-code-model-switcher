import * as assert from 'assert';
import * as vscode from 'vscode';
import { EnvironmentService, EnvironmentConfig, EnvironmentVariable, EnvironmentValidationResult } from '../../services/environment-service';
import { Logger } from '../../utils/logger';

suite('EnvironmentService Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let environmentService: EnvironmentService;
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
    });

    setup(() => {
        // Reset environment before each test
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('ANTHROPIC_') || key.startsWith('ZAI_') || key.startsWith('OPENAI_') || key.startsWith('CLAUDE_')) {
                delete process.env[key];
            }
        });
        
        // Reset singleton instance
        (EnvironmentService as any).instance = undefined;
        environmentService = EnvironmentService.getInstance(mockContext);
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
    });

    test('should initialize EnvironmentService with context', () => {
        assert.ok(environmentService);
        assert.strictEqual(environmentService, EnvironmentService.getInstance());
    });

    test('should throw error when initializing without context', () => {
        (EnvironmentService as any).instance = undefined;
        assert.throws(() => {
            EnvironmentService.getInstance();
        }, /EnvironmentService requires ExtensionContext for initialization/);
    });

    test('should set single environment variable', async () => {
        await environmentService.setEnvironmentVariable('TEST_VAR', 'test-value');
        
        assert.strictEqual(process.env.TEST_VAR, 'test-value');
    });

    test('should get environment variable', () => {
        process.env.TEST_VAR = 'test-value';
        
        const result = environmentService.getEnvironmentVariable('TEST_VAR');
        assert.strictEqual(result, 'test-value');
    });

    test('should return undefined for non-existent environment variable', () => {
        const result = environmentService.getEnvironmentVariable('NON_EXISTENT_VAR');
        assert.strictEqual(result, undefined);
    });

    test('should get relevant environment variables', () => {
        process.env.ANTHROPIC_BASE_URL = 'https://api.test.com';
        process.env.ANTHROPIC_AUTH_TOKEN = 'test-token';
        process.env.UNRELATED_VAR = 'unrelated';
        
        const result = environmentService.getEnvironmentVariables();
        
        assert.ok(result.ANTHROPIC_BASE_URL);
        assert.ok(result.ANTHROPIC_AUTH_TOKEN);
        assert.strictEqual(result.UNRELATED_VAR, undefined);
        assert.strictEqual(result.ANTHROPIC_BASE_URL, 'https://api.test.com');
        assert.strictEqual(result.ANTHROPIC_AUTH_TOKEN, 'test-token');
    });

    test('should set multiple environment variables', async () => {
        const config: EnvironmentConfig = {
            provider: 'test-provider',
            description: 'Test configuration',
            variables: [
                { name: 'VAR1', value: 'value1', required: true },
                { name: 'VAR2', value: 'value2', required: false }
            ]
        };

        await environmentService.setEnvironmentVariables(config);

        assert.strictEqual(process.env.VAR1, 'value1');
        assert.strictEqual(process.env.VAR2, 'value2');
    });

    test('should validate valid environment configuration', async () => {
        process.env.ANTHROPIC_BASE_URL = 'https://api.test.com';
        process.env.ANTHROPIC_AUTH_TOKEN = 'test-token-12345';

        const config: EnvironmentConfig = {
            provider: 'test-provider',
            variables: [
                { name: 'ANTHROPIC_BASE_URL', value: 'https://api.test.com', required: true },
                { name: 'ANTHROPIC_AUTH_TOKEN', value: 'test-token-12345', required: true }
            ]
        };

        const result = await environmentService.validateEnvironmentVariables(config);

        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.missingVariables.length, 0);
        assert.strictEqual(result.invalidVariables.length, 0);
        assert.strictEqual(result.warnings.length, 0);
    });

    test('should validate missing required variables', async () => {
        process.env.ANTHROPIC_BASE_URL = 'https://api.test.com';
        // ANTHROPIC_AUTH_TOKEN is missing

        const config: EnvironmentConfig = {
            provider: 'test-provider',
            variables: [
                { name: 'ANTHROPIC_BASE_URL', value: 'https://api.test.com', required: true },
                { name: 'ANTHROPIC_AUTH_TOKEN', value: 'test-token-12345', required: true }
            ]
        };

        const result = await environmentService.validateEnvironmentVariables(config);

        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.missingVariables.length, 1);
        assert.strictEqual(result.missingVariables[0], 'ANTHROPIC_AUTH_TOKEN');
        assert.ok(result.warnings.length > 0);
    });

    test('should validate invalid variable values', async () => {
        process.env.ANTHROPIC_BASE_URL = 'invalid-url'; // Invalid URL
        process.env.ANTHROPIC_AUTH_TOKEN = 'short'; // Too short

        const config: EnvironmentConfig = {
            provider: 'test-provider',
            variables: [
                { name: 'ANTHROPIC_BASE_URL', value: 'https://api.test.com', required: true },
                { name: 'ANTHROPIC_AUTH_TOKEN', value: 'test-token-12345', required: true }
            ]
        };

        const result = await environmentService.validateEnvironmentVariables(config);

        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.invalidVariables.length, 2);
        assert.ok(result.invalidVariables.includes('ANTHROPIC_BASE_URL'));
        assert.ok(result.invalidVariables.includes('ANTHROPIC_AUTH_TOKEN'));
    });

    test('should setup Z.ai environment variables', async () => {
        const result = await environmentService.setupZaiEnvironment('zai-test-key', 'https://api.z.ai/test');

        assert.strictEqual(result, true);
        assert.strictEqual(process.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/test');
        assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-key');
    });

    test('should setup Z.ai environment with default base URL', async () => {
        const result = await environmentService.setupZaiEnvironment('zai-test-key');

        assert.strictEqual(result, true);
        assert.strictEqual(process.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/api/anthropic');
        assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-key');
    });

    test('should clear Z.ai environment variables', async () => {
        // Setup first
        await environmentService.setupZaiEnvironment('zai-test-key', 'https://api.z.ai/test');
        
        // Then clear
        const result = await environmentService.clearZaiEnvironment();

        assert.strictEqual(result, true);
        assert.strictEqual(process.env.ANTHROPIC_BASE_URL, undefined);
        assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, undefined);
    });

    test('should get Z.ai environment status', async () => {
        // Setup environment
        await environmentService.setupZaiEnvironment('zai-test-key', 'https://api.z.ai/test');

        const status = await environmentService.getZaiEnvironmentStatus();

        assert.strictEqual(status.isConfigured, true);
        assert.strictEqual(status.authToken, true);
        assert.strictEqual(status.baseUrl, true);
        assert.ok(status.platform);
        assert.ok(status.shell);
    });

    test('should get Z.ai environment status when not configured', async () => {
        const status = await environmentService.getZaiEnvironmentStatus();

        assert.strictEqual(status.isConfigured, false);
        assert.strictEqual(status.authToken, false);
        assert.strictEqual(status.baseUrl, false);
    });

    test('should check environment setup for Z.ai', async () => {
        await environmentService.setupZaiEnvironment('zai-test-key', 'https://api.z.ai/test');

        const result = await environmentService.checkEnvironmentSetup();

        assert.strictEqual(result.isSetup, true);
        assert.strictEqual(result.provider, 'z-ai');
        assert.strictEqual(result.issues.length, 0);
    });

    test('should detect issues with Z.ai setup', async () => {
        process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/test';
        process.env.ANTHROPIC_AUTH_TOKEN = 'invalid-token'; // Not starting with 'zai-'

        const result = await environmentService.checkEnvironmentSetup();

        assert.strictEqual(result.isSetup, true);
        assert.strictEqual(result.provider, 'z-ai');
        assert.strictEqual(result.issues.length, 1);
        assert.ok(result.issues[0].includes('auth token format appears invalid'));
    });

    test('should test environment setup successfully', async () => {
        await environmentService.setupZaiEnvironment('zai-test-key', 'https://api.z.ai/test');

        const result = await environmentService.testEnvironmentSetup();

        assert.strictEqual(result.success, true);
        assert.ok(result.message.includes('Environment setup verified for provider: z-ai'));
    });

    test('should test environment setup failure when not configured', async () => {
        const result = await environmentService.testEnvironmentSetup();

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'No environment setup detected');
    });

    test('should test environment setup with issues', async () => {
        process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/test';
        process.env.ANTHROPIC_AUTH_TOKEN = 'invalid-token';

        const result = await environmentService.testEnvironmentSetup();

        assert.strictEqual(result.success, false);
        assert.ok(result.message.includes('Environment setup has issues'));
    });

    test('should get Z.ai setup instructions for macOS', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin' });

        const instructions = environmentService.getEnvironmentSetupInstructions('z-ai');

        assert.ok(instructions.includes('macOS'));
        assert.ok(instructions.includes('ANTHROPIC_BASE_URL'));
        assert.ok(instructions.includes('ANTHROPIC_AUTH_TOKEN'));

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should get Z.ai setup instructions for Windows', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        const instructions = environmentService.getEnvironmentSetupInstructions('z-ai');

        assert.ok(instructions.includes('Windows'));
        assert.ok(instructions.includes('ANTHROPIC_BASE_URL'));
        assert.ok(instructions.includes('ANTHROPIC_AUTH_TOKEN'));

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should get Z.ai setup instructions for Linux', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });

        const instructions = environmentService.getEnvironmentSetupInstructions('z-ai');

        assert.ok(instructions.includes('Linux'));
        assert.ok(instructions.includes('ANTHROPIC_BASE_URL'));
        assert.ok(instructions.includes('ANTHROPIC_AUTH_TOKEN'));

        // Restore original platform
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should handle setup environment variable error', async () => {
        // Simulate an error by making the assignment fail
        const originalEnvAssign = process.env;
        Object.defineProperty(process, 'env', {
            get: () => { throw new Error('Assignment failed'); },
            set: (value) => { originalEnvAssign = value; }
        });

        await assert.rejects(
            async () => await environmentService.setEnvironmentVariable('TEST_VAR', 'test-value'),
            /Failed to set environment variable TEST_VAR/
        );

        // Restore original env
        Object.defineProperty(process, 'env', { value: originalEnvAssign });
    });

    test('should handle validate environment variables error', async () => {
        // Simulate an error by breaking the getEnvironmentVariable method
        const originalMethod = environmentService.getEnvironmentVariable;
        environmentService.getEnvironmentVariable = () => { throw new Error('Validation failed'); };

        const config: EnvironmentConfig = {
            provider: 'test-provider',
            variables: [
                { name: 'TEST_VAR', value: 'test-value', required: true }
            ]
        };

        const result = await environmentService.validateEnvironmentVariables(config);

        assert.strictEqual(result.isValid, false);
        assert.ok(result.warnings.length > 0);
        assert.ok(result.warnings[0].includes('Validation failed'));

        // Restore original method
        environmentService.getEnvironmentVariable = originalMethod;
    });

    test('should handle Z.ai setup error', async () => {
        // Simulate an error by breaking the setEnvironmentVariables method
        const originalMethod = environmentService.setEnvironmentVariables;
        environmentService.setEnvironmentVariables = async () => { throw new Error('Setup failed'); };

        const result = await environmentService.setupZaiEnvironment('test-key');

        assert.strictEqual(result, false);

        // Restore original method
        environmentService.setEnvironmentVariables = originalMethod;
    });

    test('should handle Z.ai clear error', async () => {
        // Simulate an error by making the delete operation fail
        const originalEnv = process.env;
        Object.defineProperty(process, 'env', {
            get: () => { throw new Error('Clear failed'); },
            set: (value) => { originalEnv = value; }
        });

        const result = await environmentService.clearZaiEnvironment();

        assert.strictEqual(result, false);

        // Restore original env
        Object.defineProperty(process, 'env', { value: originalEnv });
    });

    test('should dispose environment service', () => {
        assert.doesNotThrow(() => {
            environmentService.dispose();
        });
    });
});