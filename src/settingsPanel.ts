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
          case 'showMessage':
            vscode.window.showInformationMessage(message.message);
            break;
          case 'showError':
            vscode.window.showErrorMessage(message.message);
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
        currentMode: config.get('currentMode'),
        currentModel: config.get('currentModel'),
        showThinking: config.get('showThinking'),
        enableStreaming: config.get('enableStreaming'),
        modes: config.get('modes'),
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
      'Reset',
      'Cancel'
    );

    if (result === 'Reset') {
      try {
        const config = vscode.workspace.getConfiguration('codingagent');
        
        // Reset all settings to their defaults
        await config.update('openai.host', undefined, vscode.ConfigurationTarget.Global);
        await config.update('openai.port', undefined, vscode.ConfigurationTarget.Global);
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
        allowedTools: mode.allowedTools,
        fallbackMessage: mode.fallbackMessage,
        temperature: mode.temperature,
        topP: mode.topP,
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
        allowedTools: mode.allowedTools,
        fallbackMessage: mode.fallbackMessage,
        temperature: mode.temperature,
        topP: mode.topP,
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

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'settings.css')
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'settings.js')
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
      <link href="${styleUri}" rel="stylesheet">
      <title>CodingAgent Settings</title>
    </head>
    <body>
      <div class="settings-container">
        <header class="settings-header">
          <h1>CodingAgent Settings</h1>
          <button id="resetBtn" class="reset-button">Reset to Defaults</button>
        </header>

        <div class="settings-content">
          <!-- Connection Settings -->
          <section class="settings-section">
            <h2>Connection</h2>
            <div class="form-group">
              <label for="host">OpenAI API Host:</label>
              <input type="text" id="host" placeholder="localhost" />
            </div>
            <div class="form-group">
              <label for="port">OpenAI API Port:</label>
              <input type="number" id="port" placeholder="11434" />
            </div>
          </section>

          <!-- Default Settings -->
          <section class="settings-section">
            <h2>Defaults</h2>
            <div class="form-group">
              <label for="currentMode">Default Mode:</label>
              <select id="currentMode">
                <option value="Coder">Coder</option>
                <option value="Ask">Ask</option>
                <option value="Architect">Architect</option>
              </select>
            </div>
            <div class="form-group">
              <label for="currentModel">Default Model:</label>
              <input type="text" id="currentModel" placeholder="llama3:8b" />
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="showThinking" />
                Show model thinking process
              </label>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="enableStreaming" />
                Enable streaming responses
              </label>
            </div>
          </section>

          <!-- Modes Management -->
          <section class="settings-section">
            <h2>Modes Management</h2>
            <div class="modes-header">
              <button id="newModeBtn" class="primary-button">+ New Mode</button>
            </div>
            <div id="modesList" class="modes-list">
              <!-- Modes will be populated here -->
            </div>
          </section>

          <!-- Logging Settings -->
          <section class="settings-section">
            <h2>Logging</h2>
            <div class="logging-notice">
              <p><strong>Privacy Notice:</strong> Logs may include prompts and responses. You can disable logging at any time.</p>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="loggingEnabled" />
                Enable AI communication logging
              </label>
            </div>
            <div class="form-group">
              <label for="logFilePath">Log File Path:</label>
              <div class="file-input-group">
                <input type="text" id="logFilePath" placeholder="Leave empty for default location" readonly />
                <button id="selectLogFileBtn" class="secondary-button">Browse</button>
              </div>
            </div>
            <div class="form-group">
              <label for="logVerbosity">Verbosity Level:</label>
              <select id="logVerbosity">
                <option value="Minimal">Minimal</option>
                <option value="Standard">Standard</option>
                <option value="Verbose">Verbose</option>
              </select>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="logMode" />
                Enable raw JSON logging mode
              </label>
              <small class="form-hint">Logs raw JSON objects sent and received from OpenAI API</small>
            </div>
            <div class="form-group">
              <label for="logModeFilePath">Raw JSON Log File Path:</label>
              <div class="file-input-group">
                <input type="text" id="logModeFilePath" placeholder="Leave empty for default location" readonly />
                <button id="selectLogModeFileBtn" class="secondary-button">Browse</button>
              </div>
            </div>
          </section>
        </div>

        <footer class="settings-footer">
          <button id="saveBtn" class="primary-button">Save Settings</button>
        </footer>
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
                <label for="modeDescription">Description:</label>
                <input type="text" id="modeDescription" placeholder="Brief description of this mode" />
              </div>
              <div class="form-group">
                <label for="modeSystemMessage">System Message:</label>
                <textarea id="modeSystemMessage" rows="4" required placeholder="System prompt for this mode"></textarea>
              </div>
              <div class="form-group">
                <label for="modeFallbackMessage">Fallback Message:</label>
                <textarea id="modeFallbackMessage" rows="2" placeholder="Message shown when mode is activated"></textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="modeTemperature">Temperature:</label>
                  <input type="number" id="modeTemperature" min="0" max="2" step="0.1" />
                </div>
                <div class="form-group">
                  <label for="modeTopP">Top P:</label>
                  <input type="number" id="modeTopP" min="0" max="1" step="0.05" />
                </div>
              </div>
              <div class="form-group">
                <label>Allowed Tools:</label>
                <div id="modeToolsContainer" class="tools-container">
                  <!-- Tools checkboxes will be populated here -->
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button id="saveModeBtn" class="primary-button">Save Mode</button>
            <button id="cancelModeBtn" class="secondary-button">Cancel</button>
          </div>
        </div>
      </div>

      <script src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}
