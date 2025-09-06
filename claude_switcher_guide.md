# Claude Code Model Switcher - Harmonized Implementation Guide

## Executive Summary

This guide provides a complete implementation blueprint for building a VSCode extension that enables seamless switching between Anthropic Claude models and Z.ai GLM models within Claude Code. The extension manipulates Claude Code's configuration file (`~/.claude/settings.json`) to change active models, with real-time status bar updates and secure API key management.

**Primary Focus**: Robust status bar synchronization that updates immediately when models change, eliminating the stale display issues from previous implementations.

## Architecture Overview

### Core Components
```
┌─────────────────────────────────────────────────────────┐
│                  VSCode Extension Host                  │
├─────────────────────────────────────────────────────────┤
│  extension.ts (Entry Point & Lifecycle Management)     │
├─────────────────────────────────────────────────────────┤
│                Core Manager Layer                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐   │
│  │ClaudeConfigMgr  │ │ SettingsManager │ │StatusBar │   │
│  │                 │ │                 │ │Manager   │   │
│  └─────────────────┘ └─────────────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│                 Command Layer                           │
│  ┌─────────────────┐ ┌─────────────────┐               │
│  │  switch-model   │ │   configure     │               │
│  └─────────────────┘ └─────────────────┘               │
├─────────────────────────────────────────────────────────┤
│                Utility Layer                            │
│  ┌─────┐ ┌─────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │Path │ │ Logger  │ │Permission│ │ SecurityUtils   │   │
│  │Utils│ │         │ │Utils     │ │                 │   │
│  └─────┘ └─────────┘ └──────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Status Bar Synchronization Strategy
- **Multi-initialization**: Multiple timing attempts on startup
- **File Watcher**: Real-time monitoring of `~/.claude/settings.json`
- **Polling Fallback**: 5-second polling when file watcher fails
- **Force Update**: Immediate `.show()` calls on every update

## Phase 1: Project Foundation

### 1.1 Project Structure
```
claude-code-model-switcher/
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json            # Linting rules
├── .vscode/
│   ├── launch.json          # Debug configuration
│   └── tasks.json           # Build tasks
├── src/
│   ├── extension.ts         # Main entry point
│   ├── commands/            # Command implementations
│   │   ├── switch-model.ts
│   │   ├── show-current.ts
│   │   ├── configure-keys.ts
│   │   └── configure-models.ts
│   ├── config/              # Configuration management
│   │   ├── claude-config.ts
│   │   ├── settings-manager.ts
│   │   └── model-validator.ts
│   ├── ui/                  # User interface
│   │   ├── status-bar.ts
│   │   └── notifications.ts
│   ├── utils/               # Utilities
│   │   ├── logger.ts
│   │   ├── path-utils.ts
│   │   ├── permission-utils.ts
│   │   ├── security-utils.ts
│   │   └── error-handler.ts
│   └── types/               # Type definitions
│       ├── model-config.ts
│       └── claude-settings.ts
└── out/                     # Compiled output
```

### 1.2 Package Configuration (package.json)
```json
{
  "name": "claude-code-model-switcher",
  "displayName": "Claude Code Model Switcher",
  "description": "Switch between Anthropic Claude models and Z.ai GLM models in Claude Code",
  "version": "1.0.0",
  "publisher": "your-publisher-name",
  "engines": {
    "vscode": "^1.85.0"
  },
  "main": "./out/extension.js",
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts",
    "package": "vsce package"
  },
  "activationEvents": [
    "onStartupFinished"
  ],
  "contributes": {
    "commands": [
      {
        "command": "claudeModelSwitcher.switchModel",
        "title": "Claude: Switch Model",
        "category": "Claude"
      },
      {
        "command": "claudeModelSwitcher.showCurrentModel",
        "title": "Claude: Show Current Model",
        "category": "Claude"
      },
      {
        "command": "claudeModelSwitcher.configureApiKeys",
        "title": "Claude: Configure API Keys",
        "category": "Claude"
      },
      {
        "command": "claudeModelSwitcher.configureModels",
        "title": "Claude: Configure Available Models",
        "category": "Claude"
      }
    ],
    "configuration": {
      "title": "Claude Model Switcher",
      "properties": {
        "claudeModelSwitcher.defaultModel": {
          "type": "string",
          "default": "claude-sonnet-4-20250514",
          "description": "Default model to use"
        },
        "claudeModelSwitcher.showStatusBar": {
          "type": "boolean",
          "default": true,
          "description": "Show current model in status bar"
        },
        "claudeModelSwitcher.reloadBehavior": {
          "type": "string",
          "enum": ["prompt", "auto", "skip"],
          "default": "prompt",
          "description": "Window reload behavior after model switch"
        },
        "claudeModelSwitcher.debugMode": {
          "type": "boolean",
          "default": false,
          "description": "Enable debug logging"
        },
        "claudeModelSwitcher.availableModels": {
          "type": "array",
          "default": [
            {
              "name": "claude-sonnet-4-20250514",
              "displayName": "Claude Sonnet 4",
              "description": "Latest Sonnet model for balanced performance",
              "endpoint": "https://api.anthropic.com",
              "type": "web"
            },
            {
              "name": "claude-3-5-haiku-20241022",
              "displayName": "Claude 3.5 Haiku",
              "description": "Fast and compact model for quick tasks",
              "endpoint": "https://api.anthropic.com",
              "type": "web"
            },
            {
              "name": "claude-opus-4-20250514",
              "displayName": "Claude Opus 4",
              "description": "Most capable model for complex tasks",
              "endpoint": "https://api.anthropic.com",
              "type": "web"
            },
            {
              "name": "glm-4.5",
              "displayName": "GLM-4.5",
              "description": "Z.ai's powerful reasoning model (355B params)",
              "endpoint": "https://api.z.ai/api/anthropic",
              "type": "api"
            },
            {
              "name": "glm-4.5-air",
              "displayName": "GLM-4.5-Air",
              "description": "Z.ai's lightweight model (cost-effective)",
              "endpoint": "https://api.z.ai/api/anthropic",
              "type": "api"
            }
          ],
          "description": "Available models and their configurations"
        }
      }
    }
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "vsce": "^2.15.0"
  }
}
```

### 1.3 TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", ".vscode-test", "out"]
}
```

## Phase 2: Type Definitions

### 2.1 Model Configuration Types (src/types/model-config.ts)
```typescript
export interface IModelConfig {
    name: string;
    displayName: string;
    description: string;
    endpoint: string;
    type: 'web' | 'api';
}

export interface IQuickPickModelItem {
    label: string;
    description?: string;
    detail: string;
    model: IModelConfig;
    isCurrent: boolean;
}
```

### 2.2 Claude Settings Types (src/types/claude-settings.ts)
```typescript
export interface IClaudeSettings {
    current_model?: string;
    model?: string;
    selectedModel?: string;
    env?: {
        ANTHROPIC_BASE_URL?: string;
        ANTHROPIC_AUTH_TOKEN?: string;
        ANTHROPIC_MODEL?: string;
    };
    [key: string]: unknown;
}

export interface IConfigBackup {
    timestamp: string;
    content: IClaudeSettings;
    filePath: string;
}
```

## Phase 3: Utility Layer

