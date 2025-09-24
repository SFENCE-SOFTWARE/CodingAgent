# CodingAgent Extension - AI Coding Guide

This is a comprehensive VS Code extension that provides GitHub Copilot Chat-like functionality using any OpenAI-compatible LLM backend. The extension features an advanced multi-agent system, sophisticated planning/orchestrator capabilities, intelligent change tracking, automated testing infrastructure, and robust tool-based interactions.

## Current Version: 0.1.0 (2025-01-XX)

**Architecture Evolution:**
- **Multi-Agent System**: Coder, Ask, and Architect modes with specialized tools and capabilities
- **Planning & Orchestration**: Advanced project planning with step-by-step execution, dependency management, and automated orchestration
- **Algorithm Engine**: Extensible JavaScript-based algorithm execution framework with context isolation
- **Testing Infrastructure**: Comprehensive testing system including orchestrator test runners and mock services
- **Change Management**: Visual change tracking with accept/reject, intelligent merging, and backup restoration
- **Enhanced Tools**: 15+ specialized tools for file operations, terminal commands, web content, and project management

## Architecture Overview

The extension follows a modular service architecture with multiple agents, each specialized for different types of tasks:

**Core Services:**
- `ChatService` - Main conversation orchestrator with tool execution loops
- `OpenAIService` - OpenAI-compatible API client with streaming support  
- `ToolsService` - Tool registry and execution engine
- `PlanningService` - Advanced project planning and task management
- `AlgorithmEngine` - Sandboxed algorithm execution framework
- `ChangeTrackingService` - File modification tracking and management
- `PlanContextManager` - Multi-plan context and state management
- `SettingsPanel` - Comprehensive configuration interface

## Agent Mode System

The extension operates in three specialized modes, each with distinct capabilities:

### 🛠️ Coder Mode
**Purpose**: Expert programming assistant for development tasks
**System Message**: "You are an expert programming assistant..."
**Temperature**: 0.1 (focused, deterministic responses)

**Available Tools:**
- `read_file` - Read file content with line range support
- `write_file` - Write or append to files with change tracking
- `modify_lines` - Universal line modification (insert, delete, replace)
- `patch_file` - Apply text diffs without full file rewrites
- `list_files` - Directory listing with recursive options
- `get_file_size` - File size information
- `execute_terminal` - Terminal command execution
- `create_folder` - Directory creation
- `rename_file` - File and folder renaming/moving
- `search_in_project` - Project-wide content search
- `search_in_path` - Path-specific content search

**Use Cases**: Code generation, debugging, refactoring, file manipulation, project exploration

### ❓ Ask Mode  
**Purpose**: General Q&A and research assistant
**System Message**: "You are a helpful assistant..."
**Temperature**: 0.3 (balanced creativity/accuracy)

**Available Tools:**
- `read_file` - File reading for context
- `read_webpage_as_html` - Web content fetching (raw HTML)
- `read_webpage_as_markdown` - Web content as markdown
- `read_pdf` - PDF text extraction
- `search_in_project` - Project content search

**Use Cases**: Documentation lookup, general questions, web research, content analysis

### 🏗️ Architect Mode
**Purpose**: Software architecture and system design consultant  
**System Message**: "You are a software architecture consultant..."
**Temperature**: 0.2 (structured, analytical responses)

**Available Tools:**
- `read_file` - Architecture document analysis
- `list_files` - Project structure exploration  
- `read_webpage_as_html` - External documentation
- `read_webpage_as_markdown` - Design pattern research
- `read_pdf` - Technical specification analysis
- `search_in_project` - Architecture pattern discovery

**Use Cases**: System design, architecture review, technical documentation, pattern analysis

## Planning & Orchestration System

### Advanced Planning Service

The extension includes a sophisticated planning system for complex, multi-step projects:

**Plan Structure:**
- **Plan Points**: Individual tasks with dependencies, status tracking, and validation
- **Dependency Management**: Points can depend on completion of other points
- **Status Tracking**: Implementation, review, and testing status for each point
- **Language Detection**: Automatic language detection and translation support
- **Activity Logging**: Comprehensive audit trail of plan modifications

