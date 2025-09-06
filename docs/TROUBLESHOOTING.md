# Troubleshooting Guide

This guide provides comprehensive troubleshooting information for common issues with the Claude Code Model Switcher extension.

## Quick Diagnosis

### First Steps
1. **Run Diagnostics**
   ```bash
   Claude: Run Configuration Diagnostics
   ```
   This will check most common issues and provide specific recommendations.

2. **Check Extension Status**
   - Verify extension is enabled in VS Code
   - Check for extension updates
   - Review extension logs

3. **Enable Debug Mode**
   ```json
   {
     "claudeModelSwitcher.debugMode": true
   }
   ```

## Common Issues

### Extension Not Working

#### Extension Not Activating
**Symptoms**: Extension commands not available, status bar not showing

**Causes**:
- Extension disabled
- VS Code version incompatible
- Extension corrupted during installation

**Solutions**:
1. Check extension is enabled:
   - Extensions tab (Ctrl+Shift+X)
   - Search for "Claude Code Model Switcher"
   - Ensure extension is enabled

2. Check VS Code version:
   - Requires VS Code 1.85.0+
   - Update VS Code if needed

3. Reinstall extension:
   - Disable and re-enable extension
   - Uninstall and reinstall from VSIX

#### Commands Not Available
**Symptoms**: Claude commands not showing in command palette

**Causes**:
- Extension not activated
- Commands not registered properly
- VS Code needs restart

**Solutions**:
1. Restart VS Code
2. Check extension activation:
   - Open Command Palette
   - Type "Developer: Reload Window"
3. Check for errors in Developer Tools:
   - Help > Toggle Developer Tools
   - Console tab

## Configuration Issues

### API Key Problems

#### API Key Not Found
**Symptoms**: "API key not configured" error messages

**Causes**:
- API key not set up
- Environment variables not detected
- Configuration storage issues

**Solutions**:
1. **For Anthropic**:
   ```bash
   Claude: Configure API Keys
   ```
   Select Anthropic and enter your API key

2. **For Z.ai**:
   ```bash
   Claude: Setup Environment Variables
   ```
   Follow the Z.ai setup wizard

3. **Check Environment Variables**:
   ```bash
   # macOS/Linux
   echo $ANTHROPIC_BASE_URL
   echo $ANTHROPIC_AUTH_TOKEN
   
   # Windows
   $env:ANTHROPIC_BASE_URL
   $env:ANTHROPIC_AUTH_TOKEN
   ```

#### Invalid API Key
**Symptoms**: Authentication errors, 401/403 errors

**Causes**:
- Invalid API key
- Expired API key
- Wrong key format

**Solutions**:
1. **Verify API Key**:
   - Check API key at provider's dashboard
   - Ensure no extra spaces or characters
   - Verify key format (Anthropic: `sk-...`, Z.ai: `zai_...`)

2. **Test API Key**:
   ```bash
   # Test Anthropic
   curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
        -H "Content-Type: application/json" \
        "https://api.anthropic.com/v1/messages"
   
   # Test Z.ai
   curl -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        "$ANTHROPIC_BASE_URL/v1/messages"
   ```

3. **Regenerate API Key**:
   - Generate new API key from provider dashboard
   - Update configuration with new key

### Environment Variable Issues

#### Environment Variables Not Detected
**Symptoms**: Z.ai not working, extension shows "not configured"

**Causes**:
- Variables not set before VS Code launch
- Variables set in wrong location
- Case sensitivity issues

**Solutions**:
1. **Set Variables Correctly**:
   ```bash
   # Set before launching VS Code
   export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
   export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here
   
   # Launch VS Code from same terminal
   code .
   ```

2. **Check Variable Location**:
   - macOS/Linux: `~/.zshrc`, `~/.bashrc`, `~/.profile`
   - Windows: System Properties > Environment Variables

3. **Restart VS Code**:
   - Close all VS Code windows
   - Launch VS Code again

#### Persistent Environment Variables
**Symptoms**: Variables work temporarily but not after system restart

**Causes**:
- Variables set only for current session
- Wrong profile file edited
- System not configured for persistence

**Solutions**:
1. **macOS**:
   ```bash
   # Add to ~/.zshrc (default)
   echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.zshrc
   echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.zshrc
   source ~/.zshrc
   ```

