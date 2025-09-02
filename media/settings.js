// Settings Panel JavaScript

(function() {
  const vscode = acquireVsCodeApi();
  
  let currentConfig = {};
  let isEditing = false;
  let editingModeName = null;
  let availableTools = []; // Will be populated from backend

  // DOM Elements
  const elements = {
    host: document.getElementById('host'),
    port: document.getElementById('port'),
    apiKey: document.getElementById('apiKey'),
    currentMode: document.getElementById('currentMode'),
    currentModel: document.getElementById('currentModel'),
    showThinking: document.getElementById('showThinking'),
    enableStreaming: document.getElementById('enableStreaming'),
    iterationThreshold: document.getElementById('iterationThreshold'),
    uncertaintyThreshold: document.getElementById('uncertaintyThreshold'),
    enableProjectMemory: document.getElementById('enableProjectMemory'),
    loggingEnabled: document.getElementById('loggingEnabled'),
    logFilePath: document.getElementById('logFilePath'),
    logVerbosity: document.getElementById('logVerbosity'),
    logMode: document.getElementById('logMode'),
    logModeFilePath: document.getElementById('logModeFilePath'),
    readFileMaxLines: document.getElementById('readFileMaxLines'),
    autoApproveCommands: document.getElementById('autoApproveCommands'),
    memoryMaxLines: document.getElementById('memoryMaxLines'),
    memoryMaxChars: document.getElementById('memoryMaxChars'),
    memoryAutoSafetyLimit: document.getElementById('memoryAutoSafetyLimit'),
    memoryLargeValueThreshold: document.getElementById('memoryLargeValueThreshold'),
    
    // Plan prompt elements
    planReworkPrompt: document.getElementById('planReworkPrompt'),
    planReviewPrompt: document.getElementById('planReviewPrompt'),
    pointsReworkPrompt: document.getElementById('pointsReworkPrompt'),
    pointsReviewPrompt: document.getElementById('pointsReviewPrompt'),
    pointsTestingPrompt: document.getElementById('pointsTestingPrompt'),
    pointsImplementationPrompt: document.getElementById('pointsImplementationPrompt'),
    planAcceptancePrompt: document.getElementById('planAcceptancePrompt'),
    
    toolsGrid: document.getElementById('tools-grid'),
    modesList: document.getElementById('modesList'),
    resetBtn: document.getElementById('resetBtn'),
    saveBtn: document.getElementById('saveBtn'),
    newModeBtn: document.getElementById('newModeBtn'),
    selectLogFileBtn: document.getElementById('selectLogFileBtn'),
    selectLogModeFileBtn: document.getElementById('selectLogModeFileBtn'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    saveStatus: document.getElementById('saveStatus'),
    
    // Profile elements
    newProfileName: document.getElementById('newProfileName'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    profilesList: document.getElementById('profilesList'),
    noProfiles: document.getElementById('noProfiles'),
    
    // Tab elements
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Modal elements
    modeEditorModal: document.getElementById('modeEditorModal'),
    modeEditorTitle: document.getElementById('modeEditorTitle'),
    closeModeEditor: document.getElementById('closeModeEditor'),
    modeEditorForm: document.getElementById('modeEditorForm'),
    modeName: document.getElementById('modeName'),
    modeDescription: document.getElementById('modeDescription'),
    modeLlmDescription: document.getElementById('modeLlmDescription'),
    modeSystemMessage: document.getElementById('modeSystemMessage'),
    modeOrchestrationMessage: document.getElementById('modeOrchestrationMessage'),
    modeFallbackMessage: document.getElementById('modeFallbackMessage'),
    modeTemperature: document.getElementById('modeTemperature'),
    modeTopP: document.getElementById('modeTopP'),
    modePresencePenalty: document.getElementById('modePresencePenalty'),
    modeFrequencyPenalty: document.getElementById('modeFrequencyPenalty'),
    modeAutoEvaluation: document.getElementById('modeAutoEvaluation'),
    modeToolsContainer: document.getElementById('modeToolsContainer'),
    saveModeBtn: document.getElementById('saveModeBtn'),
    cancelModeBtn: document.getElementById('cancelModeBtn')
  };

  // Initialize
  function init() {
    setupEventListeners();
    requestConfiguration();
  }

  function setupEventListeners() {
    // Tab switching
    elements.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        switchTab(tabName);
      });
    });
    
    // Main buttons
    elements.resetBtn.addEventListener('click', resetToDefaults);
    elements.saveBtn.addEventListener('click', saveConfiguration);
    elements.newModeBtn.addEventListener('click', () => openModeEditor());
    elements.selectLogFileBtn.addEventListener('click', selectLogFile);
    elements.selectLogModeFileBtn.addEventListener('click', selectLogModeFile);
    elements.testConnectionBtn?.addEventListener('click', testConnection);
    
    // Profile controls
    elements.saveProfileBtn?.addEventListener('click', saveProfile);
    elements.newProfileName?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveProfile();
      }
    });
    
    // Modal controls
    elements.closeModeEditor.addEventListener('click', closeModeEditor);
    elements.cancelModeBtn.addEventListener('click', closeModeEditor);
    elements.saveModeBtn.addEventListener('click', saveMode);
    
    // Close modal when clicking outside
    elements.modeEditorModal.addEventListener('click', (e) => {
      if (e.target === elements.modeEditorModal) {
        closeModeEditor();
      }
    });
    
    // Form validation
    elements.modeName.addEventListener('input', validateModeForm);
    elements.modeSystemMessage.addEventListener('input', validateModeForm);
    elements.modeOrchestrationMessage.addEventListener('input', validateModeForm);
  }

  function setupToolsCheckboxes() {
    console.log('Setting up tools checkboxes. Available tools:', availableTools);
    elements.modeToolsContainer.innerHTML = '';
    
    if (availableTools.length === 0) {
      console.warn('No available tools found');
      elements.modeToolsContainer.innerHTML = '<p style="color: #888;">No tools available</p>';
      return;
    }
    
    availableTools.forEach(toolInfo => {
      console.log('Creating checkbox for tool:', toolInfo.name);
      const div = document.createElement('div');
      div.className = 'tool-checkbox';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `tool-${toolInfo.name}`;
      checkbox.value = toolInfo.name;
      
      const label = document.createElement('label');
      label.setAttribute('for', `tool-${toolInfo.name}`);
      label.innerHTML = `<strong>${toolInfo.displayName}</strong><br><small>${toolInfo.description}</small>`;
      
      // Add category badge
      const categoryBadge = document.createElement('span');
      categoryBadge.className = `category-badge category-${toolInfo.category}`;
      categoryBadge.textContent = toolInfo.category;
      
      div.appendChild(checkbox);
      div.appendChild(label);
      div.appendChild(categoryBadge);
      elements.modeToolsContainer.appendChild(div);
    });
  }

  function setupToolsGrid() {
    console.log('Setting up tools grid. Available tools:', availableTools);
    
    if (!elements.toolsGrid) {
      console.warn('Tools grid element not found');
      return;
    }
    
    elements.toolsGrid.innerHTML = '';
    
    if (availableTools.length === 0) {
      console.warn('No available tools found');
      elements.toolsGrid.innerHTML = '<p style="color: #888; text-align: center;">No tools available</p>';
      return;
    }
    
    // Category display mapping
    const categoryMapping = {
      'file': 'File Operations',
      'search': 'Search',
      'system': 'System',
      'web': 'Web'
    };
    
    // Create tool cards dynamically
    availableTools.forEach(toolInfo => {
      console.log('Creating card for tool:', toolInfo.name);
      
      const toolCard = document.createElement('div');
      toolCard.className = 'tool-card';
      
      const toolTitle = document.createElement('h4');
      toolTitle.textContent = toolInfo.displayName || toolInfo.name;
      
      const toolDescription = document.createElement('p');
      toolDescription.textContent = toolInfo.description;
      
      const toolCategory = document.createElement('span');
      toolCategory.className = 'tool-category';
      toolCategory.textContent = categoryMapping[toolInfo.category] || toolInfo.category;
      
      toolCard.appendChild(toolTitle);
      toolCard.appendChild(toolDescription);
      toolCard.appendChild(toolCategory);
      
      elements.toolsGrid.appendChild(toolCard);
    });
  }

  function requestConfiguration() {
    vscode.postMessage({ type: 'getConfiguration' });
  }

  function updateUI(config) {
    currentConfig = config;
    
    // Basic settings
    elements.host.value = config.host || '';
    elements.port.value = config.port || '';
    elements.apiKey.value = config.apiKey || '';
    elements.currentMode.value = config.currentMode || '';
    elements.currentModel.value = config.currentModel || '';
    elements.showThinking.checked = config.showThinking || false;
    elements.enableStreaming.checked = config.enableStreaming !== false; // Default to true
    elements.iterationThreshold.value = config.iterationThreshold || 10;
    elements.uncertaintyThreshold.value = config.askUser?.uncertaintyThreshold || 70;
    elements.enableProjectMemory.checked = config.enableProjectMemory || false;
    
    // Logging settings
    elements.loggingEnabled.checked = config.logging?.enabled || false;
    elements.logFilePath.value = config.logging?.filePath || '';
    elements.logVerbosity.value = config.logging?.verbosity || 'Standard';
    elements.logMode.checked = config.logging?.logMode || false;
    elements.logModeFilePath.value = config.logging?.logModeFilePath || '';
    
    // Tools settings
    elements.readFileMaxLines.value = config.tools?.readFileMaxLines || 1000;
    elements.autoApproveCommands.value = config.tools?.autoApproveCommands || '';
    
    // Memory settings
    elements.memoryMaxLines.value = config.memory?.maxLines || 1000;
    elements.memoryMaxChars.value = config.memory?.maxChars || 50000;
    elements.memoryAutoSafetyLimit.value = config.memory?.autoSafetyLimit || 5000;
    elements.memoryLargeValueThreshold.value = config.memory?.largeValueThreshold || 10000;
    
    // Plan prompts settings
    if (elements.planReworkPrompt) elements.planReworkPrompt.value = config.plan?.prompts?.planRework || '';
    if (elements.planReviewPrompt) elements.planReviewPrompt.value = config.plan?.prompts?.planReview || '';
    if (elements.pointsReworkPrompt) elements.pointsReworkPrompt.value = config.plan?.prompts?.pointsRework || '';
    if (elements.pointsReviewPrompt) elements.pointsReviewPrompt.value = config.plan?.prompts?.pointsReview || '';
    if (elements.pointsTestingPrompt) elements.pointsTestingPrompt.value = config.plan?.prompts?.pointsTesting || '';
    if (elements.pointsImplementationPrompt) elements.pointsImplementationPrompt.value = config.plan?.prompts?.pointsImplementation || '';
    if (elements.planAcceptancePrompt) elements.planAcceptancePrompt.value = config.plan?.prompts?.planAcceptance || '';
    
    // Update modes dropdown
    updateModeDropdown(config.modes || {});
    
    // Update modes list
    updateModesList(config.modes || {});
  }

  function updateModeDropdown(modes) {
    const currentValue = elements.currentMode.value;
    elements.currentMode.innerHTML = '';
    
    Object.keys(modes).forEach(modeName => {
      const option = document.createElement('option');
      option.value = modeName;
      option.textContent = modeName;
      elements.currentMode.appendChild(option);
    });
    
    if (currentValue && modes[currentValue]) {
      elements.currentMode.value = currentValue;
    } else if (Object.keys(modes).length > 0) {
      elements.currentMode.value = Object.keys(modes)[0];
    }
  }

  function updateModesList(modes) {
    elements.modesList.innerHTML = '';
    
    Object.entries(modes).forEach(([modeName, modeConfig]) => {
      const modeItem = createModeItem(modeName, modeConfig);
      elements.modesList.appendChild(modeItem);
    });
  }

  function createModeItem(modeName, modeConfig) {
    const div = document.createElement('div');
    div.className = 'mode-item';
    
    const info = document.createElement('div');
    info.className = 'mode-info';
    
    const name = document.createElement('h4');
    name.textContent = modeName;
    
    const description = document.createElement('div');
    description.className = 'mode-description';
    description.textContent = modeConfig.description || 'No description';
    
    const llmDescription = document.createElement('div');
    llmDescription.className = 'mode-llm-description';
    llmDescription.textContent = `LLM Context: ${modeConfig.llmDescription || 'No LLM description'}`;
    llmDescription.style.fontSize = '0.9em';
    llmDescription.style.color = '#666';
    llmDescription.style.fontStyle = 'italic';
    
    const details = document.createElement('div');
    details.className = 'mode-details';
    details.textContent = `Temperature: ${modeConfig.temperature !== undefined ? modeConfig.temperature : 'null'}, Tools: ${(modeConfig.allowedTools || []).length}`;
    
    info.appendChild(name);
    info.appendChild(description);
    info.appendChild(llmDescription);
    info.appendChild(details);
    
    const actions = document.createElement('div');
    actions.className = 'mode-actions';
    
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openModeEditor(modeName, modeConfig));
    
    const duplicateBtn = document.createElement('button');
    duplicateBtn.textContent = 'Duplicate';
    duplicateBtn.addEventListener('click', () => duplicateMode(modeName));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteMode(modeName));
    
    actions.appendChild(editBtn);
    actions.appendChild(duplicateBtn);
    actions.appendChild(deleteBtn);
    
    div.appendChild(info);
    div.appendChild(actions);
    
    return div;
  }

  function openModeEditor(modeName = null, modeConfig = null) {
    isEditing = !!modeName;
    editingModeName = modeName;
    
    elements.modeEditorTitle.textContent = isEditing ? 'Edit Mode' : 'Create New Mode';
    
    if (isEditing && modeConfig) {
      elements.modeName.value = modeName;
      elements.modeName.disabled = true;
      elements.modeDescription.value = modeConfig.description || '';
      elements.modeLlmDescription.value = modeConfig.llmDescription || '';
      elements.modeSystemMessage.value = modeConfig.systemMessage || '';
      elements.modeOrchestrationMessage.value = modeConfig.orchestrationMessage || '';
      elements.modeFallbackMessage.value = modeConfig.fallbackMessage || '';
      elements.modeTemperature.value = modeConfig.temperature !== undefined ? modeConfig.temperature : '';
      elements.modeTopP.value = modeConfig.top_p !== undefined ? modeConfig.top_p : '';
      elements.modePresencePenalty.value = modeConfig.presence_penalty !== undefined ? modeConfig.presence_penalty : '';
      elements.modeFrequencyPenalty.value = modeConfig.frequency_penalty !== undefined ? modeConfig.frequency_penalty : '';
      elements.modeAutoEvaluation.checked = modeConfig.autoEvaluation || false;
      
      // Set tool checkboxes
      const allowedTools = modeConfig.allowedTools || [];
      availableTools.forEach(toolInfo => {
        const checkbox = document.getElementById(`tool-${toolInfo.name}`);
        if (checkbox) {
          checkbox.checked = allowedTools.includes(toolInfo.name);
        }
      });
    } else {
      // Reset form for new mode
      elements.modeEditorForm.reset();
      elements.modeName.disabled = false;
      elements.modeTemperature.value = '';
      elements.modeTopP.value = '';
      elements.modePresencePenalty.value = '';
      elements.modeFrequencyPenalty.value = '';
      elements.modeAutoEvaluation.checked = false;
      
      // Uncheck all tools
      availableTools.forEach(toolInfo => {
        const checkbox = document.getElementById(`tool-${toolInfo.name}`);
        if (checkbox) {
          checkbox.checked = false;
        }
      });
    }
    
    validateModeForm();
    elements.modeEditorModal.style.display = 'block';
  }

  function closeModeEditor() {
    elements.modeEditorModal.style.display = 'none';
    isEditing = false;
    editingModeName = null;
  }

  function validateModeForm() {
    const name = elements.modeName.value.trim();
    const systemMessage = elements.modeSystemMessage.value.trim();
    
    const isValid = name && systemMessage;
    elements.saveModeBtn.disabled = !isValid;
    
    return isValid;
  }

  function saveMode() {
    if (!validateModeForm()) {
      return;
    }
    
    const mode = {
      name: elements.modeName.value.trim(),
      description: elements.modeDescription.value.trim(),
      llmDescription: elements.modeLlmDescription.value.trim(),
      systemMessage: elements.modeSystemMessage.value.trim(),
      orchestrationMessage: elements.modeOrchestrationMessage.value.trim(),
      fallbackMessage: elements.modeFallbackMessage.value.trim(),
      temperature: elements.modeTemperature.value ? parseFloat(elements.modeTemperature.value) : undefined,
      top_p: elements.modeTopP.value ? parseFloat(elements.modeTopP.value) : undefined,
      presence_penalty: elements.modePresencePenalty.value ? parseFloat(elements.modePresencePenalty.value) : undefined,
      frequency_penalty: elements.modeFrequencyPenalty.value ? parseFloat(elements.modeFrequencyPenalty.value) : undefined,
      autoEvaluation: elements.modeAutoEvaluation.checked,
      allowedTools: availableTools.filter(toolInfo => {
        const checkbox = document.getElementById(`tool-${toolInfo.name}`);
        return checkbox && checkbox.checked;
      }).map(toolInfo => toolInfo.name)
    };
    
    if (isEditing) {
      vscode.postMessage({
        type: 'updateMode',
        modeName: editingModeName,
        mode: mode
      });
    } else {
      vscode.postMessage({
        type: 'createMode',
        mode: mode
      });
    }
  }

  function duplicateMode(modeName) {
    const newName = prompt(`Enter name for duplicate of "${modeName}":`, `${modeName} Copy`);
    if (newName && newName.trim()) {
      vscode.postMessage({
        type: 'duplicateMode',
        modeName: modeName,
        newName: newName.trim()
      });
    }
  }

  function deleteMode(modeName) {
    vscode.postMessage({
      type: 'deleteMode',
      modeName: modeName
    });
  }

  function saveConfiguration() {
    const config = {
      'openai.host': elements.host.value,
      'openai.port': parseInt(elements.port.value) || 11434,
      'openai.apiKey': elements.apiKey.value,
      'currentMode': elements.currentMode.value,
      'currentModel': elements.currentModel.value,
      'showThinking': elements.showThinking.checked,
      'enableStreaming': elements.enableStreaming.checked,
      'iterationThreshold': parseInt(elements.iterationThreshold.value) || 10,
      'askUser.uncertaintyThreshold': parseInt(elements.uncertaintyThreshold.value) || 70,
      'memory.enableProjectMemory': elements.enableProjectMemory.checked,
      'logging.enabled': elements.loggingEnabled.checked,
      'logging.filePath': elements.logFilePath.value,
      'logging.verbosity': elements.logVerbosity.value,
      'logging.logMode': elements.logMode.checked,
      'logging.logModeFilePath': elements.logModeFilePath.value,
      'tools.readFileMaxLines': parseInt(elements.readFileMaxLines.value) || 1000,
      'tools.autoApproveCommands': elements.autoApproveCommands.value,
      'memory.maxLines': parseInt(elements.memoryMaxLines.value) || 1000,
      'memory.maxChars': parseInt(elements.memoryMaxChars.value) || 50000,
      'memory.autoSafetyLimit': parseInt(elements.memoryAutoSafetyLimit.value) || 5000,
      'memory.largeValueThreshold': parseInt(elements.memoryLargeValueThreshold.value) || 10000
    };
    
    // Add plan prompts if elements exist
    if (elements.planReworkPrompt) config['plan.promptPlanRework'] = elements.planReworkPrompt.value;
    if (elements.planReviewPrompt) config['plan.promptPlanReview'] = elements.planReviewPrompt.value;
    if (elements.pointsReworkPrompt) config['plan.promptPointsRework'] = elements.pointsReworkPrompt.value;
    if (elements.pointsReviewPrompt) config['plan.promptPointsReview'] = elements.pointsReviewPrompt.value;
    if (elements.pointsTestingPrompt) config['plan.promptPointsTesting'] = elements.pointsTestingPrompt.value;
    if (elements.pointsImplementationPrompt) config['plan.promptPointsImplementation'] = elements.pointsImplementationPrompt.value;
    if (elements.planAcceptancePrompt) config['plan.promptPlanAcceptance'] = elements.planAcceptancePrompt.value;
    
    showSaveStatus('Saving...', 'pending');
    
    vscode.postMessage({
      type: 'updateConfiguration',
      config: config
    });
  }

  function resetToDefaults() {
    vscode.postMessage({ type: 'resetToDefaults' });
  }

  function selectLogFile() {
    vscode.postMessage({ type: 'selectLogFile' });
  }

  function selectLogModeFile() {
    vscode.postMessage({ type: 'selectLogModeFile' });
  }

  function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  // Handle messages from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
      case 'configurationData':
        availableTools = message.availableTools || [];
        updateUI(message.config);
        setupToolsCheckboxes(); // Setup tools after loading available tools
        setupToolsGrid(); // Setup tools grid after loading available tools
        break;
        
      case 'configurationUpdated':
        if (message.success) {
          showSaveStatus('✅ Settings saved successfully!');
        } else {
          showSaveStatus(`❌ Failed to save: ${message.error}`, 'error');
        }
        break;
        
      case 'settingsReset':
        if (message.success) {
          showMessage('Settings reset to defaults');
          requestConfiguration();
        } else {
          showMessage(`Failed to reset settings: ${message.error}`, 'error');
        }
        break;
        
      case 'modeCreated':
        if (message.success) {
          showMessage(`Mode "${message.modeName}" created successfully`);
          closeModeEditor();
          requestConfiguration();
        } else {
          showMessage(`Failed to create mode: ${message.error}`, 'error');
        }
        break;
        
      case 'modeUpdated':
        if (message.success) {
          showMessage(`Mode "${message.modeName}" updated successfully`);
          closeModeEditor();
          requestConfiguration();
        } else {
          showMessage(`Failed to update mode: ${message.error}`, 'error');
        }
        break;
        
      case 'modeDeleted':
        if (message.success) {
          showMessage(`Mode "${message.modeName}" deleted successfully`);
          requestConfiguration();
        } else {
          showMessage(`Failed to delete mode: ${message.error}`, 'error');
        }
        break;
        
      case 'modeDuplicated':
        if (message.success) {
          showMessage(`Mode duplicated as "${message.newName}"`);
          requestConfiguration();
        } else {
          showMessage(`Failed to duplicate mode: ${message.error}`, 'error');
        }
        break;
        
      case 'logFileSelected':
        elements.logFilePath.value = message.filePath;
        break;
        
      case 'logModeFileSelected':
        elements.logModeFilePath.value = message.filePath;
        break;
        
      case 'connectionTestResult':
        updateConnectionStatus(message.success, message.message);
        break;
        
      case 'profileSaved':
        if (message.success) {
          showSaveStatus(`✅ Profile "${message.profileName}" saved successfully!`);
          requestProfiles();
        } else {
          showSaveStatus(`❌ Failed to save profile: ${message.error}`, 'error');
        }
        break;
        
      case 'profileLoaded':
        if (message.success) {
          showSaveStatus(`✅ Profile "${message.profileName}" loaded successfully!`);
        } else {
          showSaveStatus(`❌ Failed to load profile: ${message.error}`, 'error');
        }
        break;
        
      case 'profileDeleted':
        if (message.success) {
          showSaveStatus(`✅ Profile "${message.profileName}" deleted successfully!`);
          requestProfiles();
        } else {
          showSaveStatus(`❌ Failed to delete profile: ${message.error}`, 'error');
        }
        break;
        
      case 'profilesList':
        renderProfiles(message.profiles);
        break;
    }
  });

  // Update connection status display
  function updateConnectionStatus(success, message) {
    const status = elements.connectionStatus;
    if (!status) return;
    
    status.textContent = message;
    status.className = success ? 'status-indicator success' : 'status-indicator error';
  }

  // Tab Management
  function switchTab(tabName) {
    // FORCE REMOVE all active classes first
    elements.tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    elements.tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // AGGRESSIVE DOM MANIPULATION - Force hide ALL tabs first
    const allTabs = ['profiles-tab', 'connection-tab', 'behavior-tab', 'tools-tab', 'modes-tab', 'logging-tab', 'advanced-tab'];
    allTabs.forEach(tabId => {
      const tab = document.getElementById(tabId);
      if (tab) {
        tab.style.display = 'none';
        tab.style.visibility = 'hidden';
        tab.style.position = 'absolute';
        tab.style.left = '-10000px';
        tab.style.top = '-10000px';
        tab.style.zIndex = '-999';
        tab.style.opacity = '0';
        tab.classList.remove('active');
      }
    });
    
    // Then add active to the correct ones
    elements.tabButtons.forEach(button => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      }
    });
    
    // AGGRESSIVE DOM MANIPULATION - Force show ONLY the active tab
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
      activeTab.style.display = 'flex';
      activeTab.style.visibility = 'visible';
      activeTab.style.position = 'static';
      activeTab.style.left = 'auto';
      activeTab.style.top = 'auto';
      activeTab.style.zIndex = 'auto';
      activeTab.style.opacity = '1';
      activeTab.classList.add('active');
    }
  }

  // Connection Testing
  function testConnection() {
    const status = elements.connectionStatus;
    if (!status) return;
    
    status.textContent = 'Testing...';
    status.className = 'status-indicator pending';
    
    // Send test request to backend
    vscode.postMessage({
      type: 'testConnection',
      host: elements.host.value || 'localhost',
      port: parseInt(elements.port.value) || 11434,
      apiKey: elements.apiKey.value || ''
    });
  }

  // Save Status Display
  function showSaveStatus(message, type = 'success') {
    const status = elements.saveStatus;
    if (!status) return;
    
    status.textContent = message;
    status.className = `save-status ${type}`;
    
    // Clear after 3 seconds
    setTimeout(() => {
      status.textContent = '';
      status.className = 'save-status';
    }, 3000);
  }

  // Profile Management Functions
  function saveProfile() {
    const profileName = elements.newProfileName?.value?.trim();
    
    if (!profileName) {
      showSaveStatus('Profile name is required', 'error');
      return;
    }

    // Validate profile name
    if (!/^[a-zA-Z0-9_-]+$/.test(profileName)) {
      showSaveStatus('Profile name can only contain letters, numbers, underscores, and hyphens', 'error');
      return;
    }

    vscode.postMessage({
      type: 'saveProfile',
      profileName: profileName
    });

    // Clear input after saving
    if (elements.newProfileName) {
      elements.newProfileName.value = '';
    }
  }

  function loadProfile(profileName) {
    vscode.postMessage({
      type: 'loadProfile',
      profileName: profileName
    });
  }

  function deleteProfile(profileName) {
    if (confirm(`Are you sure you want to delete profile "${profileName}"? This action cannot be undone.`)) {
      vscode.postMessage({
        type: 'deleteProfile',
        profileName: profileName
      });
    }
  }

  function requestProfiles() {
    vscode.postMessage({
      type: 'listProfiles'
    });
  }

  function renderProfiles(profiles) {
    if (!elements.profilesList) return;

    if (!profiles || profiles.length === 0) {
      elements.profilesList.innerHTML = `
        <div class="no-profiles" id="noProfiles">
          <div class="no-profiles-icon">📁</div>
          <p>No saved profiles yet</p>
          <p class="no-profiles-hint">Save your current configuration above to create your first profile</p>
        </div>
      `;
      return;
    }

    const profilesHtml = profiles.map(profile => {
      const savedDate = new Date(profile.savedAt).toLocaleString();
      
      return `
        <div class="profile-card">
          <div class="profile-header">
            <h4 class="profile-name">${escapeHtml(profile.name)}</h4>
            <div class="profile-actions">
              <button class="profile-button" onclick="loadProfile('${escapeHtml(profile.name)}')">
                📁 Load
              </button>
              <button class="profile-button danger" onclick="deleteProfile('${escapeHtml(profile.name)}')">
                🗑️ Delete
              </button>
            </div>
          </div>
          <div class="profile-details">
            <div class="profile-detail">
              <div class="profile-detail-label">Mode:</div>
              <div class="profile-detail-value">${escapeHtml(profile.currentMode || 'Unknown')}</div>
            </div>
            <div class="profile-detail">
              <div class="profile-detail-label">Model:</div>
              <div class="profile-detail-value">${escapeHtml(profile.currentModel || 'Unknown')}</div>
            </div>
          </div>
          <div class="profile-saved-date">Saved: ${savedDate}</div>
        </div>
      `;
    }).join('');

    elements.profilesList.innerHTML = profilesHtml;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Make functions global for onclick handlers
  window.loadProfile = loadProfile;
  window.deleteProfile = deleteProfile;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