### 3.1 Logger (src/utils/logger.ts)
```typescript
import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static debugMode: boolean = false;

    static initialize(debugMode: boolean = false): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Claude Code Model Switcher');
        }
        this.debugMode = debugMode;
    }

    static info(message: string): void {
        this.log('INFO', message);
    }

    static error(message: string): void {
        this.log('ERROR', message);
        console.error(`[Claude Model Switcher] ${this.sanitize(message)}`);
    }

    static warn(message: string): void {
        this.log('WARN', message);
    }

    static debug(message: string): void {
        if (this.debugMode) {
            this.log('DEBUG', message);
        }
    }

    private static log(level: string, message: string): void {
        this.initialize();
        const timestamp = new Date().toISOString();
        const sanitized = this.sanitize(message);
        this.outputChannel.appendLine(`[${timestamp}] ${level}: ${sanitized}`);
    }

    private static sanitize(message: string): string {
        let sanitized = message;
        
        // Remove file paths with usernames
        sanitized = sanitized.replace(/\/Users\/[^\/\s]+/g, '/Users/***');
        sanitized = sanitized.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***');
        sanitized = sanitized.replace(/\/home\/[^\/\s]+/g, '/home/***');
        
        // Remove API keys and tokens
        sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***');
        sanitized = sanitized.replace(/Bearer [a-zA-Z0-9_-]{10,}/g, 'Bearer ***');
        sanitized = sanitized.replace(/api[_-]?key[s]?\s*[:=]\s*["']?[a-zA-Z0-9_-]{10,}/g, 'api_key: ***');
        sanitized = sanitized.replace(/token[s]?\s*[:=]\s*["']?[a-zA-Z0-9_-]{10,}/g, 'token: ***');
        
        return sanitized;
    }

    static show(): void {
        this.initialize();
        this.outputChannel.show();
    }
}
```

### 3.2 Path Utils (src/utils/path-utils.ts)
```typescript
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class PathUtils {
    /**
     * Gets Claude config directory - MUST match Claude Code exactly
     */
    static getClaudeConfigDir(): string {
        const homeDir = os.homedir();
        if (!homeDir) {
            throw new Error('Unable to determine home directory');
        }
        return path.join(homeDir, '.claude');
    }

    /**
     * Gets Claude settings file path
     */
    static getClaudeSettingsPath(): string {
        return path.join(this.getClaudeConfigDir(), 'settings.json');
    }

    /**
     * Gets backup directory path
     */
    static getBackupDir(): string {
        return path.join(this.getClaudeConfigDir(), 'model-switcher-backups');
    }

    /**
     * Cross-platform file existence check
     */
    static async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch (error: unknown) {
            if (this.isEnoentError(error)) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Synchronous file existence check
     */
    static fileExistsSync(filePath: string): boolean {
        try {
            fs.accessSync(filePath, fs.constants.F_OK);
            return true;
        } catch (error: unknown) {
            if (this.isEnoentError(error)) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Validates path safety (prevents directory traversal)
     */
    static validatePathSafety(inputPath: string): boolean {
        const normalized = path.normalize(inputPath);
        const homeDir = os.homedir();
        
        // Ensure path is within home directory and doesn't contain traversal
        return normalized.startsWith(homeDir) && 
               !normalized.includes('..') && 
               !normalized.includes('~');
    }

    /**
     * Sanitizes file paths for logging
     */
    static sanitizePathForLogging(filePath: string): string {
        let sanitized = filePath;
        
        // Cross-platform path sanitization
        if (process.platform === 'win32') {
            sanitized = sanitized.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***');
            sanitized = sanitized.replace(/D:\\Users\\[^\\]+/g, 'D:\\Users\\***');
        } else {
            sanitized = sanitized.replace(/\/Users\/[^\/\s]+/g, '/Users/***');
            sanitized = sanitized.replace(/\/home\/[^\/\s]+/g, '/home/***');
        }
        
        return sanitized;
    }

    private static isEnoentError(error: unknown): boolean {
        return error instanceof Error && 
               'code' in error && 
               error.code === 'ENOENT';
    }
}
```

### 3.3 Permission Utils (src/utils/permission-utils.ts)
```typescript
import * as fs from 'fs';
import { Logger } from './logger';

export class PermissionUtils {
    /**
     * Sets secure file permissions (cross-platform)
     */
    static async setSecurePermissions(filePath: string): Promise<void> {
        try {
            if (process.platform === 'win32') {
                await this.setWindowsPermissions(filePath);
            } else {
                await this.setUnixPermissions(filePath);
            }
        } catch (error) {
            Logger.warn(`Could not set secure permissions for ${filePath}: ${error}`);
        }
    }

    static setSecurePermissionsSync(filePath: string): void {
        try {
            if (process.platform === 'win32') {
                this.setWindowsPermissionsSync(filePath);
            } else {
                this.setUnixPermissionsSync(filePath);
            }
        } catch (error) {
            Logger.warn(`Could not set secure permissions for ${filePath}: ${error}`);
        }
    }

    private static async setUnixPermissions(filePath: string): Promise<void> {
        // 700 permissions (owner: read/write/execute, group/other: none)
        await fs.promises.chmod(filePath, 0o700);
    }

    private static setUnixPermissionsSync(filePath: string): void {
        fs.chmodSync(filePath, 0o700);
    }

    private static async setWindowsPermissions(filePath: string): Promise<void> {
        try {
            const { execSync } = require('child_process');
            const username = process.env.USERNAME || process.env.USER || 'BUILTIN\\Users';
            
            // Remove inheritance and grant full control to current user only
            execSync(`icacls "${filePath}" /inheritance:r /grant:r "${username}":F`, {
                stdio: 'pipe'
            });
        } catch (error) {
            Logger.warn(`Could not set Windows permissions: ${error}`);
        }
    }

    private static setWindowsPermissionsSync(filePath: string): void {
        try {
            const { execSync } = require('child_process');
            const username = process.env.USERNAME || process.env.USER || 'BUILTIN\\Users';
            
            execSync(`icacls "${filePath}" /inheritance:r /grant:r "${username}":F`, {
                stdio: 'pipe'
            });
        } catch (error) {
            Logger.warn(`Could not set Windows permissions: ${error}`);
        }
    }

    /**
     * Creates directory with secure permissions
     */
    static async createSecureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
            await this.setSecurePermissions(dirPath);
        } catch (error: unknown) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
                throw error;
            }
            // Directory exists, just set permissions
            await this.setSecurePermissions(dirPath);
        }
    }
}
```

### 3.4 Security Utils (src/utils/security-utils.ts)
```typescript
export class SecurityUtils {
    private static readonly ALLOWED_ENDPOINTS = [
        'https://api.anthropic.com',
        'https://api.z.ai/api/anthropic'
    ];

    /**
     * Validates API endpoint against whitelist
     */
    static validateEndpoint(endpoint: string): boolean {
        if (!endpoint || typeof endpoint !== 'string') {
            return false;
        }

        const trimmed = endpoint.trim();
        
        try {
            const url = new URL(trimmed);
            
            // Must be HTTPS
            if (url.protocol !== 'https:') {
                return false;
            }

            // Must be in whitelist
            return this.ALLOWED_ENDPOINTS.includes(trimmed);
        } catch {
            return false;
        }
    }

    /**
     * Validates model name format
     */
    static validateModelName(modelName: string): boolean {
        if (!modelName || typeof modelName !== 'string') {
            return false;
        }

        const trimmed = modelName.trim();
        
        // Length check
        if (trimmed.length === 0 || trimmed.length > 100) {
            return false;
        }

        // Format check: alphanumeric, hyphens, underscores, periods
        const validFormat = /^[a-zA-Z0-9\-_.]+$/.test(trimmed);
        
        return validFormat;
    }

    /**
     * Validates API key format (basic validation)
     */
    static validateApiKeyFormat(apiKey: string): boolean {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        const trimmed = apiKey.trim();
        
        // Basic length check (API keys are typically 20+ characters)
        return trimmed.length >= 20 && trimmed.length <= 200;
    }

    /**
     * Gets allowed endpoints list
     */
    static getAllowedEndpoints(): readonly string[] {
        return this.ALLOWED_ENDPOINTS;
    }
}
```

