// src/extension.ts

import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';
import { OpenAIService } from './openai_html_api';
import { SettingsPanel } from './settingsPanel';
import { ToolsService } from './tools';
import { InlineChangeDecorationService } from './inlineChangeDecorationService';
import { ChangeCodeLensProvider } from './changeCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodingAgent extension is now active!');

  // Initialize services
  const openaiService = new OpenAIService();
  const toolsService = new ToolsService();
  
  // Get change tracking service from tools
  const changeTracker = toolsService.getChangeTrackingService();
  let inlineDecorationService: InlineChangeDecorationService | undefined;
  let codeLensProvider: ChangeCodeLensProvider | undefined;
  
  if (changeTracker) {
    inlineDecorationService = new InlineChangeDecorationService(changeTracker);
    codeLensProvider = new ChangeCodeLensProvider(changeTracker);
    
    context.subscriptions.push(
      inlineDecorationService,
      codeLensProvider,
      vscode.languages.registerCodeLensProvider('*', codeLensProvider)
    );
  }
  
  // Create and register the chat view provider
  const chatViewProvider = new ChatViewProvider(context, toolsService);
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

  // Set up change tracking callback if available
  console.log(`Extension setup: changeTracker=${!!changeTracker}, inlineDecorationService=${!!inlineDecorationService}, codeLensProvider=${!!codeLensProvider}`);
  
  if (changeTracker && inlineDecorationService && codeLensProvider) {
    console.log('Setting up change tracking callback...');
    // Create a comprehensive callback that handles all updates
    changeTracker.setChangeUpdateCallback(async (filePath: string, changeType: 'created' | 'accepted' | 'rejected') => {
      console.log(`Extension: Change ${changeType} for ${filePath}`);
      
      // Update decorations
      await inlineDecorationService.updateFileDecorations(filePath);
      
      // Refresh CodeLens
      codeLensProvider.refresh();
      
      // Update UI panel with current changes
      try {
        const allChanges = await changeTracker.getAllPendingChanges();
        chatViewProvider.updateChanges(allChanges.map(change => ({
          id: change.id,
          filePath: change.filePath,
          operation: change.changeType,
          status: change.status,
          timestamp: change.timestamp,
          toolName: change.toolName
        })));
      } catch (error) {
        console.warn('Failed to update UI panel:', error);
      }
    });
    console.log('Change tracking callback set up successfully');
  } else {
    console.warn('Cannot set up change tracking callback - some services are missing');
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.openChat', () => {
      vscode.commands.executeCommand('codingagent-chat-view.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codingagent.refreshModels', async () => {
      try {
        const models = await openaiService.getModels();
        const modelNames = models.models.map((m: any) => m.name);
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
        const models = await openaiService.getModels();
        const modelNames = models.models.map((m: any) => m.name);
        
        if (modelNames.length === 0) {
          vscode.window.showWarningMessage('No models available. Check your OpenAI API connection.');
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

  // Inline change tracking commands
  if (inlineDecorationService) {
    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.acceptChangeAtCursor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await inlineDecorationService!.handleAcceptChangeAtPosition(editor.selection.active);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.rejectChangeAtCursor', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          await inlineDecorationService!.handleRejectChangeAtPosition(editor.selection.active);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.refreshInlineDecorations', async () => {
        await inlineDecorationService!.refreshAllDecorations();
        vscode.window.showInformationMessage('Inline decorations refreshed');
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.showChanges', () => {
        chatViewProvider.showChanges();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.acceptAllChanges', async () => {
        const changeTracker = toolsService.getChangeTrackingService();
        if (changeTracker) {
          await changeTracker.acceptAllChanges();
          vscode.window.showInformationMessage('All changes accepted');
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.rejectAllChanges', async () => {
        const changeTracker = toolsService.getChangeTrackingService();
        if (changeTracker) {
          await changeTracker.rejectAllChanges();
          vscode.window.showInformationMessage('All changes rejected and reverted');
        }
      })
    );

    // CodeLens specific commands
    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.acceptSpecificChange', async (changeId: string, lineNumber: number) => {
        const changeTracker = toolsService.getChangeTrackingService();
        if (changeTracker) {
          await changeTracker.acceptChange(changeId);
          vscode.window.showInformationMessage(`Change on line ${lineNumber} accepted`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.rejectSpecificChange', async (changeId: string, lineNumber: number) => {
        const changeTracker = toolsService.getChangeTrackingService();
        if (changeTracker) {
          await changeTracker.rejectChange(changeId);
          vscode.window.showInformationMessage(`Change on line ${lineNumber} rejected and reverted`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.showChangeDiff', async (changeId: string) => {
        const changeTracker = toolsService.getChangeTrackingService();
        if (changeTracker) {
          const allChanges = await changeTracker.getAllChanges();
          const change = allChanges.find(c => c.id === changeId);
          if (change) {
            // Open diff editor
            const beforeUri = vscode.Uri.parse(`untitled:${change.filePath}.before`);
            const afterUri = vscode.Uri.parse(`untitled:${change.filePath}.after`);
            
            await vscode.workspace.openTextDocument(beforeUri).then(doc => {
              const editor = vscode.window.showTextDocument(doc);
              return editor.then(e => e.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(0, 0), change.beforeContent);
              }));
            });
            
            await vscode.workspace.openTextDocument(afterUri).then(doc => {
              const editor = vscode.window.showTextDocument(doc);
              return editor.then(e => e.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(0, 0), change.afterContent);
              }));
            });
            
            vscode.commands.executeCommand('vscode.diff', beforeUri, afterUri, `${change.toolName}: ${change.filePath}`);
          }
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.showChangeDetails', async (changeId: string) => {
        const changeTracker = toolsService.getChangeTrackingService();
        if (changeTracker) {
          const allChanges = await changeTracker.getAllChanges();
          const change = allChanges.find(c => c.id === changeId);
          if (change) {
            const timestamp = new Date(change.timestamp).toLocaleString();
            vscode.window.showInformationMessage(
              `Change ${change.status} by ${change.toolName} at ${timestamp}`,
              'Show Diff'
            ).then(selection => {
              if (selection === 'Show Diff') {
                vscode.commands.executeCommand('codingagent.showChangeDiff', changeId);
              }
            });
          }
        }
      })
    );

    // Test command for development
    context.subscriptions.push(
      vscode.commands.registerCommand('codingagent.testInlineTracking', async () => {
        try {
          const changeTracker = toolsService.getChangeTrackingService();
          if (changeTracker) {
            const testFilePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath + '/test-changes.js';
            if (testFilePath) {
              // Create a test change
              const changeId = await changeTracker.trackFileOperation(testFilePath, {
                type: 'modify',
                beforeContent: 'let result = add(2, 3);',
                afterContent: 'let result = add(5, 7);',
                toolName: 'test_tool'
              });
              
              vscode.window.showInformationMessage(`Test change created: ${changeId}`);
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Test failed: ${error}`);
        }
      })
    );
  }

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
