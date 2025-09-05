// src/chatViewProvider.ts

import * as vscode from 'vscode';
import { ChatService } from './chatService';
import { getWebviewContent } from './webview';
import { ChatMessage, StreamingUpdate, ChatUpdate } from './types';
import { ToolsService } from './tools';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codingagent-chat-view';

  private _view?: vscode.WebviewView;
  private chatService: ChatService;
  private toolsService?: ToolsService;

  constructor(private readonly context: vscode.ExtensionContext, toolsService?: ToolsService) {
    this.chatService = new ChatService(toolsService);
    this.toolsService = toolsService;
    
    // Set up streaming callback
    this.chatService.setStreamingCallback((update: StreamingUpdate) => {
      this.handleStreamingUpdate(update);
    });

    // Set up terminal approval callback
    if (this.toolsService) {
      this.toolsService.setTerminalApprovalCallback(async (commandId: string, command: string, cwd: string) => {
        return this.handleTerminalApprovalRequest(commandId, command, cwd);
      });
    }
    
    // Set up streaming callback
    this.chatService.setStreamingCallback((update: StreamingUpdate) => {
      this.handleStreamingUpdate(update);
    });
    
    // Set up configuration change callback
    this.chatService.setConfigurationChangeCallback(() => {
      this.sendConfiguration();
    });
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('codingagent')) {
        this.chatService.updateConfiguration();
        this.sendConfiguration();
        
        // If modes changed, update the available modes in UI
        if (event.affectsConfiguration('codingagent.modes')) {
          this.sendAvailableModesUpdate();
        }
      }
    });
  }

  private handleStreamingUpdate(update: StreamingUpdate) {
    if (!this._view) {return;}

    switch (update.type) {
      case 'start':
        this.sendMessage({
          type: 'streamingStart',
          messageId: update.messageId,
          model: update.model,
          mode: update.mode
        });
        break;

      case 'content':
        this.sendMessage({
          type: 'streamingContent',
          messageId: update.messageId,
          content: update.content
        });
        break;

      case 'thinking':
        // TODO: Fix TypeScript issue with getLoggingService method
        // this.chatService.getLoggingService().logDebug('ChatViewProvider sending thinking to frontend', {
        //   messageId: update.messageId,
        //   thinking: update.thinking
        // });
        this.sendMessage({
          type: 'streamingThinking',
          messageId: update.messageId,
          thinking: update.thinking
        });
        break;

      case 'tool_calls':
        this.sendMessage({
          type: 'streamingToolCalls',
          messageId: update.messageId,
          toolCalls: update.toolCalls
        });
        break;

      case 'tool_calls_start':
        this.sendMessage({
          type: 'toolCallsStart'
        });
        break;

      case 'tool_calls_end':
        this.sendMessage({
          type: 'toolCallsEnd'
        });
        break;

      case 'change_tracking':
        this.sendMessage({
          type: 'changeTracking',
          changeIds: update.changeIds
        });
        break;

      case 'correction_request':
        this.sendMessage({
          type: 'correctionRequest'
        });
        break;

      case 'correction_applied':
        this.sendMessage({
          type: 'correctionApplied',
          correctionText: update.correctionText
        });
        break;

      case 'iteration_limit_reached':
        this.sendMessage({
          type: 'iterationLimitReached',
          iterationCount: update.iterationCount
        });
        break;

      case 'ask_user_request':
        this.sendMessage({
          type: 'askUserRequest',
          requestId: update.requestId,
          question: update.question,
          context: update.context,
          urgency: update.urgency
        });
        break;

      case 'notice_message':
        // Handle notice messages
        this.sendMessage({
          type: 'addMessage',
          message: (update as any).message
        });
        break;

      case 'end':
        this.sendMessage({
          type: 'streamingEnd',
          messageId: update.messageId,
          isComplete: update.isComplete
        });
        break;

      case 'error':
        this.sendMessage({
          type: 'streamingError',
          messageId: update.messageId,
          error: update.error
        });
        break;
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri
      ]
    };

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.context.extensionUri,
      this.chatService.getMessages()
    );

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        switch (message.type) {
          case 'sendMessage':
            await this.handleSendMessage(message.content);
            break;

          case 'interruptLLM':
            this.chatService.interruptLLM();
            break;

          case 'hardInterruptLLM':
            this.chatService.hardInterruptLLM();
            break;

          case 'requestCorrection':
            this.chatService.requestCorrection();
            break;

          case 'submitCorrection':
            this.chatService.submitCorrection(message.correction);
            break;

          case 'cancelCorrection':
            this.chatService.cancelCorrection();
            break;

          case 'continueIterations':
            this.chatService.continueIterations();
            break;

          case 'stopIterations':
            this.chatService.stopIterations();
            break;

          case 'askUserResponse':
            this.handleAskUserResponse(message.requestId, message.answer, message.cancelled);
            break;

          case 'setMode':
            await this.chatService.setMode(message.mode);
            this.sendConfiguration();
            break;

          case 'setModel':
            await this.chatService.setModel(message.model);
            this.sendConfiguration();
            break;

          case 'clearChat':
            this.chatService.clearMessages();
            this.sendMessage({ type: 'clearMessages' });
            break;

          case 'getConfiguration':
            this.sendConfiguration();
            break;

          case 'getAvailableModels':
            await this.sendAvailableModels();
            break;

          case 'getAvailableModes':
            this.sendAvailableModesUpdate();
            break;

          case 'openSettings':
            await this.handleOpenSettings();
            break;

          case 'getPendingChanges':
            await this.handleGetPendingChanges();
            break;

          case 'acceptChange':
            await this.handleAcceptChange(message.changeId);
            break;

          case 'rejectChange':
            await this.handleRejectChange(message.changeId);
            break;

          case 'getChangeDiff':
            await this.handleGetChangeDiff(message.changeId);
            break;

          case 'acceptFileChanges':
            await this.handleAcceptFileChanges(message.filePath);
            break;

          case 'rejectFileChanges':
            await this.handleRejectFileChanges(message.filePath);
            break;

          case 'acceptAllChanges':
            await this.handleAcceptAllChanges();
            break;

          case 'rejectAllChanges':
            await this.handleRejectAllChanges();
            break;

          case 'approveTerminalCommand':
            await this.handleApproveTerminalCommand(message.commandId);
            break;

          case 'rejectTerminalCommand':
            await this.handleRejectTerminalCommand(message.commandId);
            break;

          case 'getPendingTerminalCommands':
            await this.handleGetPendingTerminalCommands();
            break;

          case 'copyToClipboard':
            await this.handleCopyToClipboard(message.text);
            break;

          case 'openPlanVisualization':
            await this.handleOpenPlanVisualization(message.planId);
            break;
        }
      } catch (error) {
        console.error('Error handling webview message:', error);
        this.sendMessage({
          type: 'showError',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Send initial configuration
    this.sendConfiguration();
    this.sendAvailableModels();
    this.sendAvailableModesUpdate();
  }

  private handleAskUserResponse(requestId: string, answer?: string, cancelled?: boolean) {
    // Import AskUserTool to resolve the request
    const { AskUserTool } = require('./tools/askUser');
    AskUserTool.resolveRequest(requestId, answer, cancelled || false);
  }

  private async handleSendMessage(content: string) {
    if (!this._view) {return;}

    try {
      // Add user message to internal history immediately
      const userMessage = this.chatService.addUserMessage(content);
      
      // Set loading state
      this.sendMessage({ type: 'setLoading', loading: true });

      // Show thinking if enabled (only in non-streaming mode)
      const config = vscode.workspace.getConfiguration('codingagent');
      const showThinking = config.get('showThinking', true);
      const enableStreaming = config.get('enableStreaming', true);
      
      if (showThinking && !enableStreaming) {
        this.sendMessage({ 
          type: 'showThinking', 
          thinking: 'Processing your request...' 
        });
      }

      // Send message to chat service (user message already added above)
      const newMessages = await this.chatService.processMessage(content, (update) => {
        // Handle immediate message updates via callback
        if (update.type === 'message_ready') {
          this.sendMessage({
            type: 'addMessage',
            message: update.message
          });
        }
        // For streaming updates, they will be handled by existing streaming callback
      });

      // Update thinking with final response or hide it (only in non-streaming mode)
      if (showThinking && !enableStreaming) {
        this.sendMessage({ type: 'hideThinking' });
      }

      // Add only the assistant/error messages to webview that haven't been displayed yet
      newMessages.forEach(message => {
        // Skip messages that were already displayed via streaming callbacks
        if (message.isAlreadyDisplayed) {
          return;
        }
        
        this.sendMessage({
          type: 'addMessage',
          message: message
        });
      });

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'error',
        content: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };

      this.sendMessage({
        type: 'addMessage',
        message: errorMessage
      });
    } finally {
      // Clear loading state
      this.sendMessage({ type: 'setLoading', loading: false });
    }
  }

  private sendConfiguration() {
    if (!this._view) {return;}

    this.sendMessage({
      type: 'updateConfiguration',
      config: {
        mode: this.chatService.getCurrentMode(),
        model: this.chatService.getCurrentModel(),
        showThinking: this.chatService.getShowThinking(),
        enableStreaming: this.chatService.getEnableStreaming()
      }
    });
  }

  private async sendAvailableModels() {
    if (!this._view) {return;}

    try {
      const models = await this.chatService.getAvailableModels();
      this.sendMessage({
        type: 'updateAvailableModels',
        models: models
      });
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      // Send default models as fallback
      this.sendMessage({
        type: 'updateAvailableModels',
        models: ['llama3:8b', 'mistral:7b', 'codellama:7b']
      });
    }
  }

  private async handleOpenSettings() {
    await vscode.commands.executeCommand('codingagent.openSettingsPanel');
  }

  private async handleGetPendingChanges() {
    try {
      console.log(`[ChatViewProvider] handleGetPendingChanges: Starting`);
      const changes = await this.chatService.getPendingChanges();
      console.log(`[ChatViewProvider] handleGetPendingChanges: Got ${changes.length} pending changes from service`);
      
      // Group changes by file path
      const fileGroups = new Map<string, any[]>();
      
      for (const change of changes) {
        if (!fileGroups.has(change.filePath)) {
          fileGroups.set(change.filePath, []);
        }
        fileGroups.get(change.filePath)!.push(change);
      }
      
      // Convert to file-based format
      const fileChanges = Array.from(fileGroups.entries()).map(([filePath, changesInFile]) => {
        const latestTimestamp = Math.max(...changesInFile.map(c => c.timestamp));
        const allTools = [...new Set(changesInFile.map(c => c.toolName))].join(', ');
        const changeCount = changesInFile.length;
        
        return {
          filePath: filePath,
          changeCount: changeCount,
          changes: changesInFile.map(c => c.id), // Array of change IDs
          timestamp: latestTimestamp,
          toolNames: allTools,
          status: 'pending'
        };
      });
      
      console.log(`[ChatViewProvider] handleGetPendingChanges: Converted to ${fileChanges.length} file groups`);
      
      this.sendMessage({
        type: 'pendingChanges',
        changes: fileChanges
      });
    } catch (error) {
      console.error('Failed to get pending changes:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleAcceptChange(changeId: string) {
    try {
      await this.chatService.acceptChange(changeId);
      this.sendMessage({
        type: 'changeAccepted',
        changeId: changeId
      });
      // Refresh pending changes
      await this.handleGetPendingChanges();
    } catch (error) {
      console.error('Failed to accept change:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleRejectChange(changeId: string) {
    try {
      await this.chatService.rejectChange(changeId);
      this.sendMessage({
        type: 'changeRejected',
        changeId: changeId
      });
      // Refresh pending changes
      await this.handleGetPendingChanges();
    } catch (error) {
      console.error('Failed to reject change:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleGetChangeDiff(changeId: string) {
    try {
      const htmlDiff = await this.chatService.getChangeHtmlDiff(changeId);
      this.sendMessage({
        type: 'changeDiff',
        changeId: changeId,
        htmlDiff: htmlDiff
      });
    } catch (error) {
      console.error('Failed to get change diff:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleAcceptFileChanges(filePath: string) {
    try {
      console.log(`[ChatViewProvider] handleAcceptFileChanges: Starting for ${filePath}`);
      const changes = await this.chatService.getPendingChanges();
      console.log(`[ChatViewProvider] handleAcceptFileChanges: Found ${changes.length} pending changes before accept`);
      const fileChanges = changes.filter(change => change.filePath === filePath);
      console.log(`[ChatViewProvider] handleAcceptFileChanges: Found ${fileChanges.length} changes for file ${filePath}`);
      
      for (const change of fileChanges) {
        console.log(`[ChatViewProvider] handleAcceptFileChanges: Accepting change ${change.id}`);
        await this.chatService.acceptChange(change.id);
      }
      
      this.sendMessage({
        type: 'fileChangesAccepted',
        filePath: filePath
      });
      
      // Add delay to see if callback interferes
      console.log(`[ChatViewProvider] handleAcceptFileChanges: Waiting 100ms before refresh`);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh pending changes
      console.log(`[ChatViewProvider] handleAcceptFileChanges: About to refresh pending changes`);
      await this.handleGetPendingChanges();
    } catch (error) {
      console.error('Failed to accept file changes:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleRejectFileChanges(filePath: string) {
    try {
      const changes = await this.chatService.getPendingChanges();
      const fileChanges = changes.filter(change => change.filePath === filePath);
      
      for (const change of fileChanges) {
        await this.chatService.rejectChange(change.id);
      }
      
      this.sendMessage({
        type: 'fileChangesRejected',
        filePath: filePath
      });
      // Refresh pending changes
      await this.handleGetPendingChanges();
    } catch (error) {
      console.error('Failed to reject file changes:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleAcceptAllChanges() {
    try {
      const changes = await this.chatService.getPendingChanges();
      
      for (const change of changes) {
        await this.chatService.acceptChange(change.id);
      }
      
      this.sendMessage({
        type: 'allChangesAccepted'
      });
      // Refresh pending changes
      await this.handleGetPendingChanges();
    } catch (error) {
      console.error('Failed to accept all changes:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleRejectAllChanges() {
    try {
      const changes = await this.chatService.getPendingChanges();
      
      for (const change of changes) {
        await this.chatService.rejectChange(change.id);
      }
      
      this.sendMessage({
        type: 'allChangesRejected'
      });
      // Refresh pending changes
      await this.handleGetPendingChanges();
    } catch (error) {
      console.error('Failed to reject all changes:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private sendAvailableModesUpdate() {
    if (!this._view) {return;}

    const config = vscode.workspace.getConfiguration('codingagent');
    const modes = config.get('modes', {}) as Record<string, any>;
    
    this.sendMessage({
      type: 'updateAvailableModes',
      modes: Object.keys(modes)
    });
  }

  // Terminal approval methods
  private async handleTerminalApprovalRequest(commandId: string, command: string, cwd: string): Promise<boolean> {
    console.log(`[ChatViewProvider] Terminal approval request: ${commandId} - ${command}`);
    console.log(`[ChatViewProvider] Working directory: ${cwd} (workspace root)`);
    
    if (!this._view) {
      console.error(`[ChatViewProvider] No webview available for terminal approval request`);
      return false;
    }

    // Send approval request to UI
    this.sendMessage({
      type: 'terminalApprovalRequest',
      commandId: commandId,
      command: command,
      cwd: cwd
    });

    // The actual approval will come back via message handler
    // This method just triggers the UI - the promise resolution happens in ExecuteTerminalTool
    return true; // This return value is not used, ExecuteTerminalTool handles the promise
  }

  private async handleApproveTerminalCommand(commandId: string) {
    try {
      console.log(`[ChatViewProvider] Approving terminal command: ${commandId}`);
      if (this.toolsService) {
        this.toolsService.approveTerminalCommand(commandId);
        this.sendMessage({
          type: 'terminalCommandApproved',
          commandId: commandId
        });
      }
    } catch (error) {
      console.error('Failed to approve terminal command:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleRejectTerminalCommand(commandId: string) {
    try {
      console.log(`[ChatViewProvider] Rejecting terminal command: ${commandId}`);
      if (this.toolsService) {
        this.toolsService.rejectTerminalCommand(commandId);
        this.sendMessage({
          type: 'terminalCommandRejected',
          commandId: commandId
        });
      }
    } catch (error) {
      console.error('Failed to reject terminal command:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleGetPendingTerminalCommands() {
    try {
      console.log(`[ChatViewProvider] Getting pending terminal commands`);
      if (this.toolsService) {
        const pendingCommands = this.toolsService.getPendingTerminalCommands();
        console.log(`[ChatViewProvider] Found ${pendingCommands.length} pending terminal commands`);
        this.sendMessage({
          type: 'pendingTerminalCommands',
          commands: pendingCommands
        });
      }
    } catch (error) {
      console.error('Failed to get pending terminal commands:', error);
      this.sendMessage({
        type: 'showError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private sendMessage(message: any) {
    if (message.type === 'streamingThinking') {
      // TODO: Fix TypeScript issue with getLoggingService method  
      // this.chatService.getLoggingService().logDebug('ChatViewProvider sendMessage streamingThinking', message);
    }
    if (this._view) {
      this._view.webview.postMessage(message);
      if (message.type === 'streamingThinking') {
        // TODO: Fix TypeScript issue with getLoggingService method
        // this.chatService.getLoggingService().logDebug('ChatViewProvider postMessage to webview completed for streamingThinking');
      }
    }
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = getWebviewContent(
        this._view.webview,
        this.context.extensionUri,
        this.chatService.getMessages()
      );
    }
  }

  public addMessage(message: ChatMessage) {
    if (this._view) {
      this.sendMessage({
        type: 'addMessage',
        message: message
      });
    }
  }

  public clearChat() {
    this.chatService.clearMessages();
    if (this._view) {
      this.sendMessage({ type: 'clearMessages' });
    }
  }

  public showChanges() {
    if (this._view) {
      this.sendMessage({ type: 'showChanges' });
    }
  }

  public updateChanges(changes: any[]) {
    if (this._view) {
      console.log(`[ChatViewProvider] updateChanges: Sending ${changes.length} changes to frontend`);
      this.sendMessage({
        type: 'pendingChanges',  // Changed from 'updateChanges' to match frontend handler
        changes: changes
      });
    }
  }

  private async handleCopyToClipboard(text: string) {
    try {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      vscode.window.showErrorMessage('Failed to copy to clipboard');
    }
  }

  private async handleOpenPlanVisualization(planId: string) {
    try {
      // Execute command to open plan visualization
      await vscode.commands.executeCommand('codingagent.openPlanVisualization', planId);
    } catch (error) {
      console.error('Failed to open plan visualization:', error);
      vscode.window.showErrorMessage('Failed to open plan visualization');
    }
  }

  public updateCurrentPlan(planId: string | null) {
    if (!this._view) {return;}
    
    this.sendMessage({
      type: 'updateCurrentPlan',
      planId: planId
    });
  }
}