### 3.5 Error Handler (src/utils/error-handler.ts)
```typescript
import * as vscode from 'vscode';
import { Logger } from './logger';

export class ErrorHandler {
    static async handle(error: unknown, context: string, showUser: boolean = true): Promise<void> {
        const message = this.extractMessage(error);
        const userMessage = this.getUserFriendlyMessage(error);
        
        Logger.error(`${context}: ${message}`);
        
        if (showUser) {
            await vscode.window.showErrorMessage(userMessage);
        }
    }

    static extractMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Unknown error occurred';
    }

    static getUserFriendlyMessage(error: unknown): string {
        const message = this.extractMessage(error);
        
        // Convert common errors to user-friendly messages
        if (message.includes('ENOENT')) {
            return 'Configuration file not found. Please ensure Claude Code is installed and configured.';
        }
        if (message.includes('EACCES') || message.includes('permission')) {
            return 'Permission denied. Please check file permissions for your Claude Code configuration.';
        }
        if (message.includes('ECONNREFUSED') || message.includes('network')) {
            return 'Network connection failed. Please check your internet connection.';
        }
        if (message.includes('API key') || message.includes('apiKey')) {
            return 'API key configuration error. Please configure your API keys using the extension commands.';
        }
        if (message.includes('JSON')) {
            return 'Configuration file is corrupted. The extension will attempt to restore from backup.';
        }
        
        return 'An unexpected error occurred. Check the extension output for details.';
    }
}
```

## Phase 4: Configuration Management

### 4.1 Model Validator (src/config/model-validator.ts)
```typescript
import { IModelConfig } from '../types/model-config';
import { SecurityUtils } from '../utils/security-utils';

export class ModelValidator {
    static validateModel(model: IModelConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate name
        if (!SecurityUtils.validateModelName(model.name)) {
            errors.push('Invalid model name format');
        }

        // Validate display name
        if (!model.displayName || model.displayName.trim().length === 0) {
            errors.push('Display name is required');
        }

        // Validate description
        if (!model.description || model.description.trim().length === 0) {
            errors.push('Description is required');
        }

        // Validate endpoint
        if (!SecurityUtils.validateEndpoint(model.endpoint)) {
            errors.push(`Invalid endpoint. Allowed endpoints: ${SecurityUtils.getAllowedEndpoints().join(', ')}`);
        }

        // Validate type
        if (!model.type || !['web', 'api'].includes(model.type)) {
            errors.push('Type must be either "web" or "api"');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    static validateModelArray(models: IModelConfig[]): { isValid: boolean; errors: string[] } {
        if (!Array.isArray(models)) {
            return { isValid: false, errors: ['Models must be an array'] };
        }

        if (models.length === 0) {
            return { isValid: false, errors: ['At least one model must be configured'] };
        }

        const allErrors: string[] = [];
        const modelNames = new Set<string>();

        models.forEach((model, index) => {
            const validation = this.validateModel(model);
            if (!validation.isValid) {
                allErrors.push(`Model ${index + 1}: ${validation.errors.join(', ')}`);
            }

            // Check for duplicate names
            if (modelNames.has(model.name)) {
                allErrors.push(`Duplicate model name: ${model.name}`);
            }
            modelNames.add(model.name);
        });

        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }
}
```

### 4.2 Settings Manager (src/config/settings-manager.ts)
```typescript
import * as vscode from 'vscode';
import { IModelConfig } from '../types/model-config';
import { Logger } from '../utils/logger';
import { ModelValidator } from './model-validator';

export class SettingsManager {
    private static readonly CONFIG_SECTION = 'claudeModelSwitcher';

    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(SettingsManager.CONFIG_SECTION);
    }

    getDefaultModel(): string {
        return this.getConfiguration().get<string>('defaultModel', 'claude-sonnet-4-20250514');
    }

    async setDefaultModel(modelName: string): Promise<void> {
        await this.getConfiguration().update(
            'defaultModel', 
            modelName, 
            vscode.ConfigurationTarget.Global
        );
    }

    getShowStatusBar(): boolean {
        return this.getConfiguration().get<boolean>('showStatusBar', true);
    }

    getReloadBehavior(): 'prompt' | 'auto' | 'skip' {
        return this.getConfiguration().get<'prompt' | 'auto' | 'skip'>('reloadBehavior', 'prompt');
    }

    getDebugMode(): boolean {
        return this.getConfiguration().get<boolean>('debugMode', false);
    }

    getAvailableModels(): IModelConfig[] {
        const models = this.getConfiguration().get<IModelConfig[]>('availableModels', []);
        const validation = ModelValidator.validateModelArray(models);
        
        if (!validation.isValid) {
            Logger.warn(`Invalid model configuration: ${validation.errors.join(', ')}`);
            return this.getDefaultModels();
        }
        
        return models;
    }

    async setAvailableModels(models: IModelConfig[]): Promise<void> {
        const validation = ModelValidator.validateModelArray(models);
        
        if (!validation.isValid) {
            throw new Error(`Invalid models: ${validation.errors.join(', ')}`);
        }

        await this.getConfiguration().update(
            'availableModels',
            models,
            vscode.ConfigurationTarget.Global
        );
    }

    private getDefaultModels(): IModelConfig[] {
        return [
            {
                name: "claude-sonnet-4-20250514",
                displayName: "Claude Sonnet 4",
                description: "Latest Sonnet model for balanced performance",
                endpoint: "https://api.anthropic.com",
                type: "web"
            },
            {
                name: "claude-3-5-haiku-20241022",
                displayName: "Claude 3.5 Haiku",
                description: "Fast and compact model for quick tasks",
                endpoint: "https://api.anthropic.com",
                type: "web"
            },
            {
                name: "glm-4.5",
                displayName: "GLM-4.5",
                description: "Z.ai's powerful reasoning model (355B params)",
                endpoint: "https://api.z.ai/api/anthropic",
                type: "api"
            },
            {
                name: "glm-4.5-air",
                displayName: "GLM-4.5-Air",
                description: "Z.ai's lightweight model (cost-effective)",
                endpoint: "https://api.z.ai/api/anthropic",
                type: "api"
            }
        ];
    }

    /**
     * Watch for configuration changes
     */
    onConfigurationChanged(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(SettingsManager.CONFIG_SECTION)) {
                callback(e);
            }
        });
    }
}
```

### 4.3 Claude Config Manager (src/config/claude-config.ts)
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IClaudeSettings, IConfigBackup } from '../types/claude-settings';
import { IModelConfig } from '../types/model-config';
import { PathUtils } from '../utils/path-utils';
import { PermissionUtils } from '../utils/permission-utils';
import { SecurityUtils } from '../utils/security-utils';
import { ErrorHandler } from '../utils/error-handler';
import { Logger } from '../utils/logger';

