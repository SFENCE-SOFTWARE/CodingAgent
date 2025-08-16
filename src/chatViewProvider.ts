// src/chatViewProvider.ts

import * as vscode from 'vscode';
import { ChatService } from './chatService';
import { getWebviewContent } from './webview';
import { ChatMessage, StreamingUpdate, ChatUpdate } from './types';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codingagent-chat-view';

  private _view?: vscode.WebviewView;
  private chatService: ChatService;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.chatService = new ChatService();
    
    // Set up streaming callback
    this.chatService.setStreamingCallback((update: StreamingUpdate) => {
      this.handleStreamingUpdate(update);
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
    if (!this._view) return;

    switch (update.type) {
      case 'start':
        this.sendMessage({
          type: 'streamingStart',
          messageId: update.messageId,
          model: update.model
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

  private async handleSendMessage(content: string) {
    if (!this._view) return;

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
    if (!this._view) return;

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
    if (!this._view) return;

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

  private sendAvailableModesUpdate() {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('codingagent');
    const modes = config.get('modes', {}) as Record<string, any>;
    
    this.sendMessage({
      type: 'updateAvailableModes',
      modes: Object.keys(modes)
    });
  }

  private sendMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
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
}
