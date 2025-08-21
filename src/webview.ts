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

  const settingsIconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'settings-icon.svg')
  );

  const clearIconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'clear-icon.svg')
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
          <div class="header-right">
            <button id="settingsBtn" class="header-btn" title="Open Settings">
              <img src="${settingsIconUri}" alt="Settings" width="16" height="16">
            </button>
            <button id="clearBtn" class="header-btn" title="Clear Chat">
              <img src="${clearIconUri}" alt="Clear" width="16" height="16">
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

        <!-- Change Tracking Panel -->
        <div class="change-tracking-panel" id="changeTrackingPanel" style="display: none;">
          <div class="change-panel-header">
            <h3>📝 File Changes</h3>
            <button id="hideChangesBtn" class="header-btn" title="Hide Changes Panel">×</button>
          </div>
          <div class="change-panel-content" id="changePanelContent">
            <div class="no-changes">No pending changes</div>
          </div>
        </div>

        <!-- Change Tracking Toggle Button -->
        <button id="showChangesBtn" class="show-changes-btn" title="Show File Changes" style="display: none;">
          📝 <span id="changeCount">0</span>
        </button>

        <!-- Terminal Approval Panel -->
        <div class="terminal-approval-panel" id="terminalApprovalPanel" style="display: none;">
          <div class="approval-panel-header">
            <h3>⚠️ Terminal Command Approval</h3>
          </div>
          <div class="approval-panel-content" id="approvalPanelContent">
            <!-- Commands will be populated dynamically -->
          </div>
        </div>

        <!-- Correction Dialog -->
        <div class="correction-dialog" id="correctionDialog" style="display: none;">
          <div class="correction-dialog-content">
            <div class="correction-dialog-header">
              <h3>✏️ Send Correction</h3>
            </div>
            <div class="correction-dialog-body">
              <p>Provide a correction or additional instruction for the AI:</p>
              <textarea id="correctionInput" class="correction-input" placeholder="Describe what should be corrected or done differently..." rows="4"></textarea>
            </div>
            <div class="correction-dialog-footer">
              <button id="cancelCorrectionBtn" class="correction-cancel-btn">Cancel</button>
              <button id="submitCorrectionBtn" class="correction-submit-btn">Send Correction</button>
            </div>
          </div>
        </div>

        <!-- Input Container -->
        <div class="input-container">
          <div class="controls-row">
            <select id="modeSelect" class="control-select" title="Agent Mode">
              <!-- Modes will be populated dynamically -->
            </select>
            <select id="modelSelect" class="control-select" title="AI Model">
              <option value="llama3:8b">llama3:8b</option>
            </select>
            <button id="sendButton" class="send-button" title="Send Message">
              <span class="codicon codicon-send"></span>
            </button>
            <button id="interruptButton" class="interrupt-button" title="Interrupt LLM" style="display: none;">
              <span class="codicon codicon-debug-stop"></span>
            </button>
            <button id="correctionButton" class="correction-button" title="Send Correction" style="display: none;">
              <span class="codicon codicon-edit"></span>
            </button>
          </div>
          <textarea 
            id="messageInput" 
            placeholder="Ask me anything..." 
            rows="3"
            class="message-input"
          ></textarea>
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
