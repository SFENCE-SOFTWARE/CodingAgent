# CodingAgent Extension - AI Coding Guide

This is a comprehensive VS Code extension that provides GitHub Copilot Chat-like functionality using any OpenAI-compatible LLM backend. The extension features advanced tool-based AI interactions, sophisticated memory system, intelligent change tracking, and robust security controls.

## Architecture Overview
This VS Code extension provides GitHub Copilot Chat-like functionality using any OpenAI-compatible LLM backend (Ollama, OpenAI, Azure OpenAI, llama.cpp, vLLM, LocalAI, etc.). The extension follows a multi-service architecture with streaming support, tool-based AI interactions, intelligent change tracking, memory system, and advanced security controls.

**Core Services:**
- `ChatService` - Main orchestrator for AI conversations and tool execution loops
- `OpenAIService` - HTTP client for OpenAI-compatible APIs with streaming support
- `ToolsService` - Comprehensive tool registry with 20+ tools for file system, terminal, web, and memory operations
- `MemoryService` - Persistent and temporary memory system for context retention
- `ChatViewProvider` - WebView container following VS Code's patterns
- `ChangeTrackingService` - Advanced file change tracking with intelligent merging and accept/reject functionality
- `LoggingService` - Singleton with raw JSON communication logging
- `SettingsPanel` - Comprehensive settings management with tabbed interface

## Terminal Security System (NEW)
**CRITICAL**: All terminal commands now require explicit user approval before execution:

