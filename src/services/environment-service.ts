import * as vscode from 'vscode';
import * as os from 'os';
import { Logger } from '../utils/logger';

export interface EnvironmentVariable {
  name: string;
  value: string;
  description?: string;
  required?: boolean;
  provider?: string;
}

export interface EnvironmentConfig {
  variables: EnvironmentVariable[];
  provider: string;
  description?: string;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  missingVariables: string[];
  invalidVariables: string[];
  warnings: string[];
  suggestions: string[];
}

export class EnvironmentService {
  private static instance: EnvironmentService;
  private readonly logger: Logger;
  private readonly context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.logger = new Logger('EnvironmentService');
    this.context = context;
  }

  public static getInstance(context?: vscode.ExtensionContext): EnvironmentService {
    if (!EnvironmentService.instance) {
      if (!context) {
        throw new Error('EnvironmentService requires ExtensionContext for initialization');
      }
      EnvironmentService.instance = new EnvironmentService(context);
    }
    return EnvironmentService.instance;
  }

  public async setEnvironmentVariables(config: EnvironmentConfig): Promise<void> {
    try {
      this.logger.info(`Setting environment variables for provider: ${config.provider}`);
      
      for (const variable of config.variables) {
        await this.setEnvironmentVariable(variable.name, variable.value);
      }
      
      this.logger.info(`Successfully set ${config.variables.length} environment variables`);
    } catch (error) {
      this.logger.error('Failed to set environment variables', error);
      throw new Error(`Failed to set environment variables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async setEnvironmentVariable(name: string, value: string): Promise<void> {
    try {
      this.logger.debug(`Setting environment variable: ${name}`);
      
      process.env[name] = value;
      
      this.logger.info(`Environment variable ${name} set successfully`);
    } catch (error) {
      this.logger.error(`Failed to set environment variable ${name}`, error);
      throw new Error(`Failed to set environment variable ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public getEnvironmentVariable(name: string): string | undefined {
    return process.env[name];
  }

  public getEnvironmentVariables(): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    const relevantVars = [
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_AUTH_TOKEN',
      'ANTHROPIC_MODEL',
      'ZAI_API_KEY',
      'OPENAI_API_KEY',
      'CLAUDE_API_KEY'
    ];

    for (const varName of relevantVars) {
      const value = process.env[varName];
      if (value) {
        envVars[varName] = value;
      }
    }

    return envVars;
  }

  public async validateEnvironmentVariables(config: EnvironmentConfig): Promise<EnvironmentValidationResult> {
    const result: EnvironmentValidationResult = {
      isValid: true,
      missingVariables: [],
      invalidVariables: [],
      warnings: [],
      suggestions: []
    };

    try {
      for (const variable of config.variables) {
        const currentValue = this.getEnvironmentVariable(variable.name);
        
        if (variable.required && !currentValue) {
          result.isValid = false;
          result.missingVariables.push(variable.name);
          result.suggestions.push(`Set environment variable: ${variable.name}`);
        }
        
        if (currentValue && this.isVariableValueInvalid(variable.name, currentValue)) {
          result.isValid = false;
          result.invalidVariables.push(variable.name);
        }
      }

      if (result.missingVariables.length > 0) {
        result.warnings.push(`Missing required environment variables: ${result.missingVariables.join(', ')}`);
      }

      if (result.invalidVariables.length > 0) {
        result.warnings.push(`Invalid environment variables: ${result.invalidVariables.join(', ')}`);
      }

    } catch (error) {
      this.logger.error('Failed to validate environment variables', error);
      result.isValid = false;
      result.warnings.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  public async setupZaiEnvironment(apiKey: string, baseUrl?: string): Promise<boolean> {
    try {
      const config: EnvironmentConfig = {
        provider: 'z-ai',
        description: 'Z.ai environment configuration',
        variables: [
          {
            name: 'ANTHROPIC_BASE_URL',
            value: baseUrl || 'https://api.z.ai/api/anthropic',
            description: 'Z.ai API endpoint for Anthropic compatibility',
            required: true,
            provider: 'z-ai'
          },
          {
            name: 'ANTHROPIC_AUTH_TOKEN',
            value: apiKey,
            description: 'Z.ai API key for authentication',
            required: true,
            provider: 'z-ai'
          }
        ]
      };

      await this.setEnvironmentVariables(config);
      await this.persistEnvironmentSetup(config);
      this.logger.info('Z.ai environment variables set successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to set up Z.ai environment variables', error);
      return false;
    }
  }

  public async clearZaiEnvironment(): Promise<boolean> {
    try {
      const variables = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'];
      
      for (const variable of variables) {
        delete process.env[variable];
      }
      
      this.logger.info('Cleared Z.ai environment variables');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear Z.ai environment variables', error);
      return false;
    }
  }

  public async getZaiEnvironmentStatus(): Promise<{
    isConfigured: boolean;
    authToken: boolean;
    baseUrl: boolean;
    platform: string;
    shell: string;
  }> {
    const authToken = !!this.getEnvironmentVariable('ANTHROPIC_AUTH_TOKEN');
    const baseUrl = !!this.getEnvironmentVariable('ANTHROPIC_BASE_URL');
    
    return {
      isConfigured: authToken && baseUrl,
      authToken,
      baseUrl,
      platform: process.platform,
      shell: process.env.SHELL || 'unknown'
    };
  }

  public async getEnvironmentSetupInstructions(provider: string): Promise<string> {
    switch (provider) {
      case 'z-ai':
        return this.getZaiSetupInstructions();
      default:
        return `No specific setup instructions available for provider: ${provider}`;
    }
  }

  public async checkEnvironmentSetup(): Promise<{ isSetup: boolean; provider?: string; issues: string[] }> {
    const issues: string[] = [];
    let isSetup = false;
    let provider: string | undefined;

    const zaiBaseUrl = this.getEnvironmentVariable('ANTHROPIC_BASE_URL');
    const zaiAuthToken = this.getEnvironmentVariable('ANTHROPIC_AUTH_TOKEN');

    if (zaiBaseUrl && zaiAuthToken) {
      if (zaiBaseUrl.includes('z.ai')) {
        isSetup = true;
        provider = 'z-ai';
        
        if (!zaiAuthToken.startsWith('zai-')) {
          issues.push('Z.ai auth token format appears invalid');
        }
      }
    }

    return { isSetup, provider, issues };
  }

  public async testEnvironmentSetup(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { isSetup, provider, issues } = await this.checkEnvironmentSetup();
      
      if (!isSetup) {
        return {
          success: false,
          message: 'No environment setup detected',
          details: { issues }
        };
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: `Environment setup has issues: ${issues.join(', ')}`,
          details: { provider, issues }
        };
      }

      return {
        success: true,
        message: `Environment setup verified for provider: ${provider}`,
        details: { provider }
      };
    } catch (error) {
      return {
        success: false,
        message: `Environment test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.stack : String(error) }
      };
    }
  }

  private async persistEnvironmentSetup(config: EnvironmentConfig): Promise<void> {
    try {
      const setupData = {
        provider: config.provider,
        timestamp: new Date().toISOString(),
        variables: config.variables.map(v => ({ name: v.name, description: v.description }))
      };

      await this.context.globalState.update('environmentSetup', setupData);
      this.logger.debug(`Environment setup persisted for provider: ${config.provider}`);
    } catch (error) {
      this.logger.warn('Failed to persist environment setup', error);
    }
  }

  private isVariableValueInvalid(name: string, value: string): boolean {
    switch (name) {
      case 'ANTHROPIC_BASE_URL':
        return !value.startsWith('http');
      case 'ANTHROPIC_AUTH_TOKEN':
        return value.length < 10;
      default:
        return false;
    }
  }

  private getZaiSetupInstructions(): string {
    const platform = os.platform();
    let instructions = '';

    if (platform === 'darwin') {
      instructions = `# Z.ai Environment Setup for macOS

## Option 1: Terminal Session (Temporary)
Add these lines to your terminal session:

export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="your-zai-api-key"

## Option 2: Shell Profile (Permanent)
Add to your ~/.zshrc or ~/.bashrc:

echo 'export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN="your-zai-api-key"' >> ~/.zshrc

Then restart your terminal or run: source ~/.zshrc

## Option 3: VS Code Settings (Recommended)
Use the extension's environment setup command to configure automatically.

## After Setup
- Restart VS Code to ensure environment variables are loaded
- Verify setup with the "Test Environment Setup" command
`;
    } else if (platform === 'win32') {
      instructions = `# Z.ai Environment Setup for Windows

## Option 1: Command Prompt (Temporary)
set ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
set ANTHROPIC_AUTH_TOKEN=your-zai-api-key

## Option 2: PowerShell (Temporary)
$env:ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
$env:ANTHROPIC_AUTH_TOKEN="your-zai-api-key"

## Option 3: System Environment Variables (Permanent)
1. Open System Properties > Environment Variables
2. Add new System variables:
   - ANTHROPIC_BASE_URL: https://api.z.ai/api/anthropic
   - ANTHROPIC_AUTH_TOKEN: your-zai-api-key
3. Restart VS Code

## Option 4: VS Code Settings (Recommended)
Use the extension's environment setup command to configure automatically.

## After Setup
- Restart VS Code to ensure environment variables are loaded
- Verify setup with the "Test Environment Setup" command
`;
    } else {
      instructions = `# Z.ai Environment Setup for Linux

## Option 1: Terminal Session (Temporary)
Add these lines to your terminal session:

export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="your-zai-api-key"

## Option 2: Shell Profile (Permanent)
Add to your ~/.bashrc or ~/.zshrc:

echo 'export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"' >> ~/.bashrc
echo 'export ANTHROPIC_AUTH_TOKEN="your-zai-api-key"' >> ~/.bashrc

Then restart your terminal or run: source ~/.bashrc

## Option 3: VS Code Settings (Recommended)
Use the extension's environment setup command to configure automatically.

## After Setup
- Restart VS Code to ensure environment variables are loaded
- Verify setup with the "Test Environment Setup" command
`;
    }

    return instructions;
  }

  public dispose(): void {
    this.logger.info('EnvironmentService disposed');
  }
}