**Key Features:**
```typescript
interface Plan {
  id: string;
  name: string; 
  shortDescription: string;
  longDescription: string;
  points: PlanPoint[];
  reviewChecklist: string[];
  logs: PlanLogEntry[];
  detectedLanguage?: string;
  originalRequest?: string;
  architecture?: string;
}

interface PlanPoint {
  id: string;
  shortName: string;
  detailedDescription: string;
  reviewInstructions: string;
  testingInstructions: string;
  status: string;
  dependsOn: string[];
  implemented: boolean;
  reviewed: boolean;
  tested: boolean;
  needRework: boolean;
}
```

### Orchestrator Algorithm System

**Algorithm Engine**: JavaScript-based algorithm execution with sandboxed context:

```typescript
interface AlgorithmContext {
  mode: string;
  userMessage: string;
  sendResponse: (message: string) => void;
  sendToLLM: (message: string) => Promise<string>;
  tools: {
    execute: (toolName: string, args: any) => Promise<ToolResult>;
  };
  planningService: {
    showPlan: (planId: string) => PlanResult;
    createPlan: (...) => CreateResult;
    evaluatePlanCompletion: (planId: string) => EvaluationResult;
  };
}
```

**Available Algorithms:**
- `orchestrator.js` - Main orchestration logic for plan execution
- `categorization.js` - Request categorization and routing
- Custom algorithms can be added to `src/algorithms/` directory

## Tool System Architecture

### Tool Execution Pattern

All tools follow a consistent interface pattern:

```typescript
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
}
```

### Change-Aware Tool System

File modification tools integrate with advanced change tracking:

```typescript
// Base class for all file modification tools
abstract class ChangeAwareBaseTool {
  abstract executeOperation(args: any, workspaceRoot: string): Promise<ToolResult>;
  
  // Automatic change tracking integration
  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    // Pre-execution state capture
    const result = await this.executeOperation(args, workspaceRoot);
    // Post-execution change tracking
    return result;
  }
}
```

**Change Tracking Features:**
- **Visual Indicators**: Inline decorations show added, modified, deleted lines
- **Accept/Reject**: Individual change management with code lens actions
- **Smart Merging**: Adjacent changes merge automatically, distant changes remain separate  
- **Backup System**: Automatic backups enable safe rollback
- **Persistence**: Changes survive VS Code restarts

### Core Tools Reference

**File Operations:**
- `read_file(path, start_line?, end_line?, max_bytes?)` - Read file content with optional range
- `write_file(path, content, append?)` - Write or append to files
- `modify_lines(path, operation, content?, line_number?, ...)` - Universal line modification
- `patch_file(path, old_text, new_text)` - Apply text patches
- `list_files(path, recursive?)` - Directory listing
- `get_file_size(path)` - File size in lines and bytes
- `create_folder(path)` - Create directories
- `rename_file(old_path, new_path)` - Rename/move files

**Search & Discovery:**
- `search_in_project(query, file_pattern?, max_results?)` - Project-wide search
- `search_in_path(path, query, file_pattern?, max_results?)` - Path-specific search

**Terminal:**
- `execute_terminal(command, cwd?, newTerminal?)` - Run terminal commands

**Web & Content:**
- `read_webpage_as_html(url, max_length?)` - Fetch raw HTML content
- `read_webpage_as_markdown(url, max_length?)` - Fetch as markdown
- `read_pdf(path, max_pages?)` - Extract PDF text

## Testing Infrastructure

### Orchestrator Testing System

The extension includes comprehensive testing infrastructure for validating orchestrator algorithms:

**Components:**
- `MockLLMService` - Simulates LLM responses for testing
- `OrchestratorTestRunner` - Executes orchestrator tests with mock context
- `test-orchestrator.js` - CLI script for running orchestrator tests
- Test configurations in `test-configs/` directory

