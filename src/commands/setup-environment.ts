import * as vscode from 'vscode';
import { EnvironmentService } from '../services/environment-service';
import { StorageService } from '../services/storage-service';
import { NotificationService } from '../services/notification-service';
import { Logger } from '../utils/logger';

export class SetupEnvironmentCommand {
  private readonly logger: Logger;
  private readonly storageService: StorageService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.logger = new Logger('SetupEnvironmentCommand');
    this.storageService = StorageService.getInstance();
    this.notificationService = NotificationService.getInstance();
  }

  public async execute(): Promise<void> {
    try {
      this.logger.info('Setup environment command initiated');

      const action = await this.showMainMenu();
      if (!action) {
        return;
      }

      switch (action) {
        case 'setup-zai':
          await this.setupZaiEnvironment();
          break;
        case 'verify-zai':
          await this.verifyZaiEnvironment();
          break;
        case 'clear-zai':
          await this.clearZaiEnvironment();
          break;
        case 'show-instructions':
          await this.showInstructions();
          break;
      }

    } catch (error) {
      this.logger.error('Setup environment command failed', error);
      await this.notificationService.showError(
        'Failed to setup environment',
        {
          detail: error instanceof Error ? error.message : 'Unknown error occurred',
          actions: ['Retry']
        }
      );
    }
  }

  private async showMainMenu(): Promise<string | undefined> {
    let environmentService: EnvironmentService;
    let zaiStatus: any = { isConfigured: false };

    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
      zaiStatus = await environmentService.getZaiEnvironmentStatus();
    } catch (error) {
      this.logger.warn('Could not get environment service instance', error);
    }

    const items = [
      {
        label: '$(add) Setup Z.ai Environment',
        description: 'Configure environment variables for Z.ai integration',
        detail: zaiStatus.isConfigured ? 'Z.ai environment is already configured' : 'Set up ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL',
        value: 'setup-zai'
      },
      {
        label: '$(check) Verify Z.ai Setup',
        description: 'Check if Z.ai environment variables are properly configured',
        detail: zaiStatus.isConfigured ? 'Verify current configuration' : 'Check configuration status',
        value: 'verify-zai'
      },
      {
        label: '$(trash) Clear Z.ai Environment',
        description: 'Remove Z.ai environment variables',
        detail: zaiStatus.isConfigured ? 'Clear all Z.ai environment variables' : 'No environment variables to clear',
        value: 'clear-zai'
      },
      {
        label: '$(book) Show Manual Setup Instructions',
        description: 'View instructions for manual environment variable setup',
        detail: 'Learn how to set up environment variables manually',
        value: 'show-instructions'
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose environment setup action',
      matchOnDescription: true
    });

    return selection?.value;
  }

  private async setupZaiEnvironment(): Promise<void> {
    let environmentService: EnvironmentService;
    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
    } catch (error) {
      await this.notificationService.showError(
        'Environment service not available. Please restart VS Code and try again.',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
      return;
    }

    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter Z.ai API Key',
      password: true,
      placeHolder: 'Enter your Z.ai API key',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        if (value.trim().length < 10) {
          return 'API key appears to be too short';
        }
        return null;
      },
      ignoreFocusOut: true
    });

    if (!apiKey) {
      return;
    }

    const baseUrl = await vscode.window.showInputBox({
      prompt: 'Enter Z.ai Base URL',
      placeHolder: 'https://api.z.ai/v1',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Base URL cannot be empty';
        }
        try {
          new URL(value.trim());
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      },
      ignoreFocusOut: true
    });

    if (!baseUrl) {
      return;
    }

    const success = await environmentService.setupZaiEnvironment(apiKey.trim(), baseUrl.trim());
    
    if (success) {
      const restart = await vscode.window.showInformationMessage(
        'Z.ai environment variables configured successfully. VS Code needs to restart for changes to take effect.',
        { modal: true },
        'Restart Now',
        'Restart Later'
      );

      if (restart === 'Restart Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } else {
      await this.notificationService.showError('Failed to set up Z.ai environment variables');
    }
  }

  private async verifyZaiEnvironment(): Promise<void> {
    let environmentService: EnvironmentService;
    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
    } catch (error) {
      await this.notificationService.showError(
        'Environment service not available. Please restart VS Code and try again.',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
      return;
    }

    const status = await environmentService.getZaiEnvironmentStatus();

    if (status.isConfigured) {
      await this.notificationService.showInfo(
        `Z.ai environment variables are properly configured:\n\n` +
        `• ANTHROPIC_AUTH_TOKEN: ${status.authToken ? '✅ Set' : '❌ Missing'}\n` +
        `• ANTHROPIC_BASE_URL: ${status.baseUrl ? '✅ Set' : '❌ Missing'}\n` +
        `• Platform: ${status.platform}\n` +
        `• Shell: ${status.shell}\n\n` +
        `Environment variables are ready for use with Z.ai integration.`
      );
    } else {
      const setupAction = await vscode.window.showWarningMessage(
        'Z.ai environment variables are not properly configured.',
        { modal: true },
        'Setup Now',
        'Show Instructions',
        'Cancel'
      );

      if (setupAction === 'Setup Now') {
        await this.setupZaiEnvironment();
      } else if (setupAction === 'Show Instructions') {
        await this.showInstructions();
      }
    }
  }

  private async clearZaiEnvironment(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'This will remove all Z.ai environment variables. Are you sure?',
      { modal: true },
      'Yes, Clear All',
      'Cancel'
    );

    if (confirm !== 'Yes, Clear All') {
      return;
    }

    let environmentService: EnvironmentService;
    try {
      environmentService = EnvironmentService.getInstance(this.storageService.getContext());
    } catch (error) {
      await this.notificationService.showError(
        'Environment service not available. Please restart VS Code and try again.',
        { detail: error instanceof Error ? error.message : 'Unknown error' }
      );
      return;
    }

    const success = await environmentService.clearZaiEnvironment();

    if (success) {
      await this.notificationService.showInfo('Z.ai environment variables cleared successfully');
      
      const restart = await vscode.window.showInformationMessage(
        'Z.ai environment variables cleared. VS Code needs to restart for changes to take effect.',
        { modal: true },
        'Restart Now',
        'Restart Later'
      );

      if (restart === 'Restart Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    } else {
      await this.notificationService.showError('Failed to clear Z.ai environment variables');
    }
  }

  private async showInstructions(): Promise<void> {
    const platform = process.platform;
    let instructions = '';

    if (platform === 'darwin') {
      instructions = `# Z.ai Environment Setup - macOS

## Required Environment Variables

Z.ai integration requires the following environment variables:

- \`ANTHROPIC_AUTH_TOKEN\`: Your Z.ai API key
- \`ANTHROPIC_BASE_URL\`: The Z.ai API endpoint (typically https://api.z.ai/v1)

## Setup Methods

### Method 1: Using this Extension (Recommended)
1. Use the "Setup Z.ai Environment" command
2. Enter your API key and base URL when prompted
3. Restart VS Code when prompted

### Method 2: Manual Setup

#### For Zsh (macOS default):
1. Edit your ~/.zshrc file:
   \`\`\`bash
   nano ~/.zshrc
   \`\`\`

2. Add these lines at the end:
   \`\`\`bash
   export ANTHROPIC_AUTH_TOKEN="your-api-key-here"
   export ANTHROPIC_BASE_URL="https://api.z.ai/v1"
   \`\`\`

3. Save and exit (Ctrl+O, Enter, Ctrl+X)

4. Reload your shell:
   \`\`\`bash
   source ~/.zshrc
   \`\`\`

#### For Bash:
1. Edit your ~/.bash_profile or ~/.bashrc:
   \`\`\`bash
   nano ~/.bash_profile
   \`\`\`

2. Add the same export commands as above

3. Save and reload your shell

### Method 3: System-wide Setup

1. Create or edit /etc/launchd.conf:
   \`\`\`bash
   sudo nano /etc/launchd.conf
   \`\`\`

2. Add:
   \`\`\`
   setenv ANTHROPIC_AUTH_TOKEN your-api-key-here
   setenv ANTHROPIC_BASE_URL https://api.z.ai/v1
   \`\`\`

3. Restart your Mac

## Verification

After setting up, restart VS Code and run the "Verify Z.ai Setup" command to confirm the variables are properly configured.`;
    } else if (platform === 'win32') {
      instructions = `# Z.ai Environment Setup - Windows

## Required Environment Variables

Z.ai integration requires the following environment variables:

- \`ANTHROPIC_AUTH_TOKEN\`: Your Z.ai API key
- \`ANTHROPIC_BASE_URL\`: The Z.ai API endpoint (typically https://api.z.ai/v1)

## Setup Methods

### Method 1: Using this Extension (Recommended)
1. Use the "Setup Z.ai Environment" command
2. Enter your API key and base URL when prompted
3. Restart VS Code when prompted

### Method 2: Windows Settings

1. Press Windows key and type "Environment Variables"
2. Click "Edit the system environment variables"
3. Click "Environment Variables..."
4. Under "User variables", click "New..."
5. For ANTHROPIC_AUTH_TOKEN:
   - Variable name: ANTHROPIC_AUTH_TOKEN
   - Variable value: your-api-key-here
6. Click "New..." again for ANTHROPIC_BASE_URL:
   - Variable name: ANTHROPIC_BASE_URL
   - Variable value: https://api.z.ai/v1
7. Click OK on all dialogs

### Method 3: PowerShell Profile

1. Open PowerShell
2. Run to check if profile exists:
   \`\`\`powershell
   Test-Path $PROFILE
   \`\`\`

3. If not exists, create it:
   \`\`\`powershell
   New-Item -Path $PROFILE -ItemType File -Force
   \`\`\`

4. Edit the profile:
   \`\`\`powershell
   notepad $PROFILE
   \`\`\`

5. Add these lines:
   \`\`\`powershell
   $env:ANTHROPIC_AUTH_TOKEN = "your-api-key-here"
   $env:ANTHROPIC_BASE_URL = "https://api.z.ai/v1"
   \`\`\`

6. Save and restart PowerShell/VS Code

### Method 4: Command Prompt (Temporary)

For current session only:
\`\`\`cmd
set ANTHROPIC_AUTH_TOKEN=your-api-key-here
set ANTHROPIC_BASE_URL=https://api.z.ai/v1
\`\`\`

## Verification

After setting up, restart VS Code and run the "Verify Z.ai Setup" command to confirm the variables are properly configured.`;
    } else {
      instructions = `# Z.ai Environment Setup - Linux

## Required Environment Variables

Z.ai integration requires the following environment variables:

- \`ANTHROPIC_AUTH_TOKEN\`: Your Z.ai API key
- \`ANTHROPIC_BASE_URL\`: The Z.ai API endpoint (typically https://api.z.ai/v1)

## Setup Methods

### Method 1: Using this Extension (Recommended)
1. Use the "Setup Z.ai Environment" command
2. Enter your API key and base URL when prompted
3. Restart VS Code when prompted

### Method 2: Bash Shell

1. Edit your ~/.bashrc file:
   \`\`\`bash
   nano ~/.bashrc
   \`\`\`

2. Add these lines at the end:
   \`\`\`bash
   export ANTHROPIC_AUTH_TOKEN="your-api-key-here"
   export ANTHROPIC_BASE_URL="https://api.z.ai/v1"
   \`\`\`

3. Save and exit (Ctrl+O, Enter, Ctrl+X)

4. Reload your shell:
   \`\`\`bash
   source ~/.bashrc
   \`\`\`

### Method 3: Zsh Shell

If you use Zsh:
1. Edit your ~/.zshrc file:
   \`\`\`bash
   nano ~/.zshrc
   \`\`\`

2. Add the same export commands as above

3. Save and reload your shell

### Method 4: System-wide Setup

1. Edit /etc/environment:
   \`\`\`bash
   sudo nano /etc/environment
   \`\`\`

2. Add these lines:
   \`\`\`
   ANTHROPIC_AUTH_TOKEN="your-api-key-here"
   ANTHROPIC_BASE_URL="https://api.z.ai/v1"
   \`\`\`

3. Save and reboot, or restart your display manager

### Method 5: systemd (for services)

1. Create a systemd environment file:
   \`\`\`bash
   sudo nano /etc/systemd/system/vscode.env
   \`\`\`

2. Add:
   \`\`\`
   ANTHROPIC_AUTH_TOKEN=your-api-key-here
   ANTHROPIC_BASE_URL=https://api.z.ai/v1
   \`\`\`

3. Update systemd:
   \`\`\`bash
   sudo systemctl daemon-reload
   \`\`\`

## Verification

After setting up, restart VS Code and run the "Verify Z.ai Setup" command to confirm the variables are properly configured.`;
    }

    const document = await vscode.workspace.openTextDocument({
      content: instructions,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(document);
  }
}

export async function setupEnvironment(): Promise<void> {
  const command = new SetupEnvironmentCommand();
  await command.execute();
}