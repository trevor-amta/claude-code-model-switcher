import * as crypto from 'crypto';
import { URL } from 'url';
import { logger } from './logger';
import { ApiKeyConfig } from '../types/claude-settings';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string;
  warnings?: string[];
}

export interface SecurityPolicy {
  allowedDomains: string[];
  allowedProtocols: string[];
  maxUrlLength: number;
  maxInputLength: number;
  allowedFileExtensions: string[];
  blockedPatterns: RegExp[];
}

export class SecurityUtils {
  private static readonly DEFAULT_POLICY: SecurityPolicy = {
    allowedDomains: [
      'api.anthropic.com',
      'api.z.ai',
      'localhost',
      '127.0.0.1',
      '::1'
    ],
    allowedProtocols: ['https:', 'http:'],
    maxUrlLength: 2048,
    maxInputLength: 10000,
    allowedFileExtensions: ['.json', '.txt', '.md', '.yaml', '.yml'],
    blockedPatterns: [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /<script[^>]*>/i,
      /<\/script>/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\.cookie/i,
      /localStorage/i,
      /sessionStorage/i
    ]
  };

  private static policy: SecurityPolicy = { ...SecurityUtils.DEFAULT_POLICY };

  static setSecurityPolicy(newPolicy: Partial<SecurityPolicy>): void {
    SecurityUtils.policy = { ...SecurityUtils.DEFAULT_POLICY, ...newPolicy };
    logger.info('Security policy updated');
  }

  static getSecurityPolicy(): SecurityPolicy {
    return { ...SecurityUtils.policy };
  }

  static validateUrl(url: string): ValidationResult {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL must be a non-empty string' };
    }

    if (url.length > SecurityUtils.policy.maxUrlLength) {
      return { 
        isValid: false, 
        error: `URL exceeds maximum length of ${SecurityUtils.policy.maxUrlLength} characters` 
      };
    }

    for (const pattern of SecurityUtils.policy.blockedPatterns) {
      if (pattern.test(url)) {
        logger.warn('Blocked URL due to security pattern match', { url: SecurityUtils.sanitizeForLogging(url) });
        return { isValid: false, error: 'URL contains potentially dangerous content' };
      }
    }

