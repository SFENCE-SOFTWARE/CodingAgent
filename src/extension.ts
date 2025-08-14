// src/extension.ts

import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { OllamaService } from './ollama';
import { SettingsPanel } from './settingsPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodingAgent extension is now active!');

  // Create services
  const ollamaService = new OllamaService();
  
  // Create and register the chat view provider
  const chatViewProvider = new ChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatViewProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.openChat', () => {
      vscode.commands.executeCommand('codingagent-chat-view.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.refreshModels', async () => {
      try {
        const models = await ollamaService.getModels();
        const modelNames = models.models.map(m => m.name);
        vscode.window.showInformationMessage(
          `Available models: ${modelNames.join(', ')}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  // Register additional commands for convenience
  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.clearChat', () => {
      chatViewProvider.clearChat();
      vscode.window.showInformationMessage('Chat history cleared');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.setMode', async () => {
      const modes = ['Coder', 'Ask', 'Architect'];
      const selectedMode = await vscode.window.showQuickPick(modes, {
        placeHolder: 'Select agent mode'
      });
      
      if (selectedMode) {
        const config = vscode.workspace.getConfiguration('codingagent');
        await config.update('currentMode', selectedMode, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Mode set to: ${selectedMode}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.setModel', async () => {
      try {
        const models = await ollamaService.getModels();
        const modelNames = models.models.map(m => m.name);
        
        if (modelNames.length === 0) {
          vscode.window.showWarningMessage('No models available. Check your Ollama connection.');
          return;
        }

        const selectedModel = await vscode.window.showQuickPick(modelNames, {
          placeHolder: 'Select AI model'
        });
        
        if (selectedModel) {
          const config = vscode.workspace.getConfiguration('codingagent');
          await config.update('currentModel', selectedModel, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Model set to: ${selectedModel}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'codingagent');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.openSettingsPanel', () => {
      SettingsPanel.createOrShow(context.extensionUri);
    })
  );

  // Status bar item to show current configuration
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'codingagent.openChat';
  statusBarItem.text = '$(comment-discussion) CodingAgent';
  statusBarItem.tooltip = 'Open CodingAgent Chat';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar when configuration changes
  const updateStatusBar = () => {
    const config = vscode.workspace.getConfiguration('codingagent');
    const mode = config.get<string>('currentMode', 'Coder');
    const model = config.get<string>('currentModel', 'llama3:8b');
    statusBarItem.text = `$(comment-discussion) ${mode} (${model})`;
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('codingagent')) {
        updateStatusBar();
      }
    })
  );

  updateStatusBar();

  // Show welcome message on first activation
  const isFirstTime = context.globalState.get('codingagent.firstTime', true);
  if (isFirstTime) {
    vscode.window.showInformationMessage(
      'Welcome to CodingAgent! Open the chat panel to get started.',
      'Open Chat'
    ).then(selection => {
      if (selection === 'Open Chat') {
        vscode.commands.executeCommand('codingagent.openChat');
      }
    });
    context.globalState.update('codingagent.firstTime', false);
  }
}

export function deactivate() {
  console.log('CodingAgent extension is deactivated');
}
