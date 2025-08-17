# Development Guide

## Project Structure

```
CodingAgent/
├── src/
│   ├── extension.ts                    # Main extension entry point
│   ├── types.ts                        # TypeScript interfaces and types
│   ├── chatService.ts                  # Chat logic and conversation management
│   ├── chatViewProvider.ts             # WebView provider for chat UI
│   ├── openai_html_api.ts             # Ollama API service (OpenAI compatible)
│   ├── loggingService.ts               # Logging and debugging service
│   ├── settingsPanel.ts               # Settings management UI
│   ├── webview.ts                     # WebView HTML generation
│   ├── tools.ts                       # Tool registry and management
│   ├── changeTrackingService.ts       # File change tracking and management
│   ├── changeCodeLensProvider.ts      # Code lens for change acceptance/rejection
│   ├── inlineChangeDecorationService.ts # Visual change decorations
│   ├── changeAwareBaseTool.ts         # Base class for change-aware tools
│   ├── backupManager.ts               # File backup and restoration
│   ├── tools/
│   │   ├── readFile.ts                # Read file content with line ranges
│   │   ├── writeFile.ts               # Write or append to files
│   │   ├── insertLines.ts             # Insert lines at specific positions
│   │   ├── deleteLines.ts             # Delete lines by various criteria
│   │   ├── replaceLines.ts            # Replace lines by various criteria
│   │   ├── patchFile.ts               # Apply text patches
│   │   ├── listFiles.ts               # Directory listing
│   │   ├── getFileSize.ts             # File size information
│   │   ├── createFolder.ts            # Directory creation
│   │   ├── renameFile.ts              # File/folder renaming
│   │   ├── executeTerminal.ts         # Terminal command execution
│   │   ├── searchPattern.ts           # Text search across files
│   │   ├── readWebpage.ts             # Web content fetching
│   │   └── readPdf.ts                 # PDF text extraction
│   └── test/                          # Comprehensive test suite
│       ├── extension.test.ts          # Extension integration tests
│       ├── tools.test.ts              # Tool functionality tests
│       ├── fileTools.test.ts          # File operation tests
│       ├── systemWebTools.test.ts     # System and web tool tests
│       ├── toolsIntegration.test.ts   # Tool integration tests
│       ├── changeTrackingService.test.ts # Change tracking tests
│       └── changeMerging.test.ts      # Change merging logic tests
├── media/
│   ├── chat-icon.svg                  # Extension icon
│   ├── chat.css                       # WebView styles
│   ├── chat.js                        # WebView JavaScript
│   ├── settings.css                   # Settings panel styles
│   └── settings.js                    # Settings panel JavaScript
├── package.json                       # Extension manifest
├── tsconfig.json                      # TypeScript configuration
└── README.md                          # User documentation
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
   - Initializes change tracking system
   - Manages status bar and configuration
   - Entry point for all extension functionality

2. **Chat Service (`chatService.ts`)**
   - Handles conversation logic with streaming support
   - Manages message history and tool execution loops
   - Coordinates between Ollama API and Tools

3. **OpenAI API Service (`openai_html_api.ts`)**
   - Communicates with Ollama using OpenAI-compatible endpoints
   - Handles streaming responses and function calls
   - Manages configuration and model selection

4. **Change Tracking System**
   - **`changeTrackingService.ts`**: Core change tracking and merging logic
   - **`changeCodeLensProvider.ts`**: Accept/Reject code lens integration
   - **`inlineChangeDecorationService.ts`**: Visual change indicators
   - **`backupManager.ts`**: File backup and restoration
   - **`changeAwareBaseTool.ts`**: Base class for tracking file modifications

5. **Tools Architecture**
   - **`tools.ts`**: Central tool registry and execution coordinator
   - **Individual tool files**: Each tool in its own module for maintainability
   - **Modular design**: Easy to add new tools and modify existing ones

6. **Chat View Provider (`chatViewProvider.ts`)**
   - Manages WebView lifecycle
   - Handles messages between extension and UI
   - Updates UI state based on chat events

7. **WebView Components (`webview.ts`, `media/`)**
   - HTML/CSS/JS for chat interface
   - Handles user interactions and streaming updates
   - Displays messages, tool calls, and debug info

### Data Flow

```
User Input → WebView → ChatViewProvider → ChatService → OpenAI API → AI Model
                                             ↓
                                    ToolsService → Tool Execution → ChangeTracking
                                             ↓                            ↓
User Interface ← WebView ← ChatViewProvider ← ChatService ← Results ← File Changes
                    ↑                                                      ↓
              Visual Decorations ← InlineChangeDecorationService ← ChangeTrackingService
```

## Adding New Features

### Adding a New Tool

1. **Create new tool file in `src/tools/`**:
```typescript
// src/tools/myNewTool.ts
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class MyNewTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'my_new_tool',
      displayName: 'My New Tool',
      description: 'Description of what the tool does',
      category: 'file' // or 'system', 'web'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'my_new_tool',
        description: 'Detailed description for AI model',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Parameter description' }
          },
          required: ['param1']
        }
      }
    };
  }

  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    // Tool implementation
    return {
      success: true,
      content: 'Tool executed successfully'
    };
  }

  protected getFilePath(args: any, workspaceRoot: string): string {
    // Return file path if tool modifies files
    return path.join(workspaceRoot, args.path);
  }

  protected getOperationType(args: any): 'create' | 'modify' | 'delete' | 'rename' {
    return 'modify';
  }
}
```

2. **Register tool in `tools.ts`**:
```typescript
import { MyNewTool } from './tools/myNewTool';

// Add to toolInstances array
const myNewTool = new MyNewTool(this.changeTracker);
this.toolInstances.set('my_new_tool', myNewTool);

// Add to allowedTools for appropriate modes
const allowedTools = {
  'Coder': [...existingTools, 'my_new_tool']
};
```

3. **Add tool to agent modes** in `package.json`:
```json
{
  "Coder": {
    "allowedTools": ["read_file", "write_file", "my_new_tool"]
  }
}
```

### Adding Change Tracking to Existing Tools

If creating a tool that modifies files, inherit from `ChangeAwareBaseTool`:

```typescript
export class MyFileTool extends ChangeAwareBaseTool {
  // Implement required methods
  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    const filePath = this.getFilePath(args, workspaceRoot);
    
    // Read original content
    const beforeContent = fs.readFileSync(filePath, 'utf8');
    
    // Perform modifications
    const afterContent = this.modifyContent(beforeContent, args);
    
    // Write modified content
    fs.writeFileSync(filePath, afterContent);
    
    return { success: true, content: 'File modified successfully' };
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
      "fallbackMessage": "I'm ready to help with...",
      "temperature": 0.1
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
