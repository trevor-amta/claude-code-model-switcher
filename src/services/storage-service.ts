import * as vscode from 'vscode';
import { ExtensionState, ApiKeyConfig, UserPreferences, STORAGE_KEYS } from '../types/claude-settings';
// import { ModelConfig } from '../types/model-config'; // Unused
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security-utils';

export interface SecureStorage {
  store(key: string, value: string): Promise<void>;
  retrieve(key: string): Promise<string | undefined>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface StorageOptions {
  encrypted?: boolean;
  scope?: 'global' | 'workspace';
  sensitive?: boolean;
}

export class StorageService {
  private static instance: StorageService;
  private readonly logger: Logger;
  private readonly context: vscode.ExtensionContext;
  private readonly globalState: vscode.Memento;
  private readonly workspaceState: vscode.Memento;
  private readonly secretStorage: vscode.SecretStorage;

  private constructor(context: vscode.ExtensionContext) {
    this.logger = new Logger('StorageService');
    this.context = context;
    this.globalState = context.globalState;
    this.workspaceState = context.workspaceState;
    this.secretStorage = context.secrets;
  }

  public static initialize(context: vscode.ExtensionContext): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(context);
    }
    return StorageService.instance;
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      throw new Error('StorageService not initialized. Call initialize() first.');
    }
    return StorageService.instance;
  }

  public getContext(): vscode.ExtensionContext {
    return this.context;
  }

  public async storeApiKeys(apiKeys: ApiKeyConfig, options: StorageOptions = {}): Promise<void> {
    try {
      const encrypted = options.encrypted !== false;
      const scope = options.scope || 'global';
      
      if (options.sensitive !== false) {
        await this.storeInSecretStorage('apiKeys', apiKeys);
        this.logger.info('API keys stored in secure storage');
        return;
      }

      const data = encrypted ? await SecurityUtils.encryptApiKeys(apiKeys) : apiKeys;
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      
      await storage.update(STORAGE_KEYS.USER_PREFERENCES, data);
      this.logger.info(`API keys stored in ${scope} storage (encrypted: ${encrypted})`);
    } catch (error) {
      this.logger.error('Failed to store API keys', error);
      throw new Error(`Failed to store API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveApiKeys(options: StorageOptions = {}): Promise<ApiKeyConfig | undefined> {
    try {
      if (options.sensitive !== false) {
        return await this.retrieveFromSecretStorage<ApiKeyConfig>('apiKeys');
      }

      const encrypted = options.encrypted !== false;
      const scope = options.scope || 'global';
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      
      const data = storage.get<ApiKeyConfig>(STORAGE_KEYS.USER_PREFERENCES);
      if (!data) {
        return undefined;
      }

      return encrypted ? await SecurityUtils.decryptApiKeys(data) : data;
    } catch (error) {
      this.logger.error('Failed to retrieve API keys', error);
      return undefined;
    }
  }

  public async removeApiKeys(options: StorageOptions = {}): Promise<void> {
    try {
      if (options.sensitive !== false) {
        await this.removeFromSecretStorage('apiKeys');
      }

      const scope = options.scope || 'global';
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      await storage.update(STORAGE_KEYS.USER_PREFERENCES, undefined);
      
      this.logger.info('API keys removed');
    } catch (error) {
      this.logger.error('Failed to remove API keys', error);
      throw new Error(`Failed to remove API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async storeExtensionState(state: ExtensionState, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      await storage.update(STORAGE_KEYS.EXTENSION_STATE, state);
      this.logger.debug(`Extension state stored in ${scope} storage`);
    } catch (error) {
      this.logger.error('Failed to store extension state', error);
      throw new Error(`Failed to store extension state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveExtensionState(scope: 'global' | 'workspace' = 'global'): Promise<ExtensionState | undefined> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      return storage.get<ExtensionState>(STORAGE_KEYS.EXTENSION_STATE);
    } catch (error) {
      this.logger.error('Failed to retrieve extension state', error);
      return undefined;
    }
  }

  public async storeCurrentModel(modelName: string, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      await storage.update(STORAGE_KEYS.CURRENT_MODEL, modelName);
      this.logger.debug(`Current model '${modelName}' stored in ${scope} storage`);
    } catch (error) {
      this.logger.error('Failed to store current model', error);
      throw new Error(`Failed to store current model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveCurrentModel(scope: 'global' | 'workspace' = 'global'): Promise<string | undefined> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      return storage.get<string>(STORAGE_KEYS.CURRENT_MODEL);
    } catch (error) {
      this.logger.error('Failed to retrieve current model', error);
      return undefined;
    }
  }

  public async storeLastSwitchTime(timestamp: number, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      await storage.update(STORAGE_KEYS.LAST_SWITCH_TIME, timestamp);
      this.logger.debug(`Last switch time stored in ${scope} storage`);
    } catch (error) {
      this.logger.error('Failed to store last switch time', error);
      throw new Error(`Failed to store last switch time: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveLastSwitchTime(scope: 'global' | 'workspace' = 'global'): Promise<number | undefined> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      return storage.get<number>(STORAGE_KEYS.LAST_SWITCH_TIME);
    } catch (error) {
      this.logger.error('Failed to retrieve last switch time', error);
      return undefined;
    }
  }

  public async storeSwitchCount(count: number, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      await storage.update(STORAGE_KEYS.SWITCH_COUNT, count);
      this.logger.debug(`Switch count stored in ${scope} storage`);
    } catch (error) {
      this.logger.error('Failed to store switch count', error);
      throw new Error(`Failed to store switch count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveSwitchCount(scope: 'global' | 'workspace' = 'global'): Promise<number> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      return storage.get<number>(STORAGE_KEYS.SWITCH_COUNT, 0);
    } catch (error) {
      this.logger.error('Failed to retrieve switch count', error);
      return 0;
    }
  }

  public async incrementSwitchCount(scope: 'global' | 'workspace' = 'global'): Promise<number> {
    try {
      const currentCount = await this.retrieveSwitchCount(scope);
      const newCount = currentCount + 1;
      await this.storeSwitchCount(newCount, scope);
      return newCount;
    } catch (error) {
      this.logger.error('Failed to increment switch count', error);
      throw new Error(`Failed to increment switch count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async storeUserPreferences(preferences: UserPreferences, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      await storage.update(STORAGE_KEYS.USER_PREFERENCES, preferences);
      this.logger.debug(`User preferences stored in ${scope} storage`);
    } catch (error) {
      this.logger.error('Failed to store user preferences', error);
      throw new Error(`Failed to store user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveUserPreferences(scope: 'global' | 'workspace' = 'global'): Promise<UserPreferences> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      return storage.get<UserPreferences>(STORAGE_KEYS.USER_PREFERENCES, {});
    } catch (error) {
      this.logger.error('Failed to retrieve user preferences', error);
      return {};
    }
  }

  public async storeFavoriteModels(models: string[], scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const preferences = await this.retrieveUserPreferences(scope);
      preferences.favoriteModels = models;
      await this.storeUserPreferences(preferences, scope);
      this.logger.info(`Stored ${models.length} favorite models`);
    } catch (error) {
      this.logger.error('Failed to store favorite models', error);
      throw new Error(`Failed to store favorite models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async retrieveFavoriteModels(scope: 'global' | 'workspace' = 'global'): Promise<string[]> {
    try {
      const preferences = await this.retrieveUserPreferences(scope);
      return preferences.favoriteModels || [];
    } catch (error) {
      this.logger.error('Failed to retrieve favorite models', error);
      return [];
    }
  }

  public async addFavoriteModel(modelName: string, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const favorites = await this.retrieveFavoriteModels(scope);
      if (!favorites.includes(modelName)) {
        favorites.push(modelName);
        await this.storeFavoriteModels(favorites, scope);
        this.logger.info(`Added '${modelName}' to favorites`);
      }
    } catch (error) {
      this.logger.error(`Failed to add '${modelName}' to favorites`, error);
      throw new Error(`Failed to add favorite model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async removeFavoriteModel(modelName: string, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const favorites = await this.retrieveFavoriteModels(scope);
      const filtered = favorites.filter(name => name !== modelName);
      await this.storeFavoriteModels(filtered, scope);
      this.logger.info(`Removed '${modelName}' from favorites`);
    } catch (error) {
      this.logger.error(`Failed to remove '${modelName}' from favorites`, error);
      throw new Error(`Failed to remove favorite model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async clearStorage(scope?: 'global' | 'workspace'): Promise<void> {
    try {
      const clearGlobal = !scope || scope === 'global';
      const clearWorkspace = !scope || scope === 'workspace';

      if (clearGlobal) {
        const globalKeys = this.globalState.keys();
        for (const key of globalKeys) {
          if (key.startsWith('claude.')) {
            await this.globalState.update(key, undefined);
          }
        }
        this.logger.info('Global storage cleared');
      }

      if (clearWorkspace) {
        const workspaceKeys = this.workspaceState.keys();
        for (const key of workspaceKeys) {
          if (key.startsWith('claude.')) {
            await this.workspaceState.update(key, undefined);
          }
        }
        this.logger.info('Workspace storage cleared');
      }

      await this.removeFromSecretStorage('apiKeys');
      this.logger.info('Secret storage cleared');
    } catch (error) {
      this.logger.error('Failed to clear storage', error);
      throw new Error(`Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async exportData(scope: 'global' | 'workspace' = 'global'): Promise<Record<string, any>> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      const data: Record<string, any> = {};

      for (const key of storage.keys()) {
        if (key.startsWith('claude.')) {
          data[key] = storage.get(key);
        }
      }

      this.logger.info(`Exported ${Object.keys(data).length} items from ${scope} storage`);
      return data;
    } catch (error) {
      this.logger.error('Failed to export data', error);
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async importData(data: Record<string, any>, scope: 'global' | 'workspace' = 'global'): Promise<void> {
    try {
      const storage = scope === 'global' ? this.globalState : this.workspaceState;
      
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('claude.')) {
          await storage.update(key, value);
        }
      }

      this.logger.info(`Imported ${Object.keys(data).length} items to ${scope} storage`);
    } catch (error) {
      this.logger.error('Failed to import data', error);
      throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getStorageSize(scope?: 'global' | 'workspace'): Promise<{ global: number; workspace: number; total: number }> {
    try {
      let globalSize = 0;
      let workspaceSize = 0;

      if (!scope || scope === 'global') {
        for (const key of this.globalState.keys()) {
          if (key.startsWith('claude.')) {
            const value = this.globalState.get(key);
            globalSize += JSON.stringify(value).length;
          }
        }
      }

      if (!scope || scope === 'workspace') {
        for (const key of this.workspaceState.keys()) {
          if (key.startsWith('claude.')) {
            const value = this.workspaceState.get(key);
            workspaceSize += JSON.stringify(value).length;
          }
        }
      }

      return {
        global: globalSize,
        workspace: workspaceSize,
        total: globalSize + workspaceSize
      };
    } catch (error) {
      this.logger.error('Failed to get storage size', error);
      return { global: 0, workspace: 0, total: 0 };
    }
  }

  private async storeInSecretStorage<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.secretStorage.store(`claude.${key}`, serialized);
      this.logger.debug(`Stored secret: claude.${key}`);
    } catch (error) {
      this.logger.error(`Failed to store secret: claude.${key}`, error);
      throw error;
    }
  }

  private async retrieveFromSecretStorage<T>(key: string): Promise<T | undefined> {
    try {
      const serialized = await this.secretStorage.get(`claude.${key}`);
      if (!serialized) {
        return undefined;
      }
      return JSON.parse(serialized) as T;
    } catch (error) {
      this.logger.error(`Failed to retrieve secret: claude.${key}`, error);
      return undefined;
    }
  }

  private async removeFromSecretStorage(key: string): Promise<void> {
    try {
      await this.secretStorage.delete(`claude.${key}`);
      this.logger.debug(`Removed secret: claude.${key}`);
    } catch (error) {
      this.logger.error(`Failed to remove secret: claude.${key}`, error);
      throw error;
    }
  }

  public dispose(): void {
    this.logger.info('StorageService disposed');
  }
}