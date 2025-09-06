import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeCodeConfig } from '../types/claude-settings';
import { ModelConfig } from '../types/model-config';
import { Logger } from '../utils/logger';
import { PathUtils } from '../utils/path-utils';
import { PermissionUtils } from '../utils/permission-utils';
import { SecurityUtils } from '../utils/security-utils';

export class ClaudeService {
  private static instance: ClaudeService;
  private readonly logger: Logger;
  private claudeConfigPaths: string[] = [];

  private constructor() {
    this.logger = new Logger('ClaudeService');
    this.initializeClaudeConfigPaths();
  }

  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  private initializeClaudeConfigPaths(): void {
    try {
      const homedir = require('os').homedir();
      const platform = process.platform;

      const commonPaths: string[] = [
        path.join(homedir, '.claude', 'config.json'),
        path.join(homedir, '.config', 'claude', 'config.json')
      ];

      if (platform === 'darwin') {
        commonPaths.push(
          path.join(homedir, 'Library', 'Application Support', 'Claude', 'config.json'),
          path.join(homedir, 'Library', 'Preferences', 'claude-config.json')
        );
      } else if (platform === 'win32') {
        const appData = process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming');
        commonPaths.push(
          path.join(appData, 'Claude', 'config.json'),
          path.join(appData, 'claude-config.json')
        );
      } else {
        commonPaths.push(
          path.join(homedir, '.local', 'share', 'claude', 'config.json'),
          path.join(homedir, '.claude-config.json')
        );
      }

      if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
          commonPaths.push(
            path.join(folder.uri.fsPath, '.claude', 'config.json'),
            path.join(folder.uri.fsPath, '.vscode', 'claude-config.json'),
            path.join(folder.uri.fsPath, 'claude-config.json')
          );
        }
      }

