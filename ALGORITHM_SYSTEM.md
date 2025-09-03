# CodingAgent Algorithm System

## Overview

The CodingAgent Algorithm System allows you to replace LLM-based orchestration with custom JavaScript algorithms. This provides more deterministic and configurable behavior for different modes, especially useful for the Orchestrator mode.

## Features

- **Per-mode Configuration**: Enable/disable algorithms for specific modes
- **Custom Scripts**: Use custom JavaScript files or built-in scripts
- **Sandboxed Execution**: Scripts run in a safe, controlled environment
- **Variable Storage**: Persistent key-value variables per mode
- **LLM Integration**: Scripts can still communicate with LLM when needed
- **GUI Configuration**: Settings panel integration for easy management

## Configuration

### Enable Algorithm for a Mode

In VS Code settings (or `settings.json`):

```json
{
  "codingagent.algorithm.enabled": {
    "Orchestrator": true,
    "Coder": false
  }
}
```

### Set Custom Script Path

```json
{
  "codingagent.algorithm.scriptPath": {
    "Orchestrator": "/path/to/custom/orchestrator.js"
  }
}
```

### Set Variables

```json
{
  "codingagent.algorithm.variables": {
    "Orchestrator": {
      "api_url": "https://example.com/api",
      "timeout": "30000"
    }
  }
}
```

## Writing Algorithm Scripts

### Basic Structure

Every algorithm script must define a `handleUserMessage` function:

```javascript
function handleUserMessage(message, context) {
    // Your algorithm logic here
    context.sendResponse("Algorithm processed: " + message);
    return "Algorithm completed";
}
```

### Available Context Methods

#### Logging
- `context.console.log(...args)` - Log info messages
- `context.console.error(...args)` - Log error messages
- `context.console.warn(...args)` - Log warning messages
- `context.console.info(...args)` - Log info messages

#### Communication
- `context.sendResponse(message)` - Send response to chat
- `context.sendToLLM(message, callback)` - Send message to LLM and get response

#### Variable Management
- `context.getVariable(key)` - Get stored variable
- `context.setVariable(key, value)` - Set variable (persists across executions)

#### Context Properties
- `context.mode` - Current mode name
- `context.userMessage` - Original user message
- `context.variables` - Object with all variables for this mode

### Example: Plan Detection Algorithm

```javascript
function handleUserMessage(message, context) {
    context.console.log('Processing message in Orchestrator mode:', message);
    
    // Check for plan-related keywords
    const planKeywords = ['plan', 'task', 'implement', 'review', 'test'];
    const hasPlanKeyword = planKeywords.some(keyword => 
        message.toLowerCase().includes(keyword)
    );
    
    if (hasPlanKeyword) {
        context.console.info('Plan-related request detected');
        
        // Delegate to LLM with specific context
        const llmPrompt = `This is a plan-related request. Please handle it according to plan workflow: ${message}`;
        
        context.sendToLLM(llmPrompt, function(llmResponse) {
            context.sendResponse(llmResponse);
        });
        
        context.setVariable('last_request_type', 'plan');
    } else {
        // Handle as general request
        context.console.info('General request detected');
        
        context.sendToLLM(message, function(llmResponse) {
            context.sendResponse(llmResponse);
        });
        
        context.setVariable('last_request_type', 'general');
    }
    
    return 'Orchestrator algorithm completed';
}
```

### Example: Pure Algorithm (No LLM)

```javascript
function handleUserMessage(message, context) {
    context.console.log('Pure algorithm processing:', message);
    
    let response = 'Algorithm Response:\\n\\n';
    
    // Simple command routing
    if (message.toLowerCase().includes('status')) {
        const lastAction = context.getVariable('last_action') || 'none';
        response += `Current Status: Last action was "${lastAction}"`;
        
    } else if (message.toLowerCase().includes('reset')) {
        context.setVariable('last_action', 'reset');
        response += 'System has been reset.';
        
    } else if (message.toLowerCase().includes('help')) {
        response += 'Available commands: status, reset, help';
        
    } else {
        response += 'Processing your request algorithmically...';
        context.setVariable('last_action', 'processed');
    }
    
    context.sendResponse(response);
    return 'Pure algorithm completed';
}
```

## Sandbox Environment

Algorithm scripts run in a sandboxed environment with access to:

### Available Globals
- `console` (custom implementation)
- `setTimeout`, `clearTimeout`
- `setInterval`, `clearInterval`
- `Promise`
- `JSON`, `Math`, `Date`, `RegExp`
- `String`, `Number`, `Boolean`, `Array`, `Object`

### Restricted Access
- No file system access
- No network access (except via `sendToLLM`)
- No VS Code API access
- No Node.js modules

## Built-in Scripts

### Orchestrator Script
The default Orchestrator script (`src/algorithms/orchestrator.js`) provides:
- Request analysis
- Plan detection
- Basic workflow coordination
- Variable tracking

### Default Mode Script
For other modes, a default script template is created that:
- Logs the request
- Forwards to LLM
- Returns LLM response

## Usage from Settings GUI

1. Open CodingAgent Settings
2. Navigate to Algorithm section
3. Enable algorithm for desired modes
4. Select custom script files (optional)
5. Manage variables with key-value editor
6. Click "Open Script" to edit scripts in VS Code

## Debugging

### Viewing Logs
Algorithm execution logs are available through:
- VS Code Output Channel
- AlgorithmEngine.getLogs() method
- Console messages in script

### Error Handling
- Script errors are caught and logged
- Fallback to LLM processing on algorithm failure
- Error messages shown in UI

### Testing Scripts
```javascript
// Add debug logging
context.console.log('Debug: message =', message);
context.console.log('Debug: variables =', context.variables);

// Test variable persistence
context.setVariable('debug_counter', 
    String(parseInt(context.getVariable('debug_counter') || '0') + 1)
);
context.console.log('Debug: counter =', context.getVariable('debug_counter'));
```

## Best Practices

1. **Always handle errors gracefully**
2. **Use descriptive logging for debugging**
3. **Keep scripts focused and simple**
4. **Store state in variables, not global scope**
5. **Test with fallback scenarios**
6. **Document your algorithm logic**

## Integration with CodingAgent

The algorithm system integrates seamlessly with:
- **Plan System**: Can trigger plan evaluation and tools
- **Memory System**: Can store and retrieve context
- **Tool System**: Can indirectly call tools via LLM
- **Chat System**: Full integration with chat flow
- **Settings**: Complete GUI configuration

When an algorithm is enabled for a mode, it takes precedence over LLM processing but can still delegate to LLM when needed.
