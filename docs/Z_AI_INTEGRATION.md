# Z.ai Integration Guide

This guide provides comprehensive information about integrating Z.ai with the Claude Code Model Switcher extension.

## Overview

Z.ai provides powerful GLM models that can be used with Claude Code through environment variable configuration. The extension supports seamless integration with Z.ai's GLM-4.5 and GLM-4.5-Air models.

## Supported Z.ai Models

### GLM-4.5
- **Description**: Z.ai's most powerful reasoning model with 355 billion parameters
- **Use Case**: Complex reasoning tasks, code analysis, creative writing
- **Performance**: State-of-the-art reasoning capabilities
- **Cost**: Higher per-token cost

### GLM-4.5-Air
- **Description**: Z.ai's lightweight, cost-effective model
- **Use Case**: Quick tasks, simple queries, cost-sensitive applications
- **Performance**: Fast response times with good reasoning
- **Cost**: Lower per-token cost

## Prerequisites

### 1. Z.ai Account
- Create an account at [Z.ai](https://z.ai)
- Verify your email address
- Complete any required identity verification

### 2. API Key
- Navigate to [Z.ai API Key Management](https://z.ai/manage-apikey/apikey-list)
- Generate a new API key
- Save the key securely (you'll need it for configuration)

### 3. Claude Code Installation
- Ensure Claude Code is installed on your system
- Verify Claude Code is working with default Anthropic models

## Configuration Methods

### Method 1: Environment Variables (Recommended)

#### Manual Setup

1. **Set Environment Variables**
   
   **macOS/Linux:**
   ```bash
   # Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
   export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
   export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here
   ```
   
   **Windows (PowerShell):**
   ```powershell
   # Add to your PowerShell profile
   $env:ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"
   $env:ANTHROPIC_AUTH_TOKEN = "your_zai_api_key_here"
   ```

2. **Restart VS Code**
   - Close all VS Code windows
   - Launch VS Code again (environment variables must be set before launch)

3. **Verify Configuration**
   - Use the extension's diagnostic command to verify setup

#### Using Extension Setup Wizard

1. **Open Command Palette**
   ```bash
   Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (macOS)
   ```

2. **Run Setup Command**
   ```
   Claude: Setup Environment Variables
   ```

3. **Follow the Wizard**
   - Choose Z.ai as the provider
   - Enter your API key when prompted
   - Select automatic or manual setup
   - Follow platform-specific instructions
   - Test the configuration

### Method 2: Extension Command Interface

1. **Open Command Palette**
   ```bash
   Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (macOS)
   ```

2. **Configure API Keys**
   ```
   Claude: Configure API Keys
   ```

3. **Select Z.ai**
   - Choose Z.ai from the provider list
   - Enter your API key when prompted
   - The extension will guide you through environment variable setup

## Platform-Specific Setup

### macOS

#### Option 1: Terminal Profile
```bash
# Add to ~/.zshrc (default on macOS) or ~/.bash_profile
echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.zshrc
source ~/.zshrc
```

#### Option 2: Launch Agent
Create a launch agent for persistent environment variables:
```bash
# Create launch agent plist
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.zai.anthropic.env.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zai.anthropic.env</string>
    <key>ProgramArguments</key>
    <array>
        <string>sh</string>
        <string>-c</string>
        <string>launchctl setenv ANTHROPIC_BASE_URL https://api.z.ai/api/anthropic</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

# Load the launch agent
launchctl load ~/Library/LaunchAgents/com.zai.anthropic.env.plist
```

### Linux

#### Option 1: Shell Profile
```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.bashrc
echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

#### Option 2: Systemd User Service
```bash
# Create systemd user service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/zai-env.service << EOF
[Unit]
Description=Set Z.ai environment variables

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c "echo ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic > /etc/environment"
ExecStart=/bin/sh -c "echo ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here >> /etc/environment"

[Install]
WantedBy=default.target
EOF

# Enable and start the service
systemctl --user enable zai-env.service
systemctl --user start zai-env.service
```

### Windows

#### Option 1: PowerShell Profile
```powershell
# Add to PowerShell profile (notepad $PROFILE)
$env:ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "your_zai_api_key_here"

# Or use System environment variables (persistent)
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "your_zai_api_key_here", "User")
```

#### Option 2: System Environment Variables
1. Open System Properties
2. Click "Environment Variables"
3. Add new User variables:
   - Name: `ANTHROPIC_BASE_URL`
   - Value: `https://api.z.ai/api/anthropic`
   - Name: `ANTHROPIC_AUTH_TOKEN`
   - Value: `your_zai_api_key_here`
4. Restart VS Code

## Validation and Testing

### Using Extension Diagnostics

1. **Run Diagnostics**
   ```bash
   Claude: Run Configuration Diagnostics
   ```

2. **Check Z.ai Status**
   - Look for Z.ai provider status
   - Verify environment variables are detected
   - Check API key validity

3. **Test Connection**
   - The extension will test connectivity to Z.ai endpoints
   - Verify response times and error handling

### Manual Testing

1. **Check Environment Variables**
   ```bash
   # macOS/Linux
   echo $ANTHROPIC_BASE_URL
   echo $ANTHROPIC_AUTH_TOKEN
   
   # Windows
   $env:ANTHROPIC_BASE_URL
   $env:ANTHROPIC_AUTH_TOKEN
   ```

2. **Test API Connection**
   ```bash
   curl -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"model": "glm-4.5", "max_tokens": 10}' \
        "$ANTHROPIC_BASE_URL/v1/messages"
   ```

## Troubleshooting

### Common Issues

#### Environment Variables Not Detected
- **Symptoms**: Extension shows Z.ai as not configured
- **Solutions**:
  1. Verify variables are set in the correct location
  2. Restart VS Code after setting variables
  3. Check platform-specific setup instructions
  4. Use the extension's setup wizard for guided configuration

#### API Key Issues
- **Symptoms**: Authentication errors, connection failures
- **Solutions**:
  1. Verify API key is valid at [Z.ai API Key Management](https://z.ai/manage-apikey/apikey-list)
  2. Check for typos in the API key
  3. Ensure no extra spaces in the key
  4. Generate a new API key if needed

#### Network Issues
- **Symptoms**: Timeout errors, connection refused
- **Solutions**:
  1. Check internet connectivity
  2. Verify firewall settings
  3. Test with curl or other HTTP clients
  4. Contact Z.ai support if issues persist

### Debug Mode

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

## Best Practices

### Security
- Never commit API keys to version control
- Use environment variables instead of hardcoding keys
- Regularly rotate your API keys
- Use separate keys for different environments

### Performance
- Choose the appropriate model for your task (GLM-4.5 for complex tasks, GLM-4.5-Air for simple tasks)
- Monitor usage and costs through Z.ai dashboard
- Implement caching where appropriate

### Maintenance
- Regularly update the extension
- Monitor Z.ai service status
- Keep API keys current
- Test configuration after updates

## Migration from Previous Configuration

If you previously stored Z.ai API keys in VS Code settings, the extension will automatically detect this and offer to migrate to environment variables:

1. **Run Diagnostics**
   ```bash
   Claude: Run Configuration Diagnostics
   ```

2. **Follow Migration Wizard**
   - The extension will detect old configurations
   - Choose to migrate to environment variables
   - Follow the guided migration process

3. **Verify Migration**
   - Test that Z.ai models work after migration
   - Remove old API key storage if desired

## Support

### Getting Help
- **Extension Issues**: Check the extension's troubleshooting section
- **Z.ai Issues**: Contact [Z.ai Support](https://z.ai/support)
- **Community**: Join discussions in the extension's repository

### Resources
- [Z.ai Documentation](https://docs.z.ai)
- [Z.ai API Reference](https://docs.z.ai/api-reference)
- [Claude Code Documentation](https://docs.anthropic.com/claude/docs)
- [Extension Repository](https://github.com/trevor-amta/claude-code-model-switcher)

### Reporting Issues
When reporting issues, please include:
- Extension version
- VS Code version
- Operating system
- Configuration method (environment variables vs other)
- Debug logs (if available)
- Steps to reproduce the issue