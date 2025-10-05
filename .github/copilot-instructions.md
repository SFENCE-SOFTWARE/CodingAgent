# CodingAgent Extension - AI Coding Guide

This is a comprehensive VS Code extension that provides GitHub Copilot Chat-like functionality using any OpenAI-compatible LLM backend. The extension features an advanced multi-agent system, sophisticated planning/orchestrator capabilities, intelligent change tracking, automated testing infrastructure, and robust tool-based interactions.

## Current Version: 0.1.0 (October 2025)

**Architecture Evolution:**
- **Multi-Agent System**: Coder, Ask, and Architect modes with specialized tools and capabilities
- **Planning & Orchestration**: Advanced project planning with step-by-step execution, dependency management, and automated orchestration
- **Change Management**: Visual change tracking with accept/reject, intelligent merging, and backup restoration
- **Terminal Approval System**: Interactive command approval with auto-approve lists and real-time UI feedback
- **Algorithm Engine**: Extensible JavaScript-based algorithm execution framework with context isolation
- **Testing Infrastructure**: Comprehensive testing system including orchestrator test runners and mock services
- **Enhanced Tools**: 15+ specialized tools for file operations, terminal commands, web content, and project management

## 🎯 Quick Start for AI Agents

**Essential Commands:**
```bash
npm run compile    # TypeScript compilation
npm run watch      # Development with auto-compile
npm test          # Full test suite (259 tests)
npm test -- --grep "pattern"  # Filtered tests
```

**Key files to understand first:**
- `src/planningService.ts` - Complex plan creation workflow with checklist progression
- `src/changeTrackingService.ts` - Visual change management with accept/reject
- `src/tools/executeTerminal.ts` - Terminal approval system with security controls
- `src/chatService.ts` - Tool execution loops and streaming
- `src/algorithmEngine.ts` - Sandboxed JavaScript algorithm execution

## Architecture Overview

### Core Services Architecture

```typescript
// Service communication pattern
ChatService -> ToolsService -> [Individual Tools]
     ↓             ↓
PlanningService    ChangeTrackingService
     ↓             ↓
AlgorithmEngine    InlineDecorationService
```

**Critical Service Dependencies:**
- `ChatService` - Main conversation orchestrator with tool execution loops
- `PlanningService` - Advanced project planning with **checklist-based workflows**
- `ChangeTrackingService` - File modification tracking with **visual accept/reject**
- `ToolsService` - Tool registry and execution engine with **terminal approval**
- `AlgorithmEngine` - **Sandboxed JavaScript execution** for orchestrator algorithms

## 🔑 Critical Workflow Patterns

### 1. Plan Creation Workflow (MOST COMPLEX)

**The planning system uses a sophisticated checklist progression pattern:**

```typescript
// Key pattern: doneCallback vs completionCallback
const result = planningService.evaluatePlanCreation(planId, request);

// CRITICAL: Use doneCallback to progress through checklist items
if (result.result?.doneCallback) {
  result.result.doneCallback(true, 'Completed step');
}

// NOT setPlanReviewed() - that's for final plan review only
```

**Checklist Progression Logic:**
1. `descriptionsUpdated` → `descriptionsReviewed` (2-item checklist)
2. `architectureCreated` → `architectureReviewed` (2-item checklist) 
3. `pointsCreated` → Plan complete

**Essential Files:**
- `src/planningService.ts:1874` - Description review checklist logic
- `src/planningService.ts:1893` - Checklist item removal on doneCallback
- `tests/newPlanCreationWorkflow.test.ts` - Comprehensive workflow tests

### 2. Change Tracking System (VISUAL)

**Change tracking provides visual diff management:**

```typescript
// File tools automatically integrate with change tracking
export class WriteFileTool extends ChangeAwareBaseTool {
  protected async executeOperation(args: any, workspaceRoot: string) {
    // Implementation - tracking happens automatically
    const filePath = this.getFilePath(args, workspaceRoot);
    await fs.promises.writeFile(filePath, args.content);
    return { success: true };
  }
}
```

