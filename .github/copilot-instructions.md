# CodingAgent VS Code Extension - AI Coding Guide

## Architecture Overview
This is a VS Code extension that provides GitHub Copilot Chat-like functionality using Ollama as the AI backend. The extension follows a multi-service architecture with streaming support and tool-based AI interactions.

**Core Services:**
- `ChatService` - Main orchestrator for AI conversations and tool execution loops
- `OllamaService` - HTTP client for Ollama API with streaming support
- `ToolsService` - File system and terminal operations for AI agents
- `ChatViewProvider` - WebView container following VS Code's patterns
- `LoggingService` - Singleton with raw JSON communication logging

## Key Architectural Patterns

### Agent Mode System
The extension uses a **mode-based architecture** where each mode has specific tools and system prompts:
```typescript
// Configuration in package.json defines agent capabilities
"Coder": {
  "allowedTools": ["read_file", "write_file", "list_files", "execute_terminal"],
  "systemMessage": "You are an expert programming assistant...",
  "temperature": 0.1
}
```

### Streaming Architecture
**Critical:** The extension implements streaming responses with tool call interleaving:
- `processStreamingMessage()` handles incremental content updates
- Tool calls can interrupt streaming but responses continue seamlessly
- Frontend tracks streaming state via `streamingMessages Map`
- Use `StreamingUpdate` interface for all streaming communications

### Tool Execution Loop
**Important:** Tool calls are handled recursively - AI can make multiple tool calls in sequence:
```typescript
// In chatService.ts - this pattern is essential for multi-step operations
do {
  const response = await ollama.chat(request);
  if (response.message.tool_calls) {
    // Execute tools and continue conversation
    toolResults = await executeTools(response.message.tool_calls);
    // Add tool results to conversation and continue
  }
} while (hasToolCalls && !maxIterationsReached);
```

## Development Workflows

### Build & Watch
```bash
npm run compile    # One-time TypeScript compilation
npm run watch      # Watch mode for development (use task: "npm: 0")
```

### Testing Extension
- Press F5 in VS Code to launch Extension Development Host
- Use Command Palette: "CodingAgent: Open Chat" or click activity bar icon
- Status bar shows current mode/model: `$(comment-discussion) Coder (llama3:8b)`

### Debugging Patterns
**Log Mode:** Enable raw JSON logging for Ollama communication debugging:
```json
"codingagent.logging.logMode": true
```
Files written to `.codingagent/logs/ollama-raw-json.log` with full request/response cycles.

**WebView Communication:** Debug frontend-backend communication via:
```javascript
// In media/chat.js - all vscode.postMessage calls
vscode.postMessage({ type: 'sendMessage', message: content });
```

## Critical Code Patterns

### WebView State Management
The chat UI uses **retained context** (`retainContextWhenHidden: true`) and state restoration:
```typescript
// ChatViewProvider pattern for persistent chat
const state = vscode.getState() || { messages: [], currentMode: 'Coder' };
```

### Configuration Reactivity
**Important:** All services listen for config changes and update dynamically:
```typescript
vscode.workspace.onDidChangeConfiguration(event => {
  if (event.affectsConfiguration('codingagent')) {
    this.updateConfiguration();
  }
});
```

### Tool Safety Patterns
File operations are **workspace-relative** with safety checks:
```typescript
// In tools.ts - always resolve paths relative to workspace
const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);
```

## Extension-Specific Conventions

### Message Flow Architecture
1. **Frontend** (`media/chat.js`) → `vscode.postMessage()`
2. **ChatViewProvider** → message routing to `ChatService`
3. **ChatService** → orchestrates Ollama + Tools
4. **Streaming callbacks** → real-time UI updates
5. **WebView** → DOM updates with message history

### File Structure Logic
- `src/` - TypeScript source following VS Code patterns
- `media/` - WebView assets (HTML/CSS/JS, not bundled)
- `out/` - Compiled JavaScript (gitignored)
- Configuration in `package.json` contributes section defines UI elements

### Error Handling Pattern
All services use **graceful degradation**:
```typescript
// Standard pattern across services
try {
  const result = await operation();
  return { success: true, content: result };
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return { success: false, error: errorMsg };
}
```

## Integration Points

### Ollama API Contract
Uses **OpenAI-compatible API** (`/v1/chat/completions`) not native Ollama format:
- Supports streaming via Server-Sent Events
- Tool calls follow OpenAI function calling spec
- Model names from `/api/tags` endpoint

### VS Code Extension API Usage
- **WebView Views** for activity bar integration
- **Configuration API** for reactive settings
- **Command registration** with categories for Command Palette
- **Status bar items** for quick access to current state

### External Dependencies
- **No bundling** - uses Node.js built-ins (`fs`, `path`, `child_process`)
- **TypeScript strict mode** with Node16 module resolution
- **ESLint** configuration for VS Code extension patterns

## Quick Start for AI Agents

1. **Understand the mode system** - each mode (Coder/Ask/Architect) has different tool access
2. **Follow the streaming pattern** - use `StreamingUpdate` for real-time responses
3. **Respect tool execution loops** - AI can make multiple sequential tool calls
4. **Use workspace-relative paths** - all file operations are workspace-scoped
5. **Test with watch mode** - `npm run watch` + F5 for rapid iteration

**Key files to understand first:** `chatService.ts` (orchestration), `types.ts` (interfaces), `package.json` (configuration schema).
