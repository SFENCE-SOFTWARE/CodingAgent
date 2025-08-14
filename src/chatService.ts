// src/chatService.ts

import * as vscode from 'vscode';
import { OllamaService } from './ollama';
import { ToolsService } from './tools';
import { LoggingService } from './loggingService';
import { 
  ChatMessage, 
  OllamaChatMessage, 
  ToolCall, 
  ToolDefinition,
  OllamaChatRequest 
} from './types';

export class ChatService {
  private messages: ChatMessage[] = [];
  private ollama: OllamaService;
  private tools: ToolsService;
  private logging: LoggingService;

  constructor() {
    this.ollama = new OllamaService();
    this.tools = new ToolsService();
    this.logging = LoggingService.getInstance();
  }

  async processMessage(content: string): Promise<ChatMessage[]> {
    // This assumes user message is already added via addUserMessage
    const currentMode = this.ollama.getCurrentMode();
    const currentModel = this.ollama.getCurrentModel();
    
    try {
      const modeConfig = this.ollama.getModeConfiguration(currentMode);
      
      // Get available tools for current mode
      const allTools = this.tools.getToolDefinitions();
      const allowedTools: ToolDefinition[] = [];
      
      for (const toolName of modeConfig.allowedTools) {
        if (allTools[toolName]) {
          allowedTools.push(allTools[toolName]);
        }
      }

      // Prepare messages for Ollama
      const ollamaMessages: OllamaChatMessage[] = [
        {
          role: 'system',
          content: modeConfig.systemMessage
        }
      ];

      // Add recent conversation history (last 10 messages to keep context manageable)
      const recentMessages = this.messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const ollamaMsg: OllamaChatMessage = {
            role: msg.role,
            content: msg.content
          };
          
          if (msg.toolCalls) {
            ollamaMsg.tool_calls = msg.toolCalls;
          }
          
          ollamaMessages.push(ollamaMsg);
        }
      }

      const request: OllamaChatRequest = {
        model: currentModel,
        messages: ollamaMessages,
        temperature: 0.0,
        tools: allowedTools.length > 0 ? allowedTools : undefined
      };

      const startTime = Date.now();
      const response = await this.ollama.sendChat(request);
      const endTime = Date.now();
      
      // Log the communication (standard logging)
      this.logging.logAiCommunication(request, response, {
        model: currentModel,
        mode: currentMode,
        timestamp: startTime,
        duration: endTime - startTime,
        context: 'initial'
      });

      // Log raw JSON if log mode is enabled
      this.logging.logRawJsonCommunication(request, response, {
        model: currentModel,
        mode: currentMode,
        timestamp: startTime,
        duration: endTime - startTime,
        context: 'initial'
      });

