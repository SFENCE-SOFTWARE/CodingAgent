// src/chatViewProvider.ts

import * as vscode from 'vscode';
import { ChatService } from './chatService';
import { getWebviewContent } from './webview';
import { ChatMessage } from './types';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codingagent-chat-view';

  private _view?: vscode.WebviewView;
  private chatService: ChatService;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.chatService = new ChatService();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('codingagent')) {
        this.chatService.updateConfiguration();
        this.sendConfiguration();
      }
    });
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
  }

  private async handleSendMessage(content: string) {
    if (!this._view) return;

    try {
      // Set loading state
      this.sendMessage({ type: 'setLoading', loading: true });

      // Send message to chat service
      const newMessages = await this.chatService.sendMessage(content);

      // Add messages to webview
      this.sendMessage({
        type: 'addMessages',
        messages: newMessages
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
        showThinking: this.chatService.getShowThinking()
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
