// src/types.ts

export interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface ModelList {
  models: ModelInfo[];
}

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  reasoning?: string;
  reasoning_content?: string; // Alternative field name for thinking/reasoning
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  index?: number; // Optional index for streaming support
}

// Extended tool call for streaming with partial data
export interface StreamToolCall {
  index?: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: StreamToolCall[];
      reasoning?: string;
      reasoning_content?: string; // Alternative field name for thinking/reasoning
    };
    finish_reason?: string;
  }[];
}

export interface AgentMode {
  systemMessage: string;
  allowedTools: string[];
  fallbackMessage: string;
}

export interface AgentModes {
  [key: string]: AgentMode;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'notice';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  reasoning?: string;
  raw?: any;
  model?: string;
  isStreaming?: boolean;
  isAlreadyDisplayed?: boolean; // Flag to prevent duplicate display in UI
  changeIds?: string[]; // Track associated file changes
  displayRole?: string; // Override display name (e.g., "LLM ORCHESTRATOR MODE")
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
}

export interface ToolInfo {
  name: string;
  displayName: string;
  description: string;
  category: 'file' | 'system' | 'web' | 'search' | 'other';
}

export interface BaseTool {
  getToolInfo(): ToolInfo;
  getToolDefinition(): ToolDefinition;
  execute(args: any, workspaceRoot: string): Promise<ToolResult>;
}

export interface StreamingUpdate {
  type: 'start' | 'content' | 'thinking' | 'tool_calls' | 'end' | 'error' | 'change_tracking' | 'tool_calls_start' | 'tool_calls_end' | 'correction_request' | 'correction_applied' | 'iteration_limit_reached' | 'ask_user_request' | 'notice_message';
  messageId: string;
  content?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  model?: string;
  error?: string;
  isComplete?: boolean;
  changeIds?: string[]; // For change tracking updates
  correctionText?: string; // For correction applied updates
  iterationCount?: number; // For iteration limit reached
  requestId?: string; // For ask user request
  question?: string; // For ask user request
  context?: string; // For ask user request
  urgency?: string; // For ask user request
  message?: ChatMessage; // For notice messages
}

export interface MessageUpdate {
  type: 'message_ready';
  message: ChatMessage;
}

// Change tracking UI types
export interface ChangeTrackingUpdate {
  type: 'change_created' | 'change_status_updated' | 'changes_list';
  changeId?: string;
  changes?: Array<{
    id: string;
    filePath: string;
    operation: string;
    status: string;
    timestamp: number;
    toolName: string;
  }>;
}

export type ChatUpdate = StreamingUpdate | MessageUpdate | ChangeTrackingUpdate;