export class ClaudeConfigManager {
    private readonly settingsPath: string;
    private readonly backupDir: string;
    private readonly context: vscode.ExtensionContext;
    private fileWatcher?: fs.FSWatcher;
    private debounceTimer?: ReturnType<typeof setTimeout>;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.settingsPath = PathUtils.getClaudeSettingsPath();
        this.backupDir = PathUtils.getBackupDir();
        this.initializeDirectories();
    }

    private async initializeDirectories(): Promise<void> {
        try {
            const claudeDir = PathUtils.getClaudeConfigDir();
            
            // Ensure .claude directory exists
            if (!await PathUtils.fileExists(claudeDir)) {
                await PermissionUtils.createSecureDirectory(claudeDir);
                Logger.info(`Created Claude config directory: ${claudeDir}`);
            }

            // Ensure backup directory exists
            if (!await PathUtils.fileExists(this.backupDir)) {
                await PermissionUtils.createSecureDirectory(this.backupDir);
                Logger.info(`Created backup directory: ${this.backupDir}`);
            }

            // Ensure settings.json exists
            if (!await PathUtils.fileExists(this.settingsPath)) {
                await this.createDefaultSettings();
            }
        } catch (error) {
            await ErrorHandler.handle(error, 'Failed to initialize directories');
        }
    }

    private async createDefaultSettings(): Promise<void> {
        const defaultSettings: IClaudeSettings = {};
        
        try {
            await fs.promises.writeFile(
                this.settingsPath, 
                JSON.stringify(defaultSettings, null, 2)
            );
            await PermissionUtils.setSecurePermissions(this.settingsPath);
            Logger.info('Created default Claude settings file');
        } catch (error) {
            throw new Error(`Failed to create default settings: ${ErrorHandler.extractMessage(error)}`);
        }
    }

    async getCurrentModel(): Promise<string> {
        try {
            const settings = await this.readSettings();
            
            // Check Z.ai configuration first
            if (settings.env?.ANTHROPIC_BASE_URL?.includes('z.ai')) {
                return settings.env.ANTHROPIC_MODEL || 'glm-4.5';
            }
            
            // Check various model fields
            return settings.current_model || 
                   settings.model || 
                   settings.selectedModel || 
                   'claude-sonnet-4-20250514';
        } catch (error) {
            Logger.error(`Failed to get current model: ${ErrorHandler.extractMessage(error)}`);
            return 'claude-sonnet-4-20250514';
        }
    }

    async switchModel(modelConfig: IModelConfig): Promise<void> {
        try {
            Logger.info(`Switching to model: ${modelConfig.name}`);
            
            // Validate model configuration
            if (!SecurityUtils.validateModelName(modelConfig.name)) {
                throw new Error('Invalid model name');
            }
            
            if (!SecurityUtils.validateEndpoint(modelConfig.endpoint)) {
                throw new Error('Invalid endpoint');
            }

            // Backup current configuration
            await this.backupCurrentConfig();

            // Switch based on model type
            if (modelConfig.type === 'api') {
                await this.switchToApiModel(modelConfig);
            } else {
                await this.switchToWebModel(modelConfig);
            }

            Logger.info(`Successfully switched to model: ${modelConfig.name}`);
        } catch (error) {
            await ErrorHandler.handle(error, 'Failed to switch model');
            throw error;
        }
    }

    private async switchToApiModel(modelConfig: IModelConfig): Promise<void> {
        // Get API key from secure storage
        const apiKey = await this.getApiKey(modelConfig.endpoint);
        if (!apiKey) {
            throw new Error(`API key not configured for ${modelConfig.endpoint}`);
        }

        const settings: IClaudeSettings = {
            current_model: modelConfig.name,
            env: {
                ANTHROPIC_BASE_URL: modelConfig.endpoint,
                ANTHROPIC_AUTH_TOKEN: apiKey,
                ANTHROPIC_MODEL: modelConfig.name
            }
        };

        await this.writeSettings(settings);
    }

    private async switchToWebModel(modelConfig: IModelConfig): Promise<void> {
        const settings: IClaudeSettings = {
            current_model: modelConfig.name
        };

        // Remove API-specific environment variables
        const currentSettings = await this.readSettings();
        if (currentSettings.env) {
            delete currentSettings.env.ANTHROPIC_BASE_URL;
            delete currentSettings.env.ANTHROPIC_AUTH_TOKEN;
            delete currentSettings.env.ANTHROPIC_MODEL;
            
            // Keep other env vars if they exist
            if (Object.keys(currentSettings.env).length > 0) {
                settings.env = currentSettings.env;
            }
        }

        await this.writeSettings(settings);
    }

    private async readSettings(): Promise<IClaudeSettings> {
        try {
            const content = await fs.promises.readFile(this.settingsPath, 'utf-8');
            return JSON.parse(content) as IClaudeSettings;
        } catch (error) {
            if (ErrorHandler.extractMessage(error).includes('ENOENT')) {
                await this.createDefaultSettings();
                return {};
            }
            
            if (ErrorHandler.extractMessage(error).includes('JSON')) {
                Logger.warn('Settings file corrupted, attempting to restore from backup');
                await this.restoreFromBackup();
                return await this.readSettings();
            }
            
            throw error;
        }
    }

    private async writeSettings(settings: IClaudeSettings): Promise<void> {
        try {
            const content = JSON.stringify(settings, null, 2);
            await fs.promises.writeFile(this.settingsPath, content);
            await PermissionUtils.setSecurePermissions(this.settingsPath);
        } catch (error) {
            throw new Error(`Failed to write settings: ${ErrorHandler.extractMessage(error)}`);
        }
    }

    private async backupCurrentConfig(): Promise<void> {
        try {
            if (!await PathUtils.fileExists(this.settingsPath)) {
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `settings-${timestamp}.json`);
            
            await fs.promises.copyFile(this.settingsPath, backupPath);
            await PermissionUtils.setSecurePermissions(backupPath);
            
            Logger.debug(`Backed up configuration to: ${PathUtils.sanitizePathForLogging(backupPath)}`);
            
            // Clean old backups (keep last 10)
            await this.cleanOldBackups();
        } catch (error) {
            Logger.warn(`Failed to backup configuration: ${ErrorHandler.extractMessage(error)}`);
        }
    }

    private async cleanOldBackups(): Promise<void> {
        try {
            const files = await fs.promises.readdir(this.backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('settings-') && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    mtime: fs.statSync(path.join(this.backupDir, f)).mtime
                }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            // Keep only the 10 most recent backups
            for (let i = 10; i < backupFiles.length; i++) {
                await fs.promises.unlink(backupFiles[i].path);
                Logger.debug(`Cleaned old backup: ${backupFiles[i].name}`);
            }
        } catch (error) {
            Logger.warn(`Failed to clean old backups: ${ErrorHandler.extractMessage(error)}`);
        }
    }

    private async restoreFromBackup(): Promise<void> {
        try {
            const files = await fs.promises.readdir(this.backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('settings-') && f.endsWith('.json'))
                .map(f => path.join(this.backupDir, f))
                .sort((a, b) => {
                    const statA = fs.statSync(a);
                    const statB = fs.statSync(b);
                    return statB.mtime.getTime() - statA.mtime.getTime();
                });

            if (backupFiles.length > 0) {
                await fs.promises.copyFile(backupFiles[0], this.settingsPath);
                Logger.info(`Restored configuration from backup: ${PathUtils.sanitizePathForLogging(backupFiles[0])}`);
            } else {
                await this.createDefaultSettings();
                Logger.info('No backups found, created default settings');
            }
        } catch (error) {
            Logger.error(`Failed to restore from backup: ${ErrorHandler.extractMessage(error)}`);
            await this.createDefaultSettings();
        }
    }

    private async getApiKey(endpoint: string): Promise<string | undefined> {
        try {
            const keyName = this.getApiKeyName(endpoint);
            return await this.context.secrets.get(keyName);
        } catch (error) {
            Logger.error(`Failed to retrieve API key: ${ErrorHandler.extractMessage(error)}`);
            return undefined;
        }
    }

    async setApiKey(endpoint: string, apiKey: string): Promise<void> {
        try {
            if (!SecurityUtils.validateApiKeyFormat(apiKey)) {
                throw new Error('Invalid API key format');
            }

            const keyName = this.getApiKeyName(endpoint);
            await this.context.secrets.store(keyName, apiKey);
            Logger.info(`API key stored for endpoint: ${endpoint}`);
        } catch (error) {
            throw new Error(`Failed to store API key: ${ErrorHandler.extractMessage(error)}`);
        }
    }

    private getApiKeyName(endpoint: string): string {
        if (endpoint.includes('z.ai')) {
            return 'claudeModelSwitcher.zaiApiKey';
        }
        if (endpoint.includes('anthropic.com')) {
            return 'claudeModelSwitcher.anthropicApiKey';
        }
        throw new Error(`Unsupported endpoint: ${endpoint}`);
    }

    /**
     * Watch for external changes to Claude config file
     */
    async watchConfigFile(callback: (newModel: string) => void): Promise<vscode.Disposable> {
        try {
            const watchDir = path.dirname(this.settingsPath);
            
            this.fileWatcher = fs.watch(watchDir, (eventType, filename) => {
                if (filename === 'settings.json' && eventType === 'change') {
                    // Debounce rapid changes
                    if (this.debounceTimer) {
                        clearTimeout(this.debounceTimer);
                    }
                    
                    this.debounceTimer = setTimeout(async () => {
                        try {
                            const newModel = await this.getCurrentModel();
                            Logger.debug(`Config file changed, new model: ${newModel}`);
                            callback(newModel);
                        } catch (error) {
                            Logger.error(`Failed to read model after config change: ${ErrorHandler.extractMessage(error)}`);
                        }
                    }, 500); // 500ms debounce
                }
            });

            Logger.info(`Watching Claude config file: ${PathUtils.sanitizePathForLogging(this.settingsPath)}`);

            return {
                dispose: () => {
                    if (this.fileWatcher) {
                        this.fileWatcher.close();
                        this.fileWatcher = undefined;
                    }
                    if (this.debounceTimer) {
                        clearTimeout(this.debounceTimer);
                        this.debounceTimer = undefined;
                    }
                    Logger.debug('File watcher disposed');
                }
            };
        } catch (error) {
            Logger.error(`Failed to set up file watcher: ${ErrorHandler.extractMessage(error)}`);
            throw error;
        }
    }
}
```

## Phase 5: User Interface

### 5.1 Status Bar Manager (src/ui/status-bar.ts)
```typescript
import * as vscode from 'vscode';
import { IModelConfig } from '../types/model-config';
import { Logger } from '../utils/logger';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private isDisposed: boolean = false;
    private pollingInterval?: ReturnType<typeof setInterval>;

    constructor() {
        Logger.debug('StatusBarManager: Creating status bar item');
        this.statusBarItem = this.createStatusBarItem();
        this.statusBarItem.show(); // CRITICAL: Show immediately
        Logger.debug('StatusBarManager: Status bar created and shown');
    }

    private createStatusBarItem(): vscode.StatusBarItem {
        const item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            200 // High priority to ensure visibility
        );
        
        item.command = 'claudeModelSwitcher.switchModel';
        return item;
    }

    /**
     * Update status bar with current model - CRITICAL for synchronization
     */
    updateModel(modelName: string, availableModels: IModelConfig[]): void {
        if (this.isDisposed) {
            return;
        }

        Logger.debug(`StatusBarManager: Updating with model: ${modelName}`);
        
        const modelConfig = availableModels.find(m => m.name === modelName);
        const displayName = modelConfig?.displayName || this.formatModelName(modelName);
        
        // CRITICAL: Always set properties and force show
        this.statusBarItem.text = `$(robot) ${displayName}`;
        this.statusBarItem.tooltip = this.createTooltip(modelName, modelConfig);
        
        // CRITICAL: Force show on every update
        this.statusBarItem.show();
        
        Logger.debug(`StatusBarManager: Updated - Text: "${this.statusBarItem.text}"`);
    }

    private formatModelName(modelName: string): string {
        // Convert model names to user-friendly display names
        if (modelName.startsWith('claude-')) {
            return modelName
                .replace('claude-', 'Claude ')
                .replace('-', ' ')
                .replace(/(\d+)/, '$1')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }
        
        if (modelName.startsWith('glm-')) {
            return modelName.toUpperCase().replace('-', '-');
        }
        
        return modelName;
    }

    private createTooltip(modelName: string, modelConfig?: IModelConfig): string {
        let tooltip = `Current Model: ${modelName}`;
        
        if (modelConfig) {
            tooltip += `\n${modelConfig.description}`;
            if (modelConfig.type === 'api') {
                tooltip += '\n(API-based)';
            } else {
                tooltip += '\n(Web-based)';
            }
        }
        
        tooltip += '\n\nClick to switch model';
        return tooltip;
    }

    /**
     * Start polling fallback (when file watcher fails)
     */
    startPolling(getCurrentModel: () => Promise<string>, availableModels: IModelConfig[], intervalMs: number = 5000): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(async () => {
            try {
                const currentModel = await getCurrentModel();
                this.updateModel(currentModel, availableModels);
            } catch (error) {
                Logger.error(`Polling error: ${error}`);
            }
        }, intervalMs);

        Logger.debug(`StatusBarManager: Started polling with ${intervalMs}ms interval`);
    }

    /**
     * Stop polling fallback
     */
    stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
            Logger.debug('StatusBarManager: Stopped polling');
        }
    }

    show(): void {
        if (!this.isDisposed) {
            this.statusBarItem.show();
            Logger.debug('StatusBarManager: Shown');
        }
    }

    hide(): void {
        if (!this.isDisposed) {
            this.statusBarItem.hide();
            Logger.debug('StatusBarManager: Hidden');
        }
    }

    dispose(): void {
        if (!this.isDisposed) {
            this.stopPolling();
            this.statusBarItem.dispose();
            this.isDisposed = true;
            Logger.debug('StatusBarManager: Disposed');
        }
    }
}
```

### 5.2 Notifications Helper (src/ui/notifications.ts)
```typescript
import * as vscode from 'vscode';
import { IModelConfig, IQuickPickModelItem } from '../types/model-config';