      this.claudeConfigPaths = commonPaths;
      this.logger.debug(`Initialized ${commonPaths.length} Claude config paths`);
    } catch (error) {
      this.logger.error('Failed to initialize Claude config paths', error);
      this.claudeConfigPaths = [];
    }
  }

  public async detectClaudeConfig(): Promise<string | null> {
    try {
      for (const configPath of this.claudeConfigPaths) {
        if (await PathUtils.fileExists(configPath)) {
          const hasReadPermission = await PermissionUtils.hasReadPermission(configPath);
          if (hasReadPermission) {
            this.logger.info(`Found Claude config at: ${configPath}`);
            return configPath;
          } else {
            this.logger.warn(`Found Claude config but no read permission: ${configPath}`);
          }
        }
      }

      this.logger.info('No accessible Claude config found');
      return null;
    } catch (error) {
      this.logger.error('Error detecting Claude config', error);
      return null;
    }
  }

  public async readClaudeConfig(configPath?: string): Promise<ClaudeCodeConfig | null> {
    try {
      const targetPath = configPath || await this.detectClaudeConfig();
      if (!targetPath) {
        this.logger.warn('No Claude config path available');
        return null;
      }

      if (!await PathUtils.fileExists(targetPath)) {
        this.logger.warn(`Claude config file does not exist: ${targetPath}`);
        return null;
      }

      if (!await PermissionUtils.hasReadPermission(targetPath)) {
        this.logger.error(`No read permission for Claude config: ${targetPath}`);
        throw new Error(`Permission denied reading Claude config: ${targetPath}`);
      }

      const configContent = await fs.promises.readFile(targetPath, 'utf8');
      const config = JSON.parse(configContent) as ClaudeCodeConfig;

      this.logger.debug('Successfully read Claude config');
      return await this.validateAndSanitizeConfig(config);
    } catch (error) {
      this.logger.error('Failed to read Claude config', error);
      if (error instanceof SyntaxError) {
        throw new Error('Claude config file is not valid JSON');
      }
      throw new Error(`Failed to read Claude config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async writeClaudeConfig(config: ClaudeCodeConfig, configPath?: string): Promise<string> {
    try {
      const targetPath = configPath || await this.detectClaudeConfig() || this.getDefaultConfigPath();
      
      const sanitizedConfig = await this.validateAndSanitizeConfig(config);
      
      const configDir = path.dirname(targetPath);
      if (!await PathUtils.directoryExists(configDir)) {
        await PathUtils.ensureDirectory(configDir);
      }

      if (await PathUtils.fileExists(targetPath)) {
        if (!await PermissionUtils.hasWritePermission(targetPath)) {
          throw new Error(`No write permission for Claude config: ${targetPath}`);
        }

        const backup = await this.createConfigBackup(targetPath);
        this.logger.info(`Created backup at: ${backup}`);
      }

      const configContent = JSON.stringify(sanitizedConfig, null, 2);
      await fs.promises.writeFile(targetPath, configContent, 'utf8');

      this.logger.info(`Claude config written to: ${targetPath}`);
      return targetPath;
    } catch (error) {
      this.logger.error('Failed to write Claude config', error);
      throw new Error(`Failed to write Claude config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async updateModelInConfig(model: ModelConfig, configPath?: string): Promise<string> {
    try {
      const currentConfig = await this.readClaudeConfig(configPath) || {};
      
      const updatedConfig: ClaudeCodeConfig = {
        ...currentConfig,
        modelId: model.name,
        endpoint: model.endpoint
      };

      if (model.type === 'api' && model.provider) {
        const apiKey = await this.getApiKeyForProvider(model.provider);
        if (apiKey) {
          updatedConfig.apiKey = apiKey;
        }
      }

      return await this.writeClaudeConfig(updatedConfig, configPath);
    } catch (error) {
      this.logger.error('Failed to update model in Claude config', error);
      throw new Error(`Failed to update Claude config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getCurrentModel(configPath?: string): Promise<string | null> {
    try {
      const config = await this.readClaudeConfig(configPath);
      return config?.modelId || null;
    } catch (error) {
      this.logger.error('Failed to get current model from Claude config', error);
      return null;
    }
  }

  public async testConnection(config: ClaudeCodeConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (!config.endpoint) {
        return { success: false, error: 'No endpoint configured' };
      }

      const timeout = config.timeout || 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Claude-Code-Model-Switcher/0.9.0',
          ...config.customHeaders
        };

        if (config.apiKey) {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(`${config.endpoint}/health`, {
          method: 'GET',
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        if (response.ok) {
          this.logger.debug('Connection test successful');
          return { success: true };
        } else {
          return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return { success: false, error: 'Connection timeout' };
          }
          return { success: false, error: error.message };
        }
        return { success: false, error: 'Unknown connection error' };
      }
    } catch (error) {
      this.logger.error('Connection test failed', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  public async createConfigBackup(configPath: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${configPath}.backup.${timestamp}`;
      
      await fs.promises.copyFile(configPath, backupPath);
      this.logger.info(`Created config backup: ${backupPath}`);
      return backupPath;
    } catch (error) {
      this.logger.error('Failed to create config backup', error);
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async restoreConfigBackup(backupPath: string, targetPath?: string): Promise<void> {
    try {
      const target = targetPath || await this.detectClaudeConfig();
      if (!target) {
        throw new Error('No target config path available');
      }

      if (!await PathUtils.fileExists(backupPath)) {
        throw new Error(`Backup file does not exist: ${backupPath}`);
      }

      await fs.promises.copyFile(backupPath, target);
      this.logger.info(`Restored config from backup: ${backupPath} -> ${target}`);
    } catch (error) {
      this.logger.error('Failed to restore config backup', error);
      throw new Error(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async listConfigBackups(configPath?: string): Promise<string[]> {
    try {
      const targetPath = configPath || await this.detectClaudeConfig();
      if (!targetPath) {
        return [];
      }

      const configDir = path.dirname(targetPath);
      const configName = path.basename(targetPath);
      
      if (!await PathUtils.directoryExists(configDir)) {
        return [];
      }

      const files = await fs.promises.readdir(configDir);
      const backups = files.filter(file => 
        file.startsWith(`${configName}.backup.`) && file.endsWith('.json')
      );

      return backups.map(backup => path.join(configDir, backup)).sort().reverse();
    } catch (error) {
      this.logger.error('Failed to list config backups', error);
      return [];
    }
  }

  private async validateAndSanitizeConfig(config: ClaudeCodeConfig): Promise<ClaudeCodeConfig> {
    const sanitized: ClaudeCodeConfig = {};

    if (config.modelId && typeof config.modelId === 'string') {
      sanitized.modelId = config.modelId.trim();
    }

    if (config.endpoint && typeof config.endpoint === 'string') {
      try {
        new URL(config.endpoint);
        sanitized.endpoint = config.endpoint.trim();
      } catch {
        this.logger.warn(`Invalid endpoint URL: ${config.endpoint}`);
      }
    }

    if (config.apiKey && typeof config.apiKey === 'string') {
      if (SecurityUtils.isValidApiKey(config.apiKey)) {
        sanitized.apiKey = config.apiKey.trim();
      } else {
        this.logger.warn('Invalid API key format detected');
      }
    }

    if (config.customHeaders && typeof config.customHeaders === 'object') {
      sanitized.customHeaders = {};
      for (const [key, value] of Object.entries(config.customHeaders)) {
        if (typeof key === 'string' && typeof value === 'string') {
          sanitized.customHeaders[key.trim()] = value.trim();
        }
      }
    }

    if (config.timeout && typeof config.timeout === 'number' && config.timeout > 0) {
      sanitized.timeout = Math.min(config.timeout, 60000);
    }

    if (config.retries && typeof config.retries === 'number' && config.retries >= 0) {
      sanitized.retries = Math.min(config.retries, 10);
    }

    return sanitized;
  }

  private async getApiKeyForProvider(provider: string): Promise<string | null> {
    try {
      // Special handling for z.ai - they use environment variables instead of stored keys
      if (provider === 'z-ai') {
        // Check if ANTHROPIC_AUTH_TOKEN environment variable is set (z.ai's approach)
        const envToken = process.env.ANTHROPIC_AUTH_TOKEN;
        if (envToken) {
          return envToken;
        }
        // Fall back to checking stored API key
        const ConfigService = (await import('./config-service')).ConfigService;
        const configService = ConfigService.getInstance();
        const apiKeys = await configService.getApiKeys();
        return apiKeys?.zai || null;
      }

      const ConfigService = (await import('./config-service')).ConfigService;
      const configService = ConfigService.getInstance();
      const apiKeys = await configService.getApiKeys();
      
      if (!apiKeys) {
        return null;
      }

      switch (provider) {
        case 'anthropic':
          return apiKeys.anthropic || null;
        default:
          return apiKeys.custom?.[provider] || null;
      }
    } catch (error) {
      this.logger.error(`Failed to get API key for provider ${provider}`, error);
      return null;
    }
  }

  private getDefaultConfigPath(): string {
    const homedir = require('os').homedir();
    return path.join(homedir, '.claude', 'config.json');
  }

  public async refreshConfigPaths(): Promise<void> {
    this.initializeClaudeConfigPaths();
  }

  public getConfigPaths(): string[] {
    return [...this.claudeConfigPaths];
  }

  public dispose(): void {
    this.logger.info('ClaudeService disposed');
  }
}