**Usage Pattern:**
```bash
# Run orchestrator test with specific configuration
node scripts/test-orchestrator.js test-configs/basic-plan.json

# Output: Workflow trace and execution report
```

**Test Configuration Format:**
```json
{
  "testName": "Basic Plan Creation",
  "description": "Test plan creation workflow",
  "maxIterations": 10,
  "planName": "TestPlan",
  "planDescription": "Test plan for validation",
  "mockLLM": {
    "responses": [
      {
        "trigger": "create.*plan",
        "response": "I'll create the plan...",
        "toolCalls": [...] 
      }
    ]
  }
}
```

### Testing Best Practices

**Mock LLM Responses**: Create realistic LLM simulation for orchestrator testing:
```typescript
const mockConfig: MockLLMConfig = {
  responses: [
    {
      trigger: "categorization request",
      response: "Request categorized as plan creation",
      toolCalls: [{ toolName: "createPlan", args: {...} }]
    }
  ]
};
```

**Workflow Validation**: Test complex multi-step workflows:
- Plan creation and validation
- Step-by-step execution with dependencies
- Error handling and recovery
- LLM interaction simulation

## Development Workflows

### Build & Development
```bash
npm run compile    # One-time TypeScript compilation
npm run watch      # Watch mode for development
npm test          # Run test suite
```

### Testing Extensions
- Press F5 in VS Code to launch Extension Development Host
- Use Command Palette: "CodingAgent: Open Chat"
- Status bar shows current mode/model

### Algorithm Development
1. Create algorithm file in `src/algorithms/`
2. Implement algorithm logic with AlgorithmContext
3. Add to algorithm registry
4. Create test configuration
5. Run orchestrator tests

### Debugging Patterns

**Orchestrator Testing**: Use test runner for algorithm validation:
```bash
node scripts/test-orchestrator.js test-configs/your-test.json
```

**Change Tracking**: Monitor file modifications:
```typescript
changeTracker.setChangeUpdateCallback(async (filePath, changeType) => {
  console.log(`Change ${changeType} for ${filePath}`);
});
```

**WebView Communication**: Debug frontend-backend communication:
```javascript
// In media/chat.js
vscode.postMessage({ type: 'sendMessage', message: content });
```

## Critical Code Patterns

### Agent Mode Configuration
```typescript
// In package.json - defines agent capabilities per mode
"Coder": {
  "systemMessage": "You are an expert programming assistant...",
  "allowedTools": ["read_file", "write_file", "modify_lines", ...],
  "temperature": 0.1
}
```

### Tool Execution Loop
```typescript
// In chatService.ts - handles recursive tool calls
while (toolCalls.length > 0 && iterationCount < maxIterations) {
  const results = await this.toolsService.executeTools(toolCalls);
  const followUpResponse = await this.openai.sendChat(followUpRequest);
  // Continue loop if more tool calls needed
}
```

### Algorithm Context Pattern
```typescript
// Algorithm implementation pattern
async function algorithmLogic(context: AlgorithmContext) {
  context.console.log('Starting algorithm execution');
  
  const response = await context.sendToLLM('Analyze this request');
  
  const toolResult = await context.tools.execute('read_file', { 
    path: 'src/example.ts' 
  });
  
  context.sendResponse('Algorithm completed successfully');
}
```

### Change Tracking Integration
```typescript
// File tools automatically track changes
export class WriteFileTool extends ChangeAwareBaseTool {
  protected async executeOperation(args: any, workspaceRoot: string) {
    // Tool implementation - tracking happens automatically
    const filePath = this.getFilePath(args, workspaceRoot);
    await fs.promises.writeFile(filePath, args.content);
    return { success: true, content: 'File written successfully' };
  }
}
```

## Configuration Management

### Settings Schema
```json
{
  "codingagent.host": "localhost",
  "codingagent.port": 11434,
  "codingagent.apiKey": "", // Optional for authenticated servers
  "codingagent.currentMode": "Coder",
  "codingagent.currentModel": "llama3:8b",
  "codingagent.showThinking": true,
  "codingagent.enableChangeTracking": true
}
```

