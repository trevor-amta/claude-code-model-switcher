# Claude Code Model Switcher

A Visual Studio Code extension that allows you to easily switch between different Anthropic Claude models and Z.ai GLM models when using Claude Code.

## Features

- 🔄 **Easy Model Switching**: Switch between different Claude and GLM models via command palette
- 📊 **Status Bar Integration**: See your current model at a glance in the VS Code status bar
- 🔐 **Secure API Key Management**: Encrypted storage of API keys using VS Code's secret storage
- ⚙️ **Flexible Configuration**: Customize available models, default settings, and reload behavior
- 📱 **Smart Notifications**: Get notified about model switches and configuration changes
- 🔍 **Debug Support**: Comprehensive logging for troubleshooting

## Supported Models

### Anthropic Claude Models
- **Claude Sonnet 4** - Latest Sonnet model for balanced performance
- **Claude 3.5 Haiku** - Fast and compact model for quick tasks  
- **Claude Opus 4** - Most capable model for complex tasks

### Z.ai GLM Models
- **GLM-4.5** - Z.ai's powerful reasoning model (355B params)
- **GLM-4.5-Air** - Z.ai's lightweight model (cost-effective)

## Installation

1. Download the `.vsix` file from the releases page
2. Install via VS Code:
   - Open VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Extensions: Install from VSIX"
   - Select the downloaded `.vsix` file

## Quick Start

### 1. Configure API Keys

Before switching models, you need to configure your API keys:

#### Option 1: Using Extension Commands (Recommended)
```bash
# Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
Claude: Configure API Keys
```

You'll be prompted to enter:
- **Anthropic API Key**: For Claude models
- **Z.ai API Key**: For GLM models (optional)

#### Option 2: Z.ai Environment Variables (Alternative)
Z.ai models can also be configured using environment variables (following [Z.ai's official documentation](https://docs.z.ai/scenario-example/develop-tools/claude)):

```bash
# Set these environment variables before launching VS Code
export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here
```

The extension automatically detects these environment variables for Z.ai models. If both environment variables and stored API keys are present, environment variables take precedence.

### 2. Switch Models

Use any of these methods to switch models:

**Via Command Palette:**
```bash
Claude: Switch Model
```

**Via Status Bar:**
- Click on the model name in the status bar (bottom right)

**Available Commands:**
- `Claude: Switch Model` - Choose from available models
- `Claude: Show Current Model` - Display currently selected model
- `Claude: Configure API Keys` - Set up your API credentials
- `Claude: Configure Available Models` - Customize model configurations

## Configuration

### Settings

You can customize the extension through VS Code settings (`File > Preferences > Settings`):

```json
{
  "claudeModelSwitcher.defaultModel": "claude-sonnet-4-20250514",
  "claudeModelSwitcher.showStatusBar": true,
  "claudeModelSwitcher.reloadBehavior": "prompt",
  "claudeModelSwitcher.debugMode": false
}
```

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultModel` | string | `claude-sonnet-4-20250514` | Default model to use |
| `showStatusBar` | boolean | `true` | Show current model in status bar |
| `reloadBehavior` | enum | `prompt` | Window reload behavior after model switch (`prompt`, `auto`, `skip`) |
| `debugMode` | boolean | `false` | Enable debug logging |
| `availableModels` | array | [predefined] | Available models and their configurations |

### Custom Model Configuration

You can add custom models by modifying the `availableModels` setting:

```json
{
  "claudeModelSwitcher.availableModels": [
    {
      "name": "custom-model",
      "displayName": "Custom Model",
      "description": "My custom model configuration",
      "endpoint": "https://api.example.com",
      "type": "api"
    }
  ]
}
```

## Reload Behavior

After switching models, Claude Code may need to reload to apply changes:

- **Prompt** (default): Ask user if they want to reload
- **Auto**: Automatically reload without asking
- **Skip**: Don't reload (changes may not take effect immediately)

## Security

- API keys are stored securely using VS Code's built-in secret storage
- Keys are encrypted and never logged or exposed in plain text
- Debug logs exclude sensitive information

## Development

### Prerequisites

- Node.js 18+
- VS Code 1.85.0+
- TypeScript 5.0+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd claude-code-model-switcher

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Package extension
npm run package
```

### Available Scripts

```bash
npm run compile      # Compile TypeScript
npm run watch        # Watch for changes and compile
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run test         # Run tests
npm run build        # Clean and compile
npm run package      # Create .vsix package
npm run dev          # Launch development instance
npm run debug        # Launch with debugging
```

### Architecture

The extension follows a modular architecture with these key components:

- **Services**: Core business logic (Storage, Config, Model, Notification)
- **Commands**: VS Code command implementations
- **Utils**: Shared utilities (Logger, Security, Error Handling)
- **Types**: TypeScript type definitions

## Troubleshooting

### Common Issues

**Extension not activating:**
- Check VS Code version compatibility (requires 1.85.0+)
- Enable debug mode in settings for detailed logs
- Check VS Code Developer Tools (Help > Toggle Developer Tools)

**Model switching not working:**
- Verify API keys are configured correctly
- Check network connectivity
- Enable debug logging to see detailed error messages

**Status bar not updating:**
- Ensure `showStatusBar` setting is enabled
- Reload VS Code window after configuration changes

**Z.ai models not working:**
- Verify your Z.ai API key is valid at [Z.ai API key management](https://z.ai/manage-apikey/apikey-list)
- If using environment variables, ensure they're set before launching VS Code:
  ```bash
  export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
  export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here
  code  # Launch VS Code after setting environment variables
  ```
- Check the extension uses the correct Z.ai endpoint: `https://api.z.ai/api/anthropic`

### Debug Logging

Enable debug mode for detailed logging:

```json
{
  "claudeModelSwitcher.debugMode": true
}
```

View logs in VS Code Developer Tools:
1. Help > Toggle Developer Tools
2. Go to Console tab
3. Look for messages prefixed with `[Claude Model Switcher]`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `npm run lint` and `npm test`
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Report issues on [GitHub Issues](https://github.com/trevor-amta/claude-code-model-switcher/issues)
- Check the [troubleshooting guide](#troubleshooting) above
- Enable debug mode for detailed error information