### Terminal Execution Security
- **User approval required** for all terminal commands
- **Auto-approval whitelist** - Commands in user's whitelist execute immediately
- **Complex command parsing** - Handles &&, ||, |, ;, & operators correctly
- **All-or-nothing approval** - For complex commands, ALL sub-commands must be whitelisted
- **Modal dialog** shows command details before execution (for non-whitelisted commands)
- **Workspace root only** - Commands always execute in workspace root directory
- **No directory changes** - Prevents LLM from changing terminal's working directory
- **Timeout mechanism** for approval requests (5 minutes)
- **Detailed logging** for debugging and security audit

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
  "allowedTools": ["read_file", "write_file", "modify_lines", "list_files", "get_file_size", 
                   "execute_terminal", "create_folder", "patch_file", "rename_file", 
                   "search_in_project", "search_in_path", "memory_store", "memory_retrieve_by_lines",
                   "memory_retrieve_data", "memory_delete", "memory_search", "memory_list", "memory_export"],
  "systemMessage": "You are an expert programming assistant...",
  "temperature": 0.1
}
```

**Available Tools (20+ tools):**
**File Operations:**
- `read_file` - Read file content with line range support and character limits
- `write_file` - Write or append to files (integrates with change tracking)
- `modify_lines` - Universal line modification: insert, delete, or replace lines with multiple targeting options
- `patch_file` - Apply text diffs without full file rewrites (integrates with change tracking)
- `list_files` - Directory listing with recursive option and filtering
- `get_file_size` - Get file size in lines and bytes
- `create_folder` - Create directories with recursive option (Coder mode)
- `rename_file` - Rename/move files and folders (Coder mode)

**Search & Discovery:**
- `search_in_project` - Search across VS Code project files (available in all modes)
- `search_in_path` - Search within specific paths and directories

**Terminal Operations:**
- `execute_terminal` - Run terminal commands with user approval system and timeout

**Web & Content:**
- `read_webpage_as_html` - Fetch raw HTML content from webpages (Ask/Architect modes)
- `read_webpage_as_markdown` - Fetch and convert webpage content to markdown (Ask/Architect modes)
- `read_pdf` - Extract text from PDF files (Ask/Architect modes)

**Memory System (7 tools):**
- `memory_store` - Store data with metadata (categories, tags, priority, etc.)
- `memory_retrieve_by_lines` - Retrieve content by line ranges with character limits
- `memory_retrieve_data` - Retrieve content by character offset and length
- `memory_delete` - Delete memory entries by key
- `memory_search` - Advanced search with pattern matching, filters, and sorting
- `memory_list` - List memory entries with enhanced metadata overview including line counts, sizes, and content statistics
- `memory_export` - Export memory entries to files

### Change Tracking System
**Critical:** All file modification tools integrate with advanced change tracking:
- **ChangeTrackingService** - Tracks all file modifications with before/after content
- **ChangeAwareBaseTool** - Base class that all file tools inherit from
- **Smart Merging** - Adjacent/overlapping changes merge automatically, distant changes remain separate
- **Accept/Reject** - Users can selectively accept or reject individual changes
- **Visual Indicators** - Inline decorations and code lens show pending changes only
- **Backup System** - Automatic backups enable safe rollback of rejected changes
- **Persistence** - Changes survive VS Code restarts
- **Real-time Updates** - Changes appear immediately in editor with visual feedback

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

### Memory System (NEW)
**Critical:** Advanced persistent memory system with metadata and search capabilities:
- **Two Memory Types**: Temporary (RAM-only) and Project (file-based persistence)
- **Metadata Support**: Categories, tags, priority, descriptions, access tracking
- **Search Capabilities**: Pattern matching, filters, pagination, sorting
- **Safety Limits**: Configurable character/line limits with auto-safety for large values
- **Export/Import**: Memory entries can be exported to files for backup and sharing

**Memory Tools:**
- `memory_store` - Store values with rich metadata (categories, tags, priority, etc.)
- `memory_retrieve_by_lines` - Retrieve by line ranges for large content
- `memory_retrieve_data` - Retrieve by character offset/length for precision
- `memory_search` - Advanced search with filters, patterns, and metadata
- `memory_list` - List entries with metadata overview and pagination
- `memory_delete` - Delete entries by key
- `memory_export` - Export entries to files

**Configuration:**
```json
{
  "codingagent.memory.enableProjectMemory": false,  // Must be enabled for persistent storage
  "codingagent.memory.maxLines": 100,               // Max lines per retrieve operation
  "codingagent.memory.maxChars": 10000,             // Max characters per retrieve operation
  "codingagent.memory.autoSafetyLimit": 5000,       // Auto-applied safety limit
  "codingagent.memory.largeValueThreshold": 10000   // Threshold for "large" values
}
```

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

### Streaming Architecture
**Critical:** The extension implements streaming responses with tool call interleaving:
- `processStreamingMessage()` handles incremental content updates
- Tool calls can interrupt streaming but responses continue seamlessly
- Frontend tracks streaming state via `streamingMessages Map`
- Use `StreamingUpdate` interface for all streaming communications

### Iteration Control System (NEW)
**Critical:** Advanced iteration control with user confirmation dialogs:
- **Configurable threshold** - Users can set iteration limit (1-100) in Settings GUI
- **Interactive dialogs** - Replace hard limits with user-choice dialogs
- **Batch-based approval** - Ask once per threshold batch, not every iteration
- **System notices** - Notify when corrections are applied or iterations continue
- **Correction overlay** - Modal correction dialog overlays chat input area

```typescript
// Configuration setting
"codingagent.iterationThreshold": {
  "type": "number",
  "default": 10,
  "minimum": 1,
  "maximum": 100,
  "description": "Number of tool iterations before asking user for continuation"
}
```

**Key Features:**
- `allowedIterations` tracks current threshold dynamically
- `getIterationThreshold()` reads user setting from VS Code configuration
- `continueIterations()` adds another batch of iterations based on current threshold
- Interactive dialog shows iteration count and offers Continue/Stop options
- System notices inform user when corrections are applied or iterations continue

## Version History & Updates

### Current Version: 0.0.3 (2025-08-17)
**Key Changes:**
- **Tool Consolidation**: Merged `insert_lines`, `delete_lines`, and `replace_lines` into unified `modify_lines` tool
- **Memory System**: Added comprehensive memory system with 7 memory tools and metadata support
- **Terminal Security**: Implemented user approval system for all terminal commands with auto-approve whitelist
- **Change Tracking**: Enhanced with intelligent merging and real-time visual feedback
- **Settings Panel**: Added comprehensive tabbed settings interface

### Previous Versions:
- **0.0.2**: Advanced change tracking system, new file manipulation tools
- **0.0.1**: Initial release with basic AI chat functionality and core tools

### Package Status:
- Current VSIX: `codding-agent-0.0.1.vsix` (117.67 KB)
- Repository: `https://github.com/SFENCE-SOFTWARE/VSCode/CodingAgent.git`
- Extension ID: `codding-agent`
- Display Name: `CodingAgent`

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
**Critical:** The extension implements streaming responses with tool call interleaving:
- `processStreamingMessage()` handles incremental content updates
- Tool calls can interrupt streaming but responses continue seamlessly
- Frontend tracks streaming state via `streamingMessages Map`
- Use `StreamingUpdate` interface for all streaming communications

