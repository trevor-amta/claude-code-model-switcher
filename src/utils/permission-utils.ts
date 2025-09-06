import * as fs from 'fs';
import * as path from 'path';
// import * as os from 'os'; // Unused - preserved for future platform-specific logic
import { PathUtils } from './path-utils';
import { logger } from './logger';

export interface FilePermissions {
  readable: boolean;
  writable: boolean;
  executable: boolean;
  owner: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  group: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  others: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
  mode: number;
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  missingPermissions: string[];
  currentMode?: number;
  recommendedMode?: number;
  error?: string;
}

export class PermissionUtils {
  
  static async checkFilePermissions(filePath: string): Promise<FilePermissions | null> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      const stats = await fs.promises.stat(resolvedPath);
      const mode = stats.mode;

      return {
        readable: this.hasPermission(mode, fs.constants.R_OK),
        writable: this.hasPermission(mode, fs.constants.W_OK),
        executable: this.hasPermission(mode, fs.constants.X_OK),
        owner: {
          read: (mode & parseInt('400', 8)) !== 0,
          write: (mode & parseInt('200', 8)) !== 0,
          execute: (mode & parseInt('100', 8)) !== 0
        },
        group: {
          read: (mode & parseInt('040', 8)) !== 0,
          write: (mode & parseInt('020', 8)) !== 0,
          execute: (mode & parseInt('010', 8)) !== 0
        },
        others: {
          read: (mode & parseInt('004', 8)) !== 0,
          write: (mode & parseInt('002', 8)) !== 0,
          execute: (mode & parseInt('001', 8)) !== 0
        },
        mode: mode & parseInt('777', 8)
      };
    } catch (error) {
      logger.error('Failed to check file permissions', { filePath, error: (error as Error).message });
      return null;
    }
  }

  static async hasReadPermission(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  static async hasWritePermission(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      await fs.promises.access(resolvedPath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  static async hasExecutePermission(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      await fs.promises.access(resolvedPath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  static async checkPermissions(filePath: string, requiredPermissions: string[]): Promise<PermissionCheckResult> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      const stats = await fs.promises.stat(resolvedPath);
      const currentMode = stats.mode & parseInt('777', 8);
      
      const missingPermissions: string[] = [];
      
      for (const permission of requiredPermissions) {
        const hasPermission = await this.hasSpecificPermission(resolvedPath, permission);
        if (!hasPermission) {
          missingPermissions.push(permission);
        }
      }

      return {
        hasPermission: missingPermissions.length === 0,
        missingPermissions,
        currentMode,
        recommendedMode: this.calculateRecommendedMode(requiredPermissions)
      };
    } catch (error) {
      return {
        hasPermission: false,
        missingPermissions: requiredPermissions,
        error: (error as Error).message
      };
    }
  }

  private static async hasSpecificPermission(filePath: string, permission: string): Promise<boolean> {
    const permissionMap: Record<string, number> = {
      'read': fs.constants.R_OK,
      'write': fs.constants.W_OK,
      'execute': fs.constants.X_OK
    };

    try {
      const mode = permissionMap[permission.toLowerCase()];
      if (mode === undefined) {
        return false;
      }
      
      await fs.promises.access(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  static async setSecurePermissions(filePath: string, isDirectory: boolean = false): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      
      if (PathUtils.isWindows()) {
        logger.debug('Skipping permission setting on Windows', { filePath });
        return true;
      }

      const secureMode = isDirectory ? parseInt('750', 8) : parseInt('640', 8);
      
      await fs.promises.chmod(resolvedPath, secureMode);
      logger.debug('Set secure permissions', { filePath, mode: secureMode.toString(8) });
      return true;
    } catch (error) {
      logger.error('Failed to set secure permissions', { 
        filePath, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static async ensureDirectoryPermissions(directoryPath: string): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(directoryPath);
      
      const stats = await fs.promises.stat(resolvedPath);
      if (!stats.isDirectory()) {
        logger.error('Path is not a directory', { directoryPath });
        return false;
      }

      return await this.setSecurePermissions(resolvedPath, true);
    } catch (error) {
      logger.error('Failed to ensure directory permissions', { 
        directoryPath, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static async createSecureFile(filePath: string, content: string = ''): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      const directory = PathUtils.getDirname(resolvedPath);
      
      await fs.promises.mkdir(directory, { recursive: true, mode: parseInt('750', 8) });
      
      const fileHandle = await fs.promises.open(resolvedPath, 'w', parseInt('640', 8));
      if (content) {
        await fileHandle.writeFile(content, 'utf8');
      }
      await fileHandle.close();
      
      logger.debug('Created secure file', { filePath });
      return true;
    } catch (error) {
      logger.error('Failed to create secure file', { 
        filePath, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static async createSecureDirectory(directoryPath: string): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(directoryPath);
      
      await fs.promises.mkdir(resolvedPath, { 
        recursive: true, 
        mode: parseInt('750', 8) 
      });
      
      logger.debug('Created secure directory', { directoryPath });
      return true;
    } catch (error) {
      logger.error('Failed to create secure directory', { 
        directoryPath, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static validateFileAccess(filePath: string, allowedBasePaths: string[] = []): boolean {
    try {
      const resolvedPath = PathUtils.resolvePath(filePath);
      
      if (allowedBasePaths.length === 0) {
        const workspaceRoot = PathUtils.getWorkspaceRoot();
        const configPath = PathUtils.getConfigPath();
        const claudeConfigPath = PathUtils.getClaudeConfigPath();
        allowedBasePaths = [workspaceRoot, configPath, claudeConfigPath].filter(Boolean) as string[];
      }

      return allowedBasePaths.some(basePath => {
        const resolvedBasePath = PathUtils.resolvePath(basePath);
        return PathUtils.isSubPath(resolvedBasePath, resolvedPath);
      });
    } catch (error) {
      logger.error('File access validation failed', { 
        filePath, 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static async isWritableLocation(directoryPath: string): Promise<boolean> {
    try {
      const resolvedPath = PathUtils.resolvePath(directoryPath);
      const testFilePath = path.join(resolvedPath, `.permission-test-${Date.now()}`);
      
      await fs.promises.writeFile(testFilePath, 'test', 'utf8');
      await fs.promises.unlink(testFilePath);
      
      return true;
    } catch {
      return false;
    }
  }

  private static hasPermission(mode: number, permission: number): boolean {
    return (mode & permission) !== 0;
  }

  private static calculateRecommendedMode(requiredPermissions: string[]): number {
    let mode = parseInt('600', 8);
    
    if (requiredPermissions.includes('execute')) {
      mode = parseInt('700', 8);
    } else if (requiredPermissions.includes('write')) {
      mode = parseInt('640', 8);
    } else if (requiredPermissions.includes('read')) {
      mode = parseInt('644', 8);
    }
    
    return mode;
  }

  static getRecommendedConfigPermissions(): number {
    return parseInt('640', 8);
  }

  static getRecommendedDirectoryPermissions(): number {
    return parseInt('750', 8);
  }

  static getRecommendedExecutablePermissions(): number {
    return parseInt('755', 8);
  }

  static async validateSystemPermissions(): Promise<{
    configAccess: boolean;
    tempAccess: boolean;
    workspaceAccess: boolean;
    recommendations: string[];
  }> {
    const results = {
      configAccess: false,
      tempAccess: false,
      workspaceAccess: false,
      recommendations: [] as string[]
    };

    const configPath = PathUtils.getConfigPath();
    const tempPath = PathUtils.getTempDir();
    const workspacePath = PathUtils.getWorkspaceRoot();

    results.configAccess = await this.isWritableLocation(configPath);
    if (!results.configAccess) {
      results.recommendations.push('Ensure VS Code configuration directory is writable');
    }

    results.tempAccess = await this.isWritableLocation(tempPath);
    if (!results.tempAccess) {
      results.recommendations.push('Ensure temporary directory is writable');
    }

    if (workspacePath) {
      results.workspaceAccess = await this.isWritableLocation(workspacePath);
      if (!results.workspaceAccess) {
        results.recommendations.push('Ensure workspace directory has appropriate permissions');
      }
    }

    return results;
  }
}