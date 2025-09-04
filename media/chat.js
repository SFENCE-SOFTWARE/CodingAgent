// Webview JavaScript for CodingAgent Chat

(function() {
  const vscode = acquireVsCodeApi();
  
  // DOM Elements
  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const interruptButton = document.getElementById('softInterruptButton'); // Keep for backward compatibility
  const softInterruptButton = document.getElementById('softInterruptButton');
  const hardInterruptButton = document.getElementById('hardInterruptButton');
  const correctionButton = document.getElementById('correctionButton');
  const modeSelect = document.getElementById('modeSelect');
  const modelSelect = document.getElementById('modelSelect');
  const settingsBtn = document.getElementById('settingsBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const copyAllWithThinkingBtn = document.getElementById('copyAllWithThinkingBtn');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const planVisualizationBtn = document.getElementById('planVisualizationBtn');
  
  // Correction dialog elements
  const correctionDialog = document.getElementById('correctionDialog');
  const correctionInput = document.getElementById('correctionInput');
  const cancelCorrectionBtn = document.getElementById('cancelCorrectionBtn');
  const submitCorrectionBtn = document.getElementById('submitCorrectionBtn');
  
  // Iteration dialog elements
  const iterationDialog = document.getElementById('iterationDialog');
  const iterationCountDisplay = document.getElementById('iterationCountDisplay');
  const stopIterationsBtn = document.getElementById('stopIterationsBtn');
  const continueIterationsBtn = document.getElementById('continueIterationsBtn');
  
  // Clear confirmation dialog elements
  const clearConfirmationDialog = document.getElementById('clearConfirmationDialog');
  const cancelClearBtn = document.getElementById('cancelClearBtn');
  const confirmClearBtn = document.getElementById('confirmClearBtn');
  
  // Ask user dialog elements
  const askUserDialog = document.getElementById('askUserDialog');
  const askUserQuestion = document.getElementById('askUserQuestion');
  const askUserContext = document.getElementById('askUserContext');
  const askUserInput = document.getElementById('askUserInput');
  const cancelAskUserBtn = document.getElementById('cancelAskUserBtn');
  const answerAskUserBtn = document.getElementById('answerAskUserBtn');
  
  // Change tracking elements
  const changeTrackingPanel = document.getElementById('changeTrackingPanel');
  const changePanelContent = document.getElementById('changePanelContent');
  const showChangesBtn = document.getElementById('showChangesBtn');
  const hideChangesBtn = document.getElementById('hideChangesBtn');
  const changeCount = document.getElementById('changeCount');
  
  // Terminal approval elements
  const terminalApprovalPanel = document.getElementById('terminalApprovalPanel');
  const approvalPanelContent = document.getElementById('approvalPanelContent');
  
  let isLoading = false;
  let isToolCallsRunning = false; // New state specifically for tool calls
  let isInterruptPending = false; // Track if interrupt was requested
  let currentMode = 'Coder';
  let currentModel = 'llama3:8b';
  let isThinkingExpanded = true;
  let isToolCallsExpanded = false; // Tool calls collapsed by default
  let enableStreaming = true;
  let streamingMessages = new Map(); // Track streaming messages
  let pendingChanges = []; // Track pending file changes
  let isChangesPanelVisible = false;
  let pendingTerminalCommands = []; // Track pending terminal commands
  let currentPlanId = null; // Track current active plan
  
  // Initialize
  function init() {
    setupEventListeners();
    initializeButtonStates();
    requestConfiguration();
    requestAvailableModels();
    requestAvailableModes();
  }
  
  function initializeButtonStates() {
    // Initialize all button states
    updateSendButtonState();
    updateInterruptButtonVisibility();
    
    // Set initial correction button icon
    correctionButton.innerHTML = '<span class="icon-edit"></span>';
    correctionButton.title = 'Send Correction (not available - no active request)';
  }
  
  function setupEventListeners() {
    // Debug: Check if elements exist
    console.log('Setting up event listeners...');
    console.log('clearBtn exists:', !!clearBtn);
    console.log('settingsBtn exists:', !!settingsBtn);
    
    // Send message events
    sendButton.addEventListener('click', sendMessage);
    interruptButton.addEventListener('click', softInterruptLLM);
    softInterruptButton.addEventListener('click', softInterruptLLM);
    hardInterruptButton.addEventListener('click', hardInterruptLLM);
    correctionButton.addEventListener('click', requestCorrection);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Correction dialog events
    cancelCorrectionBtn.addEventListener('click', cancelCorrection);
    submitCorrectionBtn.addEventListener('click', submitCorrection);
    correctionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitCorrection();
      }
    });
    
    // Iteration dialog events
    stopIterationsBtn.addEventListener('click', stopIterations);
    continueIterationsBtn.addEventListener('click', continueIterations);
    
    // Clear confirmation dialog events
    cancelClearBtn.addEventListener('click', cancelClearDialog);
    confirmClearBtn.addEventListener('click', confirmClearDialog);
    
    // Ask user dialog events
    cancelAskUserBtn.addEventListener('click', cancelAskUser);
    answerAskUserBtn.addEventListener('click', answerAskUser);
    askUserInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        answerAskUser();
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
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openSettings' });
      });
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        console.log('Clear button clicked');
        
        // Add visual feedback
        clearBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          clearBtn.style.transform = '';
        }, 150);
        
        // Ctrl+Click skips confirmation
        if (e.ctrlKey || e.metaKey) {
          console.log('User used Ctrl+Click - skipping confirmation');
          performClearChat();
          return;
        }
        
        // Show custom confirmation dialog
        showClearConfirmationDialog();
      });
    } else {
      console.error('clearBtn element not found!');
    }
    
    // Copy all conversation button
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => {
        copyAllConversationAsMarkdown();
      });
    } else {
      console.error('copyAllBtn element not found!');
    }
    
    // Copy all conversation with options button
    if (copyAllWithThinkingBtn) {
      copyAllWithThinkingBtn.addEventListener('click', () => {
        // Show dialog to pick which sections to include
        showCopyOptionsDialog();
      });
    } else {
      console.error('copyAllWithThinkingBtn element not found!');
    }
    
    // Refresh models button
    if (refreshModelsBtn) {
      refreshModelsBtn.addEventListener('click', () => {
        console.log('Refresh models button clicked');
        
        // Add visual feedback
        refreshModelsBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          refreshModelsBtn.style.transform = '';
        }, 150);
        
        // Request available models
        requestAvailableModels();
      });
    } else {
      console.error('refreshModelsBtn element not found!');
    }
    
    // Plan visualization button
    if (planVisualizationBtn) {
      planVisualizationBtn.addEventListener('click', () => {
        console.log('Plan visualization button clicked');
        
        // Add visual feedback
        planVisualizationBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          planVisualizationBtn.style.transform = '';
        }, 150);
        
        // Request plan visualization
        vscode.postMessage({ 
          type: 'openPlanVisualization',
          planId: currentPlanId 
        });
      });
    } else {
      console.error('planVisualizationBtn element not found!');
    }
    
    // Change tracking events
    showChangesBtn.addEventListener('click', () => {
      showChangesPanel();
    });
    
    hideChangesBtn.addEventListener('click', () => {
      hideChangesPanel();
    });
    
    // Request pending changes on load
    requestPendingChanges();
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
    updateSendButtonState();
    messageInput.disabled = loading;
    
    // Update interrupt button visibility based on tool calls state
    updateInterruptButtonVisibility();
    
    // Update compact mode for changes button
    updateChangesButtonCompactMode();
  }
  
  function updateSendButtonState() {
    sendButton.disabled = isLoading;
    
    if (isLoading) {
      sendButton.innerHTML = '<span class="icon-loading"></span>';
      sendButton.title = 'Sending...';
    } else {
      sendButton.innerHTML = '<span class="icon-send"></span>';
      sendButton.title = 'Send Message';
    }
  }
  
  function updateChangesButtonCompactMode() {
    // Always use compact mode - just add the class
    showChangesBtn.classList.add('compact');
  }

  function updatePlanVisualizationButton() {
    if (planVisualizationBtn) {
      if (currentPlanId) {
        planVisualizationBtn.style.display = 'block';
        planVisualizationBtn.title = `Visualize plan: ${currentPlanId}`;
      } else {
        planVisualizationBtn.style.display = 'none';
      }
    }
  }

  function setToolCallsRunning(running) {
    isToolCallsRunning = running;
    
    // Reset interrupt pending state when tool calls end
    if (!running) {
      isInterruptPending = false;
    }
    
    updateInterruptButtonVisibility();
    
    // Update compact mode for changes button
    updateChangesButtonCompactMode();
  }

  function updateInterruptButtonVisibility() {
    // Update button states based on loading or tool calls running
    if (isLoading || isToolCallsRunning) {
      // Enable interrupt and correction buttons during loading or tool calls
      softInterruptButton.disabled = isInterruptPending;
      hardInterruptButton.disabled = isInterruptPending;
      correctionButton.disabled = false;
      
      // Update interrupt buttons appearance based on pending state
      if (isInterruptPending) {
        softInterruptButton.innerHTML = '<span class="icon-loading"></span>';
        softInterruptButton.title = 'Soft interrupt pending...';
        hardInterruptButton.innerHTML = '<span class="icon-loading"></span>';
        hardInterruptButton.title = 'Hard interrupt pending...';
      } else {
        softInterruptButton.innerHTML = '<span class="icon-pause"></span>';
        hardInterruptButton.innerHTML = '<span class="icon-stop"></span>';
        if (isLoading && !isToolCallsRunning) {
          softInterruptButton.title = 'Soft Interrupt (graceful stop)';
          hardInterruptButton.title = 'Hard Interrupt (immediate termination)';
        } else {
          softInterruptButton.title = 'Soft Interrupt';
          hardInterruptButton.title = 'Hard Interrupt';
        }
      }
      
      // Update correction button
      if (isLoading && !isToolCallsRunning) {
        correctionButton.title = 'Send Correction (ready to inject)';
      } else {
        correctionButton.title = 'Send Correction';
      }
    } else {
      // Disable buttons when no loading or tool calls are running
      softInterruptButton.disabled = true;
      hardInterruptButton.disabled = true;
      correctionButton.disabled = true;
      softInterruptButton.innerHTML = '<span class="icon-pause"></span>';
      hardInterruptButton.innerHTML = '<span class="icon-stop"></span>';
      softInterruptButton.title = 'Soft Interrupt (not available - no active request)';
      hardInterruptButton.title = 'Hard Interrupt (not available - no active request)';
      correctionButton.title = 'Send Correction (not available - no active request)';
    }
    
    // Always update send button state
    updateSendButtonState();
  }

  function softInterruptLLM() {
    // Don't allow multiple interrupt requests
    if (isInterruptPending) return;
    
    vscode.postMessage({
      type: 'interruptLLM'
    });
    
    // Set pending state and update button appearance
    isInterruptPending = true;
    updateInterruptButtonVisibility();
    
    // Don't show any immediate message - it will come from the backend when actually interrupted
  }

  function hardInterruptLLM() {
    // Don't allow multiple interrupt requests
    if (isInterruptPending) return;
    
    vscode.postMessage({
      type: 'hardInterruptLLM'
    });
    
    // Set pending state and update button appearance
    isInterruptPending = true;
    updateInterruptButtonVisibility();
    
    // Don't show any immediate message - it will come from the backend when actually interrupted
  }

  function requestCorrection() {
    // Show correction dialog
    correctionInput.value = '';
    correctionDialog.style.display = 'flex';
    correctionInput.focus();
    
    // Update compact mode for changes button
    updateChangesButtonCompactMode();
    
    // Send request to backend
    vscode.postMessage({
      type: 'requestCorrection'
    });
  }

  function submitCorrection() {
    const correctionText = correctionInput.value.trim();
    
    if (!correctionText) {
      correctionInput.focus();
      return;
    }
    
    // Send correction to backend
    vscode.postMessage({
      type: 'submitCorrection',
      correction: correctionText
    });
    
    // Hide dialog
    correctionDialog.style.display = 'none';
    
    // Update compact mode for changes button
    updateChangesButtonCompactMode();
  }

  function cancelCorrection() {
    // Send cancel to backend
    vscode.postMessage({
      type: 'cancelCorrection'
    });
    
    // Hide dialog
    correctionDialog.style.display = 'none';
    
    // Update compact mode for changes button
    updateChangesButtonCompactMode();
  }

  function showCorrectionAppliedNotice(correctionText) {
    // Create a system notice message
    const noticeMessage = {
      id: `correction-notice-${Date.now()}`,
      role: 'system',
      content: `🔄 **Correction Applied**: ${correctionText}`,
      timestamp: Date.now()
    };
    
    addMessage(noticeMessage);
  }

  function showIterationLimitDialog(iterationCount) {
    iterationCountDisplay.textContent = iterationCount;
    iterationDialog.style.display = 'flex';
  }

  function continueIterations() {
    iterationDialog.style.display = 'none';
    vscode.postMessage({
      type: 'continueIterations'
    });
  }

  function stopIterations() {
    iterationDialog.style.display = 'none';
    vscode.postMessage({
      type: 'stopIterations'
    });
  }
  
  function showClearConfirmationDialog() {
    clearConfirmationDialog.style.display = 'flex';
  }
  
  function cancelClearDialog() {
    console.log('User cancelled clear');
    clearConfirmationDialog.style.display = 'none';
  }
  
  function confirmClearDialog() {
    console.log('User confirmed clear');
    clearConfirmationDialog.style.display = 'none';
    performClearChat();
  }
  
  function performClearChat() {
    vscode.postMessage({ type: 'clearChat' });
    clearMessages();
  }
  
  // Ask User Dialog Functions
  function showAskUserDialog(requestId, question, context, urgency) {
    askUserQuestion.textContent = question;
    if (context) {
      askUserContext.textContent = context;
      askUserContext.style.display = 'block';
    } else {
      askUserContext.style.display = 'none';
    }
    
    askUserInput.value = '';
    askUserDialog.style.display = 'block';
    askUserDialog.setAttribute('data-request-id', requestId);
    
    // Set urgency class for styling (on the dialog element)
    askUserDialog.className = `ask-user-dialog urgency-${urgency}`;
    
    // Focus on input
    setTimeout(() => askUserInput.focus(), 100);
  }
  
  function cancelAskUser() {
    const requestId = askUserDialog.getAttribute('data-request-id');
    askUserDialog.style.display = 'none';
    
    // Show visual feedback like interrupt
    if (isLoading || isToolCallsRunning) {
      setLoading(false);
      setToolCallsRunning(false);
    }
    
    vscode.postMessage({
      type: 'askUserResponse',
      requestId: requestId,
      cancelled: true
    });
  }
  
  function answerAskUser() {
    const requestId = askUserDialog.getAttribute('data-request-id');
    const answer = askUserInput.value.trim();
    
    if (!answer) {
      askUserInput.focus();
      return;
    }
    
    askUserDialog.style.display = 'none';
    
    vscode.postMessage({
      type: 'askUserResponse',
      requestId: requestId,
      answer: answer,
      cancelled: false
    });
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
    
    // Store original markdown content for copy functionality
    messageDiv.setAttribute('data-original-content', message.content);
    
    // Message header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${message.role}`;
    avatarDiv.textContent = getAvatarText(message.role);
    
    const roleSpan = document.createElement('span');
    roleSpan.className = 'message-role';
    
    // Use displayRole if available, otherwise use default logic
    if (message.displayRole) {
      roleSpan.textContent = message.displayRole;
    } else if (message.role === 'assistant') {
      // Dynamic assistant label with model name and mode from message
      const modelName = message.model || currentModel || 'Unknown';
      const modeName = message.mode || currentMode || 'Unknown';
      roleSpan.textContent = `LLM ${modelName} - ${modeName}`;
    } else {
      roleSpan.textContent = message.role;
    }
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    timestampSpan.textContent = formatTimestamp(message.timestamp);
    
    // Message actions (copy buttons)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    
    // Copy message button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-action-btn copy-message';
    copyBtn.innerHTML = '📋';
    copyBtn.title = 'Copy message as markdown';
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      copyMessageAsMarkdown(message.id);
    };
    
    actionsDiv.appendChild(copyBtn);
    
    headerDiv.appendChild(avatarDiv);
    headerDiv.appendChild(roleSpan);
    headerDiv.appendChild(timestampSpan);
    headerDiv.appendChild(actionsDiv);
    
    // Message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // For user messages, just escape HTML and preserve line breaks
    // For assistant messages, apply full markdown processing
    if (message.role === 'user') {
      const escapedContent = escapeHtml(message.content);
      contentDiv.innerHTML = escapedContent.replace(/\n/g, '<br>');
    } else {
      contentDiv.innerHTML = formatMessageContent(message.content);
    }
    
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
    
    // Create a separate collapsible section for each tool call
    toolCalls.forEach((toolCall, index) => {
      const toolContainer = document.createElement('div');
      toolContainer.className = 'tool-call-section';
      
      // Create header with toggle functionality for this specific tool
      const header = document.createElement('div');
      header.className = 'tool-calls-header';
      
      const headerLeft = document.createElement('div');
      headerLeft.className = 'tool-calls-header-left';
      headerLeft.innerHTML = `<span class="codicon codicon-tools"></span> ${toolCall.function.name}`;
      
      const toggle = document.createElement('button');
      toggle.className = 'tool-calls-toggle';
      toggle.textContent = '+'; // Collapsed by default
      
      header.appendChild(headerLeft);
      header.appendChild(toggle);
      
      // Create content container for this tool
      const content = document.createElement('div');
      content.className = 'tool-calls-content collapsed'; // Start collapsed
      
      const argsDiv = document.createElement('div');
      argsDiv.className = 'tool-call-args';
      argsDiv.textContent = toolCall.function.arguments;
      
      content.appendChild(argsDiv);
      
      // Toggle functionality for this specific tool
      const toggleTool = () => {
        const isCollapsed = content.classList.contains('collapsed');
        content.classList.toggle('collapsed');
        toggle.textContent = isCollapsed ? '−' : '+';
      };
      
      header.addEventListener('click', toggleTool);
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTool();
      });
      
      toolContainer.appendChild(header);
      toolContainer.appendChild(content);
      container.appendChild(toolContainer);
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
      case 'notice': return 'ℹ️';
      default: return '?';
    }
  }
  
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
  
  function formatMessageContent(content) {
    // Store original markdown content for copy functionality
    const originalMarkdown = content;
    
    // FIRST: Escape any existing HTML tags in the content to make it safe
    // This prevents HTML injection and ensures existing HTML shows as text
    content = escapeHtml(content);
    
    // NOW: Convert markdown syntax to HTML (on the escaped content)
    
    // Convert markdown tables to HTML
    content = content.replace(/\|(.+)\|(?:\r?\n|\r)\|[-:\|]+\|(?:\r?\n|\r)((?:\|.+\|\r?\n?)*)/g, (match, header, rows) => {
      const headerCells = header.split('|').map(cell => cell.trim()).filter(cell => cell);
      const rowData = rows.trim().split('\n').map(row => 
        row.split('|').map(cell => cell.trim()).filter(cell => cell)
      );
      
      let tableHtml = '<table class="markdown-table"><thead><tr>';
      headerCells.forEach(cell => {
        tableHtml += `<th>${cell}</th>`;  // Already escaped
      });
      tableHtml += '</tr></thead><tbody>';
      
      rowData.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<td>${cell}</td>`;  // Already escaped
        });
        tableHtml += '</tr>';
      });
      
      tableHtml += '</tbody></table>';
      return tableHtml;
    });
    
    // Convert markdown-style code blocks to HTML
    content = content.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;  // Already escaped
    });
    
    // Convert inline code
    content = content.replace(/`([^`]+)`/g, (match, code) => `<code class="inline-code">${code}</code>`);  // Already escaped
    
    // Convert bold text **text** and __text__
    content = content.replace(/\*\*(.*?)\*\*/g, (match, text) => `<strong>${text}</strong>`);  // Already escaped
    content = content.replace(/__(.*?)__/g, (match, text) => `<strong>${text}</strong>`);  // Already escaped
    
    // Convert italic text *text* and _text_
    content = content.replace(/(?<!\*)\*([^\*\n]+)\*(?!\*)/g, (match, text) => `<em>${text}</em>`);  // Already escaped
    content = content.replace(/(?<!_)_([^_\n]+)_(?!_)/g, (match, text) => `<em>${text}</em>`);  // Already escaped
    
    // Convert strikethrough ~~text~~
    content = content.replace(/~~(.*?)~~/g, (match, text) => `<del>${text}</del>`);  // Already escaped
    
    // Convert headers
    content = content.replace(/^### (.*$)/gm, (match, text) => `<h3>${text}</h3>`);  // Already escaped
    content = content.replace(/^## (.*$)/gm, (match, text) => `<h2>${text}</h2>`);  // Already escaped
    content = content.replace(/^# (.*$)/gm, (match, text) => `<h1>${text}</h1>`);  // Already escaped
    
    // Convert unordered lists
    content = content.replace(/^\* (.+)$/gm, (match, text) => `<li>${text}</li>`);  // Already escaped
    content = content.replace(/^- (.+)$/gm, (match, text) => `<li>${text}</li>`);  // Already escaped
    content = content.replace(/^(\+ .+)$/gm, (match, text) => `<li>${text}</li>`);  // Already escaped
    
    // Wrap consecutive list items in <ul>
    content = content.replace(/(<li>.*<\/li>(?:\s*<li>.*<\/li>)*)/g, '<ul>$1</ul>');
    
    // Convert ordered lists
    content = content.replace(/^\d+\. (.+)$/gm, (match, text) => `<li class="ordered">${text}</li>`);  // Already escaped
    content = content.replace(/(<li class="ordered">.*<\/li>(?:\s*<li class="ordered">.*<\/li>)*)/g, '<ol>$1</ol>');
    content = content.replace(/class="ordered"/g, ''); // Remove the temporary class
    
    // Convert links [text](url) - URLs need to be decoded back for href, but text stays escaped
    content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // Decode the URL for href attribute but keep the text escaped
      const decodedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return `<a href="${decodedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });
    
    // Convert blockquotes
    content = content.replace(/^> (.+)$/gm, (match, text) => `<blockquote>${text}</blockquote>`);  // Already escaped
    
    // Convert horizontal rules
    content = content.replace(/^---$/gm, '<hr>');
    content = content.replace(/^___$/gm, '<hr>');
    
    // Convert line breaks (but preserve existing HTML)
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
    
    // Remove any existing welcome messages first
    const existingWelcome = messagesContainer.querySelectorAll('.welcome-message');
    existingWelcome.forEach(welcome => welcome.remove());
    
    // Show welcome message again
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
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
    console.log('[Chat] Updating configuration:', config);
    currentMode = config.mode;
    currentModel = config.model;
    enableStreaming = config.enableStreaming !== undefined ? config.enableStreaming : true;
    
    // Update mode select - check if option exists first
    const modeOptions = Array.from(modeSelect.options).map(opt => opt.value);
    if (modeOptions.includes(currentMode)) {
      modeSelect.value = currentMode;
      console.log('[Chat] Mode updated to:', currentMode);
    } else {
      console.warn('[Chat] Mode not found in options:', currentMode, 'Available:', modeOptions);
    }
    
    // Update model select - check if option exists first
    const modelOptions = Array.from(modelSelect.options).map(opt => opt.value);
    if (modelOptions.includes(currentModel)) {
      modelSelect.value = currentModel;
      console.log('[Chat] Model updated to:', currentModel);
    } else {
      console.warn('[Chat] Model not found in options:', currentModel, 'Available:', modelOptions);
    }
  }

  function createStreamingMessage(messageId, model, mode) {
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
    // Use provided model/mode or fall back to current values
    const displayModel = model || currentModel || 'Unknown';
    const displayMode = mode || currentMode || 'Unknown';
    roleSpan.textContent = `LLM ${displayModel} - ${displayMode}`;
    
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
    console.log(`[CodingAgent Frontend] updateStreamingThinking called:`, messageId, deltaThinking);
    
    const streamingData = streamingMessages.get(messageId);
    if (!streamingData) {
      console.log(`[CodingAgent Frontend] No streaming data found for messageId:`, messageId);
      return;
    }
    
    // Append delta to accumulated thinking
    streamingData.accumulatedThinking += deltaThinking;
    streamingData.thinkingContent.textContent = streamingData.accumulatedThinking;
    
    console.log(`[CodingAgent Frontend] Updated thinking content:`, streamingData.accumulatedThinking);
    
    // Show thinking section if we have content
    if (streamingData.accumulatedThinking && streamingData.accumulatedThinking.trim()) {
      streamingData.thinkingDiv.style.display = 'block';
      console.log(`[CodingAgent Frontend] Thinking section shown`);
    }
    
    // Auto-scroll thinking content to the bottom during streaming
    if (streamingData.thinkingContent && streamingData.thinkingContent.scrollHeight > streamingData.thinkingContent.clientHeight) {
      streamingData.thinkingContent.scrollTop = streamingData.thinkingContent.scrollHeight;
      
      // Alternative smooth scrolling (optional, might be too slow for fast streaming)
      // streamingData.thinkingContent.scrollTo({
      //   top: streamingData.thinkingContent.scrollHeight,
      //   behavior: 'smooth'
      // });
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
    
    // Store original markdown content for copy functionality
    streamingData.element.setAttribute('data-original-content', streamingData.accumulatedContent);
    
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
    
    // Convert streaming tool calls to final structure with collapsible header and auto-collapse
    if (streamingData.accumulatedToolCalls && streamingData.accumulatedToolCalls.length > 0 && streamingData.toolCallsDiv.style.display !== 'none') {
      // Replace the simple streaming tool calls with the structured version
      const finalToolCallsElement = createToolCallsElement(streamingData.accumulatedToolCalls);
      streamingData.toolCallsDiv.parentNode.replaceChild(finalToolCallsElement, streamingData.toolCallsDiv);
      
      // Auto-collapse tool calls after a delay
      setTimeout(() => {
        // Auto-collapse all tool call sections
        const toolCallSections = finalToolCallsElement.querySelectorAll('.tool-call-section');
        toolCallSections.forEach(section => {
          const content = section.querySelector('.tool-calls-content');
          const toggle = section.querySelector('.tool-calls-toggle');
          
          if (content && toggle) {
            content.classList.add('collapsed');
            toggle.textContent = '+';
          }
        });
      }, 1500); // Slightly longer delay than thinking to avoid simultaneous animations
    }
    
    // Add copy button to message header if it doesn't already exist
    const headerDiv = streamingData.element.querySelector('.message-header');
    if (headerDiv && !headerDiv.querySelector('.message-actions')) {
      // Create message actions container
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      
      // Copy message button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'message-action-btn copy-message';
      copyBtn.innerHTML = '📋';
      copyBtn.title = 'Copy message as markdown';
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        copyMessageAsMarkdown(messageId);
      };
      
      actionsDiv.appendChild(copyBtn);
      headerDiv.appendChild(actionsDiv);
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

      case 'toolCallsStart':
        setToolCallsRunning(true);
        break;

      case 'toolCallsEnd':
        setToolCallsRunning(false);
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
        
      case 'updateCurrentPlan':
        currentPlanId = message.planId;
        updatePlanVisualizationButton();
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
        
      case 'askUserRequest':
        showAskUserDialog(message.requestId, message.question, message.context, message.urgency);
        break;

      // Change tracking handlers
      case 'changeTracking':
        handleChangeTrackingUpdate(message.changeIds);
        break;
        
      case 'pendingChanges':
        updatePendingChanges(message.changes);
        break;
        
      case 'changeAccepted':
        handleChangeStatusUpdate(message.changeId, 'accepted');
        break;
        
      case 'changeRejected':
        handleChangeStatusUpdate(message.changeId, 'rejected');
        break;
        
      case 'changeDiff':
        showChangeDiff(message.changeId, message.htmlDiff);
        break;

      // Streaming message handlers
      case 'streamingStart':
        createStreamingMessage(message.messageId, message.model, message.mode);
        break;

      case 'streamingContent':
        updateStreamingContent(message.messageId, message.content);
        break;

      case 'streamingThinking':
        console.log(`[CodingAgent Frontend] Received streamingThinking message:`, message);
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

      case 'toolCallsStart':
        setToolCallsRunning(true);
        break;

      case 'toolCallsEnd':
        setToolCallsRunning(false);
        break;

      case 'correctionRequest':
        // Show correction dialog if it's not already visible
        if (correctionDialog.style.display === 'none') {
          requestCorrection();
        }
        break;

      case 'correctionApplied':
        // Show notice that correction has been applied
        showCorrectionAppliedNotice(message.correctionText);
        break;

      case 'iterationLimitReached':
        // Show iteration limit dialog
        showIterationLimitDialog(message.iterationCount);
        break;

      // Terminal approval handlers
      case 'terminalApprovalRequest':
        showTerminalApprovalRequest(message.commandId, message.command, message.cwd);
        break;
        
      case 'terminalCommandApproved':
        hideTerminalApprovalPanel();
        break;
        
      case 'terminalCommandRejected':
        hideTerminalApprovalPanel();
        break;
        
      case 'pendingTerminalCommands':
        updatePendingTerminalCommands(message.commands);
        break;
    }
  });
  
  // Change tracking functions
  function requestPendingChanges() {
    vscode.postMessage({ type: 'getPendingChanges' });
  }
  
  function showChangesPanel() {
    changeTrackingPanel.style.display = 'block';
    showChangesBtn.style.display = 'none';
    isChangesPanelVisible = true;
  }
  
  function hideChangesPanel() {
    changeTrackingPanel.style.display = 'none';
    if (pendingChanges.length > 0) {
      showChangesBtn.style.display = 'block';
    }
    isChangesPanelVisible = false;
  }
  
  function updatePendingChanges(changes) {
    pendingChanges = changes || [];
    updateChangeCount();
    renderPendingChanges();
    
    // Show/hide the changes button
    if (pendingChanges.length > 0 && !isChangesPanelVisible) {
      showChangesBtn.style.display = 'block';
    } else if (pendingChanges.length === 0) {
      showChangesBtn.style.display = 'none';
      hideChangesPanel();
    }
    
    // Update compact mode
    updateChangesButtonCompactMode();
  }
  
  function updateChangeCount() {
    const totalChanges = pendingChanges.reduce((sum, fileChange) => sum + fileChange.changeCount, 0);
    
    // Always show only the number (compact mode)
    changeCount.textContent = totalChanges.toString();
    showChangesBtn.title = `${pendingChanges.length} file(s), ${totalChanges} change(s) pending - click for details`;
  }
  
  function renderPendingChanges() {
    if (pendingChanges.length === 0) {
      changePanelContent.innerHTML = '<div class="no-changes">No pending changes</div>';
      return;
    }
    
    // Header with global actions
    const globalActionsHtml = `
      <div class="global-actions">
        <button class="change-btn accept-all" onclick="acceptAllChanges()">✓ Accept All</button>
        <button class="change-btn reject-all" onclick="rejectAllChanges()">✗ Reject All</button>
      </div>
    `;
    
    // File-based changes
    const changesHtml = pendingChanges.map(fileChange => `
      <div class="file-change-item" data-file-path="${fileChange.filePath}">
        <div class="file-change-header">
          <div class="file-info">
            <div class="file-path">${getRelativePath(fileChange.filePath)}</div>
            <div class="change-count">${fileChange.changeCount} change(s)</div>
          </div>
          <div class="file-actions">
            <button class="change-btn accept" onclick="acceptFileChanges('${fileChange.filePath}')">✓ Accept File</button>
            <button class="change-btn reject" onclick="rejectFileChanges('${fileChange.filePath}')">✗ Reject File</button>
          </div>
        </div>
        <div class="file-change-details">
          <span class="change-tools">by ${fileChange.toolNames}</span>
          <span class="change-timestamp">${formatTimestamp(fileChange.timestamp)}</span>
        </div>
      </div>
    `).join('');
    
    changePanelContent.innerHTML = globalActionsHtml + changesHtml;
  }
  
  function handleChangeTrackingUpdate(changeIds) {
    if (changeIds && changeIds.length > 0) {
      // Refresh pending changes when new changes are created
      requestPendingChanges();
    }
  }
  
  function handleChangeStatusUpdate(changeId, status) {
    // Remove the change from pending list
    pendingChanges = pendingChanges.filter(change => change.id !== changeId);
    updatePendingChanges(pendingChanges);
  }
  
  function requestChangeDiff(changeId) {
    vscode.postMessage({ 
      type: 'getChangeDiff', 
      changeId: changeId 
    });
  }
  
  function acceptChange(changeId) {
    vscode.postMessage({ 
      type: 'acceptChange', 
      changeId: changeId 
    });
  }
  
  function rejectChange(changeId) {
    if (confirm('Are you sure you want to reject this change? This will restore the file to its previous state.')) {
      vscode.postMessage({ 
        type: 'rejectChange', 
        changeId: changeId 
      });
    }
  }

  function acceptFileChanges(filePath) {
    console.log('acceptFileChanges called with:', filePath);
    console.log('Sending message to backend');
    vscode.postMessage({ 
      type: 'acceptFileChanges', 
      filePath: filePath 
    });
  }

  function rejectFileChanges(filePath) {
    console.log('rejectFileChanges called with:', filePath);
    console.log('Sending message to backend');
    vscode.postMessage({ 
      type: 'rejectFileChanges', 
      filePath: filePath 
    });
  }

  function acceptAllChanges() {
    console.log('acceptAllChanges called');
    console.log('Sending message to backend');
    vscode.postMessage({ 
      type: 'acceptAllChanges'
    });
  }

  function rejectAllChanges() {
    console.log('rejectAllChanges called');
    console.log('Sending message to backend');
    vscode.postMessage({ 
      type: 'rejectAllChanges'
    });
  }
  
  function showChangeDiff(changeId, htmlDiff) {
    const changeItem = document.querySelector(`[data-change-id="${changeId}"]`);
    if (changeItem && htmlDiff) {
      let diffContainer = changeItem.querySelector('.change-diff');
      if (!diffContainer) {
        diffContainer = document.createElement('div');
        diffContainer.className = 'change-diff';
        changeItem.appendChild(diffContainer);
      }
      diffContainer.innerHTML = htmlDiff;
    }
  }
  
  function getRelativePath(fullPath) {
    // Extract just the filename and immediate parent folder for display
    const parts = fullPath.split(/[/\\]/);
    if (parts.length > 2) {
      return '...' + '/' + parts.slice(-2).join('/');
    }
    return parts.join('/');
  }
  
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
  
  // Terminal approval functions
  function showTerminalApprovalRequest(commandId, command, cwd) {
    console.log(`[Frontend] Terminal approval request: ${commandId} - ${command}`);
    console.log(`[Frontend] Working directory: ${cwd}`);
    
    // Update pending commands list
    const existingIndex = pendingTerminalCommands.findIndex(cmd => cmd.id === commandId);
    if (existingIndex === -1) {
      pendingTerminalCommands.push({ id: commandId, command: command, cwd: cwd });
    }
    
    // Render terminal approval panel
    renderTerminalApprovalPanel();
    
    // Show the panel
    terminalApprovalPanel.style.display = 'block';
    
    console.log(`[Frontend] Terminal approval panel shown for command: ${commandId}`);
  }
  
  function hideTerminalApprovalPanel() {
    console.log(`[Frontend] Hiding terminal approval panel`);
    terminalApprovalPanel.style.display = 'none';
    
    // Clear pending commands since they're resolved
    pendingTerminalCommands = [];
  }
  
  function renderTerminalApprovalPanel() {
    if (pendingTerminalCommands.length === 0) {
      approvalPanelContent.innerHTML = '<div class="no-commands">No pending commands</div>';
      return;
    }
    
    const commandsHtml = pendingTerminalCommands.map(cmd => `
      <div class="terminal-command-item" data-command-id="${cmd.id}">
        <div class="command-header">
          <div class="command-title">Terminal Command Request</div>
        </div>
        
        <div class="approval-warning">
          ⚠️ AI wants to execute a terminal command. Review and approve or reject.
        </div>
        
        <div class="command-info">
          <div class="command-text">${escapeHtml(cmd.command)}</div>
          <div class="command-cwd">Working directory: ${escapeHtml(cmd.cwd)} (workspace root)</div>
        </div>
        
        <div class="command-actions">
          <button class="approve-btn" onclick="approveTerminalCommand('${cmd.id}')" title="Approve & Execute">
            ✓
          </button>
          <button class="reject-btn" onclick="rejectTerminalCommand('${cmd.id}')" title="Reject">
            ✗
          </button>
        </div>
      </div>
    `).join('');
    
    approvalPanelContent.innerHTML = commandsHtml;
  }
  
  function approveTerminalCommand(commandId) {
    console.log(`[Frontend] Approving terminal command: ${commandId}`);
    vscode.postMessage({
      type: 'approveTerminalCommand',
      commandId: commandId
    });
  }
  
  function rejectTerminalCommand(commandId) {
    console.log(`[Frontend] Rejecting terminal command: ${commandId}`);
    vscode.postMessage({
      type: 'rejectTerminalCommand',
      commandId: commandId
    });
  }
  
  function updatePendingTerminalCommands(commands) {
    console.log(`[Frontend] Updating pending terminal commands:`, commands);
    pendingTerminalCommands = commands || [];
    
    if (pendingTerminalCommands.length > 0) {
      renderTerminalApprovalPanel();
      terminalApprovalPanel.style.display = 'block';
    } else {
      hideTerminalApprovalPanel();
    }
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function generateId() {
    return Math.random().toString(36).substring(2, 15);
  }
  
  // Copy functionality
  function copyMessageAsMarkdown(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const originalContent = messageElement.getAttribute('data-original-content');
    if (originalContent) {
      copyToClipboard(originalContent);
      showCopyNotification('Message copied as markdown!');
    }
  }
  
  function copyAllConversationAsMarkdown() {
    const messages = document.querySelectorAll('.message:not(.system)');
    const conversationMarkdown = [];
    
    messages.forEach(messageEl => {
      const role = messageEl.classList.contains('user') ? 'User' : 'Assistant';
      const timestamp = messageEl.querySelector('.message-timestamp').textContent;
      const originalContent = messageEl.getAttribute('data-original-content');
      
      if (originalContent) {
        conversationMarkdown.push(`## ${role} (${timestamp})\n\n${originalContent}\n`);
      }
    });
    
    const fullMarkdown = `# CodingAgent Conversation\n\n${conversationMarkdown.join('\n---\n\n')}`;
    copyToClipboard(fullMarkdown);
    showCopyNotification('Full conversation copied as markdown!');
  }
  
  function copyAllConversationWithThinkingAsMarkdown() {
    const messages = document.querySelectorAll('.message:not(.system)');
    const conversationMarkdown = [];
    
    messages.forEach(messageEl => {
      const role = messageEl.classList.contains('user') ? 'User' : 'Assistant';
      const timestamp = messageEl.querySelector('.message-timestamp').textContent;
      const originalContent = messageEl.getAttribute('data-original-content');
      
      let messageMarkdown = `## ${role} (${timestamp})\n\n`;
      
      // Add thinking content if it exists (for Assistant messages)
      if (role === 'Assistant') {
        const thinkingContainer = messageEl.querySelector('.thinking-container');
        if (thinkingContainer) {
          const thinkingContent = thinkingContainer.querySelector('.thinking-content');
          if (thinkingContent && thinkingContent.textContent.trim()) {
            messageMarkdown += `### 🧠 Model Thinking\n\n\`\`\`\n${thinkingContent.textContent.trim()}\n\`\`\`\n\n`;
          }
        }
      }
      
      // Add main message content
      if (originalContent) {
        messageMarkdown += `${originalContent}\n`;
      }
      
      conversationMarkdown.push(messageMarkdown);
    });
    
    const fullMarkdown = `# CodingAgent Conversation (with Thinking)\n\n${conversationMarkdown.join('\n---\n\n')}`;
    copyToClipboard(fullMarkdown);
    showCopyNotification('Full conversation with thinking copied as markdown!');
  }

  // New: interactive copy dialog to choose which parts to include
  function showCopyOptionsDialog() {
    // If dialog already exists, just show it
    let existing = document.getElementById('copyOptionsDialog');
    if (existing) {
      existing.style.display = 'flex';
      return;
    }

    const dialog = document.createElement('div');
    dialog.id = 'copyOptionsDialog';
    dialog.style.position = 'fixed';
    dialog.style.left = '0';
    dialog.style.top = '0';
    dialog.style.width = '100%';
    dialog.style.height = '100%';
    dialog.style.display = 'flex';
    dialog.style.alignItems = 'center';
    dialog.style.justifyContent = 'center';
    dialog.style.background = 'rgba(0,0,0,0.4)';
    dialog.style.zIndex = 9999;

    const box = document.createElement('div');
    box.style.background = '#1e1e1e';
    box.style.color = '#ddd';
    box.style.padding = '18px';
    box.style.borderRadius = '8px';
    box.style.width = '420px';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';

    const title = document.createElement('div');
    title.textContent = 'Copy conversation - select parts to include';
    title.style.fontWeight = '600';
    title.style.marginBottom = '12px';
    box.appendChild(title);

    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '8px';

    const items = [
      { id: 'copyPrompts', label: 'Prompts', default: true },
      { id: 'copyAnswers', label: 'Answers', default: true },
      { id: 'copyThinking', label: 'Thinking', default: true },
      { id: 'copyToolCalls', label: 'Tool calls', default: true }
    ];

    items.forEach(it => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '10px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = it.id;
      cb.checked = !!it.default;
      cb.style.width = '16px';
      cb.style.height = '16px';

      const lbl = document.createElement('span');
      lbl.textContent = it.label;

      row.appendChild(cb);
      row.appendChild(lbl);
      form.appendChild(row);
    });

    box.appendChild(form);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';
    actions.style.marginTop = '14px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '6px 10px';
    cancelBtn.onclick = () => { dialog.style.display = 'none'; };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Copy';
    confirmBtn.style.padding = '6px 12px';
    confirmBtn.style.background = '#0e639c';
    confirmBtn.style.border = 'none';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.borderRadius = '4px';
    confirmBtn.onclick = () => {
      const includePrompts = document.getElementById('copyPrompts').checked;
      const includeAnswers = document.getElementById('copyAnswers').checked;
      const includeThinking = document.getElementById('copyThinking').checked;
      const includeToolCalls = document.getElementById('copyToolCalls').checked;

      // Build markdown based on selection
      const messages = document.querySelectorAll('.message:not(.system)');
      const conversationMarkdown = [];

      messages.forEach(messageEl => {
        const isUser = messageEl.classList.contains('user');
        const isAssistant = messageEl.classList.contains('assistant');
        const role = isUser ? 'User' : (isAssistant ? 'Assistant' : 'Other');
        const timestamp = (messageEl.querySelector('.message-timestamp') || {}).textContent || '';
        const originalContent = messageEl.getAttribute('data-original-content') || '';

        let sectionParts = [];

        if (isUser && includePrompts) {
          sectionParts.push(originalContent);
        }

        if (isAssistant && includeThinking) {
          const thinkingContainer = messageEl.querySelector('.thinking-container');
          if (thinkingContainer) {
            const thinkingContent = thinkingContainer.querySelector('.thinking-content');
            if (thinkingContent && thinkingContent.textContent.trim()) {
              sectionParts.push('```\n' + thinkingContent.textContent.trim() + '\n```');
            }
          }
        }

        if (isAssistant && includeAnswers) {
          sectionParts.push(originalContent);
        }

        if (isAssistant && includeToolCalls) {
          const toolEntries = [];

          // Collect tool sections created by createToolCallsElement (final, non-streaming)
          const toolSections = messageEl.querySelectorAll('.tool-call-section');
          toolSections.forEach(section => {
            const nameEl = section.querySelector('.tool-calls-header-left');
            const argsEl = section.querySelector('.tool-call-args');
            const name = nameEl ? nameEl.textContent.trim().replace(/^\s*\u25A1?\s*/, '') : '';
            const args = argsEl ? argsEl.textContent.trim() : '';
            if (name || args) toolEntries.push({ name: name || 'tool', args });
          });

          // Collect streaming tool calls (created during streaming)
          const streamingToolCalls = messageEl.querySelectorAll('.tool-call');
          streamingToolCalls.forEach(tc => {
            const nameEl = tc.querySelector('.tool-call-name');
            const argsEl = tc.querySelector('.tool-call-args');
            const name = nameEl ? nameEl.textContent.trim().replace(/^\s*\u25A1?\s*/, '') : '';
            const args = argsEl ? argsEl.textContent.trim() : '';
            if (name || args) toolEntries.push({ name: name || 'tool', args });
          });

          if (toolEntries.length > 0) {
            const formatted = toolEntries.map(te => {
              const header = te.name ? `**Tool: ${te.name}**\n\n` : '';
              const argsBlock = te.args ? '```\n' + te.args + '\n```' : '```\n(no args)\n```';
              return header + argsBlock;
            }).join('\n\n');

            sectionParts.push('**Tool calls:**\n\n' + formatted);
          }
        }

        if (sectionParts.length > 0) {
          const header = `## ${role} (${timestamp})\n\n`;
          conversationMarkdown.push(header + sectionParts.join('\n\n'));
        }
      });

      const fullMarkdown = `# CodingAgent Conversation (custom export)\n\n${conversationMarkdown.join('\n---\n\n')}`;
      copyToClipboard(fullMarkdown);
      showCopyNotification('Conversation copied as markdown');
      dialog.style.display = 'none';
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    box.appendChild(actions);
    dialog.appendChild(box);
    document.body.appendChild(dialog);
  }
  
  function copyToClipboard(text) {
    // Use the VS Code API if available, otherwise fall back to navigator.clipboard
    if (typeof vscode !== 'undefined') {
      vscode.postMessage({
        type: 'copyToClipboard',
        text: text
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        fallbackCopyToClipboard(text);
      });
    } else {
      fallbackCopyToClipboard(text);
    }
  }
  
  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
  }
  
  function showCopyNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });
    
    // Remove after 2 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }
  
  // Make functions global for onclick handlers
  window.requestChangeDiff = requestChangeDiff;
  window.acceptChange = acceptChange;
  window.rejectChange = rejectChange;
  window.acceptFileChanges = acceptFileChanges;
  window.rejectFileChanges = rejectFileChanges;
  window.acceptAllChanges = acceptAllChanges;
  window.rejectAllChanges = rejectAllChanges;
  window.approveTerminalCommand = approveTerminalCommand;
  window.rejectTerminalCommand = rejectTerminalCommand;
  window.copyMessageAsMarkdown = copyMessageAsMarkdown;
  window.copyAllConversationAsMarkdown = copyAllConversationAsMarkdown;
  window.copyAllConversationWithThinkingAsMarkdown = copyAllConversationWithThinkingAsMarkdown;
  
  // Debug: confirm functions are available
  console.log('Global functions assigned:', {
    acceptFileChanges: typeof window.acceptFileChanges,
    rejectFileChanges: typeof window.rejectFileChanges,
    acceptAllChanges: typeof window.acceptAllChanges,
    rejectAllChanges: typeof window.rejectAllChanges
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
