// src/chatService.ts

import * as vscode from 'vscode';
import { OpenAIService } from './openai_html_api';
import { ToolsService } from './tools';
import { LoggingService } from './loggingService';
import { 
  ChatMessage, 
  OpenAIChatMessage, 
  OpenAIStreamChunk,
  StreamingUpdate,
  MessageUpdate,
  ChatUpdate,
  ToolCall, 
  ToolDefinition,
  OpenAIChatRequest 
} from './types';

export class ChatService {
  private messages: ChatMessage[] = [];
  private openai: OpenAIService;
  private tools: ToolsService;
  private logging: LoggingService;
  private streamingCallback?: (update: StreamingUpdate) => void;
  private isInterrupted: boolean = false;
  private pendingCorrection: string | null = null;
  private isWaitingForCorrection: boolean = false;
  private isWaitingForIterationContinue: boolean = false;
  private shouldContinueIterations: boolean = false;
  private allowedIterations: number = 10; // How many iterations are currently allowed

  constructor(toolsService?: ToolsService) {
    this.openai = new OpenAIService();
    this.tools = toolsService || new ToolsService();
    this.logging = LoggingService.getInstance();
    
    // Set up change notification callback from tools to UI
    this.tools.setChangeNotificationCallback((changeId: string) => {
      this.handleChangeNotification(changeId);
    });
  }

  private handleChangeNotification(changeId: string): void {
    // Notify UI about new change
    if (this.streamingCallback) {
      this.streamingCallback({
        type: 'change_tracking',
        messageId: 'system',
        changeIds: [changeId]
      });
    }
  }

  /**
   * Helper function to extract reasoning/thinking from delta or message object
   * Supports both 'reasoning' and 'reasoning_content' field names
   */
  private extractReasoning(obj: any): string | undefined {
    const reasoning = obj.reasoning || obj.reasoning_content;
    
    // Debug logging to see which field is being used and what content we have
    console.log(`[CodingAgent] Debug - obj.reasoning:`, obj.reasoning);
    console.log(`[CodingAgent] Debug - obj.reasoning_content:`, obj.reasoning_content);
    console.log(`[CodingAgent] Debug - extracted reasoning:`, reasoning);
    
    // Log to file as well
    this.logging.logDebug('extractReasoning called', {
      hasReasoning: !!obj.reasoning,
      hasReasoningContent: !!obj.reasoning_content,
      reasoningValue: obj.reasoning,
      reasoningContentValue: obj.reasoning_content,
      extractedValue: reasoning
    });
    
    if (reasoning) {
      console.log(`[CodingAgent] Reasoning extracted from field: ${obj.reasoning ? 'reasoning' : 'reasoning_content'}`);
      this.logging.logDebug('Reasoning extracted successfully', {
        fromField: obj.reasoning ? 'reasoning' : 'reasoning_content',
        value: reasoning
      });
    }
    
    return reasoning;
  }

  setStreamingCallback(callback: (update: StreamingUpdate) => void): void {
    this.streamingCallback = callback;
  }

  interruptLLM(): void {
    this.isInterrupted = true;
  }

  requestCorrection(): void {
    this.isWaitingForCorrection = true;
    
    // Signal correction request to UI
    if (this.streamingCallback) {
      this.streamingCallback({
        type: 'correction_request',
        messageId: this.generateId()
      });
    }
  }

  submitCorrection(correctionText: string): void {
    this.pendingCorrection = correctionText;
    this.isWaitingForCorrection = false;
  }

  cancelCorrection(): void {
    this.isWaitingForCorrection = false;
    this.pendingCorrection = null;
  }

  continueIterations(): void {
    this.shouldContinueIterations = true;
    this.isWaitingForIterationContinue = false;
    const threshold = this.getIterationThreshold();
    this.allowedIterations += threshold; // Allow more iterations based on current threshold
  }

  stopIterations(): void {
    this.shouldContinueIterations = false;
    this.isWaitingForIterationContinue = false;
  }

  private resetInterrupt(): void {
    this.isInterrupted = false;
  }

  private getIterationThreshold(): number {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get('iterationThreshold', 10);
  }

