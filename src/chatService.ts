// src/chatService.ts

import * as vscode from 'vscode';
import { OpenAIService } from './openai_html_api';
import { ToolsService } from './tools';
import { LoggingService } from './loggingService';
import { 
  ChatMessage, 
  OllamaChatMessage, 
  OllamaStreamChunk,
  StreamingUpdate,
  MessageUpdate,
  ChatUpdate,
  ToolCall, 
  ToolDefinition,
  OllamaChatRequest 
} from './types';

export class ChatService {
  private messages: ChatMessage[] = [];
  private openai: OpenAIService;
  private tools: ToolsService;
  private logging: LoggingService;
  private streamingCallback?: (update: StreamingUpdate) => void;

  constructor() {
    this.openai = new OpenAIService();
    this.tools = new ToolsService();
    this.logging = LoggingService.getInstance();
  }

  setStreamingCallback(callback: (update: StreamingUpdate) => void): void {
    this.streamingCallback = callback;
  }

  async processMessage(content: string, callback?: (update: ChatUpdate) => void): Promise<ChatMessage[]> {
    // This assumes user message is already added via addUserMessage
    const currentMode = this.openai.getCurrentMode();
    const currentModel = this.openai.getCurrentModel();
    const enableStreaming = this.openai.getEnableStreaming();
    
    try {
      const modeConfig = this.openai.getModeConfiguration(currentMode);
      
      // Get available tools for current mode
      const allTools = this.tools.getToolDefinitions();
      const allowedTools: ToolDefinition[] = [];
      
      for (const toolName of modeConfig.allowedTools) {
        const toolDef = allTools[toolName];
        if (toolDef) {
          allowedTools.push(toolDef);
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

      if (enableStreaming) {
        return await this.processStreamingMessage(request, currentModel, currentMode, startTime, callback);
      } else {
        return await this.processNonStreamingMessage(request, currentModel, currentMode, startTime, callback);
      }

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

  private async processNonStreamingMessage(
    request: OllamaChatRequest,
    currentModel: string,
    currentMode: string,
    startTime: number,
    callback?: (update: ChatUpdate) => void
  ): Promise<ChatMessage[]> {
    // Log the outgoing request immediately
    this.logging.logAiCommunication(request, null, {
      model: currentModel,
      mode: currentMode,
      timestamp: startTime,
      context: 'request-sent'
    });

    // Log raw JSON request if log mode is enabled
    this.logging.logRawJsonCommunication(request, null, {
      model: currentModel,
      mode: currentMode,
      timestamp: startTime,
      context: 'request-sent'
    });

    const response = await this.openai.sendChat(request);
    const endTime = Date.now();
    
    // Log the response immediately when received
    this.logging.logAiCommunication(request, response, {
      model: currentModel,
      mode: currentMode,
      timestamp: endTime,
      duration: endTime - startTime,
      context: 'response-received'
    });

    // Log raw JSON response if log mode is enabled
    this.logging.logRawJsonCommunication(request, response, {
      model: currentModel,
      mode: currentMode,
      timestamp: endTime,
      duration: endTime - startTime,
      context: 'response-received'
    });

    const assistantMessage = response.choices[0]?.message;

    if (!assistantMessage) {
      throw new Error('No response from model');
    }

    // Handle tool calls if present
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults = await this.handleToolCalls(assistantMessage, request, undefined, callback, false);
      return toolResults;
    }

    // Regular response without tool calls
    const chatMessage: ChatMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: assistantMessage.content || 'No content in response',
      timestamp: Date.now(),
      reasoning: assistantMessage.reasoning,
      model: currentModel
    };

    this.messages.push(chatMessage);
    
    // Send message immediately to UI via callback
    if (callback) {
      callback({
        type: 'message_ready',
        message: chatMessage
      });
      // Mark as displayed to prevent duplication in final message loop
      chatMessage.isAlreadyDisplayed = true;
    }
    
    return [chatMessage];
  }

  private async processStreamingMessage(
    request: OllamaChatRequest,
    currentModel: string,
    currentMode: string,
    startTime: number,
    callback?: (update: ChatUpdate) => void
  ): Promise<ChatMessage[]> {
    const messageId = this.generateId();
    let accumulatedContent = '';
    let accumulatedThinking = '';
    let toolCalls: ToolCall[] = [];
    let finishReason = '';
    let streamedChunks: OllamaStreamChunk[] = [];

    // Create initial message
    const chatMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: currentModel,
      isStreaming: true
    };

    this.messages.push(chatMessage);

    // Send start event
    if (this.streamingCallback) {
      this.streamingCallback({
        type: 'start',
        messageId,
        model: currentModel
      });
    }

    // Log the outgoing request immediately (before streaming starts)
    this.logging.logAiCommunication(request, null, {
      model: currentModel,
      mode: currentMode,
      timestamp: startTime,
      context: 'streaming-request-sent'
    });

    // Log raw JSON request if log mode is enabled
    this.logging.logRawJsonCommunication(request, null, {
      model: currentModel,
      mode: currentMode,
      timestamp: startTime,
      context: 'streaming-request-sent'
    });

    try {
      for await (const chunk of this.openai.sendChatStream(request)) {
        streamedChunks.push(chunk);
        const delta = chunk.choices[0]?.delta;
        
        if (!delta) continue;

        // Handle content updates
        if (delta.content) {
          accumulatedContent += delta.content;
          chatMessage.content = accumulatedContent;
          
          if (this.streamingCallback) {
            this.streamingCallback({
              type: 'content',
              messageId,
              content: delta.content // Send just the delta, not accumulated
            });
          }
        }

        // Handle thinking/reasoning updates
        if (delta.reasoning) {
          accumulatedThinking += delta.reasoning;
          chatMessage.reasoning = accumulatedThinking;
          
          if (this.streamingCallback) {
            this.streamingCallback({
              type: 'thinking',
              messageId,
              thinking: delta.reasoning // Send just the delta, not accumulated
            });
          }
        }

        // Handle tool calls with proper merging for streaming
        if (delta.tool_calls) {
          // Merge incremental tool calls by index
          for (const deltaToolCall of delta.tool_calls) {
            const deltaAny = deltaToolCall as any;
            if (deltaAny.index !== undefined) {
              const index = deltaAny.index;
              const existingIndex = toolCalls.findIndex((tc: any) => tc.index === index);
              
              if (existingIndex >= 0) {
                // Merge existing tool call
                const existing = toolCalls[existingIndex] as any;
                
                // Merge properties
                if (deltaAny.id !== undefined) {
                  existing.id = deltaAny.id;
                }
                if (deltaAny.type !== undefined) {
                  existing.type = deltaAny.type;
                }
                if (deltaAny.function) {
                  if (!existing.function) {
                    existing.function = { name: '', arguments: '' };
                  }
                  if (deltaAny.function.name !== undefined) {
                    existing.function.name = deltaAny.function.name;
                  }
                  if (deltaAny.function.arguments !== undefined) {
                    // CONCATENATE arguments instead of overwriting
                    existing.function.arguments = (existing.function.arguments || '') + deltaAny.function.arguments;
                  }
                }
              } else {
                // Add new tool call with partial data
                const newToolCall: any = {
                  id: deltaAny.id || '',
                  type: deltaAny.type || 'function',
                  function: {
                    name: deltaAny.function?.name || '',
                    arguments: deltaAny.function?.arguments || ''
                  },
                  index: index
                };
                toolCalls.push(newToolCall);
              }
            } else {
              // Legacy: tool call without index, cast to ToolCall
              toolCalls.push(deltaToolCall as ToolCall);
            }
          }
          
          chatMessage.toolCalls = toolCalls;
          
          if (this.streamingCallback) {
            this.streamingCallback({
              type: 'tool_calls',
              messageId,
              toolCalls: delta.tool_calls as ToolCall[]
            });
          }
        }

        // Handle finish reason
        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      const endTime = Date.now();

      // Create complete response for logging
      const completeResponse = {
        id: messageId,
        object: 'chat.completion',
        created: Math.floor(startTime / 1000),
        model: currentModel,
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: accumulatedContent,
            reasoning: accumulatedThinking,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
          },
          finish_reason: finishReason
        }]
      };

      // Log the communication (standard logging)
      this.logging.logAiCommunication(request, completeResponse, {
        model: currentModel,
        mode: currentMode,
        timestamp: startTime,
        duration: endTime - startTime,
        context: 'streaming-response-completed'
      });

      // Log raw JSON if log mode is enabled - log the complete response, not individual chunks
      this.logging.logRawJsonCommunication(request, completeResponse, {
        model: currentModel,
        mode: currentMode,
        timestamp: startTime,
        duration: endTime - startTime,
        context: 'streaming-response-completed'
      });

      // Update final message state
      chatMessage.isStreaming = false;
      chatMessage.isAlreadyDisplayed = true; // Mark as already displayed via streaming

      // Send end event
      if (this.streamingCallback) {
        this.streamingCallback({
          type: 'end',
          messageId,
          isComplete: true
        });
      }

      // Handle tool calls if present
      if (toolCalls.length > 0) {
        const assistantMessage: OllamaChatMessage = {
          role: 'assistant',
          content: accumulatedContent,
          reasoning: accumulatedThinking,
          tool_calls: toolCalls
        };
        
        const toolResults = await this.handleToolCalls(assistantMessage, request, messageId, callback, true);
        return toolResults;
      }

      return [chatMessage];

    } catch (error) {
      // Send error event
      if (this.streamingCallback) {
        this.streamingCallback({
          type: 'error',
          messageId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Update message with error
      chatMessage.isStreaming = false;
      chatMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
      chatMessage.role = 'error';

      return [chatMessage];
    }
  }

  private async handleToolCalls(
    assistantMessage: OllamaChatMessage, 
    originalRequest: OllamaChatRequest,
    existingMessageId?: string,
    callback?: (update: ChatUpdate) => void,
    isStreamingMode?: boolean
  ): Promise<ChatMessage[]> {
    const results: ChatMessage[] = [];

    // Normalize tool calls to ensure they are complete and valid
    let normalizedToolCalls = this.normalizeToolCalls(assistantMessage.tool_calls || []);

    // Add assistant message with tool calls (only if not already streaming)
    if (!existingMessageId) {
      const assistantChatMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: assistantMessage.content || 'Executing tools...',
        timestamp: Date.now(),
        toolCalls: normalizedToolCalls,
        reasoning: assistantMessage.reasoning,
        model: this.openai.getCurrentModel()
      };
      
      this.messages.push(assistantChatMessage);
      results.push(assistantChatMessage);
      
      // Send assistant message immediately to UI via callback (only if not already displayed via streaming)
      if (callback) {
        callback({
          type: 'message_ready',
          message: assistantChatMessage
        });
        // Mark as displayed to prevent duplication in final message loop
        assistantChatMessage.isAlreadyDisplayed = true;
      }
    }

    // Execute tools in a loop until we get a final response
    const toolMessages: OllamaChatMessage[] = [...originalRequest.messages];
    
    // Create normalized assistant message for tool execution
    const normalizedAssistantMessage: OllamaChatMessage = {
      ...assistantMessage,
      tool_calls: normalizedToolCalls
    };
    toolMessages.push(normalizedAssistantMessage);

    let currentMessage = assistantMessage;
    let iterationCount = 0;
    const maxIterations = 10; // Prevent infinite loops

    while (normalizedToolCalls.length > 0 && iterationCount < maxIterations) {
      iterationCount++;

      // Execute each tool call in the normalized tool calls
      for (const toolCall of normalizedToolCalls) {
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
        const followUpResponse = await this.openai.sendChat(followUpRequest);
        const followUpEndTime = Date.now();

        // Log the follow-up communication (standard logging)
        this.logging.logAiCommunication(followUpRequest, followUpResponse, {
          model: this.openai.getCurrentModel(),
          mode: this.openai.getCurrentMode(),
          timestamp: followUpStartTime,
          duration: followUpEndTime - followUpStartTime,
          context: `tool-follow-up-${iterationCount}`
        });

        // Log raw JSON for follow-up if log mode is enabled
        this.logging.logRawJsonCommunication(followUpRequest, followUpResponse, {
          model: this.openai.getCurrentModel(),
          mode: this.openai.getCurrentMode(),
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
          // Update normalized tool calls for next iteration
          normalizedToolCalls = this.normalizeToolCalls(currentMessage.tool_calls);
          
          // Create normalized message for toolMessages
          const normalizedCurrentMessage: OllamaChatMessage = {
            ...currentMessage,
            tool_calls: normalizedToolCalls
          };
          toolMessages.push(normalizedCurrentMessage);
          
          // Add intermediate tool call message to results
          const intermediateChatMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: currentMessage.content || 'Executing additional tools...',
            timestamp: Date.now(),
            toolCalls: normalizedToolCalls, // Use normalized tool calls
            reasoning: currentMessage.reasoning,
            model: this.openai.getCurrentModel()
          };
          
          this.messages.push(intermediateChatMessage);
          results.push(intermediateChatMessage);
          
          // Send intermediate message immediately to UI via callback
          if (callback) {
            callback({
              type: 'message_ready',
              message: intermediateChatMessage
            });
            // Mark as displayed to prevent duplication in final message loop
            intermediateChatMessage.isAlreadyDisplayed = true;
          }
          
          // Mark as displayed if this is streaming mode to prevent duplication
          if (isStreamingMode) {
            intermediateChatMessage.isAlreadyDisplayed = true;
          }
        } else {
          // No more tool calls, exit the loop
          normalizedToolCalls = [];
        }

      } catch (error) {
        // Log the follow-up error (standard logging)
        this.logging.logAiCommunication({}, null, {
          model: this.openai.getCurrentModel(),
          mode: this.openai.getCurrentMode(),
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          context: `tool-follow-up-${iterationCount}`
        });

        // Log raw JSON error for follow-up if log mode is enabled
        this.logging.logRawJsonCommunication({}, null, {
          model: this.openai.getCurrentModel(),
          mode: this.openai.getCurrentMode(),
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
        
        // Send error message immediately to UI via callback
        if (callback) {
          callback({
            type: 'message_ready',
            message: errorMessage
          });
          // Mark as displayed to prevent duplication in final message loop
          errorMessage.isAlreadyDisplayed = true;
        }
        
        // Mark as displayed if this is streaming mode to prevent duplication
        if (isStreamingMode) {
          errorMessage.isAlreadyDisplayed = true;
        }
        
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
        reasoning: currentMessage.reasoning,
        model: this.openai.getCurrentModel()
      };

      this.messages.push(finalChatMessage);
      results.push(finalChatMessage);
      
      // Send final message immediately to UI via callback
      if (callback) {
        callback({
          type: 'message_ready',
          message: finalChatMessage
        });
        // Mark as displayed to prevent duplication in final message loop
        finalChatMessage.isAlreadyDisplayed = true;
      }
      
      // Mark as displayed if this is streaming mode to prevent duplication
      if (isStreamingMode) {
        finalChatMessage.isAlreadyDisplayed = true;
      }
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
      
      // Send timeout message immediately to UI via callback
      if (callback) {
        callback({
          type: 'message_ready',
          message: timeoutMessage
        });
        // Mark as displayed to prevent duplication in final message loop
        timeoutMessage.isAlreadyDisplayed = true;
      }
      
      // Mark as displayed if this is streaming mode to prevent duplication
      if (isStreamingMode) {
        timeoutMessage.isAlreadyDisplayed = true;
      }
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
      const modelList = await this.openai.getModels();
      return modelList.models.map(model => model.name);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return ['llama3:8b']; // fallback
    }
  }

  getCurrentMode(): string {
    return this.openai.getCurrentMode();
  }

  getCurrentModel(): string {
    return this.openai.getCurrentModel();
  }

  async setMode(mode: string): Promise<void> {
    await this.openai.setCurrentMode(mode);
  }

  async setModel(model: string): Promise<void> {
    await this.openai.setCurrentModel(model);
  }

  getShowThinking(): boolean {
    return this.openai.getShowThinking();
  }

  getEnableStreaming(): boolean {
    return this.openai.getEnableStreaming();
  }

  updateConfiguration(): void {
    this.openai.updateConfiguration();
  }

  /**
   * Normalize and validate tool calls - remove incomplete tool calls and ensure required fields
   */
  private normalizeToolCalls(toolCalls: any[]): ToolCall[] {
    if (!toolCalls || !Array.isArray(toolCalls)) {
      return [];
    }
    
    return toolCalls.filter(tc => {
      // Filter out incomplete tool calls
      const isComplete = tc.id && tc.type && tc.function && tc.function.name && tc.function.arguments;
      if (!isComplete) {
        console.warn('Filtering out incomplete tool call:', tc);
        return false;
      }
      return true;
    }).map(tc => {
      // Ensure proper ToolCall structure, removing any extra fields like index
      return {
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      } as ToolCall;
    });
  }
}
