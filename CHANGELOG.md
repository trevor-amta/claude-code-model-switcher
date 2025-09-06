# Changelog

All notable changes to the Claude Code Model Switcher extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-01-06

### Added

#### Core Features
- **Model Switching**: Easy switching between Anthropic Claude models and Z.ai GLM models via command palette
- **Status Bar Integration**: Current model display in VS Code status bar with click-to-switch functionality
- **Secure API Key Management**: Encrypted storage of API keys using VS Code's secret storage system
- **Smart Configuration**: Flexible configuration system with sensible defaults

#### Supported Models
- **Claude Sonnet 4** (`claude-sonnet-4-20250514`) - Latest Sonnet model for balanced performance
- **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) - Fast and compact model for quick tasks
- **Claude Opus 4** (`claude-opus-4-20250514`) - Most capable model for complex tasks
- **GLM-4.5** (`glm-4.5`) - Z.ai's powerful reasoning model (355B parameters)
- **GLM-4.5-Air** (`glm-4.5-air`) - Z.ai's lightweight cost-effective model

#### Commands
- `Claude: Switch Model` - Interactive model selection from available models
- `Claude: Show Current Model` - Display currently selected model information
- `Claude: Configure API Keys` - Secure API key configuration interface
- `Claude: Configure Available Models` - Model configuration management

#### Services Architecture
- **StorageService**: Persistent storage with encryption for sensitive data
- **ConfigService**: VS Code configuration management with defaults
- **ModelService**: Model management and switching logic
- **NotificationService**: User notifications and feedback system
- **CommandManager**: Centralized command registration and error handling

#### Utilities
- **Logger**: Comprehensive logging system with debug mode support
- **SecurityUtils**: API key encryption/decryption utilities
- **ErrorHandler**: Standardized error handling and user feedback
- **PermissionUtils**: File system permission checking

#### Configuration Options
- `claudeModelSwitcher.defaultModel` - Default model selection
- `claudeModelSwitcher.showStatusBar` - Status bar visibility control
- `claudeModelSwitcher.reloadBehavior` - Window reload behavior after model switch
- `claudeModelSwitcher.debugMode` - Debug logging enablement
- `claudeModelSwitcher.availableModels` - Custom model configurations

#### Development Features
- **TypeScript**: Full TypeScript implementation with strict checking
- **ESLint**: Code quality enforcement with comprehensive rules
- **Testing**: Integration tests for extension activation and service functionality
- **Build System**: Complete development workflow with packaging scripts

### Technical Details

#### Dependencies
- VS Code Engine: `^1.85.0`
- TypeScript: `^5.0.0`
- ESLint: `^8.0.0`
- VSCE: `^2.15.0`

#### Architecture Highlights
- Singleton pattern for service management
- Dependency injection for proper service initialization
- Event-driven configuration updates
- Secure secret storage integration
- Comprehensive error handling with user-friendly messages

#### Security Features
- API keys stored in VS Code's secure secret storage
- Encryption for sensitive configuration data
- No logging of API keys or sensitive information
- Secure permission checking for file operations

#### Performance
- Lazy service initialization
- Efficient status bar updates
- Minimal extension activation overhead
- Background service operations

### Installation Requirements
- Visual Studio Code 1.85.0 or higher
- Node.js 18+ (for development)
- Valid Anthropic API key (for Claude models)
- Valid Z.ai API key (for GLM models, optional)

### Known Limitations
- Requires VS Code reload for some configuration changes to take effect
- Z.ai models require separate API key configuration
- Extension currently supports predefined model set (customizable via configuration)

---

## Development Changelog

### Phase 1: Project Foundation ✅
- Project structure setup
- TypeScript configuration
- ESLint configuration
- Basic package.json setup

### Phase 2: Type Definitions ✅
- Claude settings types
- Model configuration types
- API response types
- Storage interfaces

### Phase 3: Utility Layer ✅
- Logging system
- Error handling
- Security utilities
- Permission checking
- Path utilities

### Phase 4: Service Layer ✅
- Storage service with encryption
- Configuration service
- Model service
- Notification service
- Claude service integration

### Phase 5: Command Layer ✅
- Switch model command
- Show current model command
- Configure API keys command
- Configure models command
- Command manager with error handling

### Phase 6: Extension Integration ✅
- Main extension entry point
- Service initialization
- Command registration
- Status bar integration
- Configuration watchers
- Extension lifecycle management
- Integration tests
- Documentation

---

*For support and bug reports, please visit the [GitHub repository](https://github.com/trevor-amta/claude-code-model-switcher).*