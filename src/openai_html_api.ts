// src/openai_html_api.ts

import * as vscode from 'vscode';
import { ModelList, OpenAIChatRequest, OpenAIChatResponse, OpenAIStreamChunk, ToolDefinition, AgentModes } from './types';

export class OpenAIService {
  private baseApiUrl: string = 'http://localhost:11434';
  private apiKey: string = '';

  constructor() {
    this.updateConfiguration();
  }

  updateConfiguration() {
    const config = vscode.workspace.getConfiguration('codingagent');
    const host = config.get<string>('openai.host', 'localhost');
    const port = config.get<number>('openai.port', 11434);
    const apiKey = config.get<string>('openai.apiKey', '');
    this.baseApiUrl = `http://${host}:${port}`;
    this.apiKey = apiKey;
  }

  getBaseUrl(): string {
    return this.baseApiUrl;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async getModels(): Promise<ModelList> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Use API key if provided, otherwise use dummy authorization for local models
      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else {
        headers['Authorization'] = 'Bearer dummy';
      }

      const response = await fetch(`${this.baseApiUrl}/api/tags`, {
        method: 'GET',
        headers
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json() as ModelList;
    } catch (error) {
      throw new Error(`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendChat(request: OpenAIChatRequest, abortSignal?: AbortSignal): Promise<OpenAIChatResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Use API key if provided, otherwise use dummy authorization for local models
      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else {
        headers['Authorization'] = 'Bearer dummy';
      }

      const response = await fetch(`${this.baseApiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: abortSignal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }

      return await response.json() as OpenAIChatResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to send chat request: ${String(error)}`);
    }
  }

  async *sendChatStream(request: OpenAIChatRequest, abortSignal?: AbortSignal): AsyncGenerator<OpenAIStreamChunk, void, unknown> {
    try {
      const streamRequest = { ...request, stream: true };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Use API key if provided, otherwise use dummy authorization for local models
      if (this.apiKey && this.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else {
        headers['Authorization'] = 'Bearer dummy';
      }
      
      const response = await fetch(`${this.baseApiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(streamRequest),
        signal: abortSignal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                return;
              }
              
              try {
                const chunk = JSON.parse(data) as OpenAIStreamChunk;
                yield chunk;
              } catch (e) {
                console.warn('Failed to parse stream chunk:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to send streaming chat request: ${String(error)}`);
    }
  }

  getCurrentMode(): string {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get<string>('currentMode', 'Coder');
  }

  getCurrentModel(): string {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get<string>('currentModel', 'llama3:8b');
  }

  getAgentModes(): AgentModes {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get<AgentModes>('modes', {
      Coder: {
        systemMessage: "Reasoning: high\nYou are an expert programming assistant. You can read, write, and execute code. Use the available tools to help with coding tasks.",
        allowedTools: ["read_file", "write_file", "list_files", "get_file_size", "execute_terminal"],
        fallbackMessage: "I'm ready to help with your coding tasks. What would you like me to do?"
      },
      Ask: {
        systemMessage: "Reasoning: high\nYou are a helpful AI assistant. Answer questions clearly and concisely.",
        allowedTools: ["read_file", "read_webpage"],
        fallbackMessage: "I'm here to answer your questions. What would you like to know?"
      },
      Architect: {
        systemMessage: "Reasoning: high\nYou are a software architect assistant. Help design systems, review architecture, and provide technical guidance.",
        allowedTools: ["read_file", "list_files", "read_webpage", "read_pdf"],
        fallbackMessage: "I'm ready to help with architecture and design decisions. What system are you working on?"
      }
    });
  }

  getModeConfiguration(mode: string) {
    const modes = this.getAgentModes();
    return modes[mode] || modes['Coder'];
  }

  getShowThinking(): boolean {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get<boolean>('showThinking', true);
  }

  getEnableStreaming(): boolean {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get<boolean>('enableStreaming', true);
  }

  async setCurrentMode(mode: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('codingagent');
    await config.update('currentMode', mode, vscode.ConfigurationTarget.Global);
  }

  async setCurrentModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('codingagent');
    await config.update('currentModel', model, vscode.ConfigurationTarget.Global);
  }
}