**Visual Features:**
- **Inline decorations** with accept/reject CodeLens actions
- **Smart merging** - adjacent changes auto-merge, distant changes stay separate
- **Backup system** with automatic restoration on reject
- **Persistence** across VS Code sessions

**Key Files:**
- `src/inlineChangeDecorationService.ts` - Visual decorations and CodeLens
- `src/changeTrackingService.ts:269` - Accept/reject logic with backup restoration

### 3. Terminal Approval System (SECURITY)

**Terminal commands require user approval with sophisticated auto-approve:**

```typescript
// Auto-approve configuration pattern
function isCommandAutoApproved(command: string): boolean {
  const config = vscode.workspace.getConfiguration('codingagent');
  const autoApproveCommands = config.get<string>('tools.autoApproveCommands', '');
  // Parse comma-separated list, check each command component
}
```

**Approval Flow:**
1. Tool execution → approval request → UI panel
2. User approve/reject → command execution
3. Output capture with both stdout/stderr

**Key Files:**
- `src/tools/executeTerminal.ts:47` - Auto-approve logic
- `media/chat.js:1772` - Terminal approval UI panel

## Agent Mode System

The extension operates in three specialized modes with **distinct tool access**:

### 🛠️ Coder Mode (Development)
- **Tools**: File manipulation, terminal, search, planning
- **Pattern**: Most comprehensive toolset for development tasks
- **Use**: Code generation, debugging, refactoring, project exploration

### ❓ Ask Mode (Research)  
- **Tools**: File reading, web content, search (limited subset)
- **Pattern**: Read-only operations with web research capabilities
- **Use**: Documentation lookup, questions, content analysis

### 🏗️ Architect Mode (Design)
- **Tools**: File reading, structure analysis, web research, PDF reading
- **Pattern**: Analysis and design-focused toolset
- **Use**: System design, architecture review, documentation

**Mode Configuration (package.json):**
```json
"codingagent.modes.Coder": {
  "systemMessage": "You are an expert programming assistant...",
  "allowedTools": ["read_file", "write_file", "modify_lines", ...],
  "temperature": 0.1
}
```

## Testing Infrastructure

### Test Execution Patterns

```bash
# Core test patterns
npm test -- --grep "planningService"     # Planning tests
npm test -- --grep "changeTracking"      # Change management tests  
npm test -- --grep "orchestrator"        # Algorithm tests
npm test -- --grep "terminal"            # Terminal approval tests
```

### Orchestrator Testing System

**Advanced algorithm testing with mock LLM:**

```bash
# Run orchestrator tests with configuration
node scripts/test-orchestrator.js test-configs/basic-plan.json
```

**Test Configuration Pattern:**
```json
{
  "testName": "Plan Creation Workflow",
  "maxIterations": 10,
  "planName": "TestPlan", 
  "mockLLM": {
    "responses": [
      {
        "trigger": "create.*plan",
        "response": "I'll create the plan...",
        "toolCalls": [{"toolName": "createPlan", "args": {...}}]
      }
    ]
  }
}
```

**Key Files:**
- `src/orchestratorTestRunner.ts` - Mock LLM test execution
- `src/mockLLMService.ts` - LLM response simulation
- `test-configs/` - Pre-configured test scenarios

## 🔧 Tool System Architecture

### Tool Execution Loop Pattern

```typescript
// ChatService tool execution pattern
while (toolCalls.length > 0 && iterationCount < maxIterations) {
  const results = await this.toolsService.executeTools(toolCalls);
  const followUpResponse = await this.openai.sendChat(followUpRequest);
  // Continue if more tool calls needed
}
```

### Critical Tool Categories

**File Operations:**
- `modify_lines` - **Universal line modification** (insert/delete/replace)
- `write_file` - Write with **automatic change tracking**
- `patch_file` - Apply text diffs without full rewrites

**System Operations:**
- `execute_terminal` - **User approval required** with auto-approve lists
- `list_files` - Directory exploration with recursive options

**Planning Tools:**
- `plan_new` - Create plans with **automatic workflow orchestration**
- `plan_reviewed/plan_need_works` - **Critical for checklist progression**

## Algorithm Engine (ADVANCED)

**Sandboxed JavaScript execution for orchestration:**