  getLoggingService(): LoggingService {
    return this.logging;
  }

  async processMessage(content: string, callback?: (update: ChatUpdate) => void): Promise<ChatMessage[]> {
    // Reset interrupt flag at the start of new message processing
    this.resetInterrupt();
    
    // Reset allowed iterations for new message
    const threshold = this.getIterationThreshold();
    this.allowedIterations = threshold;
    this.shouldContinueIterations = false;
    
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

      // Prepare messages for OpenAI API
      const openaiMessages: OpenAIChatMessage[] = [
        {
          role: 'system',
          content: modeConfig.systemMessage
        }
      ];

      // Add recent conversation history (last 10 messages to keep context manageable)
      const recentMessages = this.messages.slice(-10);
      for (const msg of recentMessages) {
        if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'error') {
          // Map 'error' role to 'assistant' since OpenAI API doesn't have 'error' role
          const mappedRole: 'user' | 'assistant' | 'system' | 'tool' = 
            msg.role === 'error' ? 'assistant' : (msg.role as 'user' | 'assistant');
          
          const openaiMsg: OpenAIChatMessage = {
            role: mappedRole,
            content: msg.content
          };
          
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            openaiMsg.tool_calls = msg.toolCalls;
          }
          
          openaiMessages.push(openaiMsg);
        }
      }

      const request: OpenAIChatRequest = {
        model: currentModel,
        messages: openaiMessages,
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
    request: OpenAIChatRequest,
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
      reasoning: this.extractReasoning(assistantMessage),
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
    request: OpenAIChatRequest,
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
    let streamedChunks: OpenAIStreamChunk[] = [];

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

        // Debug: Log incoming delta
        console.log(`[CodingAgent] Streaming delta received:`, delta);

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
        const deltaReasoning = this.extractReasoning(delta);
        if (deltaReasoning) {
          console.log(`[CodingAgent] Processing thinking delta:`, deltaReasoning);
          this.logging.logDebug('Thinking delta received', { deltaReasoning, messageId });
          
          accumulatedThinking += deltaReasoning;
          chatMessage.reasoning = accumulatedThinking;
          
          if (this.streamingCallback) {
            console.log(`[CodingAgent] Sending thinking callback:`, deltaReasoning);
            this.logging.logDebug('Sending thinking callback', { deltaReasoning, messageId, accumulatedThinking });
            this.streamingCallback({
              type: 'thinking',
              messageId,
              thinking: deltaReasoning // Send just the delta, not accumulated
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
        const assistantMessage: OpenAIChatMessage = {
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
    assistantMessage: OpenAIChatMessage, 
    originalRequest: OpenAIChatRequest,
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
        reasoning: this.extractReasoning(assistantMessage),
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
    const toolMessages: OpenAIChatMessage[] = [...originalRequest.messages];
    
    // Create normalized assistant message for tool execution
    const normalizedAssistantMessage: OpenAIChatMessage = {
      ...assistantMessage,
      tool_calls: normalizedToolCalls
    };
    toolMessages.push(normalizedAssistantMessage);

    let currentMessage = assistantMessage;
    let iterationCount = 0;
    const iterationWarningThreshold = 10; // Show warning after 10 iterations

    while (normalizedToolCalls.length > 0) {
      // Check for iteration limit and ask user for continuation
      if (iterationCount >= this.allowedIterations) {
        this.isWaitingForIterationContinue = true;
        
        // Notify UI about iteration limit reached
        if (this.streamingCallback) {
          this.streamingCallback({
            type: 'iteration_limit_reached',
            messageId: existingMessageId || this.generateId(),
            iterationCount: iterationCount
          });
        }
        
        // Wait for user decision
        while (this.isWaitingForIterationContinue) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // If user decided to stop, break the loop
        if (!this.shouldContinueIterations) {
          const stopMessage: ChatMessage = {
            id: this.generateId(),
            role: 'notice',
            content: `Tool call process stopped by user after ${iterationCount} iterations.`,
            timestamp: Date.now()
          };

          this.messages.push(stopMessage);
          results.push(stopMessage);
          
          if (callback) {
            callback({
              type: 'message_ready',
              message: stopMessage
            });
            stopMessage.isAlreadyDisplayed = true;
          }
          break;
        }
        
        // Reset flag for next potential threshold
        this.shouldContinueIterations = false;
      }
      // Signal tool calls start on first iteration
      if (iterationCount === 0 && this.streamingCallback) {
        this.streamingCallback({
          type: 'tool_calls_start',
          messageId: existingMessageId || this.generateId()
        });
      }

      // Check for interrupt before each iteration
      if (this.isInterrupted) {
        const interruptMessage: ChatMessage = {
          id: this.generateId(),
          role: 'notice',
          content: 'Notice: Interrupted at user request.',
          timestamp: Date.now()
        };

        this.messages.push(interruptMessage);
        results.push(interruptMessage);
        
        if (callback) {
          callback({
            type: 'message_ready',
            message: interruptMessage
          });
          interruptMessage.isAlreadyDisplayed = true;
        }
        
        // Signal tool calls end
        if (this.streamingCallback) {
          this.streamingCallback({
            type: 'tool_calls_end',
            messageId: existingMessageId || this.generateId()
          });
        }
        
        return results;
      }

      iterationCount++;

      // Execute each tool call in the normalized tool calls
      for (const toolCall of normalizedToolCalls) {
        // Wait for correction if one is pending
        if (this.isWaitingForCorrection) {
          // Wait until correction is resolved
          while (this.isWaitingForCorrection) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms and check again
          }
        }

        // Check if we have a pending correction to apply
        if (this.pendingCorrection) {
          const correctionMessage: OpenAIChatMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: `Error: User correction: ${this.pendingCorrection}`
          };

          // Notify UI that correction has been applied
          if (this.streamingCallback) {
            this.streamingCallback({
              type: 'correction_applied',
              messageId: 'system',
              correctionText: this.pendingCorrection
            });
          }

          toolMessages.push(correctionMessage);
          
          // Clear the pending correction after using it
          this.pendingCorrection = null;
          continue; // Skip normal tool execution
        }

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await this.tools.executeTool(toolCall.function.name, args);
          
          const toolResultMessage: OpenAIChatMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResult.success ? toolResult.content : `Error: ${toolResult.error}`
          };

          toolMessages.push(toolResultMessage);

        } catch (error) {
          const toolResultMessage: OpenAIChatMessage = {
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
        const followUpRequest: OpenAIChatRequest = {
          ...originalRequest,
          messages: toolMessages
        };

        const followUpStartTime = Date.now();
        
        // Use streaming for follow-up responses if streaming is enabled and we're in streaming mode
        const enableStreaming = this.openai.getEnableStreaming();
        let followUpResponse: any;
        let followUpEndTime: number;
        
        if (enableStreaming && isStreamingMode) {
          // Process follow-up response with streaming
          const followUpMessageId = this.generateId();
          let accumulatedContent = '';
          let accumulatedThinking = '';
          let accumulatedToolCalls: ToolCall[] = [];
          
          // Send start event for follow-up streaming
          if (this.streamingCallback) {
            this.streamingCallback({
              type: 'start',
              messageId: followUpMessageId,
              model: this.openai.getCurrentModel()
            });
          }
          
          try {
            for await (const chunk of this.openai.sendChatStream(followUpRequest)) {
              const delta = chunk.choices[0]?.delta;
              
              if (!delta) continue;

              // Handle content updates
              if (delta.content) {
                accumulatedContent += delta.content;
                
                if (this.streamingCallback) {
                  this.streamingCallback({
                    type: 'content',
                    messageId: followUpMessageId,
                    content: delta.content
                  });
                }
              }

              // Handle thinking/reasoning updates
              const deltaReasoning = this.extractReasoning(delta);
              if (deltaReasoning) {
                accumulatedThinking += deltaReasoning;
                
                if (this.streamingCallback) {
                  this.streamingCallback({
                    type: 'thinking',
                    messageId: followUpMessageId,
                    thinking: deltaReasoning
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
                    const existingIndex = accumulatedToolCalls.findIndex((tc: any) => tc.index === index);
                    
                    if (existingIndex >= 0) {
                      // Merge existing tool call
                      const existing = accumulatedToolCalls[existingIndex] as any;
                      
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
                      accumulatedToolCalls.push(newToolCall);
                    }
                  } else {
                    // Legacy: tool call without index
                    accumulatedToolCalls.push(deltaToolCall as ToolCall);
                  }
                }
                
                if (this.streamingCallback) {
                  this.streamingCallback({
                    type: 'tool_calls',
                    messageId: followUpMessageId,
                    toolCalls: delta.tool_calls as ToolCall[]
                  });
                }
              }
            }
            
            followUpEndTime = Date.now();
            
            // Send end event for follow-up streaming
            if (this.streamingCallback) {
              this.streamingCallback({
                type: 'end',
                messageId: followUpMessageId,
                isComplete: true
              });
            }
            
            // Create response object for compatibility
            followUpResponse = {
              choices: [{
                message: {
                  role: 'assistant',
                  content: accumulatedContent,
                  reasoning: accumulatedThinking,
                  tool_calls: accumulatedToolCalls.length > 0 ? this.normalizeToolCalls(accumulatedToolCalls) : undefined
                }
              }]
            };
            
          } catch (streamError) {
            // Send error event for follow-up streaming
            if (this.streamingCallback) {
              this.streamingCallback({
                type: 'error',
                messageId: followUpMessageId,
                error: streamError instanceof Error ? streamError.message : String(streamError)
              });
            }
            throw streamError;
          }
          
        } else {
          // Non-streaming follow-up response
          followUpResponse = await this.openai.sendChat(followUpRequest);
          followUpEndTime = Date.now();
        }

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
          const normalizedCurrentMessage: OpenAIChatMessage = {
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
            reasoning: this.extractReasoning(currentMessage),
            model: this.openai.getCurrentModel()
          };
          
          this.messages.push(intermediateChatMessage);
          results.push(intermediateChatMessage);
          
          // In streaming mode, the message was already displayed via streaming callbacks
          const enableStreaming = this.openai.getEnableStreaming();
          if (enableStreaming && isStreamingMode) {
            // Mark as already displayed to prevent duplication
            intermediateChatMessage.isAlreadyDisplayed = true;
          } else {
            // Send intermediate message immediately to UI via callback (non-streaming mode)
            if (callback) {
              callback({
                type: 'message_ready',
                message: intermediateChatMessage
              });
              // Mark as displayed to prevent duplication in final message loop
              intermediateChatMessage.isAlreadyDisplayed = true;
            }
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
        
        // Error messages are not streamed, so always send via callback
        if (callback) {
          callback({
            type: 'message_ready',
            message: errorMessage
          });
          // Mark as displayed to prevent duplication in final message loop
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
        reasoning: this.extractReasoning(currentMessage),
        model: this.openai.getCurrentModel()
      };

      this.messages.push(finalChatMessage);
      results.push(finalChatMessage);
      
      // In streaming mode, the message was already displayed via streaming callbacks
      const enableStreaming = this.openai.getEnableStreaming();
      if (enableStreaming && isStreamingMode) {
        // Mark as already displayed to prevent duplication
        finalChatMessage.isAlreadyDisplayed = true;
      } else {
        // Send final message immediately to UI via callback (non-streaming mode)
        if (callback) {
          callback({
            type: 'message_ready',
            message: finalChatMessage
          });
          // Mark as displayed to prevent duplication in final message loop
          finalChatMessage.isAlreadyDisplayed = true;
        }
      }
    }

    // Signal tool calls end
    if (this.streamingCallback) {
      this.streamingCallback({
        type: 'tool_calls_end',
        messageId: existingMessageId || this.generateId()
      });
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
      return modelList.models.map((model: any) => model.name);
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

  // Change tracking methods
  async getPendingChanges() {
    return await this.tools.getPendingChanges();
  }

  async acceptChange(changeId: string): Promise<void> {
    await this.tools.acceptChange(changeId);
  }

  async rejectChange(changeId: string): Promise<void> {
    await this.tools.rejectChange(changeId);
  }

  async getChangeHtmlDiff(changeId: string): Promise<string | null> {
    return await this.tools.getChangeHtmlDiff(changeId);
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
