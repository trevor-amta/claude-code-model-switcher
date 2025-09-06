import * as vscode from 'vscode';
import { logger, LogLevel } from './logger';

export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  MODEL_ERROR = 'MODEL_ERROR',
  API_ERROR = 'API_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  USER_CANCELLED = 'USER_CANCELLED'
}

export interface ErrorContext {
  operation?: string;
  modelName?: string;
  endpoint?: string;
  filePath?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ExtensionError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  originalError?: Error;
  context?: ErrorContext;
  timestamp: Date;
  severity: 'error' | 'warning' | 'info';
  recoverable: boolean;
  retryable: boolean;
  stack?: string;
}

export interface ErrorHandlerOptions {
  showUserNotification?: boolean;
  logError?: boolean;
  logLevel?: LogLevel;
  includeStack?: boolean;
  retryable?: boolean;
  recoverable?: boolean;
}

export class ErrorHandler {
  private static readonly ERROR_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCode.UNKNOWN]: 'An unexpected error occurred',
    [ErrorCode.VALIDATION_ERROR]: 'Invalid input or configuration',
    [ErrorCode.NETWORK_ERROR]: 'Network connection failed',
    [ErrorCode.AUTHENTICATION_ERROR]: 'Authentication failed - please check your API key',
    [ErrorCode.PERMISSION_ERROR]: 'Permission denied - insufficient access rights',
    [ErrorCode.FILE_ERROR]: 'File operation failed',
    [ErrorCode.CONFIG_ERROR]: 'Configuration error detected',
    [ErrorCode.MODEL_ERROR]: 'Model-related error occurred',
    [ErrorCode.API_ERROR]: 'API request failed',
    [ErrorCode.TIMEOUT_ERROR]: 'Request timed out',
    [ErrorCode.RATE_LIMIT_ERROR]: 'Rate limit exceeded - please try again later',
    [ErrorCode.USER_CANCELLED]: 'Operation cancelled by user'
  };

  private static readonly USER_FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCode.UNKNOWN]: 'Something went wrong. Please try again or check the logs for more details.',
    [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCode.NETWORK_ERROR]: 'Please check your internet connection and try again.',
    [ErrorCode.AUTHENTICATION_ERROR]: 'Please verify your API key is correct and has the necessary permissions.',
    [ErrorCode.PERMISSION_ERROR]: 'This operation requires additional permissions. Please check your system settings.',
    [ErrorCode.FILE_ERROR]: 'Unable to access or modify the file. Please check file permissions.',
    [ErrorCode.CONFIG_ERROR]: 'Please check your extension settings and configuration.',
    [ErrorCode.MODEL_ERROR]: 'There was an issue with the selected model. Try switching to a different model.',
    [ErrorCode.API_ERROR]: 'The service is temporarily unavailable. Please try again later.',
    [ErrorCode.TIMEOUT_ERROR]: 'The request took too long. Please try again.',
    [ErrorCode.RATE_LIMIT_ERROR]: 'You\'ve reached the rate limit. Please wait a moment before trying again.',
    [ErrorCode.USER_CANCELLED]: 'Operation was cancelled.'
  };

  private static readonly RECOVERY_SUGGESTIONS: Record<ErrorCode, string[]> = {
    [ErrorCode.UNKNOWN]: [
      'Restart VS Code',
      'Check the extension logs',
      'Report the issue if it persists'
    ],
    [ErrorCode.VALIDATION_ERROR]: [
      'Verify your input format',
      'Check the extension settings',
      'Reset to default configuration'
    ],
    [ErrorCode.NETWORK_ERROR]: [
      'Check your internet connection',
      'Verify firewall settings',
      'Try again in a few moments'
    ],
    [ErrorCode.AUTHENTICATION_ERROR]: [
      'Verify your API key is correct',
      'Check API key permissions',
      'Generate a new API key if needed'
    ],
    [ErrorCode.PERMISSION_ERROR]: [
      'Run VS Code as administrator (Windows)',
      'Check file and directory permissions',
      'Ensure workspace is writable'
    ],
    [ErrorCode.FILE_ERROR]: [
      'Check file exists and is accessible',
      'Verify file permissions',
      'Ensure directory is writable'
    ],
    [ErrorCode.CONFIG_ERROR]: [
      'Reset extension settings',
      'Check configuration file format',
      'Restart VS Code'
    ],
    [ErrorCode.MODEL_ERROR]: [
      'Try a different model',
      'Check model availability',
      'Verify endpoint configuration'
    ],
    [ErrorCode.API_ERROR]: [
      'Try again in a few moments',
      'Check service status',
      'Verify endpoint configuration'
    ],
    [ErrorCode.TIMEOUT_ERROR]: [
      'Try again with a shorter request',
      'Check network connection',
      'Increase timeout settings if available'
    ],
    [ErrorCode.RATE_LIMIT_ERROR]: [
      'Wait before making another request',
      'Check your usage limits',
      'Consider upgrading your plan'
    ],
    [ErrorCode.USER_CANCELLED]: []
  };

  static createError(
    code: ErrorCode,
    message: string,
    originalError?: Error,
    context?: ErrorContext,
    options: Partial<ExtensionError> = {}
  ): ExtensionError {
    const userMessage = options.userMessage || this.USER_FRIENDLY_MESSAGES[code] || message;
    
    return {
      code,
      message,
      userMessage,
      originalError,
      context,
      timestamp: new Date(),
      severity: options.severity || 'error',
      recoverable: options.recoverable ?? this.isRecoverable(code),
      retryable: options.retryable ?? this.isRetryable(code),
      stack: originalError?.stack
    };
  }

  static async handleError(
    error: ExtensionError | Error,
    options: ErrorHandlerOptions = {}
  ): Promise<void> {
    let extensionError: ExtensionError;

    if (error instanceof Error) {
      extensionError = this.createError(
        ErrorCode.UNKNOWN,
        error.message,
        error,
        undefined,
        {
          recoverable: options.recoverable ?? false,
          retryable: options.retryable ?? false
        }
      );
    } else {
      extensionError = error;
    }

    const defaultOptions: ErrorHandlerOptions = {
      showUserNotification: true,
      logError: true,
      logLevel: LogLevel.ERROR,
      includeStack: true,
      retryable: extensionError.retryable,
      recoverable: extensionError.recoverable
    };

    const finalOptions = { ...defaultOptions, ...options };

    if (finalOptions.logError) {
      this.logError(extensionError, finalOptions);
    }

    if (finalOptions.showUserNotification && extensionError.code !== ErrorCode.USER_CANCELLED) {
      await this.showUserNotification(extensionError, finalOptions);
    }
  }

  private static logError(error: ExtensionError, options: ErrorHandlerOptions): void {
    const logLevel = options.logLevel || LogLevel.ERROR;
    const context: Record<string, any> = {
      ...error.context,
      code: error.code,
      severity: error.severity,
      recoverable: error.recoverable,
      retryable: error.retryable,
      timestamp: error.timestamp.toISOString()
    };

    if (options.includeStack && error.stack) {
      context.stack = error.stack;
    }

    const logMessage = `${error.message}${error.originalError ? ` (${error.originalError.message})` : ''}`;

    switch (logLevel) {
      case LogLevel.ERROR:
        logger.error(logMessage, context, error.context?.component);
        break;
      case LogLevel.WARN:
        logger.warn(logMessage, context, error.context?.component);
        break;
      case LogLevel.INFO:
        logger.info(logMessage, context, error.context?.component);
        break;
      case LogLevel.DEBUG:
        logger.debug(logMessage, context, error.context?.component);
        break;
    }
  }

  private static async showUserNotification(
    error: ExtensionError,
    options: ErrorHandlerOptions
  ): Promise<void> {
    const message = error.userMessage || error.message;
    const suggestions = this.RECOVERY_SUGGESTIONS[error.code] || [];
    
    let fullMessage = message;
    if (suggestions.length > 0 && error.recoverable) {
      fullMessage += '\n\nSuggestions:\n' + suggestions.map(s => `• ${s}`).join('\n');
    }

    const actions: string[] = [];
    
    if (error.retryable && options.retryable !== false) {
      actions.push('Retry');
    }
    
    if (error.recoverable && suggestions.length > 0) {
      actions.push('Show Details');
    }
    
    actions.push('View Logs');

    let selectedAction: string | undefined;

    switch (error.severity) {
      case 'error':
        selectedAction = await vscode.window.showErrorMessage(message, ...actions);
        break;
      case 'warning':
        selectedAction = await vscode.window.showWarningMessage(message, ...actions);
        break;
      case 'info':
        selectedAction = await vscode.window.showInformationMessage(message, ...actions);
        break;
    }

    if (selectedAction) {
      await this.handleUserAction(selectedAction, error, fullMessage);
    }
  }

  private static async handleUserAction(
    action: string,
    error: ExtensionError,
    fullMessage: string
  ): Promise<void> {
    switch (action) {
      case 'Retry':
        vscode.commands.executeCommand('claudeModelSwitcher.retry');
        break;
      case 'Show Details':
        await vscode.window.showInformationMessage(
          fullMessage,
          { modal: true }
        );
        break;
      case 'View Logs':
        logger.show();
        break;
    }
  }

  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    errorCode: ErrorCode = ErrorCode.UNKNOWN,
    context?: ErrorContext
  ): (...args: T) => Promise<R | undefined> {
    return async (...args: T) => {
      try {
        return await fn(...args);
      } catch (error) {
        const extensionError = this.createError(
          errorCode,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined,
          context
        );
        
        await this.handleError(extensionError);
        return undefined;
      }
    };
  }

  static wrapSync<T extends any[], R>(
    fn: (...args: T) => R,
    errorCode: ErrorCode = ErrorCode.UNKNOWN,
    context?: ErrorContext
  ): (...args: T) => R | undefined {
    return (...args: T) => {
      try {
        return fn(...args);
      } catch (error) {
        const extensionError = this.createError(
          errorCode,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined,
          context
        );
        
        this.handleError(extensionError);
        return undefined;
      }
    };
  }

  private static isRecoverable(code: ErrorCode): boolean {
    const recoverableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.RATE_LIMIT_ERROR,
      ErrorCode.API_ERROR,
      ErrorCode.CONFIG_ERROR,
      ErrorCode.VALIDATION_ERROR
    ];
    return recoverableCodes.includes(code);
  }

  private static isRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.API_ERROR,
      ErrorCode.RATE_LIMIT_ERROR
    ];
    return retryableCodes.includes(code);
  }

  static classifyError(error: Error): ErrorCode {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('timeout') || name.includes('timeout')) {
      return ErrorCode.TIMEOUT_ERROR;
    }
    
    if (message.includes('network') || message.includes('connection') || name.includes('network')) {
      return ErrorCode.NETWORK_ERROR;
    }
    
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('api key')) {
      return ErrorCode.AUTHENTICATION_ERROR;
    }
    
    if (message.includes('permission') || message.includes('access denied') || name.includes('permission')) {
      return ErrorCode.PERMISSION_ERROR;
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorCode.RATE_LIMIT_ERROR;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCode.VALIDATION_ERROR;
    }
    
    if (message.includes('file') || name.includes('file')) {
      return ErrorCode.FILE_ERROR;
    }
    
    if (message.includes('config') || name.includes('config')) {
      return ErrorCode.CONFIG_ERROR;
    }

    return ErrorCode.UNKNOWN;
  }

  static createNetworkError(message: string, context?: ErrorContext): ExtensionError {
    return this.createError(ErrorCode.NETWORK_ERROR, message, undefined, context);
  }

  static createValidationError(message: string, context?: ErrorContext): ExtensionError {
    return this.createError(ErrorCode.VALIDATION_ERROR, message, undefined, context);
  }

  static createAuthenticationError(message: string, context?: ErrorContext): ExtensionError {
    return this.createError(ErrorCode.AUTHENTICATION_ERROR, message, undefined, context);
  }

  static createConfigError(message: string, context?: ErrorContext): ExtensionError {
    return this.createError(ErrorCode.CONFIG_ERROR, message, undefined, context);
  }

  static createModelError(message: string, context?: ErrorContext): ExtensionError {
    return this.createError(ErrorCode.MODEL_ERROR, message, undefined, context);
  }

  static createApiError(message: string, context?: ErrorContext): ExtensionError {
    return this.createError(ErrorCode.API_ERROR, message, undefined, context);
  }

  static createUserCancelledError(context?: ErrorContext): ExtensionError {
    return this.createError(
      ErrorCode.USER_CANCELLED, 
      'Operation was cancelled by user',
      undefined,
      context,
      { severity: 'info' }
    );
  }

  static getErrorMessage(error: Error | ExtensionError | unknown): string {
    if (error && typeof error === 'object' && 'userMessage' in error) {
      return (error as ExtensionError).userMessage;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return typeof error === 'string' ? error : 'An unknown error occurred';
  }
}