### Iteration Control System (NEW)
**Critical:** Advanced iteration control with user confirmation dialogs:
- **Configurable threshold** - Users can set iteration limit (1-100) in Settings GUI
- **Interactive dialogs** - Replace hard limits with user-choice dialogs
- **Batch-based approval** - Ask once per threshold batch, not every iteration
- **System notices** - Notify when corrections are applied or iterations continue
- **Correction overlay** - Modal correction dialog overlays chat input area

```typescript
// Configuration setting
"codingagent.iterationThreshold": {
  "type": "number",
  "default": 10,
  "minimum": 1,
  "maximum": 100,
  "description": "Number of tool iterations before asking user for continuation"
}
```

**Key Features:**
- `allowedIterations` tracks current threshold dynamically
- `getIterationThreshold()` reads user setting from VS Code configuration
- `continueIterations()` adds another batch of iterations based on current threshold
- Interactive dialog shows iteration count and offers Continue/Stop options
- System notices inform user when corrections are applied or iterations continue

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
**Log Mode:** Enable raw JSON logging for LLM communication debugging:
```json
"codingagent.logging.logMode": true
```
Files written to `.codingagent/logs/openai-raw-json.log` with full request/response cycles.

**WebView Communication:** Debug frontend-backend communication via:
```javascript
// In media/chat.js - all vscode.postMessage calls
vscode.postMessage({ type: 'sendMessage', message: content });
```

## Advanced Features (NEW)

### Tool Call Correction System
**Interactive Correction Workflow:**
- **Correction Dialog** - Modal overlay that appears over chat input during corrections
- **Last Tool Call Correction** - Users can correct the most recent AI tool call
- **System Notices** - Automatic notifications when corrections are applied
- **Seamless Integration** - Corrections integrate with streaming and iteration systems

```typescript
// Backend correction state management
private pendingCorrection: string | null = null;
private isWaitingForCorrection: boolean = false;

// Frontend correction dialog
function showCorrectionDialog() {
  // Modal overlay replaces input area
  // User provides correction text
  // Sends correction to backend
}
```

### Progressive Tool Iteration
**Smart Iteration Management:**
- **Dynamic Thresholds** - User-configurable iteration limits via Settings GUI
- **Batch Processing** - Ask for continuation once per batch, not per iteration
- **Visual Progress** - Clear indication of iteration count and progress
- **User Control** - Continue/Stop options with clear consequences

