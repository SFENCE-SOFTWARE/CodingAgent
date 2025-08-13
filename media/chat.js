// Webview JavaScript for CodingAgent Chat

(function() {
  const vscode = acquireVsCodeApi();
  
  // DOM Elements
  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const modeSelect = document.getElementById('modeSelect');
  const modelSelect = document.getElementById('modelSelect');
  const refreshModelsButton = document.getElementById('refreshModels');
  const clearChatButton = document.getElementById('clearChat');
  
  let isLoading = false;
  let currentMode = 'Coder';
  let currentModel = 'llama3:8b';
  
  // Initialize
  function init() {
    setupEventListeners();
    requestConfiguration();
    requestAvailableModels();
  }
  
  function setupEventListeners() {
    // Send message events
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', autoResizeTextarea);
    
    // Mode and model changes
    modeSelect.addEventListener('change', (e) => {
      currentMode = e.target.value;
      vscode.postMessage({
        type: 'setMode',
        mode: currentMode
      });
    });
    
    modelSelect.addEventListener('change', (e) => {
      currentModel = e.target.value;
      vscode.postMessage({
        type: 'setModel',
        model: currentModel
      });
    });
    
    // Refresh models
    refreshModelsButton.addEventListener('click', () => {
      requestAvailableModels();
    });
    
    // Clear chat
    clearChatButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the chat history?')) {
        vscode.postMessage({ type: 'clearChat' });
        clearMessages();
      }
    });
  }
  
  function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  }
  
  function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || isLoading) return;
    
    setLoading(true);
    messageInput.value = '';
    autoResizeTextarea();
    
    vscode.postMessage({
      type: 'sendMessage',
      content: content
    });
  }
  
  function setLoading(loading) {
    isLoading = loading;
    sendButton.disabled = loading;
    messageInput.disabled = loading;
    
    if (loading) {
      sendButton.innerHTML = '<div class="loading"><div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div></div>';
    } else {
      sendButton.innerHTML = '<span class="codicon codicon-send"></span>';
    }
  }
  
  function addMessage(message) {
    const messageElement = createMessageElement(message);
    
    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }
  
  function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    // Message header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${message.role}`;
    avatarDiv.textContent = getAvatarText(message.role);
    
    const roleSpan = document.createElement('span');
    roleSpan.className = 'message-role';
    roleSpan.textContent = message.role;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    timestampSpan.textContent = formatTimestamp(message.timestamp);
    
    headerDiv.appendChild(avatarDiv);
    headerDiv.appendChild(roleSpan);
    headerDiv.appendChild(timestampSpan);
    
    // Message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessageContent(message.content);
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    // Add thinking/reasoning if present
    if (message.reasoning) {
      const thinkingDiv = createThinkingElement(message.reasoning);
      messageDiv.appendChild(thinkingDiv);
    }
    
    // Add tool calls if present
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolCallsDiv = createToolCallsElement(message.toolCalls);
      messageDiv.appendChild(toolCallsDiv);
    }
    
    // Add raw request if present (for debugging)
    if (message.raw) {
      const rawDiv = createRawRequestElement(message.raw);
      messageDiv.appendChild(rawDiv);
    }
    
    return messageDiv;
  }
  
  function createThinkingElement(reasoning) {
    const container = document.createElement('div');
    container.className = 'thinking-container';
    
    const header = document.createElement('div');
    header.className = 'thinking-header';
    header.innerHTML = '<span class="codicon codicon-lightbulb"></span> Model Thinking';
    
    const content = document.createElement('div');
    content.className = 'thinking-content';
    content.textContent = reasoning;
    
    header.addEventListener('click', () => {
      content.classList.toggle('collapsed');
    });
    
    container.appendChild(header);
    container.appendChild(content);
    
    return container;
  }
  
  function createToolCallsElement(toolCalls) {
    const container = document.createElement('div');
    container.className = 'tool-calls-container';
    
    toolCalls.forEach(toolCall => {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'tool-call';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'tool-call-name';
      nameDiv.textContent = `🔧 ${toolCall.function.name}`;
      
      const argsDiv = document.createElement('div');
      argsDiv.className = 'tool-call-args';
      argsDiv.textContent = toolCall.function.arguments;
      
      toolDiv.appendChild(nameDiv);
      toolDiv.appendChild(argsDiv);
      container.appendChild(toolDiv);
    });
    
    return container;
  }
  
  function createRawRequestElement(rawData) {
    const container = document.createElement('div');
    container.className = 'raw-request-container';
    
    const header = document.createElement('div');
    header.className = 'raw-request-header';
    header.innerHTML = '<span class="codicon codicon-debug"></span> Debug Info (click to expand)';
    
    const content = document.createElement('div');
    content.className = 'raw-request-content collapsed';
    content.textContent = JSON.stringify(rawData, null, 2);
    
    header.addEventListener('click', () => {
      content.classList.toggle('collapsed');
    });
    
    container.appendChild(header);
    container.appendChild(content);
    
    return container;
  }
  
  function getAvatarText(role) {
    switch (role) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'error': return '⚠️';
      default: return '?';
    }
  }
  
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
  
  function formatMessageContent(content) {
    // Convert markdown-style code blocks to HTML
    content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
    });
    
    // Convert inline code
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert line breaks
    content = content.replace(/\n/g, '<br>');
    
    return content;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function clearMessages() {
    const messages = messagesContainer.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
    
    // Show welcome message again
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
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
    `;
    messagesContainer.appendChild(welcomeDiv);
  }
  
  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }
  
  function requestConfiguration() {
    vscode.postMessage({ type: 'getConfiguration' });
  }
  
  function requestAvailableModels() {
    vscode.postMessage({ type: 'getAvailableModels' });
  }
  
  function updateConfiguration(config) {
    currentMode = config.mode;
    currentModel = config.model;
    
    modeSelect.value = currentMode;
    modelSelect.value = currentModel;
  }
  
  function updateAvailableModels(models) {
    const currentSelection = modelSelect.value;
    modelSelect.innerHTML = '';
    
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
    
    // Restore selection if possible
    if (models.includes(currentSelection)) {
      modelSelect.value = currentSelection;
    } else if (models.length > 0) {
      modelSelect.value = models[0];
      currentModel = models[0];
    }
  }
  
  // Handle messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
      case 'addMessage':
        addMessage(message.message);
        break;
        
      case 'addMessages':
        message.messages.forEach(msg => addMessage(msg));
        break;
        
      case 'setLoading':
        setLoading(message.loading);
        break;
        
      case 'updateConfiguration':
        updateConfiguration(message.config);
        break;
        
      case 'updateAvailableModels':
        updateAvailableModels(message.models);
        break;
        
      case 'showError':
        console.error('Extension error:', message.error);
        addMessage({
          id: Date.now().toString(),
          role: 'error',
          content: message.error,
          timestamp: Date.now()
        });
        setLoading(false);
        break;
        
      case 'clearMessages':
        clearMessages();
        break;
    }
  });
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Make addMessage globally available for initial messages script
  window.addMessage = addMessage;
})();
