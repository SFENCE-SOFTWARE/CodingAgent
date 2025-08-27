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

  const refreshIconUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'refresh-icon.svg')
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
        </div>
        
        <!-- Action Buttons Row -->
        <div class="action-buttons-row">
          <button id="copyAllBtn" class="action-btn" title="Copy all conversation as markdown">
            <span class="icon-copy-all"></span>
          </button>
          <button id="copyAllWithThinkingBtn" class="action-btn" title="Copy all conversation with thinking as markdown">
            🧠
          </button>
          <button id="refreshModelsBtn" class="action-btn" title="Refresh available models">
            <img src="${refreshIconUri}" alt="Refresh" width="16" height="16">
          </button>
          <button id="settingsBtn" class="action-btn" title="Open Settings">
            <img src="${settingsIconUri}" alt="Settings" width="16" height="16">
          </button>
          <button id="clearBtn" class="action-btn" title="Clear Chat (Ctrl+Click to skip confirmation)">
            <img src="${clearIconUri}" alt="Clear" width="16" height="16">
          </button>
        </div>

        <!-- Messages Container -->
        <div class="messages-container" id="messagesContainer">
          <div class="welcome-message">
            <div class="welcome-icon">🤖</div>
            <h3>Welcome to CodingAgent!</h3>
            <p>I'm your AI coding assistant. I can help you with:</p>
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
          <span id="changeCount">0</span>
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

        <!-- Input Container -->
        <div class="input-container">
          <div class="controls-row">
            <select id="modeSelect" class="control-select" title="Agent Mode">
              <!-- Modes will be populated dynamically -->
            </select>
            <select id="modelSelect" class="control-select" title="AI Model">
              <option value="llama3:8b">llama3:8b</option>
            </select>
          </div>
          <textarea 
            id="messageInput" 
            placeholder="Ask me anything..." 
            rows="3"
            class="message-input"
          ></textarea>
          <div class="button-row">
            <button id="sendButton" class="action-button send-button" title="Send Message">
              <span class="icon-send"></span>
            </button>
            <button id="correctionButton" class="action-button correction-button" title="Send Correction">
              <span class="icon-edit"></span>
            </button>
            <button id="interruptButton" class="action-button interrupt-button" title="Interrupt LLM">
              <span class="icon-stop"></span>
            </button>
          </div>
          <div class="input-hint">
            <span class="hint-text">Press Ctrl+Enter to send • Use @filename to reference files</span>
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

        <!-- Iteration Limit Dialog -->
        <div class="iteration-dialog" id="iterationDialog" style="display: none;">
          <div class="iteration-dialog-content">
            <div class="iteration-dialog-header">
              <h3>⏰ Long Running Process</h3>
            </div>
            <div class="iteration-dialog-body">
              <p>The AI has been working on this task for a while (<span id="iterationCountDisplay">10</span> iterations).</p>
              <p>Would you like to continue or stop the process?</p>
            </div>
            <div class="iteration-dialog-footer">
              <button id="stopIterationsBtn" class="iteration-stop-btn">Stop Process</button>
              <button id="continueIterationsBtn" class="iteration-continue-btn">Continue Working</button>
            </div>
          </div>
        </div>

        <!-- Clear Confirmation Dialog -->
        <div class="clear-confirmation-dialog" id="clearConfirmationDialog" style="display: none;">
          <div class="clear-confirmation-content">
            <div class="clear-confirmation-header">
              <h3>🗑️ Clear Chat History</h3>
            </div>
            <div class="clear-confirmation-body">
              <p>This will remove all messages from the current session.</p>
              <p><strong>Tip:</strong> Hold Ctrl/Cmd while clicking to skip this confirmation.</p>
            </div>
            <div class="clear-confirmation-footer">
              <button id="cancelClearBtn" class="clear-cancel-btn">Cancel</button>
              <button id="confirmClearBtn" class="clear-confirm-btn">Clear Chat</button>
            </div>
          </div>
        </div>
        
        <!-- Ask User Dialog -->
        <div class="ask-user-dialog" id="askUserDialog" style="display: none;">
          <div class="ask-user-dialog-content">
            <div class="ask-user-dialog-header">
              <h3>❓ AI needs your input</h3>
            </div>
            <div class="ask-user-dialog-body">
              <p id="askUserQuestion" class="ask-user-question"></p>
              <div id="askUserContext" class="ask-user-context" style="display: none;"></div>
              <textarea id="askUserInput" class="ask-user-input" placeholder="Your response..." rows="3"></textarea>
              <div class="ask-user-hint">Press Ctrl+Enter to submit</div>
            </div>
            <div class="ask-user-dialog-footer">
              <button id="cancelAskUserBtn" class="ask-user-cancel-btn">Cancel</button>
              <button id="answerAskUserBtn" class="ask-user-answer-btn">Answer</button>
            </div>
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
