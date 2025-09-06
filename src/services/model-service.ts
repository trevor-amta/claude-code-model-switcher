import * as vscode from 'vscode';
import { ModelConfig, ModelSwitchResult, ModelValidationResult, ModelSwitchOptions, ValidationOptions } from '../types/model-config';
import { ClaudeCodeConfig } from '../types/claude-settings';
import { Logger } from '../utils/logger';
import { ConfigService } from './config-service';
import { ClaudeService } from './claude-service';
import { PROVIDER_METADATA } from '../types/provider-config';

export class ModelService {
  private static instance: ModelService;
  private readonly logger: Logger;
  private readonly configService: ConfigService;
  private readonly claudeService: ClaudeService;

  private constructor() {
    this.logger = new Logger('ModelService');
    this.configService = ConfigService.getInstance();
    this.claudeService = ClaudeService.getInstance();
  }

  public static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  public async validateModel(
    modelName: string, 
    options: ValidationOptions = {}
  ): Promise<ModelValidationResult> {
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      const availableModels = await this.configService.getAvailableModels();
      const model = availableModels.find(m => m.name === modelName);

      if (!model) {
        issues.push(`Model '${modelName}' not found in available models`);
        return {
          isValid: false,
          model: { name: modelName, displayName: modelName, description: '', endpoint: '', type: 'web' },
          issues,
          warnings
        };
      }

      if (!model.endpoint || !this.isValidUrl(model.endpoint)) {
        issues.push(`Invalid endpoint URL: ${model.endpoint}`);
      }

      if (!model.displayName?.trim()) {
        warnings.push('Model has no display name');
      }

      if (!model.description?.trim()) {
        warnings.push('Model has no description');
      }

      if (model.type === 'api') {
        if (options.checkApiKey !== false) {
          const hasApiKey = await this.checkApiKeyForModel(model);
          if (!hasApiKey) {
            issues.push(`API key required for model '${modelName}' but not configured`);
          }
        }
      }

      if (options.checkEndpoint !== false && model.endpoint) {
        try {
          const url = new URL(model.endpoint);
          if (!['http:', 'https:'].includes(url.protocol)) {
            issues.push(`Unsupported endpoint protocol: ${url.protocol}`);
          }
        } catch (error) {
          issues.push(`Invalid endpoint format: ${model.endpoint}`);
        }
      }

      if (options.testConnection === true) {
        const connectionResult = await this.testModelConnection(model, options.timeout);
        if (!connectionResult.success) {
          warnings.push(`Connection test failed: ${connectionResult.error || 'Unknown error'}`);
        }
      }

      if (model.capabilities) {
        if (model.capabilities.maxTokens && model.capabilities.maxTokens <= 0) {
          warnings.push('Invalid maxTokens value');
        }
        if (model.capabilities.contextWindow && model.capabilities.contextWindow <= 0) {
          warnings.push('Invalid contextWindow value');
        }
      }

      this.logger.debug(`Model validation for '${modelName}' completed`, {
        issues: issues.length,
        warnings: warnings.length
      });

      return {
        isValid: issues.length === 0,
        model,
        issues,
        warnings
      };

    } catch (error) {
      this.logger.error(`Model validation failed for '${modelName}'`, error);
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        isValid: false,
        model: { name: modelName, displayName: modelName, description: '', endpoint: '', type: 'web' },
        issues,
        warnings
      };
    }
  }

  public async switchModel(
    modelName: string, 
    options: ModelSwitchOptions = {}
  ): Promise<ModelSwitchResult> {
    try {
      this.logger.info(`Starting model switch to: ${modelName}`);

      const currentModel = await this.getCurrentModel();
      if (currentModel === modelName && !options.force) {
        return {
          success: true,
          previousModel: currentModel,
          newModel: modelName,
          requiresReload: false,
          message: 'Model is already active'
        };
      }

      if (!options.skipValidation) {
        const validation = await this.validateModel(modelName, {
          checkApiKey: true,
          checkEndpoint: true,
          testConnection: false,
          timeout: 5000
        });

        if (!validation.isValid) {
          return {
            success: false,
            previousModel: currentModel || 'unknown',
            newModel: modelName,
            requiresReload: false,
            error: `Model validation failed: ${validation.issues.join(', ')}`
          };
        }
      }

      const availableModels = await this.configService.getAvailableModels();
      const targetModel = availableModels.find(m => m.name === modelName);
      
      if (!targetModel) {
        return {
          success: false,
          previousModel: currentModel || 'unknown',
          newModel: modelName,
          requiresReload: false,
          error: `Model '${modelName}' not found in available models`
        };
      }

      await this.configService.setDefaultModel(modelName);

      try {
        await this.claudeService.updateModelInConfig(targetModel);
        this.logger.info('Updated Claude Code configuration');
      } catch (error) {
        this.logger.warn('Failed to update Claude Code configuration', error);
      }

      const reloadBehavior = await this.configService.getReloadBehavior();
      const requiresReload = !options.skipReload && this.shouldReloadWindow(currentModel, modelName);

      if (requiresReload && reloadBehavior !== 'skip') {
        if (reloadBehavior === 'auto') {
          setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }, 1000);
        }
      }

      const result: ModelSwitchResult = {
        success: true,
        previousModel: currentModel || 'unknown',
        newModel: modelName,
        requiresReload,
        message: `Successfully switched to ${targetModel.displayName}`
      };

      this.logger.info(`Model switch completed successfully`, result);
      return result;

    } catch (error) {
      this.logger.error(`Model switch failed for '${modelName}'`, error);
      return {
        success: false,
        previousModel: await this.getCurrentModel() || 'unknown',
        newModel: modelName,
        requiresReload: false,
        error: `Switch failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  public async getCurrentModel(): Promise<string | null> {
    try {
      let currentModel = await this.configService.getDefaultModel();
      
      try {
        const claudeModel = await this.claudeService.getCurrentModel();
        if (claudeModel && claudeModel !== currentModel) {
          this.logger.debug(`Claude config model differs from VS Code setting: ${claudeModel} vs ${currentModel}`);
          currentModel = claudeModel;
        }
      } catch (error) {
        this.logger.debug('Could not read Claude config, using VS Code setting', error);
      }

      return currentModel;
    } catch (error) {
      this.logger.error('Failed to get current model', error);
      return null;
    }
  }

  public async getAvailableModels(): Promise<ModelConfig[]> {
    try {
      return await this.configService.getAvailableModels();
    } catch (error) {
      this.logger.error('Failed to get available models', error);
      return [];
    }
  }

  public async getModelByName(modelName: string): Promise<ModelConfig | null> {
    try {
      const availableModels = await this.getAvailableModels();
      return availableModels.find(m => m.name === modelName) || null;
    } catch (error) {
      this.logger.error(`Failed to get model '${modelName}'`, error);
      return null;
    }
  }

  public async addModel(model: ModelConfig): Promise<void> {
    try {
      const validation = await this.validateModel(model.name, { checkApiKey: false });
      if (!validation.isValid) {
        throw new Error(`Invalid model configuration: ${validation.issues.join(', ')}`);
      }

      const availableModels = await this.getAvailableModels();
      const existingIndex = availableModels.findIndex(m => m.name === model.name);
      
      if (existingIndex >= 0) {
        availableModels[existingIndex] = model;
        this.logger.info(`Updated existing model: ${model.name}`);
      } else {
        availableModels.push(model);
        this.logger.info(`Added new model: ${model.name}`);
      }

      await this.configService.setAvailableModels(availableModels);
    } catch (error) {
      this.logger.error(`Failed to add model '${model.name}'`, error);
      throw new Error(`Failed to add model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async removeModel(modelName: string): Promise<void> {
    try {
      const availableModels = await this.getAvailableModels();
      const filteredModels = availableModels.filter(m => m.name !== modelName);
      
      if (filteredModels.length === availableModels.length) {
        throw new Error(`Model '${modelName}' not found`);
      }

      const currentModel = await this.getCurrentModel();
      if (currentModel === modelName) {
        if (filteredModels.length > 0) {
          await this.switchModel(filteredModels[0].name, { skipValidation: true });
          this.logger.info(`Switched to ${filteredModels[0].name} after removing current model`);
        }
      }

      await this.configService.setAvailableModels(filteredModels);
      this.logger.info(`Removed model: ${modelName}`);
    } catch (error) {
      this.logger.error(`Failed to remove model '${modelName}'`, error);
      throw new Error(`Failed to remove model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async testModelConnection(
    model: ModelConfig, 
    timeout: number = 10000
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config: ClaudeCodeConfig = {
        modelId: model.name,
        endpoint: model.endpoint,
        timeout
      };

      if (model.type === 'api') {
        const apiKey = await this.getApiKeyForModel(model);
        if (apiKey) {
          config.apiKey = apiKey;
        }
      }

      return await this.claudeService.testConnection(config);
    } catch (error) {
      this.logger.error(`Connection test failed for model '${model.name}'`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async validateAllModels(): Promise<Record<string, ModelValidationResult>> {
    const results: Record<string, ModelValidationResult> = {};
    
    try {
      const availableModels = await this.getAvailableModels();
      
      for (const model of availableModels) {
        results[model.name] = await this.validateModel(model.name, {
          checkApiKey: true,
          checkEndpoint: true,
          testConnection: false
        });
      }
    } catch (error) {
      this.logger.error('Failed to validate all models', error);
    }

    return results;
  }

  private async checkApiKeyForModel(model: ModelConfig): Promise<boolean> {
    if (model.type !== 'api' || !model.provider) {
      return true;
    }

    const provider = PROVIDER_METADATA[model.provider];
    if (!provider) {
      this.logger.warn(`Unknown provider: ${model.provider}`);
      return false;
    }

    // Use configuration strategy based on provider
    const strategy = this.configService.getConfigurationStrategy(model.provider);
    if (!strategy) {
      this.logger.warn(`No configuration strategy found for provider: ${model.provider}`);
      return false;
    }

    const status = await strategy.getConfigurationStatus();
    return status.isConfigured;
  }

  private async getApiKeyForModel(model: ModelConfig): Promise<string | null> {
    if (model.type !== 'api' || !model.provider) {
      return null;
    }

    const provider = PROVIDER_METADATA[model.provider];
    if (!provider) {
      this.logger.warn(`Unknown provider: ${model.provider}`);
      return null;
    }

    // Use configuration strategy based on provider
    const strategy = this.configService.getConfigurationStrategy(model.provider);
    if (!strategy) {
      this.logger.warn(`No configuration strategy found for provider: ${model.provider}`);
      return null;
    }

    const apiKey = await strategy.getApiKey(model.provider);
    return apiKey || null;
  }

  private shouldReloadWindow(previousModel: string | null, newModel: string): boolean {
    if (!previousModel) {
      return false;
    }

    if (previousModel === newModel) {
      return false;
    }

    return true;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  public async getQuickPickItems(): Promise<vscode.QuickPickItem[]> {
    try {
      const availableModels = await this.getAvailableModels();
      const currentModel = await this.getCurrentModel();

      return availableModels.map(model => ({
        label: model.displayName,
        description: model.name,
        detail: model.description,
        picked: model.name === currentModel
      }));
    } catch (error) {
      this.logger.error('Failed to create quick pick items', error);
      return [];
    }
  }

  public dispose(): void {
    this.logger.info('ModelService disposed');
  }
}