export class NotificationHelper {
    static async showModelPicker(
        availableModels: IModelConfig[], 
        currentModel: string
    ): Promise<IModelConfig | undefined> {
        const items: IQuickPickModelItem[] = availableModels.map(model => ({
            label: model.displayName,
            description: model.name === currentModel ? '$(check) Current' : undefined,
            detail: `${model.description} • ${model.type === 'api' ? 'API' : 'Web'}`,
            model: model,
            isCurrent: model.name === currentModel
        }));

        // Sort: current model first, then alphabetically
        items.sort((a, b) => {
            if (a.isCurrent && !b.isCurrent) return -1;
            if (!a.isCurrent && b.isCurrent) return 1;
            return a.label.localeCompare(b.label);
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a model',
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.model;
    }

    static async showApiKeyInput(endpoint: string): Promise<string | undefined> {
        const providerName = endpoint.includes('z.ai') ? 'Z.ai' : 'Anthropic';
        
        return await vscode.window.showInputBox({
            prompt: `Enter your ${providerName} API key`,
            password: true,
            placeHolder: `Your ${providerName} API key`,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API key cannot be empty';
                }
                if (value.trim().length < 20) {
                    return 'API key appears to be too short';
                }
                if (value.trim().length > 200) {
                    return 'API key appears to be too long';
                }
                return null;
            }
        });
    }

