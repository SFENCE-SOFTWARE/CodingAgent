// src/types.ts

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaModelList {
  models: OllamaModel[];
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  reasoning?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
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

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  temperature?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface OllamaChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: OllamaChatMessage;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OllamaStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: ToolCall[];
      reasoning?: string;
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
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  reasoning?: string;
  raw?: any;
  model?: string;
  isStreaming?: boolean;
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
}

export interface StreamingUpdate {
  type: 'start' | 'content' | 'thinking' | 'tool_calls' | 'end' | 'error';
  messageId: string;
  content?: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  model?: string;
  error?: string;
  isComplete?: boolean;
}
