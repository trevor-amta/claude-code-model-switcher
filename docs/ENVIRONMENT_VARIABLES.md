# Environment Variable Requirements

This document details the environment variable requirements for different providers supported by the Claude Code Model Switcher extension.

## Overview

The extension uses environment variables for certain providers that require them, particularly Z.ai. Environment variables must be set before launching VS Code for the extension to detect them properly.

## Provider-Specific Requirements

### Z.ai

#### Required Variables
```bash
# Base URL for Z.ai API
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic

# Authentication token (API key)
ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here
```

#### Variable Details
- **ANTHROPIC_BASE_URL**: Must be exactly `https://api.z.ai/api/anthropic`
- **ANTHROPIC_AUTH_TOKEN**: Your Z.ai API key from [Z.ai API Key Management](https://z.ai/manage-apikey/apikey-list)

#### Validation Rules
- URL must be valid and reachable
- API key must be in the correct format (starts with `zai_`)
- Both variables must be set for Z.ai to work
- Variables are case-sensitive

### Anthropic

#### Optional Variables
```bash
# Custom Anthropic API endpoint (optional)
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Anthropic API key (optional - can use extension storage instead)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

#### Variable Details
- **ANTHROPIC_BASE_URL**: Optional, defaults to `https://api.anthropic.com`
- **ANTHROPIC_API_KEY**: Optional, can be stored in extension instead

## Platform-Specific Setup

### macOS

#### Temporary Setup (Current Session)
```bash
# Set variables for current terminal session
export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here

# Launch VS Code from this terminal
code .
```

#### Persistent Setup (Shell Profile)
```bash
# For Zsh (default on macOS)
echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.zshrc
source ~/.zshrc

# For Bash
echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.bash_profile
echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.bash_profile
source ~/.bash_profile
```

#### System-Wide Setup
```bash
# Create environment file
sudo tee /etc/launchd.conf << EOF
setenv ANTHROPIC_BASE_URL https://api.z.ai/api/anthropic
setenv ANTHROPIC_AUTH_TOKEN your_zai_api_key_here
EOF

# Reboot or restart launchd
```

### Linux

#### Temporary Setup (Current Session)
```bash
# Set variables for current terminal session
export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here

# Launch VS Code from this terminal
code .
```

#### Persistent Setup (Shell Profile)
```bash
# For Bash
echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.bashrc
echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.bashrc
source ~/.bashrc

# For Zsh
echo 'export ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here' >> ~/.zshrc
source ~/.zshrc
```

#### System-Wide Setup
```bash
# Create environment file
sudo tee /etc/environment << EOF
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=your_zai_api_key_here
EOF

# Reboot or restart services
```

### Windows

#### Temporary Setup (Current Session)
```powershell
# Set variables for current PowerShell session
$env:ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "your_zai_api_key_here"

# Launch VS Code from this PowerShell session
code .
```

#### Persistent Setup (PowerShell Profile)
```powershell
# Add to PowerShell profile (notepad $PROFILE)
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "your_zai_api_key_here", "User")

# Or add to profile for current user only
echo '$env:ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"' >> $PROFILE
echo '$env:ANTHROPIC_AUTH_TOKEN = "your_zai_api_key_here"' >> $PROFILE
```

#### System-Wide Setup (GUI)
1. Press `Win + R` and type `sysdm.cpl`
2. Go to "Advanced" tab
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Add:
   - Variable name: `ANTHROPIC_BASE_URL`
   - Variable value: `https://api.z.ai/api/anthropic`
6. Click "New" again
7. Add:
   - Variable name: `ANTHROPIC_AUTH_TOKEN`
   - Variable value: `your_zai_api_key_here`
8. Click OK on all windows
9. Restart VS Code

#### System-Wide Setup (Command Line)
```powershell
# Set user environment variables (requires admin privileges for system-wide)
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "your_zai_api_key_here", "User")

# Or system-wide (affects all users)
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic", "Machine")
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "your_zai_api_key_here", "Machine")
```

## Validation and Verification

### Check Environment Variables

#### macOS/Linux
```bash
# Check if variables are set
echo "Base URL: $ANTHROPIC_BASE_URL"
echo "Auth Token: $ANTHROPIC_AUTH_TOKEN"

# Or use env command
env | grep ANTHROPIC
```

#### Windows
```powershell
# Check if variables are set
Write-Host "Base URL: $env:ANTHROPIC_BASE_URL"
Write-Host "Auth Token: $env:ANTHROPIC_AUTH_TOKEN"

# Or use Get-ChildItem
Get-ChildItem Env: | Where-Object Name -like "ANTHROPIC*"
```

### Test API Connectivity

#### Using curl
```bash
# Test Z.ai API connectivity
curl -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"model": "glm-4.5", "max_tokens": 10, "messages": [{"role": "user", "content": "Hello"}]}' \
     "$ANTHROPIC_BASE_URL/v1/messages"
```

#### Using the Extension
```bash
# Run extension diagnostics
Claude: Run Configuration Diagnostics
```

## Best Practices

### Security
- Never commit API keys to version control
- Use environment variables instead of hardcoding
- Regularly rotate API keys
- Use separate keys for different environments
- Keep API keys secure and limit access

### Configuration Management
- Document your environment variable setup
- Use consistent naming conventions
- Test setup after changes
- Maintain backup of configuration
- Use version control for setup scripts

### Troubleshooting
- Verify variables are set before launching VS Code
- Check for typos in variable names
- Ensure no extra spaces in values
- Test connectivity to API endpoints
- Use extension diagnostics for validation

## Common Issues and Solutions

### Variables Not Detected
- **Issue**: Extension doesn't detect environment variables
- **Solution**: Restart VS Code after setting variables
- **Check**: Verify variables are set in correct location

### Incorrect Variable Names
- **Issue**: Variables not working due to case sensitivity
- **Solution**: Use exact variable names (case-sensitive)
- **Check**: Verify spelling and case of variable names

### API Key Format Issues
- **Issue**: Authentication failures
- **Solution**: Ensure API key is in correct format
- **Check**: Verify API key starts with `zai_` for Z.ai

### URL Format Issues
- **Issue**: Connection failures
- **Solution**: Use exact URL format
- **Check**: Verify no extra spaces or characters in URL

## Extension Integration

### Automatic Detection
The extension automatically detects environment variables and prioritizes them over stored API keys for providers that require them.

### Fallback Behavior
If environment variables are not set, the extension falls back to stored API keys for providers that support both methods.

### Validation
The extension validates environment variables:
- Checks if variables are set
- Validates URL format
- Verifies API key format
- Tests connectivity when possible

### Status Reporting
The extension reports environment variable status through:
- Status bar indicators
- Diagnostic reports
- Configuration commands
- Error messages with actionable feedback

## Migration from Stored API Keys

If you previously stored Z.ai API keys in VS Code settings, the extension will:

1. **Detect** existing configurations
2. **Offer** migration to environment variables
3. **Guide** you through the migration process
4. **Validate** the new configuration
5. **Clean up** old settings if requested

Use the migration wizard:
```bash
Claude: Run Configuration Diagnostics
```

## Support

For additional help:
- Check the [Z.ai Integration Guide](./Z_AI_INTEGRATION.md)
- Use the extension's diagnostic commands
- Refer to platform-specific documentation
- Contact support for persistent issues