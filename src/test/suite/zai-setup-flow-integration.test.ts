import * as assert from 'assert';
import * as vscode from 'vscode';
import { SetupEnvironmentCommand } from '../../commands/setup-environment';
import { EnvironmentService } from '../../services/environment-service';
import { StorageService } from '../../services/storage-service';
import { NotificationService } from '../../services/notification-service';
import { Logger } from '../../utils/logger';

suite('Z.ai Setup Flow Integration Test Suite', () => {
    let mockContext: vscode.ExtensionContext;
    let storageService: StorageService;
    let notificationService: NotificationService;
    let setupCommand: SetupEnvironmentCommand;
    let environmentService: EnvironmentService;
    let originalEnv: NodeJS.ProcessEnv;
    let mockShowQuickPick: any;
    let mockShowInputBox: any;
    let mockShowInformationMessage: any;
    let mockShowWarningMessage: any;
    let mockShowErrorMessage: any;
    let mockExecuteCommand: any;
    let mockOpenTextDocument: any;
    let mockShowTextDocument: any;

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

        // Reset singletons
        (StorageService as any).instance = undefined;
        (NotificationService as any).instance = undefined;
        (EnvironmentService as any).instance = undefined;

        // Create services
        storageService = StorageService.initialize(mockContext);
        notificationService = NotificationService.getInstance();
        environmentService = EnvironmentService.getInstance(mockContext);
        setupCommand = new SetupEnvironmentCommand();

        // Mock VS Code UI methods
        mockShowQuickPick = async (items: any[], options: any) => {
            return items[0]; // Return first item by default
        };

        mockShowInputBox = async (options: any) => {
            if (options.prompt?.includes('API Key')) {
                return 'zai-test-api-key';
            } else if (options.prompt?.includes('Base URL')) {
                return 'https://api.z.ai/v1';
            }
            return 'test-input';
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

        mockOpenTextDocument = async (options: any) => {
            return {
                language: options.language,
                getText: () => options.content
            } as any;
        };

        mockShowTextDocument = async (document: any) => {
            return;
        };

        // Apply mocks
        (vscode.window.showQuickPick as any) = mockShowQuickPick;
        (vscode.window.showInputBox as any) = mockShowInputBox;
        (vscode.window.showInformationMessage as any) = mockShowInformationMessage;
        (vscode.window.showWarningMessage as any) = mockShowWarningMessage;
        (vscode.window.showErrorMessage as any) = mockShowErrorMessage;
        (vscode.commands.executeCommand as any) = mockExecuteCommand;
        (vscode.workspace.openTextDocument as any) = mockOpenTextDocument;
        (vscode.window.showTextDocument as any) = mockShowTextDocument;
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
        setupCommand = (setupCommand as any).dispose?.() || setupCommand;
        environmentService.dispose();
    });

    suite('Main Menu Flow', () => {
        test('should show main menu with all options', async () => {
            const menuItems = [];
            
            // Mock to capture menu items
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                menuItems.push(...items);
                return items[0];
            };

            await setupCommand.execute();

            assert.strictEqual(menuItems.length, 4);
            assert.ok(menuItems.some(item => item.value === 'setup-zai'));
            assert.ok(menuItems.some(item => item.value === 'verify-zai'));
            assert.ok(menuItems.some(item => item.value === 'clear-zai'));
            assert.ok(menuItems.some(item => item.value === 'show-instructions'));
        });

        test('should handle menu cancellation gracefully', async () => {
            // Mock menu cancellation
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return undefined; // User cancelled
            };

            await setupCommand.execute();

            // Should complete without errors
            assert.ok(true);
        });

        test('should show current Z.ai status in menu', async () => {
            // Set up environment variables
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            const menuItems = [];
            
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                menuItems.push(...items);
                return items[0];
            };

            await setupCommand.execute();

            const setupItem = menuItems.find(item => item.value === 'setup-zai');
            assert.ok(setupItem.detail.includes('already configured'));
        });
    });

    suite('Z.ai Setup Flow', () => {
        test('should complete full Z.ai setup flow', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            // Mock successful setup
            const originalSetup = environmentService.setupZaiEnvironment;
            environmentService.setupZaiEnvironment = async (apiKey: string, baseUrl?: string) => {
                process.env.ANTHROPIC_AUTH_TOKEN = apiKey;
                process.env.ANTHROPIC_BASE_URL = baseUrl || 'https://api.z.ai/v1';
                return true;
            };

            await setupCommand.execute();

            // Verify environment variables are set
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-api-key');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/v1');

            // Restore original method
            environmentService.setupZaiEnvironment = originalSetup;
        });

        test('should handle API key input cancellation', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            // Mock API key cancellation
            (vscode.window.showInputBox as any) = async (options: any) => {
                if (options.prompt?.includes('API Key')) {
                    return undefined; // User cancelled
                }
                return 'test-input';
            };

            await setupCommand.execute();

            // Should complete without setting environment variables
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, undefined);
        });

        test('should handle base URL input cancellation', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            // Mock base URL cancellation
            let callCount = 0;
            (vscode.window.showInputBox as any) = async (options: any) => {
                callCount++;
                if (callCount === 1) {
                    return 'zai-test-api-key';
                } else if (callCount === 2) {
                    return undefined; // User cancelled base URL
                }
                return 'test-input';
            };

            await setupCommand.execute();

            // Should complete without setting environment variables
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, undefined);
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, undefined);
        });

        test('should validate API key format', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            let validationCallCount = 0;
            (vscode.window.showInputBox as any) = async (options: any) => {
                if (options.prompt?.includes('API Key')) {
                    validationCallCount++;
                    if (validationCallCount === 1) {
                        return 'short'; // Invalid key
                    } else {
                        return 'zai-test-api-key'; // Valid key
                    }
                } else if (options.prompt?.includes('Base URL')) {
                    return 'https://api.z.ai/v1';
                }
                return 'test-input';
            };

            await setupCommand.execute();

            // Should complete after validation
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-api-key');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/v1');
        });

        test('should validate base URL format', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            let validationCallCount = 0;
            (vscode.window.showInputBox as any) = async (options: any) => {
                if (options.prompt?.includes('API Key')) {
                    return 'zai-test-api-key';
                } else if (options.prompt?.includes('Base URL')) {
                    validationCallCount++;
                    if (validationCallCount === 1) {
                        return 'invalid-url'; // Invalid URL
                    } else {
                        return 'https://api.z.ai/v1'; // Valid URL
                    }
                }
                return 'test-input';
            };

            await setupCommand.execute();

            // Should complete after validation
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-api-key');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/v1');
        });

        test('should handle setup failure', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            // Mock setup failure
            const originalSetup = environmentService.setupZaiEnvironment;
            environmentService.setupZaiEnvironment = async (apiKey: string, baseUrl?: string) => {
                return false; // Setup failed
            };

            let errorShown = false;
            (notificationService.showError as any) = async (message: string, options?: any) => {
                errorShown = true;
            };

            await setupCommand.execute();

            assert.strictEqual(errorShown, true);
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, undefined);

            // Restore original method
            environmentService.setupZaiEnvironment = originalSetup;
        });

        test('should restart VS Code when requested', async () => {
            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            // Mock successful setup
            const originalSetup = environmentService.setupZaiEnvironment;
            environmentService.setupZaiEnvironment = async (apiKey: string, baseUrl?: string) => {
                process.env.ANTHROPIC_AUTH_TOKEN = apiKey;
                process.env.ANTHROPIC_BASE_URL = baseUrl || 'https://api.z.ai/v1';
                return true;
            };

            let restartCommandExecuted = false;
            (vscode.commands.executeCommand as any) = async (command: string, ...args: any[]) => {
                if (command === 'workbench.action.reloadWindow') {
                    restartCommandExecuted = true;
                }
            };

            // Mock restart selection
            (vscode.window.showInformationMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                return 'Restart Now';
            };

            await setupCommand.execute();

            assert.strictEqual(restartCommandExecuted, true);

            // Restore original method
            environmentService.setupZaiEnvironment = originalSetup;
        });
    });

    suite('Z.ai Verification Flow', () => {
        test('should verify successful Z.ai setup', async () => {
            // Set up environment variables
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            // Mock menu selection for verification
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'verify-zai');
            };

            let infoShown = false;
            (notificationService.showInfo as any) = async (message: string, options?: any) => {
                infoShown = true;
                assert.ok(message.includes('✅ Set'));
            };

            await setupCommand.execute();

            assert.strictEqual(infoShown, true);
        });

        test('should handle missing environment variables in verification', async () => {
            // Don't set environment variables

            // Mock menu selection for verification
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'verify-zai');
            };

            let warningShown = false;
            (vscode.window.showWarningMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                warningShown = true;
                return 'Setup Now';
            };

            await setupCommand.execute();

            assert.strictEqual(warningShown, true);
        });

        test('should redirect to setup from verification', async () => {
            // Don't set environment variables

            // Mock menu selection for verification
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'verify-zai');
            };

            // Mock setup redirection
            let setupTriggered = false;
            (vscode.window.showWarningMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                setupTriggered = true;
                return 'Setup Now';
            };

            // Mock successful setup
            const originalSetup = environmentService.setupZaiEnvironment;
            environmentService.setupZaiEnvironment = async (apiKey: string, baseUrl?: string) => {
                process.env.ANTHROPIC_AUTH_TOKEN = apiKey;
                process.env.ANTHROPIC_BASE_URL = baseUrl || 'https://api.z.ai/v1';
                return true;
            };

            await setupCommand.execute();

            assert.strictEqual(setupTriggered, true);
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-api-key');

            // Restore original method
            environmentService.setupZaiEnvironment = originalSetup;
        });
    });

    suite('Z.ai Clear Environment Flow', () => {
        test('should clear Z.ai environment variables', async () => {
            // Set up environment variables first
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            // Mock menu selection for clear
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'clear-zai');
            };

            // Mock confirmation
            (vscode.window.showWarningMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                return 'Yes, Clear All';
            };

            await setupCommand.execute();

            // Environment variables should be cleared
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, '');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, '');
        });

        test('should handle clear cancellation', async () => {
            // Set up environment variables first
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            // Mock menu selection for clear
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'clear-zai');
            };

            // Mock cancellation
            (vscode.window.showWarningMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                return 'Cancel';
            };

            await setupCommand.execute();

            // Environment variables should remain unchanged
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, 'zai-test-key');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/v1');
        });

        test('should restart VS Code after clearing', async () => {
            // Set up environment variables first
            process.env.ANTHROPIC_AUTH_TOKEN = 'zai-test-key';
            process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/v1';

            // Mock menu selection for clear
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'clear-zai');
            };

            // Mock confirmation and restart
            (vscode.window.showWarningMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                return 'Yes, Clear All';
            };

            let restartCommandExecuted = false;
            (vscode.commands.executeCommand as any) = async (command: string, ...args: any[]) => {
                if (command === 'workbench.action.reloadWindow') {
                    restartCommandExecuted = true;
                }
            };

            (vscode.window.showInformationMessage as any) = async (message: string, options: any, ...actions: string[]) => {
                return 'Restart Now';
            };

            await setupCommand.execute();

            assert.strictEqual(restartCommandExecuted, true);
            assert.strictEqual(process.env.ANTHROPIC_AUTH_TOKEN, '');
            assert.strictEqual(process.env.ANTHROPIC_BASE_URL, '');
        });
    });

    suite('Instructions Flow', () => {
        test('should show instructions on macOS', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            // Mock menu selection for instructions
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'show-instructions');
            };

            let documentOpened = false;
            let documentContent = '';
            (vscode.workspace.openTextDocument as any) = async (options: any) => {
                documentOpened = true;
                documentContent = options.content;
                return {
                    language: options.language,
                    getText: () => options.content
                } as any;
            };

            (vscode.window.showTextDocument as any) = async (document: any) => {
                return;
            };

            await setupCommand.execute();

            assert.strictEqual(documentOpened, true);
            assert.ok(documentContent.includes('macOS'));
            assert.ok(documentContent.includes('ANTHROPIC_AUTH_TOKEN'));
            assert.ok(documentContent.includes('ANTHROPIC_BASE_URL'));

            // Restore original platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should show instructions on Windows', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            // Mock menu selection for instructions
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'show-instructions');
            };

            let documentOpened = false;
            let documentContent = '';
            (vscode.workspace.openTextDocument as any) = async (options: any) => {
                documentOpened = true;
                documentContent = options.content;
                return {
                    language: options.language,
                    getText: () => options.content
                } as any;
            };

            (vscode.window.showTextDocument as any) = async (document: any) => {
                return;
            };

            await setupCommand.execute();

            assert.strictEqual(documentOpened, true);
            assert.ok(documentContent.includes('Windows'));
            assert.ok(documentContent.includes('ANTHROPIC_AUTH_TOKEN'));
            assert.ok(documentContent.includes('ANTHROPIC_BASE_URL'));

            // Restore original platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        test('should show instructions on Linux', async () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });

            // Mock menu selection for instructions
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'show-instructions');
            };

            let documentOpened = false;
            let documentContent = '';
            (vscode.workspace.openTextDocument as any) = async (options: any) => {
                documentOpened = true;
                documentContent = options.content;
                return {
                    language: options.language,
                    getText: () => options.content
                } as any;
            };

            (vscode.window.showTextDocument as any) = async (document: any) => {
                return;
            };

            await setupCommand.execute();

            assert.strictEqual(documentOpened, true);
            assert.ok(documentContent.includes('Linux'));
            assert.ok(documentContent.includes('ANTHROPIC_AUTH_TOKEN'));
            assert.ok(documentContent.includes('ANTHROPIC_BASE_URL'));

            // Restore original platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    suite('Error Handling', () => {
        test('should handle environment service initialization failure', async () => {
            // Mock environment service failure
            const originalGetInstance = (EnvironmentService as any).getInstance;
            (EnvironmentService as any).getInstance = () => {
                throw new Error('Environment service initialization failed');
            };

            // Mock menu selection for setup
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'setup-zai');
            };

            let errorShown = false;
            (notificationService.showError as any) = async (message: string, options?: any) => {
                errorShown = true;
                assert.ok(message.includes('Environment service not available'));
            };

            await setupCommand.execute();

            assert.strictEqual(errorShown, true);

            // Restore original method
            (EnvironmentService as any).getInstance = originalGetInstance;
        });

        test('should handle general command errors gracefully', async () => {
            // Mock menu selection to trigger error
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                throw new Error('Quick pick failed');
            };

            let errorShown = false;
            (notificationService.showError as any) = async (message: string, options?: any) => {
                errorShown = true;
                assert.ok(message.includes('Failed to setup environment'));
            };

            await setupCommand.execute();

            assert.strictEqual(errorShown, true);
        });

        test('should handle storage service context issues', async () => {
            // Mock storage service without context
            const originalGetContext = storageService.getContext;
            storageService.getContext = () => {
                throw new Error('Context not available');
            };

            // Mock menu selection for verification
            (vscode.window.showQuickPick as any) = async (items: any[], options: any) => {
                return items.find(item => item.value === 'verify-zai');
            };

            let errorShown = false;
            (notificationService.showError as any) = async (message: string, options?: any) => {
                errorShown = true;
                assert.ok(message.includes('Environment service not available'));
            };

            await setupCommand.execute();

            assert.strictEqual(errorShown, true);

            // Restore original method
            storageService.getContext = originalGetContext;
        });
    });
});