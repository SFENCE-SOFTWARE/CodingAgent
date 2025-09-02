// src/settingsPanel.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ToolsService } from './tools';

export class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;
  public static readonly viewType = 'codingagent-settings';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      'CodingAgent Settings',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'src', 'webview')
        ]
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      e => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.type) {
          case 'getConfiguration':
            this._sendConfiguration();
            break;
          case 'updateConfiguration':
            this._updateConfiguration(message.config);
            break;
          case 'resetToDefaults':
            this._resetToDefaults();
            break;
          case 'createMode':
            this._createMode(message.mode);
            break;
          case 'updateMode':
            this._updateMode(message.modeName, message.mode);
            break;
          case 'deleteMode':
            this._deleteMode(message.modeName);
            break;
          case 'duplicateMode':
            this._duplicateMode(message.modeName, message.newName);
            break;
          case 'selectLogFile':
            this._selectLogFile();
            break;
          case 'selectLogModeFile':
            this._selectLogModeFile();
            break;
          case 'testConnection':
            this._testConnection(message.host, message.port, message.apiKey);
            break;
          case 'showMessage':
            vscode.window.showInformationMessage(message.message);
            break;
          case 'showError':
            vscode.window.showErrorMessage(message.message);
            break;
          case 'saveProfile':
            this._saveProfile(message.profileName);
            break;
          case 'loadProfile':
            this._loadProfile(message.profileName);
            break;
          case 'deleteProfile':
            this._deleteProfile(message.profileName);
            break;
          case 'listProfiles':
            this._listProfiles();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    SettingsPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'CodingAgent Settings';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _sendConfiguration() {
    const config = vscode.workspace.getConfiguration('codingagent');
    
    // Get available tools from ToolsService
    const toolsService = new ToolsService();
    const availableTools = toolsService.getAllToolsInfo();
    
    this._panel.webview.postMessage({
      type: 'configurationData',
      config: {
        host: config.get('openai.host'),
        port: config.get('openai.port'),
        apiKey: config.get('openai.apiKey'),
        currentMode: config.get('currentMode'),
        currentModel: config.get('currentModel'),
        showThinking: config.get('showThinking'),
        enableStreaming: config.get('enableStreaming'),
        iterationThreshold: config.get('iterationThreshold'),
        enableProjectMemory: config.get('memory.enableProjectMemory'),
        askUser: {
          uncertaintyThreshold: config.get('askUser.uncertaintyThreshold')
        },
        modes: config.get('modes'),
        tools: {
          readFileMaxLines: config.get('tools.readFileMaxLines'),
          autoApproveCommands: config.get('tools.autoApproveCommands')
        },
        memory: {
          maxLines: config.get('memory.maxLines'),
          maxChars: config.get('memory.maxChars'),
          autoSafetyLimit: config.get('memory.autoSafetyLimit'),
          largeValueThreshold: config.get('memory.largeValueThreshold')
        },
        plan: {
          autoEvaluation: {
            enabled: config.get('plan.autoEvaluation.enabled'),
            enabledModes: config.get('plan.autoEvaluation.enabledModes'),
            skipCallUnderMode: config.get('plan.autoEvaluation.skipCallUnderMode'),
            autoSendCorrection: config.get('plan.autoEvaluation.autoSendCorrection'),
            evaluationDelay: config.get('plan.autoEvaluation.evaluationDelay')
          },
          prompts: {
            planReview: config.get('plan.prompts.planReview'),
            implementation: config.get('plan.prompts.implementation'),
            codeReview: config.get('plan.prompts.codeReview'),
            testing: config.get('plan.prompts.testing'),
            acceptance: config.get('plan.prompts.acceptance')
          }
        },
        logging: {
          enabled: config.get('logging.enabled'),
          filePath: config.get('logging.filePath'),
          verbosity: config.get('logging.verbosity'),
          logMode: config.get('logging.logMode'),
          logModeFilePath: config.get('logging.logModeFilePath')
        }
      },
      availableTools: availableTools
    });

    // Also send profiles list
    this._listProfiles();
  }

  private async _updateConfiguration(configUpdate: any) {
    try {
      const config = vscode.workspace.getConfiguration('codingagent');
      
      for (const [key, value] of Object.entries(configUpdate)) {
        await config.update(key, value, vscode.ConfigurationTarget.Global);
      }

      this._panel.webview.postMessage({
        type: 'configurationUpdated',
        success: true
      });

      vscode.window.showInformationMessage('Settings updated successfully');
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'configurationUpdated',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async _resetToDefaults() {
    const result = await vscode.window.showWarningMessage(
      'Are you sure you want to reset all CodingAgent settings to their default values? This action cannot be undone.',
      { modal: true },
      'Reset'
    );

    if (result === 'Reset') {
      try {
        const config = vscode.workspace.getConfiguration('codingagent');
        
        // Reset all settings to their defaults
        await config.update('openai.host', undefined, vscode.ConfigurationTarget.Global);
        await config.update('openai.port', undefined, vscode.ConfigurationTarget.Global);
        await config.update('openai.apiKey', undefined, vscode.ConfigurationTarget.Global);
        await config.update('currentMode', undefined, vscode.ConfigurationTarget.Global);
        await config.update('currentModel', undefined, vscode.ConfigurationTarget.Global);
        await config.update('showThinking', undefined, vscode.ConfigurationTarget.Global);
        await config.update('enableStreaming', undefined, vscode.ConfigurationTarget.Global);
        await config.update('modes', undefined, vscode.ConfigurationTarget.Global);
        await config.update('logging.enabled', undefined, vscode.ConfigurationTarget.Global);
        await config.update('logging.filePath', undefined, vscode.ConfigurationTarget.Global);
        await config.update('logging.verbosity', undefined, vscode.ConfigurationTarget.Global);
        await config.update('logging.logMode', undefined, vscode.ConfigurationTarget.Global);
        await config.update('logging.logModeFilePath', undefined, vscode.ConfigurationTarget.Global);
        await config.update('tools.readFileMaxLines', undefined, vscode.ConfigurationTarget.Global);
        await config.update('tools.autoApproveCommands', undefined, vscode.ConfigurationTarget.Global);
        await config.update('memory.maxLines', undefined, vscode.ConfigurationTarget.Global);
        await config.update('memory.maxChars', undefined, vscode.ConfigurationTarget.Global);
        await config.update('memory.autoSafetyLimit', undefined, vscode.ConfigurationTarget.Global);
        await config.update('memory.largeValueThreshold', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.autoEvaluation.enabled', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.autoEvaluation.enabledModes', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.autoEvaluation.skipCallUnderMode', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.autoEvaluation.autoSendCorrection', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.autoEvaluation.evaluationDelay', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.prompts.planReview', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.prompts.implementation', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.prompts.codeReview', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.prompts.testing', undefined, vscode.ConfigurationTarget.Global);
        await config.update('plan.prompts.acceptance', undefined, vscode.ConfigurationTarget.Global);

        this._sendConfiguration();
        
        this._panel.webview.postMessage({
          type: 'settingsReset',
          success: true
        });

        vscode.window.showInformationMessage('Settings have been reset to defaults');
      } catch (error) {
        this._panel.webview.postMessage({
          type: 'settingsReset',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async _createMode(mode: any) {
    try {
      const config = vscode.workspace.getConfiguration('codingagent');
      const modes = { ...config.get('modes', {}) } as Record<string, any>;
      
      if (modes[mode.name]) {
        throw new Error(`Mode "${mode.name}" already exists`);
      }

      modes[mode.name] = {
        systemMessage: mode.systemMessage,
        orchestrationMessage: mode.orchestrationMessage,
        allowedTools: mode.allowedTools,
        fallbackMessage: mode.fallbackMessage,
        temperature: mode.temperature,
        top_p: mode.top_p,
        presence_penalty: mode.presence_penalty,
        frequency_penalty: mode.frequency_penalty,
        autoEvaluation: mode.autoEvaluation,
        description: mode.description
      };

      await config.update('modes', modes, vscode.ConfigurationTarget.Global);

      this._panel.webview.postMessage({
        type: 'modeCreated',
        success: true,
        modeName: mode.name
      });

      vscode.window.showInformationMessage(`Mode "${mode.name}" created successfully`);
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'modeCreated',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async _updateMode(modeName: string, mode: any) {
    try {
      const config = vscode.workspace.getConfiguration('codingagent');
      const modes = { ...config.get('modes', {}) } as Record<string, any>;
      
      if (!modes[modeName]) {
        throw new Error(`Mode "${modeName}" does not exist`);
      }

      modes[modeName] = {
        systemMessage: mode.systemMessage,
        orchestrationMessage: mode.orchestrationMessage,
        allowedTools: mode.allowedTools,
        fallbackMessage: mode.fallbackMessage,
        temperature: mode.temperature,
        top_p: mode.top_p,
        presence_penalty: mode.presence_penalty,
        frequency_penalty: mode.frequency_penalty,
        autoEvaluation: mode.autoEvaluation,
        description: mode.description
      };

      await config.update('modes', modes, vscode.ConfigurationTarget.Global);

      this._panel.webview.postMessage({
        type: 'modeUpdated',
        success: true,
        modeName: modeName
      });

      vscode.window.showInformationMessage(`Mode "${modeName}" updated successfully`);
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'modeUpdated',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async _deleteMode(modeName: string) {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the mode "${modeName}"? This action cannot be undone.`,
      { modal: true },
      'Delete',
      'Cancel'
    );

    if (result === 'Delete') {
      try {
        const config = vscode.workspace.getConfiguration('codingagent');
        const modes = { ...config.get('modes', {}) } as Record<string, any>;
        
        if (!modes[modeName]) {
          throw new Error(`Mode "${modeName}" does not exist`);
        }

        delete modes[modeName];
        await config.update('modes', modes, vscode.ConfigurationTarget.Global);

        this._panel.webview.postMessage({
          type: 'modeDeleted',
          success: true,
          modeName: modeName
        });

        vscode.window.showInformationMessage(`Mode "${modeName}" deleted successfully`);
      } catch (error) {
        this._panel.webview.postMessage({
          type: 'modeDeleted',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async _duplicateMode(originalName: string, newName: string) {
    try {
      const config = vscode.workspace.getConfiguration('codingagent');
      const modes = { ...config.get('modes', {}) } as Record<string, any>;
      
      if (!modes[originalName]) {
        throw new Error(`Mode "${originalName}" does not exist`);
      }

      if (modes[newName]) {
        throw new Error(`Mode "${newName}" already exists`);
      }

      modes[newName] = { ...modes[originalName] };
      await config.update('modes', modes, vscode.ConfigurationTarget.Global);

      this._panel.webview.postMessage({
        type: 'modeDuplicated',
        success: true,
        originalName: originalName,
        newName: newName
      });

      vscode.window.showInformationMessage(`Mode duplicated as "${newName}"`);
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'modeDuplicated',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async _selectLogFile() {
    const options: vscode.SaveDialogOptions = {
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
      filters: {
        'Log files': ['log', 'txt'],
        'All files': ['*']
      }
    };

    const fileUri = await vscode.window.showSaveDialog(options);
    if (fileUri) {
      this._panel.webview.postMessage({
        type: 'logFileSelected',
        filePath: fileUri.fsPath
      });
    }
  }

  private async _selectLogModeFile() {
    const options: vscode.SaveDialogOptions = {
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
      filters: {
        'Log files': ['log', 'txt'],
        'All files': ['*']
      }
    };

    const fileUri = await vscode.window.showSaveDialog(options);
    if (fileUri) {
      this._panel.webview.postMessage({
        type: 'logModeFileSelected',
        filePath: fileUri.fsPath
      });
    }
  }

  private async _testConnection(host: string, port: number, apiKey: string) {
    try {
      const baseUrl = `http://${host}:${port}`;
      
      // Test connection by trying to fetch models
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Use API key if provided, otherwise use dummy authorization for local models
      if (apiKey && apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        headers['Authorization'] = 'Bearer dummy';
      }

      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const models = await response.json();
        this._panel.webview.postMessage({
          type: 'connectionTestResult',
          success: true,
          message: `✅ Connected successfully! Found ${models.models?.length || 0} models.`
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'connectionTestResult',
        success: false,
        message: `❌ Connection failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private _getProfilesPath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return path.join(workspaceFolder.uri.fsPath, '.codingagent', 'profiles');
    }
    
    // Fallback to global storage if no workspace
    const homeDir = require('os').homedir();
    return path.join(homeDir, '.codingagent', 'profiles');
  }

  private async _saveProfile(profileName: string) {
    try {
      if (!profileName || profileName.trim() === '') {
        throw new Error('Profile name cannot be empty');
      }

      // Validate profile name (no special characters)
      if (!/^[a-zA-Z0-9_-]+$/.test(profileName)) {
        throw new Error('Profile name can only contain letters, numbers, underscores, and hyphens');
      }

      const config = vscode.workspace.getConfiguration('codingagent');
      
      // Get current configuration
      const profileData = {
        host: config.get('openai.host'),
        port: config.get('openai.port'),
        apiKey: config.get('openai.apiKey'),
        currentMode: config.get('currentMode'),
        currentModel: config.get('currentModel'),
        showThinking: config.get('showThinking'),
        enableStreaming: config.get('enableStreaming'),
        iterationThreshold: config.get('iterationThreshold'),
        enableProjectMemory: config.get('memory.enableProjectMemory'),
        askUser: {
          uncertaintyThreshold: config.get('askUser.uncertaintyThreshold')
        },
        modes: config.get('modes'),
        tools: {
          readFileMaxLines: config.get('tools.readFileMaxLines'),
          autoApproveCommands: config.get('tools.autoApproveCommands')
        },
        memory: {
          maxLines: config.get('memory.maxLines'),
          maxChars: config.get('memory.maxChars'),
          autoSafetyLimit: config.get('memory.autoSafetyLimit'),
          largeValueThreshold: config.get('memory.largeValueThreshold')
        },
        logging: {
          enabled: config.get('logging.enabled'),
          filePath: config.get('logging.filePath'),
          verbosity: config.get('logging.verbosity'),
          logMode: config.get('logging.logMode'),
          logModeFilePath: config.get('logging.logModeFilePath')
        },
        plan: {
          autoEvaluation: {
            enabled: config.get('plan.autoEvaluation.enabled'),
            enabledModes: config.get('plan.autoEvaluation.enabledModes'),
            skipCallUnderMode: config.get('plan.autoEvaluation.skipCallUnderMode'),
            autoSendCorrection: config.get('plan.autoEvaluation.autoSendCorrection'),
            evaluationDelay: config.get('plan.autoEvaluation.evaluationDelay')
          },
          prompts: {
            planReview: config.get('plan.prompts.planReview'),
            implementation: config.get('plan.prompts.implementation'),
            codeReview: config.get('plan.prompts.codeReview'),
            testing: config.get('plan.prompts.testing'),
            acceptance: config.get('plan.prompts.acceptance')
          }
        },
        savedAt: new Date().toISOString()
      };

      const profilesPath = this._getProfilesPath();
      const profileFile = path.join(profilesPath, `${profileName}.json`);

      // Ensure profiles directory exists
      if (!fs.existsSync(profilesPath)) {
        fs.mkdirSync(profilesPath, { recursive: true });
      }

      // Save profile
      fs.writeFileSync(profileFile, JSON.stringify(profileData, null, 2));

      this._panel.webview.postMessage({
        type: 'profileSaved',
        success: true,
        profileName: profileName
      });

      vscode.window.showInformationMessage(`Profile "${profileName}" saved successfully`);
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'profileSaved',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async _loadProfile(profileName: string) {
    try {
      if (!profileName || profileName.trim() === '') {
        throw new Error('Profile name cannot be empty');
      }

      const profilesPath = this._getProfilesPath();
      const profileFile = path.join(profilesPath, `${profileName}.json`);

      if (!fs.existsSync(profileFile)) {
        throw new Error(`Profile "${profileName}" not found`);
      }

      const profileData = JSON.parse(fs.readFileSync(profileFile, 'utf-8'));
      const config = vscode.workspace.getConfiguration('codingagent');

      // Apply profile settings
      await config.update('openai.host', profileData.host, vscode.ConfigurationTarget.Global);
      await config.update('openai.port', profileData.port, vscode.ConfigurationTarget.Global);
      await config.update('openai.apiKey', profileData.apiKey, vscode.ConfigurationTarget.Global);
      await config.update('currentMode', profileData.currentMode, vscode.ConfigurationTarget.Global);
      await config.update('currentModel', profileData.currentModel, vscode.ConfigurationTarget.Global);
      await config.update('showThinking', profileData.showThinking, vscode.ConfigurationTarget.Global);
      await config.update('enableStreaming', profileData.enableStreaming, vscode.ConfigurationTarget.Global);
      await config.update('iterationThreshold', profileData.iterationThreshold, vscode.ConfigurationTarget.Global);
      await config.update('memory.enableProjectMemory', profileData.enableProjectMemory, vscode.ConfigurationTarget.Global);
      
      if (profileData.askUser) {
        await config.update('askUser.uncertaintyThreshold', profileData.askUser.uncertaintyThreshold, vscode.ConfigurationTarget.Global);
      }
      
      if (profileData.modes) {
        await config.update('modes', profileData.modes, vscode.ConfigurationTarget.Global);
      }
      
      if (profileData.tools) {
        await config.update('tools.readFileMaxLines', profileData.tools.readFileMaxLines, vscode.ConfigurationTarget.Global);
        await config.update('tools.autoApproveCommands', profileData.tools.autoApproveCommands, vscode.ConfigurationTarget.Global);
      }
      
      if (profileData.memory) {
        await config.update('memory.maxLines', profileData.memory.maxLines, vscode.ConfigurationTarget.Global);
        await config.update('memory.maxChars', profileData.memory.maxChars, vscode.ConfigurationTarget.Global);
        await config.update('memory.autoSafetyLimit', profileData.memory.autoSafetyLimit, vscode.ConfigurationTarget.Global);
        await config.update('memory.largeValueThreshold', profileData.memory.largeValueThreshold, vscode.ConfigurationTarget.Global);
      }
      
      if (profileData.logging) {
        await config.update('logging.enabled', profileData.logging.enabled, vscode.ConfigurationTarget.Global);
        await config.update('logging.filePath', profileData.logging.filePath, vscode.ConfigurationTarget.Global);
        await config.update('logging.verbosity', profileData.logging.verbosity, vscode.ConfigurationTarget.Global);
        await config.update('logging.logMode', profileData.logging.logMode, vscode.ConfigurationTarget.Global);
        await config.update('logging.logModeFilePath', profileData.logging.logModeFilePath, vscode.ConfigurationTarget.Global);
      }
      
      if (profileData.plan) {
        if (profileData.plan.autoEvaluation) {
          await config.update('plan.autoEvaluation.enabled', profileData.plan.autoEvaluation.enabled, vscode.ConfigurationTarget.Global);
          await config.update('plan.autoEvaluation.enabledModes', profileData.plan.autoEvaluation.enabledModes, vscode.ConfigurationTarget.Global);
          await config.update('plan.autoEvaluation.skipCallUnderMode', profileData.plan.autoEvaluation.skipCallUnderMode, vscode.ConfigurationTarget.Global);
          await config.update('plan.autoEvaluation.autoSendCorrection', profileData.plan.autoEvaluation.autoSendCorrection, vscode.ConfigurationTarget.Global);
          await config.update('plan.autoEvaluation.evaluationDelay', profileData.plan.autoEvaluation.evaluationDelay, vscode.ConfigurationTarget.Global);
        }
        if (profileData.plan.prompts) {
          await config.update('plan.prompts.planReview', profileData.plan.prompts.planReview, vscode.ConfigurationTarget.Global);
          await config.update('plan.prompts.implementation', profileData.plan.prompts.implementation, vscode.ConfigurationTarget.Global);
          await config.update('plan.prompts.codeReview', profileData.plan.prompts.codeReview, vscode.ConfigurationTarget.Global);
          await config.update('plan.prompts.testing', profileData.plan.prompts.testing, vscode.ConfigurationTarget.Global);
          await config.update('plan.prompts.acceptance', profileData.plan.prompts.acceptance, vscode.ConfigurationTarget.Global);
        }
      }

      // Send updated configuration to frontend
      this._sendConfiguration();

      this._panel.webview.postMessage({
        type: 'profileLoaded',
        success: true,
        profileName: profileName
      });

      vscode.window.showInformationMessage(`Profile "${profileName}" loaded successfully`);
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'profileLoaded',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async _deleteProfile(profileName: string) {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete profile "${profileName}"? This action cannot be undone.`,
      { modal: true },
      'Delete',
      'Cancel'
    );

    if (result === 'Delete') {
      try {
        const profilesPath = this._getProfilesPath();
        const profileFile = path.join(profilesPath, `${profileName}.json`);

        if (!fs.existsSync(profileFile)) {
          throw new Error(`Profile "${profileName}" not found`);
        }

        fs.unlinkSync(profileFile);

        this._panel.webview.postMessage({
          type: 'profileDeleted',
          success: true,
          profileName: profileName
        });

        // Refresh profiles list
        this._listProfiles();

        vscode.window.showInformationMessage(`Profile "${profileName}" deleted successfully`);
      } catch (error) {
        this._panel.webview.postMessage({
          type: 'profileDeleted',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private _listProfiles() {
    try {
      const profilesPath = this._getProfilesPath();
      
      if (!fs.existsSync(profilesPath)) {
        this._panel.webview.postMessage({
          type: 'profilesList',
          profiles: []
        });
        return;
      }

      const files = fs.readdirSync(profilesPath);
      const profiles = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const profileFile = path.join(profilesPath, file);
            const profileData = JSON.parse(fs.readFileSync(profileFile, 'utf-8'));
            const profileName = path.basename(file, '.json');
            
            profiles.push({
              name: profileName,
              savedAt: profileData.savedAt || 'Unknown',
              currentMode: profileData.currentMode || 'Unknown',
              currentModel: profileData.currentModel || 'Unknown'
            });
          } catch (error) {
            // Skip corrupted profile files
            console.warn(`Skipping corrupted profile file: ${file}`, error);
          }
        }
      }

      // Sort by saved date (newest first)
      profiles.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

      this._panel.webview.postMessage({
        type: 'profilesList',
        profiles: profiles
      });
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'profilesList',
        profiles: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'settings.css')
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'settings.js')
    );

    // Icon URIs
    const connectionIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'connection-icon.svg')
    );
    const behaviorIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'behavior-icon.svg')
    );
    const toolsIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'tools-icon.svg')
    );
    const modesIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'modes-icon.svg')
    );
    const loggingIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'logging-icon.svg')
    );
    const advancedIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'advanced-icon.svg')
    );
    const settingsIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'settings-icon.svg')
    );
    const planIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'plan-icon.svg')
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:;">
      <link href="${styleUri}" rel="stylesheet">
      <title>CodingAgent Settings</title>
    </head>
    <body>
      <div class="settings-container">
        <header class="settings-header">
          <div class="header-content">
            <h1>CodingAgent Settings</h1>
            <div class="header-actions">
              <button id="saveBtn" class="primary-button">💾 Save Settings</button>
              <button id="resetBtn" class="reset-button">Reset to Defaults</button>
            </div>
          </div>
          <span id="saveStatus" class="save-status"></span>
        </header>

        <div class="settings-layout">
          <!-- Tab Navigation Sidebar -->
          <nav class="settings-sidebar">
            <button class="tab-button active" data-tab="profiles" title="Configuration Profiles">
              <img src="${settingsIconUri}" alt="Profiles" />
              <span class="tab-label">Profiles</span>
            </button>
            <button class="tab-button" data-tab="connection" title="Connection Settings">
              <img src="${connectionIconUri}" alt="Connection" />
              <span class="tab-label">Connection</span>
            </button>
            <button class="tab-button" data-tab="behavior" title="Behavior Settings">
              <img src="${behaviorIconUri}" alt="Behavior" />
              <span class="tab-label">Behavior</span>
            </button>
            <button class="tab-button" data-tab="tools" title="Tools Configuration">
              <img src="${toolsIconUri}" alt="Tools" />
              <span class="tab-label">Tools</span>
            </button>
            <button class="tab-button" data-tab="modes" title="AI Modes Management">
              <img src="${modesIconUri}" alt="Modes" />
              <span class="tab-label">Modes</span>
            </button>
            <button class="tab-button" data-tab="logging" title="Logging Configuration">
              <img src="${loggingIconUri}" alt="Logging" />
              <span class="tab-label">Logging</span>
            </button>
            <button class="tab-button" data-tab="plan" title="Plan Evaluation Settings">
              <img src="${planIconUri}" alt="Plan" />
              <span class="tab-label">Plan</span>
            </button>
            <button class="tab-button" data-tab="advanced" title="Advanced Settings">
              <img src="${advancedIconUri}" alt="Advanced" />
              <span class="tab-label">Advanced</span>
            </button>
          </nav>

          <!-- Main Content Area -->
          <main class="settings-content">
            <!-- Profiles Tab -->
            <div id="profiles-tab" class="tab-content active">
              <section class="settings-section">
                <h2>💾 Configuration Profiles</h2>
                <p class="section-description">Save and manage different configuration profiles for quick switching</p>
                
                <div class="profiles-actions">
                  <div class="profile-save-section">
                    <h3>Save Current Configuration</h3>
                    <div class="form-group">
                      <label for="newProfileName">Profile Name:</label>
                      <div class="profile-input-group">
                        <input type="text" id="newProfileName" placeholder="Enter profile name (e.g., Development, Production)" maxlength="50" />
                        <button id="saveProfileBtn" class="primary-button">💾 Save Profile</button>
                      </div>
                      <small class="form-hint">Only letters, numbers, underscores, and hyphens allowed</small>
                    </div>
                  </div>
                </div>

                <div class="profiles-list-section">
                  <h3>Saved Profiles</h3>
                  <div id="profilesList" class="profiles-list">
                    <!-- Profiles will be populated here -->
                    <div class="no-profiles" id="noProfiles">
                      <div class="no-profiles-icon">📁</div>
                      <p>No saved profiles yet</p>
                      <p class="no-profiles-hint">Save your current configuration above to create your first profile</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- Connection Tab -->
            <div id="connection-tab" class="tab-content">
              <section class="settings-section">
                <h2>🔗 OpenAI API Connection</h2>
                <p class="section-description">Configure connection to your OpenAI-compatible API server</p>
                
                <div class="form-group">
                  <label for="host">Host Address:</label>
                  <input type="text" id="host" placeholder="localhost" />
                  <small class="form-hint">IP address or hostname of your API server</small>
                </div>
                
                <div class="form-group">
                  <label for="port">Port:</label>
                  <input type="number" id="port" placeholder="11434" min="1" max="65535" />
                  <small class="form-hint">Port number for API connection</small>
                </div>
                
                <div class="form-group">
                  <label for="apiKey">API Key:</label>
                  <input type="password" id="apiKey" placeholder="Leave empty for local models without authentication" />
                  <small class="form-hint">OpenAI API key (optional for local models like Ollama)</small>
                </div>
                
                <div class="connection-status">
                  <button id="testConnectionBtn" class="secondary-button">Test Connection</button>
                  <span id="connectionStatus" class="status-indicator"></span>
                </div>
              </section>
            </div>

            <!-- Behavior Tab -->
            <div id="behavior-tab" class="tab-content">
              <section class="settings-section">
                <h2>⚡ Response Behavior</h2>
                <p class="section-description">Control how the AI responds and displays information</p>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="enableStreaming" />
                    <span class="checkbox-label">Enable Streaming Responses</span>
                  </label>
                  <small class="form-hint">Show text as it's being generated (recommended for better UX)</small>
                </div>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="showThinking" />
                    <span class="checkbox-label">Show Model Thinking Process</span>
                  </label>
                  <small class="form-hint">Display the model's reasoning before the final answer</small>
                </div>
                
                <div class="form-group">
                  <label for="iterationThreshold">Tool Iteration Threshold:</label>
                  <input type="number" id="iterationThreshold" min="1" max="100" step="1" />
                  <small class="form-hint">Number of tool iterations before asking for user confirmation (1-100)</small>
                </div>

                <div class="form-group">
                  <label for="uncertaintyThreshold">Ask User Uncertainty Threshold (%):</label>
                  <input type="number" id="uncertaintyThreshold" min="0" max="100" step="5" />
                  <small class="form-hint">AI will ask for user feedback when uncertainty is above this percentage (0-100)</small>
                </div>

                <div class="form-group">
                  <label class="checkbox-container">
                    <input type="checkbox" id="enableProjectMemory" />
                    <span class="checkbox-checkmark"></span>
                    <span class="checkbox-label">Enable Project Memory</span>
                  </label>
                  <small class="form-hint">Allow storing persistent memory in project (.codingagent/memory/)</small>
                </div>
              </section>

              <section class="settings-section">
                <h2>🎯 Default Settings</h2>
                <p class="section-description">Set default mode and model for new conversations</p>
                
                <div class="form-group">
                  <label for="currentMode">Default Mode:</label>
                  <select id="currentMode">
                    <option value="Coder">Coder - Programming assistant</option>
                    <option value="Ask">Ask - General Q&A</option>
                    <option value="Architect">Architect - System design</option>
                  </select>
                  <small class="form-hint">The AI mode to use when starting new conversations</small>
                </div>
                
                <div class="form-group">
                  <label for="currentModel">Default Model:</label>
                  <input type="text" id="currentModel" placeholder="llama3:8b" />
                  <small class="form-hint">Model name from your OpenAI-compatible server</small>
                </div>
              </section>
            </div>

            <!-- Tools Tab -->
            <div id="tools-tab" class="tab-content">
              <section class="settings-section">
                <h2>🔧 Tools Configuration</h2>
                <p class="section-description">Configure behavior and limits for AI tools</p>
                
                <div class="form-group">
                  <label for="readFileMaxLines">Read File Max Lines:</label>
                  <input type="number" id="readFileMaxLines" min="10" max="10000" step="10" />
                  <small class="form-hint">Maximum number of lines read_file tool can read in one operation (10-10000)</small>
                </div>
              </section>

              <section class="settings-section">
                <h2>🧠 Memory Configuration</h2>
                <p class="section-description">Configure memory retrieval limits and behavior</p>
                
                <div class="form-group">
                  <label for="memoryMaxLines">Memory Max Lines:</label>
                  <input type="number" id="memoryMaxLines" min="10" max="1000" step="10" value="100" />
                  <small class="form-hint">Maximum number of lines memory_retrieve can read in one operation (10-1000)</small>
                </div>
                
                <div class="form-group">
                  <label for="memoryMaxChars">Memory Max Characters:</label>
                  <input type="number" id="memoryMaxChars" min="1000" max="50000" step="1000" value="10000" />
                  <small class="form-hint">Maximum number of characters memory_retrieve can read in one operation (1000-50000)</small>
                </div>
                
                <div class="form-group">
                  <label for="memoryAutoSafetyLimit">Auto Safety Limit:</label>
                  <input type="number" id="memoryAutoSafetyLimit" min="1000" max="10000" step="500" value="5000" />
                  <small class="form-hint">Auto-applied safety limit for large values without explicit length (1000-10000 chars)</small>
                </div>
                
                <div class="form-group">
                  <label for="memoryLargeValueThreshold">Large Value Threshold:</label>
                  <input type="number" id="memoryLargeValueThreshold" min="5000" max="50000" step="1000" value="10000" />
                  <small class="form-hint">Threshold above which values are considered "large" and safety limits apply (5000-50000 chars)</small>
                </div>
              </section>

              <section class="settings-section">
                <h2>🔒 Terminal Security</h2>
                <p class="section-description">Configure terminal command security and auto-approval</p>
                
                <div class="form-group">
                  <label for="autoApproveCommands">Auto-Approve Commands:</label>
                  <input type="text" id="autoApproveCommands" placeholder="ls,pwd,git status,npm --version" />
                  <small class="form-hint">Comma-separated list of commands that are automatically approved without user confirmation. Use with caution!</small>
                </div>
                
                <div class="security-notice">
                  <div class="notice-icon">⚠️</div>
                  <div class="notice-content">
                    <strong>Security Notice:</strong> Commands in this list execute automatically. 
                    Only add commands you trust completely.
                  </div>
                </div>
              </section>

              <section class="settings-section">
                <h2>📋 Available Tools</h2>
                <p class="section-description">Overview of available AI tools and their capabilities</p>
                
                <div class="tool-info">
                  <h3>Available Tools</h3>
                  <div class="tools-grid" id="tools-grid">
                    <!-- Tools will be populated dynamically -->
                  </div>
                </div>
              </section>
            </div>

            <!-- Modes Tab -->
            <div id="modes-tab" class="tab-content">
              <section class="settings-section">
                <h2>🎯 AI Modes Management</h2>
                <p class="section-description">Create and configure different AI personalities and capabilities</p>
                
                <div class="modes-header">
                  <button id="newModeBtn" class="primary-button">+ Create New Mode</button>
                </div>
                
                <div id="modesList" class="modes-list">
                  <!-- Modes will be populated here -->
                </div>
              </section>
            </div>

            <!-- Logging Tab -->
            <div id="logging-tab" class="tab-content">
              <section class="settings-section">
                <h2>📝 Communication Logging</h2>
                <p class="section-description">Control how conversations are logged for debugging and analysis</p>
                
                <div class="privacy-notice">
                  <div class="notice-icon">⚠️</div>
                  <div class="notice-content">
                    <strong>Privacy Notice:</strong> Logs contain all prompts and responses. 
                    Disable logging if handling sensitive information.
                  </div>
                </div>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="loggingEnabled" />
                    <span class="checkbox-label">Enable Communication Logging</span>
                  </label>
                  <small class="form-hint">Log AI conversations for debugging and analysis</small>
                </div>
                
                <div class="form-group">
                  <label for="logVerbosity">Logging Detail Level:</label>
                  <select id="logVerbosity">
                    <option value="Minimal">Minimal - Essential info only</option>
                    <option value="Standard">Standard - Balanced detail</option>
                    <option value="Verbose">Verbose - Complete details</option>
                  </select>
                  <small class="form-hint">How much detail to include in logs</small>
                </div>
                
                <div class="form-group">
                  <label for="logFilePath">Standard Log File:</label>
                  <div class="file-input-group">
                    <input type="text" id="logFilePath" placeholder="Default: .codingagent/logs/ai-communication.log" readonly />
                    <button id="selectLogFileBtn" class="secondary-button">Browse</button>
                  </div>
                  <small class="form-hint">Location for formatted conversation logs</small>
                </div>
              </section>

              <section class="settings-section">
                <h2>🔧 Developer Logging</h2>
                <p class="section-description">Raw API communication logs for development and debugging</p>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="logMode" />
                    <span class="checkbox-label">Enable Raw JSON Logging</span>
                  </label>
                  <small class="form-hint">Log raw API requests and responses in JSON format</small>
                </div>
                
                <div class="form-group">
                  <label for="logModeFilePath">Raw JSON Log File:</label>
                  <div class="file-input-group">
                    <input type="text" id="logModeFilePath" placeholder="Default: .codingagent/logs/openai-raw-json.log" readonly />
                    <button id="selectLogModeFileBtn" class="secondary-button">Browse</button>
                  </div>
                  <small class="form-hint">Location for raw API communication logs</small>
                </div>
              </section>
            </div>

            <!-- Plan Tab -->
            <div id="plan-tab" class="tab-content">
              <section class="settings-section">
                <h2>📋 Plan Evaluation</h2>
                <p class="section-description">Configure automatic plan evaluation after LLM responses</p>
                <p class="section-description"><strong>Note:</strong> Plan evaluation is now configured per-mode. Edit individual modes in "AI Modes Management" to enable/disable plan evaluation for specific modes.</p>
              </section>

              <section class="settings-section">
                <h2>💬 Correction Prompts</h2>
                <p class="section-description">Customize prompts for each plan evaluation step</p>
                
                <div class="prompt-templates">
                  <div class="form-group">
                    <label for="planReviewPrompt">Plan Review Prompt:</label>
                    <textarea id="planReviewPrompt" rows="3" placeholder="Plan needs to be reviewed. Please review the overall plan structure, goals, and approach. Use 'plan_reviewed' tool when done.">Plan needs to be reviewed before implementation can begin. Please review the overall plan structure, goals, and approach to ensure they align with the requirements. Once you're satisfied with the plan, use the 'plan_reviewed' tool to mark it as reviewed.</textarea>
                    <small class="form-hint">Prompt when plan hasn't been reviewed yet</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="implementationPrompt">Implementation Prompt:</label>
                    <textarea id="implementationPrompt" rows="3" placeholder="Some plan points need implementation. Points to implement: {{points}}">The following plan points still need to be implemented: {{points}}. Please implement the code for these points and mark them as implemented using the 'plan_point_implemented' tool.</textarea>
                    <small class="form-hint">Prompt when points need implementation. Use {{points}} to include point IDs</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="codeReviewPrompt">Code Review Prompt:</label>
                    <textarea id="codeReviewPrompt" rows="3" placeholder="Some plan points need code review. Points to review: {{points}}">The following plan points have been implemented but need code review: {{points}}. Please review the implementation and mark them as reviewed using the 'plan_point_reviewed' tool.</textarea>
                    <small class="form-hint">Prompt when implemented points need review. Use {{points}} to include point IDs</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="testingPrompt">Testing Prompt:</label>
                    <textarea id="testingPrompt" rows="3" placeholder="Some plan points need testing. Points to test: {{points}}">The following plan points have been reviewed but need testing: {{points}}. Please create and run tests for these implementations and mark them as tested using the 'plan_point_tested' tool.</textarea>
                    <small class="form-hint">Prompt when reviewed points need testing. Use {{points}} to include point IDs</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="acceptancePrompt">Acceptance Prompt:</label>
                    <textarea id="acceptancePrompt" rows="3" placeholder="Plan is ready for acceptance. Please verify all requirements are met and accept the plan.">All plan points have been implemented, reviewed, and tested. The plan is now ready for final acceptance. Please verify that all requirements have been met and use the 'plan_accepted' tool to mark the plan as complete.</textarea>
                    <small class="form-hint">Prompt when plan is ready for final acceptance</small>
                  </div>
                </div>
                
                <div class="prompt-help">
                  <h3>Template Variables</h3>
                  <ul>
                    <li><code>{{points}}</code> - List of point IDs that need attention</li>
                    <li><code>{{planId}}</code> - Current plan ID</li>
                    <li><code>{{reason}}</code> - Detailed reason why the step failed</li>
                  </ul>
                </div>
              </section>

              <section class="settings-section">
                <h2>🔄 Evaluation Behavior</h2>
                <p class="section-description">Configure when and how plan evaluation runs</p>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="skipCallUnderMode" checked />
                    <span class="checkbox-label">Skip evaluation for call_under_mode responses</span>
                  </label>
                  <small class="form-hint">Don't evaluate plans after responses from call_under_mode tool (recommended)</small>
                </div>
                
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="autoSendCorrection" checked />
                    <span class="checkbox-label">Automatically send correction prompts</span>
                  </label>
                  <small class="form-hint">Automatically send corrective prompts when plan evaluation fails</small>
                </div>
                
                <div class="form-group">
                  <label for="evaluationDelay">Evaluation Delay (ms):</label>
                  <input type="number" id="evaluationDelay" value="1000" min="0" max="10000" step="100" />
                  <small class="form-hint">Delay before running plan evaluation after LLM response (0-10000ms)</small>
                </div>
              </section>
            </div>

            <!-- Advanced Tab -->
            <div id="advanced-tab" class="tab-content">
              <section class="settings-section">
                <h2>⚙️ Advanced Configuration</h2>
                <p class="section-description">Advanced settings for power users and developers</p>
                
                <div class="warning-notice">
                  <div class="notice-icon">⚠️</div>
                  <div class="notice-content">
                    <strong>Warning:</strong> These settings can affect system performance and behavior. 
                    Change only if you understand their impact.
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="maxTokens">Maximum Tokens:</label>
                  <input type="number" id="maxTokens" placeholder="4096" min="1" max="32768" />
                  <small class="form-hint">Maximum tokens in model responses (leave empty for model default)</small>
                </div>
                
                <div class="form-group">
                  <label for="temperature">Temperature:</label>
                  <input type="number" id="temperature" placeholder="0.7" min="0" max="2" step="0.1" />
                  <small class="form-hint">Creativity level (0.0 = deterministic, 2.0 = very creative)</small>
                </div>
                
                <div class="form-group">
                  <label for="requestTimeout">Request Timeout (ms):</label>
                  <input type="number" id="requestTimeout" placeholder="30000" min="1000" max="300000" />
                  <small class="form-hint">How long to wait for API responses before timing out</small>
                </div>
              </section>
            </div>
          </main>
        </div>

        <!-- Mode Editor Modal -->
        <div id="modeEditorModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="modeEditorTitle">Edit Mode</h3>
              <button id="closeModeEditor" class="close-button">&times;</button>
            </div>
            <div class="modal-body">
              <form id="modeEditorForm">
                <div class="form-group">
                  <label for="modeName">Mode Name:</label>
                  <input type="text" id="modeName" required />
                </div>
                <div class="form-group">
                  <label for="modeDescription">Description (User-facing):</label>
                  <input type="text" id="modeDescription" placeholder="Brief description of this mode for users" />
                </div>
                <div class="form-group">
                  <label for="modeLlmDescription">Description (LLM Context):</label>
                  <input type="text" id="modeLlmDescription" placeholder="Description for LLM context (e.g., role, capabilities)" />
                </div>
                <div class="form-group">
                  <label for="modeSystemMessage">System Message (User Interaction):</label>
                  <textarea id="modeSystemMessage" rows="20" required placeholder="System prompt for direct user interaction"></textarea>
                </div>
                <div class="form-group">
                  <label for="modeOrchestrationMessage">Orchestration Message (call_under_mode):</label>
                  <textarea id="modeOrchestrationMessage" rows="20" placeholder="System prompt when called via call_under_mode (leave empty to use system message)"></textarea>
                </div>
                <div class="form-group">
                  <label for="modeFallbackMessage">Fallback Message:</label>
                  <textarea id="modeFallbackMessage" rows="2" placeholder="Message shown when mode is activated"></textarea>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="modeTemperature">Temperature:</label>
                    <input type="number" id="modeTemperature" min="0" max="2" step="0.1" placeholder="Leave empty for null" />
                  </div>
                  <div class="form-group">
                    <label for="modeTopP">Top P:</label>
                    <input type="number" id="modeTopP" min="0" max="1" step="0.05" placeholder="Leave empty for null" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="modePresencePenalty">Presence Penalty:</label>
                    <input type="number" id="modePresencePenalty" min="-2" max="2" step="0.1" placeholder="Leave empty for null" />
                  </div>
                  <div class="form-group">
                    <label for="modeFrequencyPenalty">Frequency Penalty:</label>
                    <input type="number" id="modeFrequencyPenalty" min="-2" max="2" step="0.1" placeholder="Leave empty for null" />
                  </div>
                </div>
                <div class="form-group">
                  <label>Allowed Tools:</label>
                  <div id="modeToolsContainer" class="tools-container">
                    <!-- Tools checkboxes will be populated here -->
                  </div>
                </div>
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="modeAutoEvaluation" />
                    <span class="checkbox-label">Enable Automatic Plan Evaluation</span>
                  </label>
                  <small class="form-hint">Automatically evaluate plan completion after LLM responses in this mode</small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button id="saveModeBtn" class="primary-button">Save Mode</button>
              <button id="cancelModeBtn" class="secondary-button">Cancel</button>
            </div>
          </div>
        </div>

        <footer class="settings-footer">
          <span id="saveStatus" class="save-status"></span>
        </footer>
      </div>

      <script src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}