### Mode Customization
```json
{
  "codingagent.modes": {
    "CustomMode": {
      "systemMessage": "Your custom system prompt",
      "allowedTools": ["read_file", "write_file"],
      "temperature": 0.2,
      "fallbackMessage": "Custom mode activated"
    }
  }
}
```

## File Structure Logic

```
src/
├── extension.ts              # Main extension entry point
├── chatService.ts            # Core chat orchestration  
├── openai_html_api.ts        # OpenAI-compatible API client
├── tools.ts                  # Tool registry and service
├── planningService.ts        # Advanced planning system
├── algorithmEngine.ts        # Algorithm execution framework
├── changeTrackingService.ts  # File modification tracking
├── settingsPanel.ts          # Configuration management
├── planContextManager.ts     # Plan context management
├── mockLLMService.ts         # Testing mock service
├── orchestratorTestRunner.ts # Test execution framework
├── types.ts                  # TypeScript interfaces
├── algorithms/               # JavaScript algorithm files
├── tools/                    # Individual tool implementations
└── tests/                    # Comprehensive test suite

media/                        # WebView frontend assets
├── chat.js                   # Chat interface logic
├── chat.css                  # Chat styling
├── settings.js               # Settings panel frontend
└── settings.css              # Settings styling

scripts/                      # CLI and utility scripts
├── test-orchestrator.js      # Orchestrator test runner
└── ...

test-configs/                 # Test configuration files
├── basic-plan.json          # Basic planning test
├── complex-workflow.json    # Multi-step workflow test
└── ...
```

## Quick Start for AI Agents

1. **Understand the mode system** - each mode (Coder/Ask/Architect) has different tool access and specialization
2. **Follow the streaming pattern** - use proper message handling for real-time responses  
3. **Respect tool execution loops** - AI can make multiple sequential tool calls
4. **Use workspace-relative paths** - all file operations are workspace-scoped
5. **Leverage the planning system** - for complex multi-step tasks, create plans with dependencies
6. **Test with orchestrator** - use the test runner to validate complex workflows
7. **Integrate change tracking** - all file modifications are tracked and manageable

**Key files to understand first:**
- `chatService.ts` (conversation orchestration)
- `planningService.ts` (project planning)
- `algorithmEngine.ts` (algorithm execution)
- `types.ts` (core interfaces)
- `package.json` (configuration schema)

## Integration Points

### OpenAI API Compatibility
- Uses standard `/v1/chat/completions` endpoint format
- Supports streaming via Server-Sent Events
- Tool calls follow OpenAI function calling specification  
- Compatible with Ollama, llama.cpp, vLLM, LocalAI, OpenAI, Azure OpenAI

### VS Code Extension API
- **WebView Views** for activity bar integration
- **Configuration API** for reactive settings
- **Command registration** with categories
- **Status bar integration** for quick access
- **CodeLens provider** for change management

### External Dependencies
- **Node.js built-ins** - `fs`, `path`, `child_process`
- **TypeScript strict mode** with Node16 module resolution
- **No external bundling** - pure Node.js/VS Code API usage

## Best Practices for AI Agents

### Tool Usage
- **Read before writing** - always understand existing code structure
- **Use appropriate modes** - match agent mode to task type
- **Leverage planning** - break complex tasks into managed plans
- **Test workflows** - use orchestrator testing for validation
- **Manage changes** - utilize change tracking for safe modifications

### Error Handling
```typescript
// Standard error handling pattern across services
try {
  const result = await operation();
  return { success: true, content: result };
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return { success: false, error: errorMsg };
}
```

### Context Management
- **Plan Context**: Use `PlanContextManager` for multi-plan workflows
- **Algorithm Context**: Leverage sandboxed context for algorithm execution
- **Change Context**: Track all file modifications with restore capabilities

This guide provides comprehensive coverage of the CodingAgent extension architecture, enabling AI coding agents to work effectively within the system's sophisticated multi-agent, planning-oriented framework.