    try {
      const parsedUrl = new URL(url);
      
      if (!SecurityUtils.policy.allowedProtocols.includes(parsedUrl.protocol)) {
        return { 
          isValid: false, 
          error: `Protocol ${parsedUrl.protocol} is not allowed` 
        };
      }

      const hostname = parsedUrl.hostname.toLowerCase();
      const isAllowedDomain = SecurityUtils.policy.allowedDomains.some(domain => {
        return hostname === domain || hostname.endsWith(`.${domain}`);
      });

      if (!isAllowedDomain) {
        logger.warn('URL domain not in allowlist', { 
          hostname: SecurityUtils.sanitizeForLogging(hostname) 
        });
        return { 
          isValid: false, 
          error: `Domain ${hostname} is not in the allowed domains list` 
        };
      }

      return { 
        isValid: true, 
        sanitizedValue: url,
        warnings: parsedUrl.protocol === 'http:' ? ['Using HTTP instead of HTTPS'] : undefined
      };

    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid URL format: ${(error as Error).message}` 
      };
    }
  }

  static validateApiKey(apiKey: string, provider: string = 'unknown'): ValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API key must be a non-empty string' };
    }

    if (apiKey.length < 10) {
      return { isValid: false, error: 'API key is too short' };
    }

    if (apiKey.length > 500) {
      return { isValid: false, error: 'API key is too long' };
    }

    const warnings: string[] = [];

    switch (provider.toLowerCase()) {
      case 'anthropic':
        if (!apiKey.startsWith('sk-')) {
          warnings.push('Anthropic API keys typically start with sk-');
        }
        break;
      case 'z-ai':
      case 'zai':
        break;
      default:
        warnings.push('Unknown API key provider');
    }

    for (const pattern of SecurityUtils.policy.blockedPatterns) {
      if (pattern.test(apiKey)) {
        logger.warn('API key contains suspicious patterns', { provider });
        return { isValid: false, error: 'API key contains potentially dangerous content' };
      }
    }

    return { 
      isValid: true, 
      sanitizedValue: apiKey,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  static validateInput(input: string, fieldName: string = 'input'): ValidationResult {
    if (!input || typeof input !== 'string') {
      return { isValid: false, error: `${fieldName} must be a non-empty string` };
    }

    if (input.length > SecurityUtils.policy.maxInputLength) {
      return { 
        isValid: false, 
        error: `${fieldName} exceeds maximum length of ${SecurityUtils.policy.maxInputLength} characters` 
      };
    }

    for (const pattern of SecurityUtils.policy.blockedPatterns) {
      if (pattern.test(input)) {
        logger.warn('Input contains blocked pattern', { 
          fieldName, 
          input: SecurityUtils.sanitizeForLogging(input) 
        });
        return { isValid: false, error: `${fieldName} contains potentially dangerous content` };
      }
    }

    const sanitized = SecurityUtils.sanitizeInput(input);
    const warnings: string[] = [];

    if (sanitized !== input) {
      warnings.push('Input was sanitized to remove potentially dangerous characters');
    }

    return { 
      isValid: true, 
      sanitizedValue: sanitized,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  static validateModelName(modelName: string): ValidationResult {
    if (!modelName || typeof modelName !== 'string') {
      return { isValid: false, error: 'Model name must be a non-empty string' };
    }

    const allowedPattern = /^[a-zA-Z0-9._-]+$/;
    if (!allowedPattern.test(modelName)) {
      return { 
        isValid: false, 
        error: 'Model name contains invalid characters. Only letters, numbers, dots, hyphens, and underscores are allowed' 
      };
    }

    if (modelName.length > 100) {
      return { isValid: false, error: 'Model name is too long (max 100 characters)' };
    }

    return { isValid: true, sanitizedValue: modelName };
  }

  static validateFileExtension(filename: string): ValidationResult {
    if (!filename || typeof filename !== 'string') {
      return { isValid: false, error: 'Filename must be a non-empty string' };
    }

    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (!SecurityUtils.policy.allowedFileExtensions.includes(extension)) {
      return { 
        isValid: false, 
        error: `File extension ${extension} is not allowed` 
      };
    }

    return { isValid: true, sanitizedValue: filename };
  }

  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  static hashValue(value: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(value).digest('hex');
  }

  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  static sanitizeForLogging(value: string, maxLength: number = 50): string {
    if (!value || typeof value !== 'string') {
      return '[INVALID_VALUE]';
    }

    let sanitized = value
      .replace(/[^\w\s.-]/g, '*')
      .substring(0, maxLength);

    if (value.length > maxLength) {
      sanitized += '...';
    }

    return sanitized;
  }

  static validateEndpoint(endpoint: string): ValidationResult {
    const urlValidation = SecurityUtils.validateUrl(endpoint);
    if (!urlValidation.isValid) {
      return urlValidation;
    }

    try {
      const parsedUrl = new URL(endpoint);
      
      if (parsedUrl.pathname && parsedUrl.pathname !== '/' && !parsedUrl.pathname.startsWith('/api')) {
        return { 
          isValid: false, 
          error: 'Endpoint path must be root (/) or start with /api' 
        };
      }

      if (parsedUrl.search || parsedUrl.hash) {
        return { 
          isValid: false, 
          error: 'Endpoint URL should not contain query parameters or fragments' 
        };
      }

      return { isValid: true, sanitizedValue: endpoint };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid endpoint format: ${(error as Error).message}` 
      };
    }
  }

  static isSecureEnvironment(): boolean {
    try {
      return typeof crypto !== 'undefined' && 
             typeof crypto.randomBytes === 'function' &&
             process.versions.node !== undefined;
    } catch {
      return false;
    }
  }

  static validateConfiguration(config: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.endpoint) {
      const endpointValidation = SecurityUtils.validateEndpoint(config.endpoint);
      if (!endpointValidation.isValid) {
        errors.push(`Invalid endpoint: ${endpointValidation.error}`);
      } else if (endpointValidation.warnings) {
        warnings.push(...endpointValidation.warnings);
      }
    }

    if (config.apiKey) {
      const apiKeyValidation = SecurityUtils.validateApiKey(config.apiKey, config.provider);
      if (!apiKeyValidation.isValid) {
        errors.push(`Invalid API key: ${apiKeyValidation.error}`);
      } else if (apiKeyValidation.warnings) {
        warnings.push(...apiKeyValidation.warnings);
      }
    }

    if (config.modelName) {
      const modelValidation = SecurityUtils.validateModelName(config.modelName);
      if (!modelValidation.isValid) {
        errors.push(`Invalid model name: ${modelValidation.error}`);
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  static createCSP(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.anthropic.com https://api.z.ai",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
  }

  static addDomainToAllowlist(domain: string): boolean {
    const validation = SecurityUtils.validateInput(domain, 'domain');
    if (!validation.isValid || !validation.sanitizedValue) {
      logger.warn('Failed to add invalid domain to allowlist', { domain });
      return false;
    }

    const sanitizedDomain = validation.sanitizedValue.toLowerCase();
    
    if (!SecurityUtils.policy.allowedDomains.includes(sanitizedDomain)) {
      SecurityUtils.policy.allowedDomains.push(sanitizedDomain);
      logger.info('Domain added to allowlist', { domain: sanitizedDomain });
      return true;
    }

    return false;
  }

  static removeDomainFromAllowlist(domain: string): boolean {
    const index = SecurityUtils.policy.allowedDomains.indexOf(domain.toLowerCase());
    if (index > -1) {
      SecurityUtils.policy.allowedDomains.splice(index, 1);
      logger.info('Domain removed from allowlist', { domain });
      return true;
    }
    return false;
  }

  static async encryptApiKeys(apiKeys: ApiKeyConfig): Promise<ApiKeyConfig> {
    const encrypted: ApiKeyConfig = { ...apiKeys };
    
    if (apiKeys.anthropic) {
      encrypted.anthropic = SecurityUtils.encrypt(apiKeys.anthropic);
    }
    if (apiKeys.zai) {
      encrypted.zai = SecurityUtils.encrypt(apiKeys.zai);
    }
    if (apiKeys.custom) {
      encrypted.custom = {};
      for (const [key, value] of Object.entries(apiKeys.custom)) {
        encrypted.custom[key] = SecurityUtils.encrypt(value);
      }
    }
    
    return encrypted;
  }

  static async decryptApiKeys(encryptedApiKeys: ApiKeyConfig): Promise<ApiKeyConfig> {
    const decrypted: ApiKeyConfig = { ...encryptedApiKeys };
    
    if (encryptedApiKeys.anthropic) {
      decrypted.anthropic = SecurityUtils.decrypt(encryptedApiKeys.anthropic);
    }
    if (encryptedApiKeys.zai) {
      decrypted.zai = SecurityUtils.decrypt(encryptedApiKeys.zai);
    }
    if (encryptedApiKeys.custom) {
      decrypted.custom = {};
      for (const [key, value] of Object.entries(encryptedApiKeys.custom)) {
        decrypted.custom[key] = SecurityUtils.decrypt(value);
      }
    }
    
    return decrypted;
  }

  static isValidApiKey(apiKey: string): boolean {
    const result = SecurityUtils.validateApiKey(apiKey);
    return result.isValid;
  }

  private static encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync('claude-model-switcher', 'salt', 32);
    const _iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${_iv.toString('hex')}:${encrypted}`;
  }

  private static decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync('claude-model-switcher', 'salt', 32);
    
    const [ivHex, encrypted] = encryptedText.split(':');
    const _iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}