    static async showReloadPrompt(modelName: string): Promise<boolean> {
        const reloadAction = 'Reload Window';
        const skipAction = 'Skip';
        
        const choice = await vscode.window.showInformationMessage(
            `Model switched to ${modelName}. Reload window for Claude Code to fully reflect this change?`,
            reloadAction,
            skipAction
        );

        return choice === reloadAction;
    }

    static async showModelConfigEditor(
        currentModels: IModelConfig[]
    ): Promise<IModelConfig[] | undefined> {
        const currentJson = JSON.stringify(currentModels, null, 2);
        
        const newJson = await vscode.window.showInputBox({
            prompt: 'Edit available models (JSON format)',
            value: currentJson,
            validateInput: (value) => {
                try {
                    const parsed = JSON.parse(value);
                    if (!Array.isArray(parsed)) {
                        return 'Must be a JSON array';
                    }
                    return null;
                } catch {
                    return 'Invalid JSON format';
                }
            }
        });

        if (newJson) {
            try {
                return JSON.parse(newJson) as IModelConfig[];
            } catch {
                vscode.window.showErrorMessage('Invalid JSON format');
                return undefined;
            }
        }

        return undefined;
    }
}
```

## Phase 6: Commands

### 6.1 Switch Model Command (src/commands/switch-model.ts)
```typescript
import * as vscode from 'vscode';
import { ClaudeConfigManager } from '../config/claude-config';
import { SettingsManager } from '../config/settings-manager';
import { StatusBarManager } from '../ui/status-bar';
import { NotificationHelper } from '../ui/notifications';
import { ErrorHandler } from '../utils/error-handler';
import { Logger } from '../utils/logger';

export class SwitchModelCommand {
    constructor(
        private configManager: ClaudeConfigManager,
        private settingsManager: SettingsManager,
        private statusBarManager: StatusBarManager
    ) {}

    async execute(): Promise<void> {
        try {
            Logger.info('Executing switch model command');

            const availableModels = this.settingsManager.getAvailableModels();
            const currentModel = await this.configManager.getCurrentModel();

            const selectedModel = await NotificationHelper.showModelPicker(
                availableModels, 
                currentModel
            );

            if (!selectedModel) {
                Logger.debug('No model selected, cancelling switch');
                return;
            }

            if (selectedModel.name === currentModel) {
                vscode.window.showInformationMessage(`Already using ${selectedModel.displayName}`);
                return;
            }

            await this.performSwitch(selectedModel, availableModels);

        } catch (error) {
            await ErrorHandler.handle(error, 'Switch model command failed');
        }
    }

    private async performSwitch(
        selectedModel: any, 
        availableModels: any[]
    ): Promise<void> {
        try {
            // Check if API key is needed
            if (selectedModel.type === 'api') {
                const hasApiKey = await this.checkApiKeyExists(selectedModel.endpoint);
                if (!hasApiKey) {
                    const configureNow = await vscode.window.showWarningMessage(
                        `${selectedModel.displayName} requires an API key. Configure now?`,
                        'Configure', 'Cancel'
                    );

                    if (configureNow === 'Configure') {
                        const apiKey = await NotificationHelper.showApiKeyInput(selectedModel.endpoint);
                        if (apiKey) {
                            await this.configManager.setApiKey(selectedModel.endpoint, apiKey);
                        } else {
                            return; // User cancelled API key input
                        }
                    } else {
                        return; // User cancelled
                    }
                }
            }

            // Perform the switch
            await this.configManager.switchModel(selectedModel);
            await this.settingsManager.setDefaultModel(selectedModel.name);

            // CRITICAL: Update status bar immediately
            this.statusBarManager.updateModel(selectedModel.name, availableModels);

            // Handle window reload
            await this.handleReload(selectedModel.displayName);

            vscode.window.showInformationMessage(`Switched to ${selectedModel.displayName}`);
            Logger.info(`Successfully switched to model: ${selectedModel.name}`);

        } catch (error) {
            throw new Error(`Failed to switch to ${selectedModel.displayName}: ${ErrorHandler.extractMessage(error)}`);
        }
    }

    private async checkApiKeyExists(endpoint: string): Promise<boolean> {
        try {
            // This method would check if API key exists in secure storage
            // Implementation depends on the ConfigManager's API
            const keyName = endpoint.includes('z.ai') ? 'claudeModelSwitcher.zaiApiKey' : 'claudeModelSwitcher.anthropicApiKey';
            const context = (this.configManager as any).context; // Access via private property
            const apiKey = await context.secrets.get(keyName);
            return !!apiKey;
        } catch {
            return false;
        }
    }

    private async handleReload(modelName: string): Promise<void> {
        const reloadBehavior = this.settingsManager.getReloadBehavior();

        switch (reloadBehavior) {
            case 'auto':
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
                break;
            
            case 'prompt':
                const shouldReload = await NotificationHelper.showReloadPrompt(modelName);
                if (shouldReload) {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                break;
            
            case 'skip':
            default:
                // Do nothing
                break;
        }
    }
}
```

### 6.2 Show Current Model Command (src/commands/show-current.ts)
```typescript
import * as vscode from 'vscode';
import { ClaudeConfigManager } from '../config/claude-config';
import { SettingsManager } from '../config/settings-manager';
import { ErrorHandler } from '../utils/error-handler';
import { Logger } from '../utils/logger';

export class ShowCurrentModelCommand {
    constructor(
        private configManager: ClaudeConfigManager,
        private settingsManager: SettingsManager
    ) {}

    async execute(): Promise<void> {
        try {
            Logger.debug('Executing show current model command');

            const currentModel = await this.configManager.getCurrentModel();
            const availableModels = this.settingsManager.getAvailableModels();
            
            const modelConfig = availableModels.find(m => m.name === currentModel);
            
            let message = `Current model: ${currentModel}`;
            
            if (modelConfig) {
                message = `Current model: ${modelConfig.displayName}\n`;
                message += `Description: ${modelConfig.description}\n`;
                message += `Type: ${modelConfig.type === 'api' ? 'API-based' : 'Web-based'}\n`;
                message += `Endpoint: ${modelConfig.endpoint}`;
            }

            await vscode.window.showInformationMessage(message);
            Logger.info(`Displayed current model: ${currentModel}`);

        } catch (error) {
            await ErrorHandler.handle(error, 'Show current model command failed');
        }
    }
}
```

### 6.3 Configure API Keys Command (src/commands/configure-keys.ts)
```typescript
import * as vscode from 'vscode';
import { ClaudeConfigManager } from '../config/claude-config';
import { SettingsManager } from '../config/settings-manager';
import { NotificationHelper } from '../ui/notifications';
import { SecurityUtils } from '../utils/security-utils';
import { ErrorHandler } from '../utils/error-handler';
import { Logger } from '../utils/logger';

export class ConfigureApiKeysCommand {
    constructor(
        private configManager: ClaudeConfigManager,
        private settingsManager: SettingsManager
    ) {}

