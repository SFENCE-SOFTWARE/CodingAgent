// Webview JavaScript for CodingAgent Chat

(function() {
  const vscode = acquireVsCodeApi();
  
  // DOM Elements
  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const modeSelect = document.getElementById('modeSelect');
  const modelSelect = document.getElementById('modelSelect');
  const settingsBtn = document.getElementById('settingsBtn');
  const clearBtn = document.getElementById('clearBtn');
  
  let isLoading = false;
  let currentMode = 'Coder';
  let currentModel = 'llama3:8b';
  let isThinkingExpanded = true;
  let isToolCallsExpanded = false; // Tool calls collapsed by default
  let enableStreaming = true;
  let streamingMessages = new Map(); // Track streaming messages
  
  // Initialize
  function init() {
    setupEventListeners();
    requestConfiguration();
    requestAvailableModels();
    requestAvailableModes();
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
    
    // Settings and clear buttons
    settingsBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });
    
    clearBtn.addEventListener('click', () => {
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
    
    // Add user message immediately to ensure it shows up
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: Date.now()
    };
    addMessage(userMessage);
    
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
    
    // Dynamic assistant label with model name
    if (message.role === 'assistant') {
      const modelName = message.model || currentModel || 'Unknown';
      roleSpan.textContent = `LLM ${modelName}`;
    } else {
      roleSpan.textContent = message.role;
    }
    
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
    
    // Add thinking/reasoning if present (before content)
    if (message.reasoning) {
      const thinkingDiv = createThinkingElement(message.reasoning);
      messageDiv.appendChild(thinkingDiv);
    }
    
    messageDiv.appendChild(contentDiv);

    // Add tool calls if present (after content, collapsed by default)
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
    
    const headerLeft = document.createElement('div');
    headerLeft.className = 'thinking-header-left';
    headerLeft.innerHTML = '<span class="codicon codicon-lightbulb"></span> Model Thinking';
    
    const toggle = document.createElement('button');
    toggle.className = 'thinking-toggle';
    toggle.textContent = '−';
    
    header.appendChild(headerLeft);
    header.appendChild(toggle);
    
    const content = document.createElement('div');
    content.className = 'thinking-content';
    content.textContent = reasoning;
    
    // Auto-collapse after response
    setTimeout(() => {
      if (isThinkingExpanded) {
        content.classList.add('collapsed');
        toggle.textContent = '+';
        isThinkingExpanded = false;
      }
    }, 500);
    
    header.addEventListener('click', () => {
      content.classList.toggle('collapsed');
      toggle.textContent = content.classList.contains('collapsed') ? '+' : '−';
      isThinkingExpanded = !content.classList.contains('collapsed');
    });
    
    container.appendChild(header);
    container.appendChild(content);
    
    return container;
  }
  
  function createToolCallsElement(toolCalls) {
    const container = document.createElement('div');
    container.className = 'tool-calls-container';
    
    // Create header with toggle functionality
    const header = document.createElement('div');
    header.className = 'tool-calls-header';
    
    const headerLeft = document.createElement('div');
    headerLeft.className = 'tool-calls-header-left';
    headerLeft.innerHTML = `<span class="codicon codicon-tools"></span> Tool Calls (${toolCalls.length})`;
    
    const toggle = document.createElement('button');
    toggle.className = 'tool-calls-toggle';
    toggle.textContent = '+'; // Collapsed by default
    
    header.appendChild(headerLeft);
    header.appendChild(toggle);
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'tool-calls-content collapsed'; // Start collapsed
    
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
      content.appendChild(toolDiv);
    });
    
    // Toggle functionality
    const toggleToolCalls = () => {
      const isCollapsed = content.classList.contains('collapsed');
      content.classList.toggle('collapsed');
      toggle.textContent = isCollapsed ? '−' : '+';
    };
    
    header.addEventListener('click', toggleToolCalls);
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleToolCalls();
    });
    
    container.appendChild(header);
    container.appendChild(content);
    
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

  function requestAvailableModes() {
    vscode.postMessage({ type: 'getAvailableModes' });
  }
  
  function updateConfiguration(config) {
    currentMode = config.mode;
    currentModel = config.model;
    enableStreaming = config.enableStreaming !== undefined ? config.enableStreaming : true;
    
    modeSelect.value = currentMode;
    modelSelect.value = currentModel;
  }

  function createStreamingMessage(messageId, model) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming';
    messageDiv.setAttribute('data-message-id', messageId);
    
    // Message header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar assistant';
    avatarDiv.textContent = '🤖';
    
    const roleSpan = document.createElement('span');
    roleSpan.className = 'message-role';
    roleSpan.textContent = `LLM ${model || currentModel || 'Unknown'}`;
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    timestampSpan.textContent = formatTimestamp(Date.now());
    
    headerDiv.appendChild(avatarDiv);
    headerDiv.appendChild(roleSpan);
    headerDiv.appendChild(timestampSpan);
    
    // Thinking section (initially hidden)
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'thinking-container';
    thinkingDiv.style.display = 'none';
    
    const thinkingHeader = document.createElement('div');
    thinkingHeader.className = 'thinking-header';
    
    const thinkingHeaderLeft = document.createElement('div');
    thinkingHeaderLeft.className = 'thinking-header-left';
    thinkingHeaderLeft.innerHTML = '<span class="codicon codicon-lightbulb"></span> Model Thinking';
    
    const thinkingToggle = document.createElement('button');
    thinkingToggle.className = 'thinking-toggle';
    thinkingToggle.textContent = '−';
    
    thinkingHeader.appendChild(thinkingHeaderLeft);
    thinkingHeader.appendChild(thinkingToggle);
    
    const thinkingContent = document.createElement('div');
    thinkingContent.className = 'thinking-content';
    
    thinkingHeader.addEventListener('click', () => {
      thinkingContent.classList.toggle('collapsed');
      thinkingToggle.textContent = thinkingContent.classList.contains('collapsed') ? '+' : '−';
    });
    
    thinkingDiv.appendChild(thinkingHeader);
    thinkingDiv.appendChild(thinkingContent);
    
    // Message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<div class="streaming-cursor">▊</div>';
    
    // Tool calls container (initially hidden)
    const toolCallsDiv = document.createElement('div');
    toolCallsDiv.className = 'tool-calls-container';
    toolCallsDiv.style.display = 'none';
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(thinkingDiv);
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(toolCallsDiv);
    
    // Store references for easy access
    streamingMessages.set(messageId, {
      element: messageDiv,
      contentDiv: contentDiv,
      thinkingDiv: thinkingDiv,
      thinkingContent: thinkingContent,
      toolCallsDiv: toolCallsDiv,
      accumulatedContent: '',
      accumulatedThinking: '',
      accumulatedToolCalls: []
    });
    
    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    return messageDiv;
  }

  function updateStreamingContent(messageId, deltaContent) {
    const streamingData = streamingMessages.get(messageId);
    if (!streamingData) return;
    
    // Append delta to accumulated content
    streamingData.accumulatedContent += deltaContent;
    streamingData.contentDiv.innerHTML = formatMessageContent(streamingData.accumulatedContent) + '<div class="streaming-cursor">▊</div>';
    scrollToBottom();
  }

  function updateStreamingThinking(messageId, deltaThinking) {
    const streamingData = streamingMessages.get(messageId);
    if (!streamingData) return;
    
    // Append delta to accumulated thinking
    streamingData.accumulatedThinking += deltaThinking;
    streamingData.thinkingContent.textContent = streamingData.accumulatedThinking;
    
    // Show thinking section if we have content
    if (streamingData.accumulatedThinking && streamingData.accumulatedThinking.trim()) {
      streamingData.thinkingDiv.style.display = 'block';
    }
    
    scrollToBottom();
  }

  function addStreamingToolCalls(messageId, toolCalls) {
    const streamingData = streamingMessages.get(messageId);
    if (!streamingData) return;
    
    // Initialize accumulated tool calls if not exists
    if (!streamingData.accumulatedToolCalls) {
      streamingData.accumulatedToolCalls = [];
    }
    
    // Merge incoming tool calls with accumulated ones
    toolCalls.forEach(incomingToolCall => {
      const index = incomingToolCall.index !== undefined ? incomingToolCall.index : 0;
      const existingIndex = streamingData.accumulatedToolCalls.findIndex(tc => tc.index === index);
      
      if (existingIndex !== -1) {
        // Merge with existing tool call
        const existing = streamingData.accumulatedToolCalls[existingIndex];
        if (incomingToolCall.function?.name) {
          existing.function.name = incomingToolCall.function.name;
        }
        if (incomingToolCall.function?.arguments) {
          existing.function.arguments = (existing.function.arguments || '') + incomingToolCall.function.arguments;
        }
      } else {
        // Add new tool call
        streamingData.accumulatedToolCalls.push({
          index: index,
          id: incomingToolCall.id || `tool_call_${index}`,
          type: incomingToolCall.type || 'function',
          function: {
            name: incomingToolCall.function?.name || '',
            arguments: incomingToolCall.function?.arguments || ''
          }
        });
      }
    });
    
    // Rebuild tool calls display
    streamingData.toolCallsDiv.innerHTML = '';
    streamingData.accumulatedToolCalls.forEach(toolCall => {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'tool-call';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'tool-call-name';
      nameDiv.textContent = `🔧 ${toolCall.function.name || 'Loading...'}`;
      
      const argsDiv = document.createElement('div');
      argsDiv.className = 'tool-call-args';
      // Show loading indicator if we have name but incomplete arguments
      if (toolCall.function.name && !toolCall.function.arguments) {
        argsDiv.innerHTML = '<span style="opacity: 0.6;">Loading arguments...</span>';
      } else if (toolCall.function.arguments) {
        argsDiv.textContent = toolCall.function.arguments;
      } else {
        argsDiv.innerHTML = '<span style="opacity: 0.6;">...</span>';
      }
      
      toolDiv.appendChild(nameDiv);
      toolDiv.appendChild(argsDiv);
      streamingData.toolCallsDiv.appendChild(toolDiv);
    });
    
    // Show tool calls container
    streamingData.toolCallsDiv.style.display = 'block';
    scrollToBottom();
  }

  function finishStreamingMessage(messageId, isComplete) {
    const streamingData = streamingMessages.get(messageId);
    if (!streamingData) return;
    
    // Remove streaming cursor
    streamingData.contentDiv.innerHTML = formatMessageContent(streamingData.accumulatedContent);
    
    // Remove streaming class
    streamingData.element.classList.remove('streaming');
    
    // Auto-collapse thinking after a delay
    if (streamingData.accumulatedThinking && streamingData.thinkingDiv.style.display !== 'none') {
      setTimeout(() => {
        const thinkingContent = streamingData.thinkingContent;
        const toggle = streamingData.thinkingDiv.querySelector('.thinking-toggle');
        thinkingContent.classList.add('collapsed');
        toggle.textContent = '+';
      }, 1000);
    }
    
    // Clean up
    streamingMessages.delete(messageId);
    scrollToBottom();
  }

  function handleStreamingError(messageId, error) {
    const streamingData = streamingMessages.get(messageId);
    if (!streamingData) return;
    
    // Update content with error
    streamingData.contentDiv.innerHTML = `<div class="error-content">Error: ${error}</div>`;
    
    // Remove streaming cursor and class
    streamingData.element.classList.remove('streaming');
    streamingData.element.classList.add('error');
    
    // Clean up
    streamingMessages.delete(messageId);
    scrollToBottom();
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

  function updateAvailableModes(modes) {
    const currentSelection = modeSelect.value;
    modeSelect.innerHTML = '';
    
    modes.forEach(mode => {
      const option = document.createElement('option');
      option.value = mode;
      option.textContent = mode;
      modeSelect.appendChild(option);
    });
    
    // Restore selection if possible
    if (modes.includes(currentSelection)) {
      modeSelect.value = currentSelection;
      currentMode = currentSelection;
    } else if (modes.length > 0) {
      modeSelect.value = modes[0];
      currentMode = modes[0];
    }
  }

  function showThinking(content) {
    let thinkingContainer = messagesContainer.querySelector('.thinking-container');
    
    if (!thinkingContainer) {
      thinkingContainer = document.createElement('div');
      thinkingContainer.className = 'thinking-container';
      
      const header = document.createElement('div');
      header.className = 'thinking-header';
      
      const headerLeft = document.createElement('div');
      headerLeft.className = 'thinking-header-left';
      headerLeft.innerHTML = '<span class="codicon codicon-lightbulb"></span> Model Thinking';
      
      const toggle = document.createElement('button');
      toggle.className = 'thinking-toggle';
      toggle.textContent = '−';
      
      header.appendChild(headerLeft);
      header.appendChild(toggle);
      
      const content = document.createElement('div');
      content.className = 'thinking-content';
      
      header.addEventListener('click', () => {
        content.classList.toggle('collapsed');
        toggle.textContent = content.classList.contains('collapsed') ? '+' : '−';
        isThinkingExpanded = !content.classList.contains('collapsed');
      });
      
      thinkingContainer.appendChild(header);
      thinkingContainer.appendChild(content);
      messagesContainer.appendChild(thinkingContainer);
    }
    
    const thinkingContent = thinkingContainer.querySelector('.thinking-content');
    thinkingContent.textContent = content;
    thinkingContent.classList.remove('collapsed');
    
    const toggle = thinkingContainer.querySelector('.thinking-toggle');
    toggle.textContent = '−';
    isThinkingExpanded = true;
    
    scrollToBottom();
  }

  function updateThinking(content) {
    const thinkingContainer = messagesContainer.querySelector('.thinking-container');
    if (thinkingContainer) {
      const thinkingContent = thinkingContainer.querySelector('.thinking-content');
      thinkingContent.textContent = content;
      if (isThinkingExpanded) {
        scrollToBottom();
      }
    }
  }

  function hideThinking() {
    const thinkingContainer = messagesContainer.querySelector('.thinking-container');
    if (thinkingContainer) {
      // Auto-collapse after a delay
      setTimeout(() => {
        const thinkingContent = thinkingContainer.querySelector('.thinking-content');
        const toggle = thinkingContainer.querySelector('.thinking-toggle');
        thinkingContent.classList.add('collapsed');
        toggle.textContent = '+';
        isThinkingExpanded = false;
      }, 500);
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
        
      case 'showThinking':
        showThinking(message.thinking);
        break;
        
      case 'updateThinking':
        updateThinking(message.thinking);
        break;
        
      case 'hideThinking':
        hideThinking();
        break;
        
      case 'updateConfiguration':
        updateConfiguration(message.config);
        break;
        
      case 'updateAvailableModels':
        updateAvailableModels(message.models);
        break;
        
      case 'updateAvailableModes':
        updateAvailableModes(message.modes);
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

      // Streaming message handlers
      case 'streamingStart':
        createStreamingMessage(message.messageId, message.model);
        break;

      case 'streamingContent':
        updateStreamingContent(message.messageId, message.content);
        break;

      case 'streamingThinking':
        updateStreamingThinking(message.messageId, message.thinking);
        break;

      case 'streamingToolCalls':
        addStreamingToolCalls(message.messageId, message.toolCalls);
        break;

      case 'streamingEnd':
        finishStreamingMessage(message.messageId, message.isComplete);
        break;

      case 'streamingError':
        handleStreamingError(message.messageId, message.error);
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