      const assistantMessage = response.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('No response from model');
      }

      // Handle tool calls if present
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const toolResults = await this.handleToolCalls(assistantMessage, request);
        return toolResults;
      }

      // Regular response without tool calls
      const chatMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: assistantMessage.content || 'No content in response',
        timestamp: Date.now(),
        reasoning: assistantMessage.reasoning
      };

      this.messages.push(chatMessage);
      return [chatMessage];

    } catch (error) {
      // Log the error (standard logging)
      this.logging.logAiCommunication({}, null, {
        model: currentModel,
        mode: currentMode,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        context: 'initial'
      });

      // Log raw JSON error if log mode is enabled
      this.logging.logRawJsonCommunication({}, null, {
        model: currentModel,
        mode: currentMode,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        context: 'initial'
      });

      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: 'error',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };

      this.messages.push(errorMessage);
      return [errorMessage];
    }
  }

  private async handleToolCalls(
    assistantMessage: OllamaChatMessage, 
    originalRequest: OllamaChatRequest
  ): Promise<ChatMessage[]> {
    const results: ChatMessage[] = [];

    // Add assistant message with tool calls
    const assistantChatMessage: ChatMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: assistantMessage.content || 'Executing tools...',
      timestamp: Date.now(),
      toolCalls: assistantMessage.tool_calls,
      reasoning: assistantMessage.reasoning
    };
    
    this.messages.push(assistantChatMessage);
    results.push(assistantChatMessage);

    // Execute tools in a loop until we get a final response
    const toolMessages: OllamaChatMessage[] = [...originalRequest.messages];
    toolMessages.push(assistantMessage);

    let currentMessage = assistantMessage;
    let iterationCount = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (currentMessage.tool_calls && currentMessage.tool_calls.length > 0 && iterationCount < maxIterations) {
      iterationCount++;

      // Execute each tool call in the current message
      for (const toolCall of currentMessage.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await this.tools.executeTool(toolCall.function.name, args);
          
          const toolResultMessage: OllamaChatMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResult.success ? toolResult.content : `Error: ${toolResult.error}`
          };

          toolMessages.push(toolResultMessage);

        } catch (error) {
          const toolResultMessage: OllamaChatMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: `Error parsing tool arguments: ${error instanceof Error ? error.message : String(error)}`
          };

          toolMessages.push(toolResultMessage);
        }
      }

      // Send updated conversation back to model for next response
      try {
        const followUpRequest: OllamaChatRequest = {
          ...originalRequest,
          messages: toolMessages
        };

        const followUpStartTime = Date.now();
        const followUpResponse = await this.ollama.sendChat(followUpRequest);
        const followUpEndTime = Date.now();

        // Log the follow-up communication (standard logging)
        this.logging.logAiCommunication(followUpRequest, followUpResponse, {
          model: this.ollama.getCurrentModel(),
          mode: this.ollama.getCurrentMode(),
          timestamp: followUpStartTime,
          duration: followUpEndTime - followUpStartTime,
          context: `tool-follow-up-${iterationCount}`
        });

        // Log raw JSON for follow-up if log mode is enabled
        this.logging.logRawJsonCommunication(followUpRequest, followUpResponse, {
          model: this.ollama.getCurrentModel(),
          mode: this.ollama.getCurrentMode(),
          timestamp: followUpStartTime,
          duration: followUpEndTime - followUpStartTime,
          context: `tool-follow-up-${iterationCount}`
        });

        currentMessage = followUpResponse.choices[0]?.message;

        if (!currentMessage) {
          throw new Error('No response from model in tool call iteration');
        }

        // If this response has tool calls, add it to the conversation and continue the loop
        if (currentMessage.tool_calls && currentMessage.tool_calls.length > 0) {
          toolMessages.push(currentMessage);
          
          // Add intermediate tool call message to results
          const intermediateChatMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: currentMessage.content || 'Executing additional tools...',
            timestamp: Date.now(),
            toolCalls: currentMessage.tool_calls,
            reasoning: currentMessage.reasoning
          };
          
          this.messages.push(intermediateChatMessage);
          results.push(intermediateChatMessage);
        }

      } catch (error) {
        // Log the follow-up error (standard logging)
        this.logging.logAiCommunication({}, null, {
          model: this.ollama.getCurrentModel(),
          mode: this.ollama.getCurrentMode(),
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          context: `tool-follow-up-${iterationCount}`
        });

        // Log raw JSON error for follow-up if log mode is enabled
        this.logging.logRawJsonCommunication({}, null, {
          model: this.ollama.getCurrentModel(),
          mode: this.ollama.getCurrentMode(),
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          context: `tool-follow-up-${iterationCount}`
        });

        const errorMessage: ChatMessage = {
          id: this.generateId(),
          role: 'error',
          content: `Error in follow-up response (iteration ${iterationCount}): ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now()
        };

        this.messages.push(errorMessage);
        results.push(errorMessage);
        break; // Exit the loop on error
      }
    }

    // Add final message if we have one (without tool calls)
    if (currentMessage && (!currentMessage.tool_calls || currentMessage.tool_calls.length === 0)) {
      const finalChatMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: currentMessage.content || 'Process completed',
        timestamp: Date.now(),
        reasoning: currentMessage.reasoning
      };

      this.messages.push(finalChatMessage);
      results.push(finalChatMessage);
    } else if (iterationCount >= maxIterations) {
      // Handle case where we hit the iteration limit
      const timeoutMessage: ChatMessage = {
        id: this.generateId(),
        role: 'error',
        content: `Tool call process stopped after ${maxIterations} iterations to prevent infinite loops.`,
        timestamp: Date.now()
      };

      this.messages.push(timeoutMessage);
      results.push(timeoutMessage);
    }

    return results;
  }

  addUserMessage(content: string): ChatMessage {
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    this.messages.push(userMessage);
    return userMessage;
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const modelList = await this.ollama.getModels();
      return modelList.models.map(model => model.name);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return ['llama3:8b']; // fallback
    }
  }

  getCurrentMode(): string {
    return this.ollama.getCurrentMode();
  }

  getCurrentModel(): string {
    return this.ollama.getCurrentModel();
  }

  async setMode(mode: string): Promise<void> {
    await this.ollama.setCurrentMode(mode);
  }

  async setModel(model: string): Promise<void> {
    await this.ollama.setCurrentModel(model);
  }

  getShowThinking(): boolean {
    return this.ollama.getShowThinking();
  }

  updateConfiguration(): void {
    this.ollama.updateConfiguration();
  }
}
