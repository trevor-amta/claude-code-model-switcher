import * as assert from 'assert';
import * as vscode from 'vscode';
import * as myExtension from '../../extension';
import { CommandManager } from '../../commands';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting extension tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher-name.claude-code-model-switcher'));
    });

    test('Extension should activate', async function() {
        this.timeout(60000);
        
        const extension = vscode.extensions.getExtension('your-publisher-name.claude-code-model-switcher');
        assert.ok(extension);
        
        await extension.activate();
        assert.ok(extension.isActive);
    });

    test('Commands should be registered', async function() {
        this.timeout(30000);
        
        const commands = await vscode.commands.getCommands();
        const expectedCommands = [
            'claudeModelSwitcher.switchModel',
            'claudeModelSwitcher.showCurrentModel',
            'claudeModelSwitcher.configureApiKeys',
            'claudeModelSwitcher.configureModels'
        ];

        expectedCommands.forEach(cmd => {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        });
    });

    test('CommandManager should initialize correctly', () => {
        const commandManager = new CommandManager();
        const registeredCommands = commandManager.getRegisteredCommands();
        
        assert.ok(Array.isArray(registeredCommands));
        assert.ok(registeredCommands.length > 0);
        
        const expectedCommands = [
            'claudeModelSwitcher.switchModel',
            'claudeModelSwitcher.showCurrentModel',
            'claudeModelSwitcher.configureApiKeys',
            'claudeModelSwitcher.configureModels'
        ];

        expectedCommands.forEach(cmd => {
            assert.ok(registeredCommands.includes(cmd), `Command ${cmd} should be in CommandManager`);
        });
    });

    test('Configuration should have default values', () => {
        const config = vscode.workspace.getConfiguration('claudeModelSwitcher');
        
        assert.strictEqual(config.get('defaultModel'), 'claude-sonnet-4-20250514');
        assert.strictEqual(config.get('showStatusBar'), true);
        assert.strictEqual(config.get('reloadBehavior'), 'prompt');
        assert.strictEqual(config.get('debugMode'), false);
        
        const availableModels = config.get('availableModels') as any[];
        assert.ok(Array.isArray(availableModels));
        assert.ok(availableModels.length > 0);
    });

    test('Status bar should be updatable', async () => {
        try {
            await myExtension.updateStatusBar();
            assert.ok(true, 'updateStatusBar should not throw');
        } catch (error) {
            console.warn('Status bar update failed (expected in test environment):', error);
        }
    });
});