    async execute(): Promise<void> {
        try {
            Logger.info('Executing configure API keys command');

            const availableModels = this.settingsManager.getAvailableModels();
            const apiEndpoints = [...new Set(
                availableModels
                    .filter(m => m.type === 'api')
                    .map(m => m.endpoint)
            )];

            if (apiEndpoints.length === 0) {
                vscode.window.showInformationMessage('No API-based models configured');
                return;
            }

            const endpoint = await this.selectEndpoint(apiEndpoints);
            if (!endpoint) {
                return;
            }

            const apiKey = await NotificationHelper.showApiKeyInput(endpoint);
            if (!apiKey) {
                return;
            }

            await this.configManager.setApiKey(endpoint, apiKey.trim());
            
            const providerName = endpoint.includes('z.ai') ? 'Z.ai' : 'Anthropic';
            vscode.window.showInformationMessage(`${providerName} API key configured successfully`);
            Logger.info(`API key configured for: ${endpoint}`);

        } catch (error) {
            await ErrorHandler.handle(error, 'Configure API keys command failed');
        }
    }

    private async selectEndpoint(endpoints: string[]): Promise<string | undefined> {
        if (endpoints.length === 1) {
            return endpoints[0];
        }

        const items = endpoints.map(endpoint => ({
            label: endpoint.includes('z.ai') ? 'Z.ai GLM Models' : 'Anthropic API',
            description: endpoint,
            endpoint: endpoint
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select API provider to configure'
        });

        return selected?.endpoint;
    }
}
```

### 6.4 Configure Models Command (src/commands/configure-models.ts)
```typescript
import * as vscode from 'vscode';
import { SettingsManager } from '../config/settings-manager';
import { NotificationHelper } from '../ui/notifications';
import { ModelValidator } from '../config/model-validator';
import { ErrorHandler } from '../utils/error-handler';
import { Logger } from '../utils/logger';

export class ConfigureModelsCommand {
    constructor(private settingsManager: SettingsManager) {}

    async execute(): Promise<void> {
        try {
            Logger.info('Executing configure models command');

            const currentModels = this.settingsManager.getAvailableModels();
            const newModels = await NotificationHelper.showModelConfigEditor(currentModels);

            if (!newModels) {
                return;
            }

            // Validate new models
            const validation = ModelValidator.validateModelArray(newModels);
            if (!validation.isValid) {
                vscode.window.showErrorMessage(
                    `Invalid model configuration:\n${validation.errors.join('\n')}`
                );
                return;
            }

            await this.settingsManager.setAvailableModels(newModels);
            vscode.window.showInformationMessage('Model configuration updated successfully');
            Logger.info(`Updated model configuration with ${newModels.length} models`);

        } catch (error) {
            await ErrorHandler.handle(error, 'Configure models command failed');
        }
    }
}
```

## Phase 7: Extension Entry Point

### 7.1 Main Extension File (src/extension.ts)
```typescript
import * as vscode from 'vscode';
import { ClaudeConfigManager } from './config/claude-config';
import { SettingsManager } from './config/settings-manager';
import { StatusBarManager } from './ui/status-bar';
import { SwitchModelCommand } from './commands/switch-model';
import { ShowCurrentModelCommand } from './commands/show-current';
import { ConfigureApiKeysCommand } from './commands/configure-keys';
import { ConfigureModelsCommand } from './commands/configure-models';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        Logger.info('Claude Code Model Switcher activating...');

        // Initialize managers
        const settingsManager = new SettingsManager();
        const configManager = new ClaudeConfigManager(context);
        const statusBarManager = new StatusBarManager();

        // Initialize logger with debug mode
        Logger.initialize(settingsManager.getDebugMode());

        // CRITICAL: Status bar initialization with multiple strategies
        await initializeStatusBar(statusBarManager, configManager, settingsManager);

        // Register commands
        registerCommands(context, configManager, settingsManager, statusBarManager);

        // Set up configuration change listener
        setupConfigurationListener(settingsManager, statusBarManager, configManager);

        // Set up file watcher for real-time synchronization
        await setupFileWatcher(context, configManager, statusBarManager, settingsManager);

        // Handle startup auto-switch
        await handleStartupAutoSwitch(configManager, settingsManager, statusBarManager);

        // Ensure cleanup on deactivation
        context.subscriptions.push({
            dispose: () => {
                statusBarManager.dispose();
                Logger.info('Extension cleanup completed');
            }
        });

        Logger.info('Claude Code Model Switcher activated successfully');

    } catch (error) {
        await ErrorHandler.handle(error, 'Extension activation failed', true);
        throw error;
    }
}

export function deactivate(): void {
    Logger.info('Claude Code Model Switcher deactivated');
}

/**
 * CRITICAL: Multi-strategy status bar initialization
 */
async function initializeStatusBar(
    statusBarManager: StatusBarManager,
    configManager: ClaudeConfigManager,
    settingsManager: SettingsManager
): Promise<void> {
    if (!settingsManager.getShowStatusBar()) {
        statusBarManager.hide();
        return;
    }

    const availableModels = settingsManager.getAvailableModels();
    
    // Strategy 1: Immediate attempt
    try {
        const currentModel = await configManager.getCurrentModel();
        statusBarManager.updateModel(currentModel, availableModels);
        Logger.info(`Status bar initialized immediately with model: ${currentModel}`);
    } catch (error) {
        Logger.warn(`Immediate status bar initialization failed: ${ErrorHandler.extractMessage(error)}`);
        
        // Fallback: Use default model
        const defaultModel = settingsManager.getDefaultModel();
        statusBarManager.updateModel(defaultModel, availableModels);
        Logger.info(`Status bar initialized with default model: ${defaultModel}`);
    }

    // Strategy 2: Delayed attempt (backup)
    setTimeout(async () => {
        try {
            const currentModel = await configManager.getCurrentModel();
            statusBarManager.updateModel(currentModel, availableModels);
            Logger.debug('Status bar updated via delayed initialization');
        } catch (error) {
            Logger.debug(`Delayed status bar update failed: ${ErrorHandler.extractMessage(error)}`);
        }
    }, 1000);

    // Strategy 3: Polling fallback (if file watcher fails)
    statusBarManager.startPolling(
        () => configManager.getCurrentModel(),
        availableModels,
        5000 // 5 second intervals
    );
}

/**
 * Register all extension commands
 */
function registerCommands(
    context: vscode.ExtensionContext,
    configManager: ClaudeConfigManager,
    settingsManager: SettingsManager,
    statusBarManager: StatusBarManager
): void {
    
    const switchModelCommand = new SwitchModelCommand(configManager, settingsManager, statusBarManager);
    const showCurrentCommand = new ShowCurrentModelCommand(configManager, settingsManager);
    const configureKeysCommand = new ConfigureApiKeysCommand(configManager, settingsManager);
    const configureModelsCommand = new ConfigureModelsCommand(settingsManager);

    context.subscriptions.push(
        vscode.commands.registerCommand('claudeModelSwitcher.switchModel', () => switchModelCommand.execute()),
        vscode.commands.registerCommand('claudeModelSwitcher.showCurrentModel', () => showCurrentCommand.execute()),
        vscode.commands.registerCommand('claudeModelSwitcher.configureApiKeys', () => configureKeysCommand.execute()),
        vscode.commands.registerCommand('claudeModelSwitcher.configureModels', () => configureModelsCommand.execute())
    );

    Logger.info('Commands registered successfully');
}

/**
 * Set up configuration change listener
 */
