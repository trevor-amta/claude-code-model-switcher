import { ModelConfig, ReloadBehavior } from './model-config';

export interface ClaudeExtensionSettings {
  defaultModel: string;
  showStatusBar: boolean;
  reloadBehavior: ReloadBehavior;
  debugMode: boolean;
  availableModels: ModelConfig[];
  apiKeys?: ApiKeyConfig;
  preferences?: UserPreferences;
  notifications?: NotificationSettings;
}

export interface ApiKeyConfig {
  anthropic?: string;
  zai?: string;
  custom?: Record<string, string>;
  storageMethod?: 'workspace' | 'global' | 'keychain';
}

export interface UserPreferences {
  autoSwitchOnStartup?: boolean;
  rememberLastModel?: boolean;
  showModelInTitle?: boolean;
  quickSwitchShortcuts?: Record<string, string>;
  favoriteModels?: string[];
  hiddenModels?: string[];
  customModelOrder?: string[];
}

export interface NotificationSettings {
  showSwitchConfirmation?: boolean;
  showReloadPrompt?: boolean;
  showErrorNotifications?: boolean;
  showSuccessNotifications?: boolean;
  notificationDuration?: number;
}

export interface ExtensionState {
  currentModel: string;
  isInitialized: boolean;
  lastSwitchTime?: number;
  switchCount?: number;
  errors?: ExtensionError[];
  statusBarItem?: any;
}

export interface ExtensionError {
  message: string;
  code?: string;
  timestamp: number;
  context?: Record<string, any>;
  stack?: string;
}

export interface ModelSwitchOptions {
  force?: boolean;
  skipValidation?: boolean;
  skipReload?: boolean;
  showNotification?: boolean;
  reason?: string;
}

export interface ValidationOptions {
  checkApiKey?: boolean;
  checkEndpoint?: boolean;
  testConnection?: boolean;
  timeout?: number;
}

export interface ClaudeCodeConfig {
  env?: {
    ANTHROPIC_MODEL?: string;
    ANTHROPIC_BASE_URL?: string;
    ANTHROPIC_AUTH_TOKEN?: string;
    [key: string]: string | undefined;
  };
  // Legacy fields for backward compatibility
  modelId?: string;
  endpoint?: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface StatusBarConfig {
  text: string;
  tooltip: string;
  color?: string;
  backgroundColor?: string;
  priority?: number;
  alignment?: 'left' | 'right';
}

export interface QuickPickModelItem {
  label: string;
  description?: string;
  detail?: string;
  model: ModelConfig;
  iconPath?: any;
  picked?: boolean;
}

export type SettingsKey = keyof ClaudeExtensionSettings;
export type ConfigurationTarget = 'workspace' | 'global' | 'workspaceFolder';

export const SETTINGS_KEYS = {
  DEFAULT_MODEL: 'claudeModelSwitcher.defaultModel',
  SHOW_STATUS_BAR: 'claudeModelSwitcher.showStatusBar',
  RELOAD_BEHAVIOR: 'claudeModelSwitcher.reloadBehavior',
  DEBUG_MODE: 'claudeModelSwitcher.debugMode',
  AVAILABLE_MODELS: 'claudeModelSwitcher.availableModels',
  API_KEYS: 'claudeModelSwitcher.apiKeys',
  PREFERENCES: 'claudeModelSwitcher.preferences',
  NOTIFICATIONS: 'claudeModelSwitcher.notifications'
} as const;

export const STORAGE_KEYS = {
  CURRENT_MODEL: 'claude.currentModel',
  LAST_SWITCH_TIME: 'claude.lastSwitchTime',
  SWITCH_COUNT: 'claude.switchCount',
  EXTENSION_STATE: 'claude.extensionState',
  USER_PREFERENCES: 'claude.userPreferences'
} as const;