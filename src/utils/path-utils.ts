import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';

export class PathUtils {
  
  static normalizePath(inputPath: string): string {
    return path.normalize(inputPath);
  }

  static resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      return path.resolve(inputPath);
    }
    
    const workspaceRoot = this.getWorkspaceRoot();
    if (workspaceRoot) {
      return path.resolve(workspaceRoot, inputPath);
    }
    
    return path.resolve(inputPath);
  }

  static joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  static getBasename(filePath: string, ext?: string): string {
    return path.basename(filePath, ext);
  }

  static getDirname(filePath: string): string {
    return path.dirname(filePath);
  }

  static getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  static isAbsolute(inputPath: string): boolean {
    return path.isAbsolute(inputPath);
  }

  static relative(from: string, to: string): string {
    return path.relative(from, to);
  }

  static getWorkspaceRoot(): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  static getConfigPath(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Code', 'User');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User');
      case 'linux':
      default:
        return path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'Code', 'User');
    }
  }

  static getExtensionPath(): string {
    const configPath = this.getConfigPath();
    return path.join(configPath, 'extensions');
  }

  static getClaudeConfigPath(): string {
    const homeDir = os.homedir();
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Claude');
      case 'linux':
      default:
        return path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'claude');
    }
  }

  static getClaudeSettingsPath(): string {
    return path.join(this.getClaudeConfigPath(), 'settings.json');
  }

  static getTempDir(): string {
    return os.tmpdir();
  }

  static createTempPath(prefix: string = 'claude-model-switcher', suffix: string = ''): string {
    const tempDir = this.getTempDir();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${prefix}-${timestamp}-${random}${suffix}`;
    return path.join(tempDir, filename);
  }

  static sanitizePath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Invalid path: must be a non-empty string');
    }

    const normalized = path.normalize(inputPath);
    
    const dangerous = [
      '..',
      '~',
      '$',
      '`',
      '&',
      '|',
      ';',
      '<',
      '>',
      '(',
      ')',
      '{',
      '}',
      '[',
      ']',
      '*',
      '?',
      '\\'
    ];

    for (const char of dangerous) {
      if (normalized.includes(char) && char !== path.sep && char !== ':') {
        throw new Error(`Potentially dangerous character in path: ${char}`);
      }
    }

    if (normalized.includes('..')) {
      throw new Error('Path traversal detected');
    }

    return normalized;
  }

  static validatePath(inputPath: string, allowedPaths?: string[]): boolean {
    try {
      const sanitized = this.sanitizePath(inputPath);
      const resolved = this.resolvePath(sanitized);

      if (allowedPaths && allowedPaths.length > 0) {
        return allowedPaths.some(allowedPath => {
          const resolvedAllowed = this.resolvePath(allowedPath);
          return resolved.startsWith(resolvedAllowed);
        });
      }

      const workspaceRoot = this.getWorkspaceRoot();
      if (workspaceRoot) {
        return resolved.startsWith(workspaceRoot) || resolved.startsWith(this.getConfigPath());
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  static isSubPath(parent: string, child: string): boolean {
    const resolvedParent = this.resolvePath(parent);
    const resolvedChild = this.resolvePath(child);
    
    const relativePath = path.relative(resolvedParent, resolvedChild);
    
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  static ensureTrailingSeparator(inputPath: string): string {
    if (!inputPath.endsWith(path.sep)) {
      return inputPath + path.sep;
    }
    return inputPath;
  }

  static removeTrailingSeparator(inputPath: string): string {
    if (inputPath.endsWith(path.sep) && inputPath.length > 1) {
      return inputPath.slice(0, -1);
    }
    return inputPath;
  }

  static getPlatform(): NodeJS.Platform {
    return os.platform();
  }

  static isWindows(): boolean {
    return this.getPlatform() === 'win32';
  }

  static isMacOS(): boolean {
    return this.getPlatform() === 'darwin';
  }

  static isLinux(): boolean {
    return this.getPlatform() === 'linux';
  }

  static convertPathSeparators(inputPath: string, targetPlatform?: NodeJS.Platform): string {
    const platform = targetPlatform || this.getPlatform();
    
    if (platform === 'win32') {
      return inputPath.replace(/\//g, '\\');
    } else {
      return inputPath.replace(/\\/g, '/');
    }
  }

  static getPathSegments(inputPath: string): string[] {
    return this.normalizePath(inputPath).split(path.sep).filter(segment => segment.length > 0);
  }

  static pathContains(containerPath: string, targetPath: string): boolean {
    const normalizedContainer = this.normalizePath(containerPath);
    const normalizedTarget = this.normalizePath(targetPath);
    
    return normalizedTarget.startsWith(normalizedContainer + path.sep) || 
           normalizedTarget === normalizedContainer;
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}