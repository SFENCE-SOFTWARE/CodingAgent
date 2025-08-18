# CodingAgent### Terminal Execution Security
- **User approval required** for all terminal commands
- **Auto-approval whitelist** - Commands in user's whitelist execute immediately
- **Complex command parsing** - Handles &&, ||, |, ;, & operators correctly
- **All-or-nothing approval** - For complex commands, ALL sub-commands must be whitelisted
- **Modal dialog** shows command details before execution (for non-whitelisted commands)
- **Workspace root only** - Commands always execute in workspace root directory
- **No directory changes** - Prevents LLM from changing terminal's working directory
- **Timeout mechanism** for approval requests (5 minutes)
- **Detailed logging** for debugging and security auditExtension - AI Coding Guide

## Architecture Overview
This is a VS Code extension that provides GitHub Copilot Chat-like functionality using Ollama as the AI backend. The extension follows a multi-service architecture with streaming support and tool-based AI interactions.

**Core Services:**
- `ChatService` - Main orchestrator for AI conversations and tool execution loops
- `OpenAIService` - HTTP client for Ollama API using OpenAI-compatible endpoints with streaming support
- `ToolsService` - File system and terminal operations registry for AI agents with security controls
- `ChatViewProvider` - WebView container following VS Code's patterns
- `ChangeTrackingService` - Advanced file change tracking with accept/reject functionality
- `LoggingService` - Singleton with raw JSON communication logging

## Terminal Security System (NEW)
**IMPORTANT**: All terminal commands now require explicit user approval before execution:

### Security Considerations
- **Always validate** tool parameters
- **Sanitize** user input before display
- **Require approval** for destructive operations (or add to auto-approve whitelist for safe commands)
- **Parse complex commands** correctly (handle &&, ||, |, ;, & operators)
- **Log security-relevant** actions
- **Use timeouts** for user interactions

### Auto-Approval System
Configure safe commands for automatic execution without user confirmation:

```json
{
  "codingagent.tools.autoApproveCommands": "ls,pwd,git status,npm --version"
}
```

**Supported command parsing:**
- `ls && pwd` - Both `ls` and `pwd` must be in whitelist
- `git status | grep modified` - Both `git` and `grep` must be whitelisted  
- `npm install; npm start` - Both `npm` commands execute if `npm` is whitelisted
- Complex commands are parsed to extract individual command names
- **Promise-based approval flow** between frontend and backend

### Code Pattern for Terminal Approval
```typescript
// Backend: ExecuteTerminalTool waits for approval
const approvalPromise = new Promise<boolean>((resolve, reject) => {
  // Store pending command with timeout
  setTimeout(() => reject(new Error('Approval timeout')), 5 * 60 * 1000);
});

// Frontend: User approval triggers resolution
function approveTerminalCommand(commandId) {
  vscode.postMessage({ type: 'approveTerminalCommand', commandId });
}
```

## Key Architectural Patterns

### Agent Mode System
The extension uses a **mode-based architecture** where each mode has specific tools and system prompts:
```typescript
// Configuration in package.json defines agent capabilities
"Coder": {
  "allowedTools": ["read_file", "write_file", "list_files", "get_file_size", "execute_terminal", 
                   "create_folder", "patch_file", "rename_file", "search_pattern"],
  "systemMessage": "You are an expert programming assistant...",
  "temperature": 0.1
}
```

**Available Tools:**
- `read_file` - Read file content with line range support
- `write_file` - Write or append to files
- `modify_lines` - Universal line modification: insert, delete, or replace lines with operation parameter
- `patch_file` - Apply text diffs without full file rewrites
- `list_files` - Directory listing with recursive option  
- `get_file_size` - Get file size in lines and bytes
- `execute_terminal` - Run terminal commands with timeout
- `search_pattern` - Search across workspace files (available in all modes)
- `create_folder` - Create directories with recursive option (Coder mode)
- `rename_file` - Rename/move files and folders (Coder mode)
- `read_webpage` - Fetch and read webpage content (Ask/Architect modes)
- `read_pdf` - Extract text from PDF files (Ask/Architect modes)

### Change Tracking System
**Critical:** All file modification tools integrate with advanced change tracking:
- **ChangeTrackingService** - Tracks all file modifications with before/after content
- **ChangeAwareBaseTool** - Base class that all file tools inherit from
- **Smart Merging** - Adjacent/overlapping changes merge automatically, distant changes remain separate
- **Accept/Reject** - Users can selectively accept or reject individual changes
- **Visual Indicators** - Inline decorations and code lens show pending changes
- **Backup System** - Automatic backups enable safe rollback of rejected changes
- **Persistence** - Changes survive VS Code restarts

```typescript
// File tools automatically track changes via ChangeAwareBaseTool
export class MyFileTool extends ChangeAwareBaseTool {
  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    // Tool implementation - tracking happens automatically
    const filePath = this.getFilePath(args, workspaceRoot);
    // Modify file content
    return { success: true, content: 'Modified successfully' };
  }
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
while (normalizedToolCalls.length > 0 && iterationCount < maxIterations) {
  // Execute tools and get results
  const followUpResponse = await this.openai.sendChat(followUpRequest);
  // Check if more tool calls are needed and continue loop
}
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
Files written to `.codingagent/logs/openai-raw-json.log` with full request/response cycles.

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

### Tool Implementation Pattern
All tools follow a consistent interface pattern from `BaseTool`:
```typescript
// Each tool in src/tools/ implements this pattern
export class ReadFileTool implements BaseTool {
  getToolInfo(): ToolInfo { /* metadata */ }
  getToolDefinition(): ToolDefinition { /* OpenAI function schema */ }
  async execute(args: any, workspaceRoot: string): Promise<ToolResult> { /* implementation */ }
}
```

## Extension-Specific Conventions

### Message Flow Architecture
1. **Frontend** (`media/chat.js`) → `vscode.postMessage()`
2. **ChatViewProvider** → message routing to `ChatService`
3. **ChatService** → orchestrates OpenAI API + Tools
4. **Streaming callbacks** → real-time UI updates
5. **WebView** → DOM updates with message history

**UI Order for Assistant Messages:**
- Header (avatar, model name, timestamp)
- Thinking block (if reasoning present, expanded by default)
- Message content
- Tool calls (collapsed by default, expandable)
- Debug info (if available)

### File Structure Logic
- `src/` - TypeScript source following VS Code patterns
- `src/tools/` - Individual tool implementations following ChangeAwareBaseTool interface
- `src/changeTrackingService.ts` - Core change tracking and merging logic
- `src/changeCodeLensProvider.ts` - Code lens integration for Accept/Reject
- `src/inlineChangeDecorationService.ts` - Visual change indicators
- `src/backupManager.ts` - File backup and restoration system
- `src/test/` - Comprehensive test suite (124+ tests) including change tracking scenarios
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