function setupConfigurationListener(
    settingsManager: SettingsManager,
    statusBarManager: StatusBarManager,
    configManager: ClaudeConfigManager
): vscode.Disposable {
    
    return settingsManager.onConfigurationChanged(async (e) => {
        Logger.debug('Configuration changed, updating extension');

        // Update debug mode
        if (e.affectsConfiguration('claudeModelSwitcher.debugMode')) {
            Logger.initialize(settingsManager.getDebugMode());
        }

        // Update status bar visibility
        if (e.affectsConfiguration('claudeModelSwitcher.showStatusBar')) {
            if (settingsManager.getShowStatusBar()) {
                try {
                    const currentModel = await configManager.getCurrentModel();
                    const availableModels = settingsManager.getAvailableModels();
                    statusBarManager.updateModel(currentModel, availableModels);
                    statusBarManager.show();
                } catch (error) {
                    Logger.error(`Failed to update status bar: ${ErrorHandler.extractMessage(error)}`);
                }
            } else {
                statusBarManager.hide();
            }
        }

        // Update available models
        if (e.affectsConfiguration('claudeModelSwitcher.availableModels')) {
            try {
                const currentModel = await configManager.getCurrentModel();
                const availableModels = settingsManager.getAvailableModels();
                statusBarManager.updateModel(currentModel, availableModels);
            } catch (error) {
                Logger.error(`Failed to update status bar with new models: ${ErrorHandler.extractMessage(error)}`);
            }
        }
    });
}

/**
 * Set up file watcher for real-time synchronization
 */
async function setupFileWatcher(
    context: vscode.ExtensionContext,
    configManager: ClaudeConfigManager,
    statusBarManager: StatusBarManager,
    settingsManager: SettingsManager
): Promise<void> {
    try {
        const fileWatcher = await configManager.watchConfigFile((newModel) => {
            Logger.debug(`File watcher detected model change: ${newModel}`);
            
            if (settingsManager.getShowStatusBar()) {
                const availableModels = settingsManager.getAvailableModels();
                statusBarManager.updateModel(newModel, availableModels);
                
                // Stop polling since file watcher is working
                statusBarManager.stopPolling();
            }
        });

        context.subscriptions.push(fileWatcher);
        Logger.info('File watcher set up successfully');

    } catch (error) {
        Logger.warn(`Failed to set up file watcher: ${ErrorHandler.extractMessage(error)}`);
        Logger.info('Continuing with polling fallback');
    }
}

/**
 * Handle startup auto-switch if enabled
 */
async function handleStartupAutoSwitch(
    configManager: ClaudeConfigManager,
    settingsManager: SettingsManager,
    statusBarManager: StatusBarManager
): Promise<void> {
    // Note: Auto-switch on startup is not implemented in current settings
    // This is a placeholder for future enhancement
    // 
    // if (settingsManager.getAutoSwitchOnStartup()) {
    //     const defaultModel = settingsManager.getDefaultModel();
    //     try {
    //         await configManager.switchModel(/* model config */);
    //         Logger.info(`Auto-switched to model: ${defaultModel}`);
    //     } catch (error) {
    //         Logger.error(`Auto-switch failed: ${ErrorHandler.extractMessage(error)}`);
    //     }
    // }
}
```

## Phase 8: Build and Debug Configuration

### 8.1 Debug Configuration (.vscode/launch.json)
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch Extension",
            "type": "extensionHost",
            "request": "launch",
            "runtimeExecutable": "${execPath}",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/out/**/*.js"
            ],
            "preLaunchTask": "${workspaceFolder}:npm: compile"
        },
        {
            "name": "Launch Extension (Debug Mode)",
            "type": "extensionHost",
            "request": "launch",
            "runtimeExecutable": "${execPath}",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}",
                "--verbose"
            ],
            "outFiles": [
                "${workspaceFolder}/out/**/*.js"
            ],
            "preLaunchTask": "${workspaceFolder}:npm: compile",
            "env": {
                "VSCODE_EXTENSION_DEBUG": "true"
            }
        }
    ]
}
```

### 8.2 Build Tasks (.vscode/tasks.json)
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "npm",
            "script": "compile",
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "presentation": {
                "panel": "shared",
                "clear": true
            },
            "problemMatcher": "$tsc"
        },
        {
            "type": "npm",
            "script": "watch",
            "group": "build",
            "presentation": {
                "panel": "shared",
                "clear": true
            },
            "problemMatcher": "$tsc-watch",
            "isBackground": true
        },
        {
            "type": "npm",
            "script": "lint",
            "group": "test",
            "presentation": {
                "panel": "shared",
                "clear": true
            }
        }
    ]
}
```

### 8.3 ESLint Configuration (.eslintrc.json)
```json
{
    "extends": [
        "eslint:recommended",
        "@typescript-eslint/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "plugins": ["@typescript-eslint"],
    "rules": {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/prefer-const": "error",
        "no-console": "warn",
        "prefer-const": "error",
        "no-var": "error"
    },
    "env": {
        "node": true,
        "es6": true
    },
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module"
    }
}
```

## Implementation Roadmap

### Step 1: Set up project structure and basic configuration
- Create package.json and tsconfig.json
- Set up build pipeline and debugging
- Implement basic logging and error handling

### Step 2: Implement core utilities
- PathUtils for cross-platform file handling
- SecurityUtils for validation and whitelisting
- PermissionUtils for secure file operations

### Step 3: Build configuration management
- SettingsManager for VSCode configuration
- ClaudeConfigManager for Claude settings file manipulation
- ModelValidator for input validation

### Step 4: Create user interface
- StatusBarManager with multi-strategy initialization
- NotificationHelper for user interactions
- Command implementations

### Step 5: Extension lifecycle
- Main extension.ts with robust activation
- File watcher setup with polling fallback
- Configuration change handling

### Step 6: Testing and refinement
- Test on all platforms (Windows, macOS, Linux)
- Test with different Claude Code configurations
- Verify status bar synchronization in various scenarios

## Z.ai Integration Details

Based on the Z.ai documentation, here are the specific integration requirements:

### Environment Variables for Z.ai GLM Models
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-z-ai-api-key",
    "ANTHROPIC_MODEL": "glm-4.5"
  }
}
```

### Supported GLM Models
- **glm-4.5**: Primary model for complex reasoning (355B parameters)
- **glm-4.5-air**: Lightweight model for faster operations (106B parameters)

### API Key Management
- Users must obtain API keys from Z.ai dashboard
- Keys are stored securely using VSCode's SecretStorage
- Extension validates key format before storage

## Security Considerations

1. **API Key Storage**: Uses VSCode's secure storage exclusively
2. **Endpoint Validation**: Strict whitelist of allowed endpoints
3. **Input Sanitization**: All user inputs validated and sanitized
4. **File Permissions**: Secure file permissions on all platforms
5. **Error Sanitization**: Sensitive information stripped from logs

## Platform Compatibility

- **Windows**: Native and WSL support
- **macOS**: Full native support
- **Linux**: Native support including various distributions

The extension handles cross-platform differences in file paths, permissions, and file watching automatically.

## Build Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Lint code
npm run lint

# Package extension
npm run package
```

## Development Workflow

1. **Setup**: Run `npm install` to install dependencies
2. **Development**: Use `npm run watch` for continuous compilation
3. **Debugging**: Press F5 in VSCode to launch extension host
4. **Testing**: Test commands through Command Palette
5. **Packaging**: Use `npm run package` to create .vsix file

This harmonized implementation guide provides a robust foundation for building the Claude Code Model Switcher extension with the primary focus on reliable status bar synchronization and seamless model switching across platforms.