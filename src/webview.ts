// src/webview.ts

import * as vscode from 'vscode';
import { ChatMessage } from './types';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialMessages: ChatMessage[] = []
): string {
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat.css')
  );

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat.js')
  );

  const iconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat-icon.svg')
  );

  return /* html */`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:;">
      <link href="${styleUri}" rel="stylesheet">
      <title>CodingAgent Chat</title>
    </head>
    <body>
      <div class="chat-container">
        <!-- Header -->
        <div class="chat-header">
          <div class="header-left">
            <img src="${iconUri}" alt="CodingAgent" class="header-icon">
            <span class="header-title">CodingAgent</span>
          </div>
          <div class="header-controls">
            <select id="modeSelect" class="control-select" title="Agent Mode">
              <option value="Coder">🛠️ Coder</option>
              <option value="Ask">❓ Ask</option>
              <option value="Architect">🏗️ Architect</option>
            </select>
            <select id="modelSelect" class="control-select" title="AI Model">
              <option value="llama3:8b">llama3:8b</option>
            </select>
            <button id="refreshModels" class="control-btn" title="Refresh Models">
              <span class="codicon codicon-refresh"></span>
            </button>
            <button id="clearChat" class="control-btn" title="Clear Chat">
              <span class="codicon codicon-trash"></span>
            </button>
          </div>
        </div>

        <!-- Messages Container -->
        <div class="messages-container" id="messagesContainer">
          <div class="welcome-message">
            <div class="welcome-icon">🤖</div>
            <h3>Welcome to CodingAgent!</h3>
            <p>I'm your AI coding assistant powered by Ollama. I can help you with:</p>
            <ul>
              <li>📝 Reading and writing code files</li>
              <li>🔍 Exploring project structure</li>
              <li>⚡ Running terminal commands</li>
              <li>🌐 Reading web content</li>
              <li>💡 Answering coding questions</li>
            </ul>
            <p>Select a mode and start chatting!</p>
          </div>
        </div>

        <!-- Input Container -->
        <div class="input-container">
          <div class="input-wrapper">
            <textarea 
              id="messageInput" 
              placeholder="Ask me anything..." 
              rows="1"
              class="message-input"
            ></textarea>
            <button id="sendButton" class="send-button" title="Send Message">
              <span class="codicon codicon-send"></span>
            </button>
          </div>
          <div class="input-hint">
            <span class="hint-text">Press Ctrl+Enter to send • Use @filename to reference files</span>
          </div>
        </div>
      </div>

      <script src="${scriptUri}"></script>
      <script>
        // Initialize with any existing messages
        const initialMessages = ${JSON.stringify(initialMessages)};
        if (initialMessages.length > 0) {
          initialMessages.forEach(message => {
            addMessage(message);
          });
        }
      </script>
    </body>
    </html>
  `;
}