2. **Linux**:
   ```bash
   # Add to ~/.bashrc or ~/.profile
   echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.bashrc
   echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Windows**:
   ```powershell
   # Set persistent environment variables
   [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic", "User")
   [Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "your_zai_api_key_here", "User")
   ```

## Model Switching Issues

### Model Switch Not Working

#### Configuration File Not Updated
**Symptoms**: Model switch command succeeds but Claude Code doesn't use new model

**Causes**:
- Claude Code configuration file not found
- File permissions issues
- Claude Code not reading configuration

**Solutions**:
1. **Check Configuration File**:
   ```bash
   # macOS/Linux
   cat ~/.claude/settings.json
   
   # Windows
   type %USERPROFILE%\.claude\settings.json
   ```

2. **Verify File Permissions**:
   ```bash
   # Check file exists and is readable
   ls -la ~/.claude/settings.json
   ```

3. **Manual Configuration Test**:
   ```bash
   # Create test configuration
   mkdir -p ~/.claude
   echo '{"model": "claude-sonnet-4-20250514"}' > ~/.claude/settings.json
   ```

#### Claude Code Not Reloading
**Symptoms**: Model change doesn't take effect

**Causes**:
- VS Code window not reloaded
- Claude Code process still running
- Reload behavior settings

**Solutions**:
1. **Reload VS Code Window**:
   ```bash
   # Command Palette
   Developer: Reload Window
   ```

2. **Check Reload Settings**:
   ```json
   {
     "claudeModelSwitcher.reloadBehavior": "prompt"  // or "auto" or "skip"
   }
   ```

3. **Restart Claude Code**:
   - Close VS Code
   - End any running Claude Code processes
   - Restart VS Code

### Model Not Available

#### Model Not in List
**Symptoms**: Desired model not showing in selection list

**Causes**:
- Model not configured
- Model configuration incorrect
- Provider not configured

**Solutions**:
1. **Check Available Models**:
   ```bash
   Claude: Configure Available Models
   ```

2. **Add Custom Model**:
   ```json
   {
     "claudeModelSwitcher.availableModels": [
       {
         "name": "custom-model",
         "displayName": "Custom Model",
         "description": "Custom model configuration",
         "endpoint": "https://api.example.com",
         "type": "api"
       }
     ]
   }
   ```

3. **Verify Provider Configuration**:
   - Ensure provider API keys are configured
   - Check provider connectivity

## Network and Connectivity Issues

### API Connection Problems

#### Connection Timeouts
**Symptoms**: Requests time out, slow response times

**Causes**:
- Network connectivity issues
- Firewall blocking requests
- API service downtime

**Solutions**:
1. **Test Network Connectivity**:
   ```bash
   # Test basic connectivity
   ping api.anthropic.com
   ping api.z.ai
   
   # Test API endpoints
   curl -I https://api.anthropic.com
   curl -I https://api.z.ai
   ```

2. **Check Firewall Settings**:
   - Ensure VS Code can access external APIs
   - Check corporate firewall restrictions
   - Verify proxy settings if applicable

3. **Check Service Status**:
   - [Anthropic Status](https://status.anthropic.com)
   - [Z.ai Status](https://status.z.ai)

#### SSL/TLS Issues
**Symptoms**: Certificate errors, SSL handshake failures

**Causes**:
- Outdated certificates
- Corporate SSL inspection
- Network interference

**Solutions**:
1. **Update Certificates**:
   - Update system certificates
   - Update VS Code to latest version

2. **Check Corporate Network**:
   - Contact IT department about SSL inspection
   - Configure proxy settings if needed

3. **Test with Different Network**:
   - Try different internet connection
   - Test from home network if possible

## Z.ai Specific Issues

### Z.ai Configuration Problems

#### Z.ai Models Not Working
**Symptoms**: Z.ai models showing as not configured

**Causes**:
- Environment variables not set
- API key format incorrect
- Base URL incorrect

**Solutions**:
1. **Verify Environment Variables**:
   ```bash
   # Check variables are set correctly
   echo "Base URL: $ANTHROPIC_BASE_URL"
   echo "Auth Token: $ANTHROPIC_AUTH_TOKEN"
   
   # Should show:
   # Base URL: https://api.z.ai/api/anthropic
   # Auth Token: zai_...
   ```

2. **Use Setup Wizard**:
   ```bash
   Claude: Setup Environment Variables
   ```

3. **Test Z.ai API**:
   ```bash
   curl -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"model": "glm-4.5", "max_tokens": 10, "messages": [{"role": "user", "content": "Hello"}]}' \
        "$ANTHROPIC_BASE_URL/v1/messages"
   ```

#### Migration Issues
**Symptoms**: Issues after updating extension or migrating configuration

**Causes**:
- Old configuration format
- API keys stored in wrong location
- Migration process incomplete

**Solutions**:
1. **Run Migration Wizard**:
   ```bash
   Claude: Run Configuration Diagnostics
   ```

2. **Manual Migration**:
   - Check for old Z.ai API keys in VS Code settings
   - Remove old configurations
   - Set up environment variables properly

3. **Clean Configuration**:
   - Reset extension settings
   - Reconfigure from scratch

## Status Bar Issues

### Status Bar Not Showing

#### Status Bar Disabled
**Symptoms**: Model name not showing in status bar

**Causes**:
- Status bar disabled in settings
- Extension not activated
- VS Code status bar hidden

**Solutions**:
1. **Check Extension Settings**:
   ```json
   {
     "claudeModelSwitcher.showStatusBar": true
   }
   ```

2. **Check VS Code Status Bar**:
   - View > Appearance > Status Bar
   - Ensure status bar is visible

3. **Restart Extension**:
   - Disable and re-enable extension
   - Reload VS Code window

#### Status Bar Not Updating
**Symptoms**: Status bar shows old model after switch

**Causes**:
- Extension not receiving update events
- Configuration not applied
- Cache issues

**Solutions**:
1. **Manual Refresh**:
   - Click on status bar item
   - Use "Show Current Model" command

2. **Clear Extension Cache**:
   - Reload VS Code window
   - Restart VS Code completely

3. **Check for Errors**:
   - Enable debug mode
   - Check console for error messages

## Debugging and Logs

### Enable Debug Mode

**Step-by-Step**:
1. Open VS Code settings
2. Search for "Claude Model Switcher"
3. Enable "Debug Mode" option
4. Reload VS Code window

**Or via settings.json**:
```json
{
  "claudeModelSwitcher.debugMode": true
}
```

### View Logs

**VS Code Developer Tools**:
1. Help > Toggle Developer Tools
2. Go to Console tab
3. Look for messages prefixed with `[Claude Model Switcher]`

**Extension Output Channel**:
1. View > Output
2. Select "Claude Model Switcher" from dropdown

### Common Log Messages

#### Information Messages
- `[Claude Model Switcher] Extension activated`
- `[Claude Model Switcher] Model switched to: model-name`
- `[Claude Model Switcher] Configuration loaded successfully`

#### Warning Messages
- `[Claude Model Switcher] API key not configured for provider`
- `[Claude Model Switcher] Environment variables not detected`
- `[Claude Model Switcher] Using fallback configuration`

#### Error Messages
- `[Claude Model Switcher] Failed to update model configuration`
- `[Claude Model Switcher] API request failed`
- `[Claude Model Switcher] Configuration file not found`

## Performance Issues

### Slow Model Switching

#### Causes and Solutions
1. **Network Latency**:
   - Check internet connection
   - Try different models/providers
   - Consider using local models if available

2. **VS Code Performance**:
   - Close unused extensions
   - Restart VS Code regularly
   - Check for VS Code updates

3. **System Resources**:
   - Check memory usage
   - Close unused applications
   - Restart system if needed

### High Memory Usage

#### Causes and Solutions
1. **Extension Cache**:
   - Clear extension cache
   - Reload VS Code window
   - Restart VS Code completely

2. **Multiple VS Code Instances**:
   - Close unused VS Code windows
   - Use single VS Code instance
   - Monitor memory usage

## Getting Help

### Before Contacting Support
1. Run diagnostics and note any errors
2. Enable debug mode and reproduce the issue
3. Collect relevant logs and error messages
4. Note your environment (OS, VS Code version, extension version)

### What to Include in Support Requests
- Extension version
- VS Code version
- Operating system
- Configuration method (environment variables vs stored keys)
- Debug logs
- Steps to reproduce the issue
- Screenshots if applicable

### Support Resources
- [GitHub Issues](https://github.com/trevor-amta/claude-code-model-switcher/issues)
- [Z.ai Support](https://z.ai/support)
- [Anthropic Support](https://support.anthropic.com)
- [VS Code Support](https://code.visualstudio.com/support)

### Community Resources
- [Extension Documentation](./README.md)
- [Z.ai Integration Guide](./Z_AI_INTEGRATION.md)
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)
- [Community Discussions](https://github.com/trevor-amta/claude-code-model-switcher/discussions)

## Advanced Troubleshooting

### Manual Configuration Testing

**Test Configuration File**:
```bash
# Create test configuration
mkdir -p ~/.claude
echo '{"model": "claude-sonnet-4-20250514"}' > ~/.claude/settings.json

# Test Z.ai configuration
echo '{"model": "glm-4.5", "env": {"ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic", "ANTHROPIC_AUTH_TOKEN": "your_key"}}' > ~/.claude/settings.json
```

**Test API Connectivity**:
```bash
# Test Anthropic
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "claude-sonnet-4-20250514", "max_tokens": 10, "messages": [{"role": "user", "content": "Hello"}]}' \
     "https://api.anthropic.com/v1/messages"

# Test Z.ai
curl -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"model": "glm-4.5", "max_tokens": 10, "messages": [{"role": "user", "content": "Hello"}]}' \
     "$ANTHROPIC_BASE_URL/v1/messages"
```

### Extension Development Debugging

**Extension Host Debug**:
1. Help > Toggle Developer Tools
2. Go to Sources tab
3. Navigate to extension files
4. Set breakpoints and debug

**Extension Reload**:
```bash
# Command Palette
Developer: Reload Window

# Or
Ctrl+Shift+P > "Developer: Reload Window"
```

This comprehensive troubleshooting guide should help resolve most issues with the Claude Code Model Switcher extension. For persistent issues, please check the support resources or create an issue on GitHub.