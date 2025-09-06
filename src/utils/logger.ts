import * as vscode from 'vscode';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  source?: string;
}

class Logger {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel;
  private debugMode: boolean = false;

  constructor(channelName: string = 'Claude Model Switcher') {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
    this.logLevel = LogLevel.INFO;
  }

  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.logLevel = enabled ? LogLevel.DEBUG : LogLevel.INFO;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public error(message: string, error?: any, source?: string): void {
    this.log(LogLevel.ERROR, message, this.errorToContext(error), source);
  }

  public warn(message: string, contextOrError?: Record<string, any> | any, source?: string): void {
    const context = this.normalizeContext(contextOrError);
    this.log(LogLevel.WARN, message, context, source);
  }

  public info(message: string, context?: Record<string, any>, source?: string): void {
    this.log(LogLevel.INFO, message, context, source);
  }

  public debug(message: string, contextOrError?: Record<string, any> | any, source?: string): void {
    const context = this.normalizeContext(contextOrError);
    this.log(LogLevel.DEBUG, message, context, source);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, source?: string): void {
    if (level > this.logLevel) {
      return;
    }

    const timestamp = new Date();
    const sanitizedMessage = this.sanitizeMessage(message);
    const sanitizedContext = context ? this.sanitizeContext(context) : undefined;

    const logEntry: LogEntry = {
      level,
      message: sanitizedMessage,
      timestamp,
      context: sanitizedContext,
      source
    };

    const formattedMessage = this.formatLogEntry(logEntry);
    this.outputChannel.appendLine(formattedMessage);

    if (level === LogLevel.ERROR) {
      if (this.debugMode) {
        vscode.window.showErrorMessage(`Claude Model Switcher: ${sanitizedMessage}`);
      }
    }
  }

  private sanitizeMessage(message: string): string {
    return message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b(?:api[_-]?key|token|secret|password|pwd)\s*[:=]\s*[^\s\]},;'"]+/gi, '$1: [REDACTED]')
      .replace(/\b[A-Za-z0-9+/]{20,}={0,2}\b/g, '[BASE64_REDACTED]')
      .replace(/\b(?:sk-|pk-)[A-Za-z0-9]{20,}/g, '[API_KEY_REDACTED]')
      .replace(/\b(?:bearer\s+)?[A-Za-z0-9_-]{20,}/gi, '[TOKEN_REDACTED]')
      .replace(/(?:\/\/|https?:\/\/)[^\/\s]*:[^@\s]*@/g, '//[CREDENTIALS_REDACTED]@')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_NUMBER_REDACTED]')
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN_REDACTED]');
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      
      if (this.isSensitiveKey(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          sanitized[key] = value.map(item => 
            typeof item === 'string' ? this.sanitizeMessage(item) : item
          );
        } else {
          sanitized[key] = this.sanitizeContext(value);
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      'password', 'pwd', 'pass', 'secret', 'token', 'key', 'auth',
      'credential', 'apikey', 'api_key', 'bearer', 'authorization',
      'x-api-key', 'x-auth-token', 'cookie', 'session'
    ];

    return sensitivePatterns.some(pattern => key.includes(pattern));
  }

  private errorToContext(error?: any): Record<string, any> | undefined {
    return this.normalizeContext(error);
  }

  private normalizeContext(contextOrError?: any): Record<string, any> | undefined {
    if (!contextOrError) {
      return undefined;
    }
    
    if (contextOrError instanceof Error) {
      return {
        message: contextOrError.message,
        name: contextOrError.name,
        stack: contextOrError.stack
      };
    }
    
    if (typeof contextOrError === 'object') {
      return contextOrError;
    }
    
    return { value: String(contextOrError) };
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    const source = entry.source ? `[${entry.source}] ` : '';
    
    let message = `${timestamp} [${levelName}] ${source}${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      try {
        const contextStr = JSON.stringify(entry.context, null, 2);
        message += `\nContext: ${contextStr}`;
      } catch (error) {
        message += '\nContext: [Unable to serialize context]';
      }
    }

    return message;
  }

  public show(): void {
    this.outputChannel.show();
  }

  public clear(): void {
    this.outputChannel.clear();
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}

const logger = new Logger();

export { Logger, logger };
export default Logger;