**Implementation Pattern:**
```typescript
// Dynamic threshold reading
private getIterationThreshold(): number {
  const config = vscode.workspace.getConfiguration('codingagent');
  return config.get('iterationThreshold', 10);
}

// Batch-based continuation
continueIterations(): void {
  const threshold = this.getIterationThreshold();
  this.allowedIterations += threshold; // Add another batch
}
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

### Chat UI Enhancements (NEW)
**Modern Chat Interface:**
- **Icon-only buttons** - Clean interface with tooltips for accessibility
- **Always-visible controls** - Buttons positioned below input, never hidden
- **Correction overlay** - Modal dialog overlays input area during corrections
- **System notices** - Integrated notices for corrections and iteration events
- **Interactive dialogs** - Modal dialogs for iteration control and user choices

**Button Layout:**
```html
<!-- Icon-only buttons with specific order -->
<button id="sendBtn" title="Send Message">📤</button>
<button id="interruptBtn" title="Interrupt">⏹️</button>
<button id="correctBtn" title="Correct Last Tool Call">✏️</button>
<button id="clearBtn" title="Clear Chat">🗑️</button>
```

**CSS Architecture:**
- Responsive design with flexbox layouts
- Icon-only buttons with hover states
- Modal overlays with backdrop blur
- Consistent spacing and typography

### File Structure Logic
- `src/` - TypeScript source following VS Code patterns
- `src/tools/` - Individual tool implementations following ChangeAwareBaseTool interface
- `src/changeTrackingService.ts` - Core change tracking and merging logic
- `src/changeCodeLensProvider.ts` - Code lens integration for Accept/Reject
- `src/inlineChangeDecorationService.ts` - Visual change indicators
- `src/backupManager.ts` - File backup and restoration system
- `src/settingsPanel.ts` - Comprehensive settings management with tabbed interface
- `src/chatService.ts` - Enhanced with iteration control and correction systems
- `tests/` - Comprehensive test suite (56+ tests) including change tracking scenarios
- `media/` - WebView assets (HTML/CSS/JS, not bundled)
  - `media/chat.js` - Enhanced chat UI with correction dialogs and iteration control
  - `media/chat.css` - Modern responsive design with modal overlays
  - `media/settings.js` - Settings panel frontend logic with live validation
  - `media/settings.css` - Settings panel styling with tabbed navigation
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

### OpenAI API Contract
Uses **OpenAI-compatible API** (`/v1/chat/completions`) format for maximum compatibility:
- Supports streaming via Server-Sent Events
- Tool calls follow OpenAI function calling spec
- Works with Ollama (`/api/tags` endpoint for model names), OpenAI, Azure OpenAI, and other compatible providers

### VS Code Extension API Usage
- **WebView Views** for activity bar integration
- **Configuration API** for reactive settings
- **Command registration** with categories for Command Palette
- **Status bar items** for quick access to current state

### Settings Panel (NEW)
**Comprehensive Settings Management:**
- **Tabbed interface** - Connection, Modes, Behavior, Tools, Logging, Advanced sections
- **Live validation** - Real-time configuration validation and feedback
- **Modal editors** - Rich modal dialogs for complex configuration editing
- **Export/Import** - Configuration backup and restore functionality

**Key Settings:**
- `codingagent.iterationThreshold` - Configurable tool iteration limit (1-100)
- `codingagent.tools.autoApproveCommands` - Terminal command whitelist
- `codingagent.logging.logMode` - Raw JSON communication logging
- `codingagent.enableStreaming` - Streaming response control
- `codingagent.showThinking` - Model reasoning display

**Settings Panel Architecture:**
```typescript
// Settings panel with tabbed navigation
class SettingsPanel {
  private _sendConfiguration() {
    // Sends all current configuration to frontend
    const config = vscode.workspace.getConfiguration('codingagent');
    // Include all new settings like iterationThreshold
  }
  
  private _updateConfiguration(configUpdate: any) {
    // Updates VS Code configuration with user changes
    // Validates and applies configuration updates
  }
}
```

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

## Latest Features Summary (2025-08-22)

### 🔐 Security Enhancement: Terminal Approval System
- **All terminal commands require explicit user approval** before execution
- **Auto-approval whitelist** for safe commands like `ls`, `pwd`, `git status`
- **Complex command parsing** handles &&, ||, |, ;, & operators correctly
- **5-minute timeout** for approval requests with graceful error handling
- **Modal approval dialog** shows command details and working directory

### 🧠 Memory System Integration
- **7 comprehensive memory tools** with metadata support (categories, tags, priority)
- **Two storage types**: Temporary (RAM) and Project (persistent file-based)
- **Advanced search capabilities** with pattern matching and filtering
- **Export functionality** to save memory content to files
- **Configurable safety limits** for large content handling

### 📝 Enhanced Change Tracking
- **Real-time visual feedback** for all file modifications
- **Smart change merging**: Adjacent changes combine, distant changes stay separate
- **Accept/Reject individual changes** with clean UI (no clutter after resolution)
- **Automatic backup system** enables safe rollback of rejected changes
- **Persistence across sessions** - changes survive VS Code restarts

### 🔧 Unified Tool System
- **`modify_lines` tool** consolidates insert/delete/replace line operations
- **20+ tools available** across file, search, terminal, web, and memory operations
- **Change-aware tools** automatically integrate with tracking system
- **Mode-based tool access** - different agent modes have different tool permissions

### ⚙️ Advanced Settings Management
- **Tabbed settings interface** with Connection, Modes, Behavior, Tools, Logging sections
- **Live validation** and real-time configuration updates
- **Iteration threshold control** (1-100) for managing AI tool execution loops
- **Auto-approve command whitelist** for terminal security
- **Memory system configuration** with safety limits

### 🎨 Modern UI Enhancements
- **Icon-only buttons** with tooltips for clean interface
- **Modal correction dialogs** for interactive AI guidance adjustment
- **Iteration control dialogs** for managing long AI tool execution sequences
- **System notices** for user feedback on corrections and iterations
- **Responsive design** with consistent VS Code styling
