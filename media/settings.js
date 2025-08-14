// Settings Panel JavaScript

(function() {
  const vscode = acquireVsCodeApi();
  
  let currentConfig = {};
  let isEditing = false;
  let editingModeName = null;

  // Available tools
  const availableTools = [
    'read_file', 'write_file', 'list_files', 'get_file_size', 
    'execute_terminal', 'read_webpage', 'read_pdf'
  ];

  // DOM Elements
  const elements = {
    host: document.getElementById('host'),
    port: document.getElementById('port'),
    currentMode: document.getElementById('currentMode'),
    currentModel: document.getElementById('currentModel'),
    showThinking: document.getElementById('showThinking'),
    loggingEnabled: document.getElementById('loggingEnabled'),
    logFilePath: document.getElementById('logFilePath'),
    logVerbosity: document.getElementById('logVerbosity'),
    logMode: document.getElementById('logMode'),
    logModeFilePath: document.getElementById('logModeFilePath'),
    modesList: document.getElementById('modesList'),
    resetBtn: document.getElementById('resetBtn'),
    saveBtn: document.getElementById('saveBtn'),
    newModeBtn: document.getElementById('newModeBtn'),
    selectLogFileBtn: document.getElementById('selectLogFileBtn'),
    selectLogModeFileBtn: document.getElementById('selectLogModeFileBtn'),
    
    // Modal elements
    modeEditorModal: document.getElementById('modeEditorModal'),
    modeEditorTitle: document.getElementById('modeEditorTitle'),
    closeModeEditor: document.getElementById('closeModeEditor'),
    modeEditorForm: document.getElementById('modeEditorForm'),
    modeName: document.getElementById('modeName'),
    modeDescription: document.getElementById('modeDescription'),
    modeSystemMessage: document.getElementById('modeSystemMessage'),
    modeFallbackMessage: document.getElementById('modeFallbackMessage'),
    modeTemperature: document.getElementById('modeTemperature'),
    modeTopP: document.getElementById('modeTopP'),
    modeToolsContainer: document.getElementById('modeToolsContainer'),
    saveModeBtn: document.getElementById('saveModeBtn'),
    cancelModeBtn: document.getElementById('cancelModeBtn')
  };

  // Initialize
  function init() {
    setupEventListeners();
    setupToolsCheckboxes();
    requestConfiguration();
  }

  function setupEventListeners() {
    // Main buttons
    elements.resetBtn.addEventListener('click', resetToDefaults);
    elements.saveBtn.addEventListener('click', saveConfiguration);
    elements.newModeBtn.addEventListener('click', () => openModeEditor());
    elements.selectLogFileBtn.addEventListener('click', selectLogFile);
    elements.selectLogModeFileBtn.addEventListener('click', selectLogModeFile);
    
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
  }

  function setupToolsCheckboxes() {
    elements.modeToolsContainer.innerHTML = '';
    
    availableTools.forEach(tool => {
      const div = document.createElement('div');
      div.className = 'tool-checkbox';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `tool-${tool}`;
      checkbox.value = tool;
      
      const label = document.createElement('label');
      label.setAttribute('for', `tool-${tool}`);
      label.textContent = tool.replace(/_/g, ' ');
      
      div.appendChild(checkbox);
      div.appendChild(label);
      elements.modeToolsContainer.appendChild(div);
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
    elements.currentMode.value = config.currentMode || '';
    elements.currentModel.value = config.currentModel || '';
    elements.showThinking.checked = config.showThinking || false;
    
    // Logging settings
    elements.loggingEnabled.checked = config.logging?.enabled || false;
    elements.logFilePath.value = config.logging?.filePath || '';
    elements.logVerbosity.value = config.logging?.verbosity || 'Standard';
    elements.logMode.checked = config.logging?.logMode || false;
    elements.logModeFilePath.value = config.logging?.logModeFilePath || '';
    
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
    
    const details = document.createElement('div');
    details.className = 'mode-details';
    details.textContent = `Temperature: ${modeConfig.temperature || 0.1}, Tools: ${(modeConfig.allowedTools || []).length}`;
    
    info.appendChild(name);
    info.appendChild(description);
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
      elements.modeSystemMessage.value = modeConfig.systemMessage || '';
      elements.modeFallbackMessage.value = modeConfig.fallbackMessage || '';
      elements.modeTemperature.value = modeConfig.temperature || 0.1;
      elements.modeTopP.value = modeConfig.topP || 0.9;
      
      // Set tool checkboxes
      const allowedTools = modeConfig.allowedTools || [];
      availableTools.forEach(tool => {
        const checkbox = document.getElementById(`tool-${tool}`);
        if (checkbox) {
          checkbox.checked = allowedTools.includes(tool);
        }
      });
    } else {
      // Reset form for new mode
      elements.modeEditorForm.reset();
      elements.modeName.disabled = false;
      elements.modeTemperature.value = 0.1;
      elements.modeTopP.value = 0.9;
      
      // Uncheck all tools
      availableTools.forEach(tool => {
        const checkbox = document.getElementById(`tool-${tool}`);
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
      systemMessage: elements.modeSystemMessage.value.trim(),
      fallbackMessage: elements.modeFallbackMessage.value.trim(),
      temperature: parseFloat(elements.modeTemperature.value) || 0.1,
      topP: parseFloat(elements.modeTopP.value) || 0.9,
      allowedTools: availableTools.filter(tool => {
        const checkbox = document.getElementById(`tool-${tool}`);
        return checkbox && checkbox.checked;
      })
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
      'ollama.host': elements.host.value,
      'ollama.port': parseInt(elements.port.value) || 11434,
      'currentMode': elements.currentMode.value,
      'currentModel': elements.currentModel.value,
      'showThinking': elements.showThinking.checked,
      'logging.enabled': elements.loggingEnabled.checked,
      'logging.filePath': elements.logFilePath.value,
      'logging.verbosity': elements.logVerbosity.value,
      'logging.logMode': elements.logMode.checked,
      'logging.logModeFilePath': elements.logModeFilePath.value
    };
    
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
        updateUI(message.config);
        break;
        
      case 'configurationUpdated':
        if (message.success) {
          showMessage('Configuration updated successfully');
        } else {
          showMessage(`Failed to update configuration: ${message.error}`, 'error');
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
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