```typescript
interface AlgorithmContext {
  sendToLLM: (message: string) => Promise<string>;
  tools: { execute: (name: string, args: any) => Promise<ToolResult> };
  planningService: { evaluatePlanCreation: (...) => Result };
  console: { log/error/warn/info };
  isInterrupted: () => boolean;
}
```

**Built-in Algorithms:**
- `src/algorithms/orchestrator.js` - Main orchestration logic
- `src/algorithms/categorization.js` - Request routing
- Custom algorithms can be added to `src/algorithms/`

## Development Workflows

### Extension Development

```bash
# Development cycle
npm run watch          # Auto-compile TypeScript
# Press F5 → Extension Development Host
# Command Palette: "CodingAgent: Open Chat"
```

### Debugging Patterns

**Planning Workflow Debug:**
```typescript
// Check plan state during debugging
const plan = planningService.showPlan(planId);
console.log('Checklist length:', plan.plan?.creationChecklist?.length);
console.log('Step:', plan.plan?.creationStep);
```

**Change Tracking Debug:**
```typescript
// Monitor change callbacks
changeTracker.setChangeUpdateCallback(async (filePath, changeType) => {
  console.log(`Change ${changeType} for ${filePath}`);
});
```

**Terminal Approval Debug:**
```typescript
// Check auto-approve status
const autoApproved = ExecuteTerminalTool.wouldCommandBeAutoApproved(command);
console.log('Would auto-approve:', autoApproved);
```

## Configuration Management

### Settings Schema (Critical)

```json
{
  "codingagent.host": "localhost",
  "codingagent.port": 11434,
  "codingagent.currentMode": "Coder",
  "codingagent.enableChangeTracking": true,
  "codingagent.tools.autoApproveCommands": "ls,pwd,git status"
}
```

### Plan Creation Configuration

**Checklist Templates:**
```json
{
  "codingagent.plan.creation.checklistDescriptionReview": "* Item 1\n* Item 2",
  "codingagent.plan.creation.callbackDescriptionReview": "plan.reviewed"
}
```

## Integration Points

### VS Code Extension API
- **WebView Views** - Activity bar integration with real-time updates
- **CodeLens Provider** - Accept/reject change actions inline
- **Decoration API** - Visual change indicators
- **Terminal API** - Command execution with approval

### OpenAI API Compatibility
- **Streaming Support** - Real-time response processing
- **Tool Calls** - Function calling specification
- **Compatible Backends**: Ollama, llama.cpp, vLLM, LocalAI, OpenAI

## Error Handling Patterns

### Standard Error Pattern
```typescript
try {
  const result = await operation();
  return { success: true, content: result };
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  return { success: false, error: errorMsg };
}
```

### Planning Workflow Errors
- **Always use showPlan()** instead of direct plan access
- **Check completionCallback** before manual state changes
- **Use doneCallback** for workflow progression, not setPlanReviewed

### Change Tracking Errors
- **Backup restoration** happens automatically on reject
- **File locks** are handled with retry logic
- **Merge conflicts** use intelligent line-level resolution

## Best Practices for AI Agents

### Planning Workflows
1. **Use evaluatePlanCreation** for step-by-step workflow
2. **Always call doneCallback(true)** to progress checklist items
3. **Check showPlan() output** for current state validation
4. **Never manually modify plan.reviewed** during creation workflow

### Change Management
1. **All file tools auto-track changes** - no manual intervention needed
2. **Visual feedback** is automatic through decorations
3. **Accept/reject** works at individual change level
4. **Backup system** ensures safe rollback on any rejection

### Terminal Operations
1. **Auto-approve lists** in settings for safe commands
2. **All commands run in workspace root** regardless of specified cwd
3. **User approval required** for security-sensitive operations
4. **Output capture** includes both stdout and stderr

### Testing & Validation
1. **Use orchestrator tests** for complex workflow validation
2. **Mock LLM responses** for deterministic testing
3. **Test configurations** enable repeatable scenarios
4. **Workflow tracing** provides detailed execution reports

This guide enables AI coding agents to work effectively within the CodingAgent extension's sophisticated multi-agent, planning-oriented framework with advanced change tracking and approval systems.

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
