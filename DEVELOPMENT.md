# Development Guide

## Project Structure

```
Codi3. **Open chat**: Look for the CodingAgent icon in the Activity Bar (left sidebar)gAgent/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── types.ts             # TypeScript interfaces and types
│   ├── ollama.ts            # Ollama API service
│   ├── tools.ts             # Tool definitions and execution
│   ├── chatService.ts       # Chat logic and conversation management
│   ├── chatViewProvider.ts  # WebView provider for chat UI
│   ├── webview.ts           # WebView HTML generation
│   └── test/                # Test files
├── media/
│   ├── chat-icon.svg        # Extension icon
│   ├── chat.css             # WebView styles
│   └── chat.js              # WebView JavaScript
├── package.json             # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── README.md                # User documentation
```

## Building and Testing

### Prerequisites
- Node.js 18+ and npm
- VS Code 1.103.0+
- Ollama installed locally

### Setup
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes (development)
npm run watch

# Run linting
npm run lint
```

### Testing the Extension

1. **Open in VS Code**: Open the project folder in VS Code
2. **Start debugging**: Press F5 or go to Run > Start Debugging
3. **Extension Host**: A new VS Code window will open with the extension loaded
4. **Open chat**: Look for the CodingAgent view in the Explorer sidebar

### Ollama Setup for Testing

```bash
# Install Ollama (if not already installed)
# Download from https://ollama.ai/

# Pull a test model
ollama pull llama3:8b

# Start Ollama server
ollama serve
```

## Architecture Overview

### Core Components

1. **Extension Main (`extension.ts`)**
   - Registers commands and providers
   - Manages status bar and configuration
   - Entry point for all extension functionality

2. **Chat Service (`chatService.ts`)**
   - Handles conversation logic
   - Manages message history
   - Coordinates between Ollama and Tools

3. **Ollama Service (`ollama.ts`)**
   - Communicates with Ollama API
   - Handles model listing and chat requests
   - Manages configuration settings

4. **Tools Service (`tools.ts`)**
   - Implements all available tools
   - Handles file operations, terminal commands, etc.
   - Provides tool definitions for AI model

5. **Chat View Provider (`chatViewProvider.ts`)**
   - Manages WebView lifecycle
   - Handles messages between extension and UI
   - Updates UI state based on chat events

6. **WebView Components (`webview.ts`, `media/`)**
   - HTML/CSS/JS for chat interface
   - Handles user interactions
   - Displays messages, tool calls, and debug info

### Data Flow

```
User Input → WebView → ChatViewProvider → ChatService → OllamaService → AI Model
                                             ↓
                                         ToolsService → Tool Execution → Results
                                             ↓
User Interface ← WebView ← ChatViewProvider ← ChatService ← Ollama Response
```

## Adding New Features

### Adding a New Tool

1. **Define tool in `tools.ts`**:
```typescript
// Add to getToolDefinitions()
new_tool: {
  type: 'function',
  function: {
    name: 'new_tool',
    description: 'Description of what the tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    }
  }
}

// Add to executeTool()
case 'new_tool':
  return await this.executeNewTool(args.param1);

// Implement the tool
private async executeNewTool(param1: string): Promise<ToolResult> {
  // Tool implementation
}
```

2. **Add tool to agent modes** in `package.json`:
```json
{
  "codingagent.modes": {
    "Coder": {
      "allowedTools": ["read_file", "write_file", "new_tool"]
    }
  }
}
```

### Adding a New Agent Mode

Update the default configuration in `package.json`:

```json
{
  "codingagent.modes": {
    "NewMode": {
      "systemMessage": "You are a specialized assistant for...",
      "allowedTools": ["tool1", "tool2"],
      "fallbackMessage": "I'm ready to help with..."
    }
  }
}
```

### Modifying the UI

1. **Styles**: Edit `media/chat.css`
2. **Behavior**: Edit `media/chat.js`
3. **HTML Structure**: Edit the template in `webview.ts`

## Configuration Schema

The extension uses VS Code's configuration system. Settings are defined in `package.json` under `contributes.configuration.properties`.

### Key Settings

- `codingagent.ollama.host`: Ollama server host
- `codingagent.ollama.port`: Ollama server port  
- `codingagent.currentMode`: Active agent mode
- `codingagent.currentModel`: Active AI model
- `codingagent.showThinking`: Show model reasoning
- `codingagent.modes`: Agent mode definitions

## Security Considerations

### Terminal Command Execution
- Commands run in the workspace directory by default
- 30-second timeout to prevent hanging
- Output is captured and sanitized
- No shell injection vulnerabilities (uses child_process.exec properly)

### File Operations
- All file paths are resolved relative to workspace
- No access outside workspace directory
- Proper error handling for permission issues

### Web Requests
- Basic HTML stripping for webpage content
- Configurable content length limits
- Standard fetch API with error handling

## Debugging Tips

### Common Issues

1. **"Tool not found"**: Check tool name spelling in mode configuration
2. **"Path not found"**: Ensure file paths are relative to workspace root
3. **"No response from model"**: Check Ollama is running and model is pulled
4. **WebView not loading**: Check for CSP violations in browser dev tools

### Debug Mode

Enable detailed debugging by:
1. Setting `"codingagent.showThinking": true`
2. Expanding "Debug Info" sections in error messages
3. Checking VS Code Developer Console (Help > Toggle Developer Tools)

### Useful VS Code Commands

- `Developer: Reload Window` - Restart extension during development
- `Developer: Show Running Extensions` - Check extension status
- `Developer: Toggle Developer Tools` - Debug WebView issues

## Performance Considerations

### Message History
- Limited to last 10 messages to manage context size
- Consider implementing conversation compression for longer chats

### File Operations
- Large files are truncated automatically
- Consider streaming for very large files

### Tool Execution
- Terminal commands have configurable timeouts
- File operations use synchronous APIs for simplicity

## Contributing Guidelines

1. **Code Style**: Follow existing TypeScript conventions
2. **Error Handling**: Always provide user-friendly error messages
3. **Documentation**: Update README.md for user-facing changes
4. **Testing**: Test with multiple Ollama models
5. **Security**: Review any new file/network operations

## Packaging for Distribution

```bash
# Install VSCE (VS Code Extension CLI)
npm install -g vsce

# Package extension
vsce package

# This creates a .vsix file that can be installed in VS Code
```

## Troubleshooting Development Issues

### TypeScript Errors
```bash
# Clean and rebuild
rm -rf out/
npm run compile
```

### Extension Not Loading
- Check package.json syntax
- Verify all required files are present
- Look for errors in VS Code Developer Console

### WebView Issues
- Check CSP settings in webview.ts
- Verify resource URIs are properly generated
- Test JavaScript in browser dev tools
