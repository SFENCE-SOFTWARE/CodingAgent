// src/chatService.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from './openai_html_api';
import { ToolsService } from './tools';
import { LoggingService } from './loggingService';
import { AskUserTool } from './tools/askUser';
import { PlanContextManager } from './planContextManager';
import { AlgorithmEngine } from './algorithmEngine';
import { PlanningService } from './planningService';
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
  private algorithmEngine: AlgorithmEngine;
  private streamingCallback?: (update: StreamingUpdate) => void;
  private isInterrupted: boolean = false;
  private pendingCorrection: string | null = null;
  private isWaitingForCorrection: boolean = false;
  private isWaitingForIterationContinue: boolean = false;
  private shouldContinueIterations: boolean = false;
  private currentAbortController: AbortController | null = null;
  private allowedIterations: number = 10; // How many iterations are currently allowed
  private currentPlanId: string | null = null; // Track the current active plan ID
  private workspaceRoot: string | null = null; // Store workspace root for history persistence
  private isOrchestrated: boolean = false; // Track if we're in orchestrated mode

  constructor(toolsService?: ToolsService) {
    this.openai = new OpenAIService();
    this.tools = toolsService || new ToolsService();
    this.logging = LoggingService.getInstance();
    this.algorithmEngine = AlgorithmEngine.getInstance();
    
    // Register this ChatService instance with the algorithm engine
    this.algorithmEngine.setChatService(this);
    
    // Register planning service with algorithm engine
    const planningService = PlanningService.getInstance();
    this.algorithmEngine.setPlanningService(planningService);
    
    // Get workspace root for history persistence
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;
    
    // Load existing chat history
    this.loadChatHistory();
    
    // Set up change notification callback from tools to UI
    this.tools.setChangeNotificationCallback((changeId: string) => {
      this.handleChangeNotification(changeId);
    });
    
    // Set up ask user message handler
    AskUserTool.setMessageHandler((payload: any) => {
      this.handleAskUserRequest(payload);
    });
    
    // Set up ask user interrupt handler
    AskUserTool.setInterruptHandler(() => {
      this.isInterrupted = true;
    });
    
    // Set up plan context manager callback
    const planContextManager = PlanContextManager.getInstance();
    planContextManager.setUpdateCallback((planId: string | null) => {
      this.currentPlanId = planId;
    });
    
    // Set up mode change callback
    this.tools.setModeChangeCallback(async (targetMode: string, task: string, originalMode: string) => {
      return await this.handleModeChange(targetMode, task, originalMode);
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

  private handleAskUserRequest(payload: any): void {
    // Forward ask user request to UI
    if (this.streamingCallback) {
      this.streamingCallback({
        type: 'ask_user_request',
        messageId: 'system',
        requestId: payload.requestId,
        question: payload.question,
        context: payload.context,
        urgency: payload.urgency
      });
    }
  }

  /**
   * Helper function to extract reasoning/thinking from delta or message object
   * Supports both 'reasoning' and 'reasoning_content' field names
   */
  private extractReasoning(obj: any): string | undefined {
    const reasoning = obj.reasoning || obj.reasoning_content;
    return reasoning;
  }

  setStreamingCallback(callback: (update: StreamingUpdate) => void): void {
    this.streamingCallback = callback;
  }

  /**
   * Process system message by replacing dynamic placeholders
   */
  private processSystemMessage(systemMessage: string): string {
    let processedMessage = systemMessage;
    
    // Replace <plan_id> placeholder with current plan ID
    if (processedMessage.includes('<plan_id>')) {
      const planContextManager = PlanContextManager.getInstance();
      const planIdValue = planContextManager.getCurrentPlanId() || 'No active plan';
      processedMessage = processedMessage.replace('<plan_id>', planIdValue);
    }
    
    return processedMessage;
  }

  /**
   * Get the appropriate system message for current context
   */
  private getSystemMessage(modeConfig: any, isOrchestrated: boolean = false): string {
    // Use orchestrationMessage when called under mode delegation, fallback to systemMessage
    const baseMessage = isOrchestrated && modeConfig.orchestrationMessage 
      ? modeConfig.orchestrationMessage 
      : modeConfig.systemMessage;
    
    return this.processSystemMessage(baseMessage);
  }

  /**
   * Set the current active plan ID for context in system messages
   */
  public setCurrentPlanId(planId: string | null): void {
    const planContextManager = PlanContextManager.getInstance();
    planContextManager.setCurrentPlanId(planId);
  }

  /**
   * Get the current active plan ID
   */
  public getCurrentPlanId(): string | null {
    const planContextManager = PlanContextManager.getInstance();
    return planContextManager.getCurrentPlanId();
  }

  interruptLLM(): void {
    this.isInterrupted = true;
  }

  hardInterruptLLM(): void {
    this.isInterrupted = true;
    // Immediately abort any ongoing request
    if (this.currentAbortController) {
      this.currentAbortController.abort('Hard interrupt requested');
      this.currentAbortController = null;
    }
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

  private async handleModeChange(targetMode: string, task: string, originalMode: string): Promise<string> {
    // Store original orchestrated state
    const wasOrchestrated = this.isOrchestrated;
    
    try {
      // Get current configuration
      const config = vscode.workspace.getConfiguration('codingagent');
      
      // Send notice about mode switch to UI
      this.addNoticeMessage(`🔄 Switching to ${targetMode} mode to handle delegated task...`);
      
      // Temporarily switch to target mode
      await config.update('currentMode', targetMode, vscode.ConfigurationTarget.Global);
      
      // Set orchestrated flag to use orchestrationMessage
      this.isOrchestrated = true;
      
      // Create and send task message from the orchestrator
      const taskMessage = this.addTaskMessage(task, 'LLM ORCHESTRATOR MODE');
      
      // Store original streaming callback to avoid interfering with delegation
      const originalStreamingCallback = this.streamingCallback;
      let delegationComplete = false;
      let finalResponse = '';
      
      // Set a temporary callback to track delegation completion
      this.streamingCallback = (update: StreamingUpdate) => {
        if (update.type === 'tool_calls_end') {
          delegationComplete = true;
        }
        // Still forward updates to the original callback if it exists
        if (originalStreamingCallback) {
          originalStreamingCallback(update);
        }
      };
      
      // Send task to the target mode LLM
      const responseMessages = await this.processMessage(task);
      
      // Wait for tool calls to complete if they are running
      const maxWaitTime = 60000; // 60 seconds timeout
      const startWait = Date.now();
      while (!delegationComplete && (Date.now() - startWait) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
        // Check if we have any recent assistant messages that might be complete
        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && (!lastMessage.toolCalls || lastMessage.toolCalls.length === 0)) {
          delegationComplete = true;
        }
      }
      
      // Restore original streaming callback
      this.streamingCallback = originalStreamingCallback;
      
      // Extract the content from the final assistant response
      const assistantResponse = responseMessages.find(msg => msg.role === 'assistant');
      finalResponse = assistantResponse ? assistantResponse.content : 'No response generated';
      
      // If we have newer messages in the conversation, use the latest assistant response
      const latestMessages = this.messages.slice(-5); // Check last 5 messages
      for (let i = latestMessages.length - 1; i >= 0; i--) {
        const msg = latestMessages[i];
        if (msg.role === 'assistant' && msg.content && msg.content.trim()) {
          finalResponse = msg.content;
          break;
        }
      }
      
      // Send notice about switching back
      this.addNoticeMessage(`🔄 Task completed. Switching back to ${originalMode} mode...`);
      
      // Switch back to original mode
      await config.update('currentMode', originalMode, vscode.ConfigurationTarget.Global);
      
      // Restore orchestrated flag
      this.isOrchestrated = wasOrchestrated;
      
      return finalResponse;
    } catch (error) {
      // Ensure we switch back to original mode and restore flag even on error
      const config = vscode.workspace.getConfiguration('codingagent');
      await config.update('currentMode', originalMode, vscode.ConfigurationTarget.Global);
      this.isOrchestrated = wasOrchestrated;
      
      throw error;
    }
  }

  private addNoticeMessage(content: string): void {
    const noticeMessage: ChatMessage = {
      id: this.generateId(),
      role: 'notice',
      content: content,
      timestamp: Date.now()
    };
    
    this.messages.push(noticeMessage);
    this.saveChatHistory(); // Save after adding notice message
    
    // Send complete notice message to UI
    if (this.streamingCallback) {
      // Create a special update type for notice messages
      (this.streamingCallback as any)({
        type: 'notice_message',
        message: noticeMessage
      });
    }
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
    
    // Check if algorithm is enabled for current mode
    if (this.algorithmEngine.isAlgorithmEnabled(currentMode)) {
      try {
        const algorithmResult = await this.algorithmEngine.executeAlgorithm(currentMode, content, callback);
        
        if (algorithmResult.handled) {
          // Algorithm handled the message, create assistant response
          const assistantMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: algorithmResult.response || 'Algorithm completed successfully',
            timestamp: Date.now(),
            model: `Algorithm-${currentMode}`,
            displayRole: `Algorithm-${currentMode}`, // Custom display role without LLM prefix
            isStreaming: false
          };
          
          this.messages.push(assistantMessage);
          this.saveChatHistory();
          
          // Send update to UI
          if (callback) {
            callback({
              type: 'message_ready',
              message: assistantMessage
            });
            // Mark as already displayed to prevent duplication
            (assistantMessage as any).isAlreadyDisplayed = true;
          }
          
          return [assistantMessage];
        } else if (algorithmResult.error) {
          // Algorithm failed, log error and fallback to LLM
          await this.logging.logDebug(`Algorithm execution failed: ${algorithmResult.error}`);
          console.warn('Algorithm execution failed, falling back to LLM:', algorithmResult.error);
        }
        // If algorithm didn't handle the message, continue with LLM processing
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await this.logging.logDebug(`Algorithm execution error: ${errorMsg}`);
        console.warn('Algorithm execution error, falling back to LLM:', errorMsg);
      }
    }
    
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
          content: this.getSystemMessage(modeConfig, this.isOrchestrated)
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

      // Propagate per-mode model parameters to the request when available, pass null if not configured
      const request: OpenAIChatRequest = {
        model: currentModel,
        messages: openaiMessages,
        temperature: typeof modeConfig.temperature === 'number' ? modeConfig.temperature : null,
        top_p: typeof modeConfig.top_p === 'number' ? modeConfig.top_p : null,
        presence_penalty: typeof modeConfig.presence_penalty === 'number' ? modeConfig.presence_penalty : null,
        frequency_penalty: typeof modeConfig.frequency_penalty === 'number' ? modeConfig.frequency_penalty : null,
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
      this.saveChatHistory(); // Save after adding error message
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
    // NOTE: Only raw JSON logging for requests - readable log will be done with complete response
    this.logging.logRawJsonCommunication(request, null, {
      model: currentModel,
      mode: currentMode,
      timestamp: startTime,
      context: 'request-sent'
    });

    // Create abort controller for this request
    this.currentAbortController = new AbortController();

    const response = await this.openai.sendChat(request, this.currentAbortController.signal);
    this.currentAbortController = null; // Clear after completion
    
    const endTime = Date.now();
    
    // Log the response immediately when received (for non-streaming final responses)
    this.logging.logAiCommunication(request, response, {
      model: currentModel,
      mode: currentMode,
      timestamp: endTime,
      duration: endTime - startTime,
      context: 'non-streaming-response'
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
      try {
        const toolResults = await this.handleToolCalls(assistantMessage, request, undefined, callback, false);
        return toolResults;
      } catch (error) {
        if (error instanceof Error && error.message === 'USER_CANCELLED_ASK_USER') {
          // User cancelled ask_user - stop processing and don't add any messages
          return [];
        }
        // Re-throw other errors
        throw error;
      }
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
    this.saveChatHistory(); // Save after adding non-streaming assistant message
    
    // Send message immediately to UI via callback
    if (callback) {
      callback({
        type: 'message_ready',
        message: chatMessage
      });
      // Mark as displayed to prevent duplication in final message loop
      chatMessage.isAlreadyDisplayed = true;
    }
    
    // Check for automatic plan evaluation after LLM response
    await this.checkAndExecuteAutomaticPlanEvaluation(callback);
    
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
    // NOTE: Only raw JSON logging for requests - readable log will be done with complete response
    this.logging.logRawJsonCommunication(request, null, {
      model: currentModel,
      mode: currentMode,
      timestamp: startTime,
      context: 'streaming-request-sent'
    });

    // Create abort controller for this request
    this.currentAbortController = new AbortController();

    try {
      for await (const chunk of this.openai.sendChatStream(request, this.currentAbortController.signal)) {
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
        const deltaReasoning = this.extractReasoning(delta);
        if (deltaReasoning) {
          accumulatedThinking += deltaReasoning;
          chatMessage.reasoning = accumulatedThinking;
          
          if (this.streamingCallback) {
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
      this.saveChatHistory(); // Save after completing streaming message

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
        
        try {
          const toolResults = await this.handleToolCalls(assistantMessage, request, messageId, callback, true);
          return toolResults;
        } catch (error) {
          if (error instanceof Error && error.message === 'USER_CANCELLED_ASK_USER') {
            // User cancelled ask_user - stop processing and don't add any messages
            return [];
          }
          // Re-throw other errors
          throw error;
        }
      }

      // Clear abort controller after successful completion
      this.currentAbortController = null;
      
      // Check for automatic plan evaluation after streaming response completion
      await this.checkAndExecuteAutomaticPlanEvaluation(callback);
      
      return [chatMessage];

    } catch (error) {
      // Clear abort controller on error
      this.currentAbortController = null;
      
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
    const toolExecutionResults: any[] = []; // Track tool results for logging

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
      this.saveChatHistory(); // Save after adding assistant message
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
      // Check for interrupt at the beginning of each iteration
      if (this.isInterrupted) {
        console.log('[CodingAgent] Tool calls loop interrupted by user');
        
        // Notify UI about tool calls ending due to interrupt
        if (this.streamingCallback) {
          this.streamingCallback({
            type: 'tool_calls_end',
            messageId: existingMessageId || this.generateId()
          });
        }
        
        // Stop execution and return current results
        return results;
      }
      
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
        // Check for interrupt before each tool call
        if (this.isInterrupted) {
          console.log('[CodingAgent] Tool execution interrupted by user');
          
          // Notify UI about tool calls ending due to interrupt
          if (this.streamingCallback) {
            this.streamingCallback({
              type: 'tool_calls_end',
              messageId: existingMessageId || this.generateId()
            });
          }
          
          // Stop execution and return current results
          return results;
        }
        
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
          
          // Store tool result for logging
          toolExecutionResults.push({
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            args: args,
            ...toolResult
          });
          
          // Check for interrupt after tool execution (for ask_user cancellation)
          if (this.isInterrupted) {
            console.log('[CodingAgent] Tool execution interrupted after tool completion');
            
            // Notify UI about tool calls ending
            if (this.streamingCallback) {
              this.streamingCallback({
                type: 'tool_calls_end',
                messageId: existingMessageId || this.generateId()
              });
            }
            
            // Stop execution and return current results
            return results;
          }
          
          // Special handling for ask_user tool cancellation (legacy - should be handled by interrupt above)
          if (toolCall.function.name === 'ask_user' && !toolResult.success && toolResult.error?.includes('cancelled')) {
            // User cancelled - trigger interrupt like behavior
            this.isInterrupted = true;
            
            // Notify UI about tool calls ending
            if (this.streamingCallback) {
              this.streamingCallback({
                type: 'tool_calls_end',
                messageId: existingMessageId || this.generateId()
              });
            }
            
            // Throw special exception to stop processing
            throw new Error('USER_CANCELLED_ASK_USER');
          }
          
          const toolResultMessage: OpenAIChatMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: toolResult.success ? toolResult.content : `Error: ${toolResult.error}`
          };

          toolMessages.push(toolResultMessage);

        } catch (error) {
          const errorMsg = `Error parsing tool arguments: ${error instanceof Error ? error.message : String(error)}`;
          
          // Store tool error for logging
          toolExecutionResults.push({
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            success: false,
            error: errorMsg
          });
          
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
            // Use the current abort controller if available
            const abortSignal = this.currentAbortController?.signal;
            for await (const chunk of this.openai.sendChatStream(followUpRequest, abortSignal)) {
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
          const abortSignal = this.currentAbortController?.signal;
          followUpResponse = await this.openai.sendChat(followUpRequest, abortSignal);
          followUpEndTime = Date.now();
        }

        // Log the follow-up communication (standard logging)
        this.logging.logAiCommunication(followUpRequest, followUpResponse, {
          model: this.openai.getCurrentModel(),
          mode: this.openai.getCurrentMode(),
          timestamp: followUpStartTime,
          duration: followUpEndTime - followUpStartTime,
          context: `tool-follow-up-${iterationCount}`,
          toolResults: toolExecutionResults
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
        this.saveChatHistory(); // Save after adding error message
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
      this.saveChatHistory(); // Save after adding final chat message
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

    // Check for automatic plan evaluation after tool execution completion
    await this.checkAndExecuteAutomaticPlanEvaluation(callback);

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
    this.saveChatHistory(); // Save after adding user message
    return userMessage;
  }

  addTaskMessage(content: string, displayRole: string): ChatMessage {
    const taskMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    // Override the display role
    (taskMessage as any).displayRole = displayRole;
    
    this.messages.push(taskMessage);
    
    // Send task message to UI immediately
    if (this.streamingCallback) {
      (this.streamingCallback as any)({
        type: 'notice_message',
        message: taskMessage
      });
    }
    
    return taskMessage;
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
    this.saveChatHistory(); // Save empty history when clearing
  }

  /**
   * Get the path to the chat history file for the current workspace
   */
  private getChatHistoryPath(): string | null {
    if (!this.workspaceRoot) {
      return null;
    }
    
    const codingAgentDir = path.join(this.workspaceRoot, '.codingagent');
    const historyFile = path.join(codingAgentDir, 'chat-history.json');
    
    return historyFile;
  }

  /**
   * Ensure the .codingagent directory exists
   */
  private ensureCodingAgentDir(): boolean {
    if (!this.workspaceRoot) {
      return false;
    }
    
    const codingAgentDir = path.join(this.workspaceRoot, '.codingagent');
    
    try {
      if (!fs.existsSync(codingAgentDir)) {
        fs.mkdirSync(codingAgentDir, { recursive: true });
      }
      return true;
    } catch (error) {
      console.error('Failed to create .codingagent directory:', error);
      return false;
    }
  }

  /**
   * Load chat history from workspace
   */
  private loadChatHistory(): void {
    const historyPath = this.getChatHistoryPath();
    if (!historyPath) {
      console.log('No workspace found, skipping chat history load');
      return;
    }

    try {
      if (fs.existsSync(historyPath)) {
        const historyData = fs.readFileSync(historyPath, 'utf8');
        const parsedHistory = JSON.parse(historyData);
        
        // Validate and restore messages with all their properties
        if (Array.isArray(parsedHistory.messages)) {
          this.messages = parsedHistory.messages
            .filter(this.isValidChatMessage.bind(this))
            .map((msg: any) => {
              // Ensure all optional properties are properly restored
              const restoredMessage: ChatMessage = {
                id: msg.id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp
              };

              // Restore optional properties if they exist
              if (msg.toolCalls) {
                restoredMessage.toolCalls = msg.toolCalls;
              }
              if (msg.reasoning) {
                restoredMessage.reasoning = msg.reasoning;
              }
              if (msg.model) {
                restoredMessage.model = msg.model;
              }
              if (msg.raw) {
                restoredMessage.raw = msg.raw;
              }
              if (msg.changeIds) {
                restoredMessage.changeIds = msg.changeIds;
              }
              if (msg.displayRole) {
                restoredMessage.displayRole = msg.displayRole;
              }
              
              // Reset streaming flags (these shouldn't persist)
              restoredMessage.isStreaming = false;
              restoredMessage.isAlreadyDisplayed = false;

              return restoredMessage;
            });
          
          console.log(`Loaded ${this.messages.length} messages from chat history`);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Reset to empty messages on error
      this.messages = [];
    }
  }

  /**
   * Save current chat history to workspace
   */
  private saveChatHistory(): void {
    const historyPath = this.getChatHistoryPath();
    if (!historyPath) {
      console.log('No workspace found, skipping chat history save');
      return;
    }

    if (!this.ensureCodingAgentDir()) {
      console.error('Failed to create .codingagent directory');
      return;
    }

    try {
      const historyData = {
        version: '1.0',
        timestamp: Date.now(),
        messages: this.messages
      };
      
      console.log(`Saving ${this.messages.length} messages to chat history`);
      fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2), 'utf8');
      console.log('Chat history saved successfully');
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  }

  /**
   * Validate that an object is a valid ChatMessage
   */
  private isValidChatMessage(message: any): message is ChatMessage {
    const isBasicValid = (
      message &&
      typeof message.id === 'string' &&
      typeof message.role === 'string' &&
      ['user', 'assistant', 'error', 'notice'].includes(message.role) &&
      typeof message.content === 'string' &&
      typeof message.timestamp === 'number'
    );

    if (!isBasicValid) {
      return false;
    }

    // Validate optional properties if they exist
    if (message.toolCalls !== undefined && !Array.isArray(message.toolCalls)) {
      console.warn('Invalid toolCalls in message:', message.id);
      return false;
    }

    if (message.reasoning !== undefined && typeof message.reasoning !== 'string') {
      console.warn('Invalid reasoning in message:', message.id);
      return false;
    }

    if (message.model !== undefined && typeof message.model !== 'string') {
      console.warn('Invalid model in message:', message.id);
      return false;
    }

    if (message.changeIds !== undefined && !Array.isArray(message.changeIds)) {
      console.warn('Invalid changeIds in message:', message.id);
      return false;
    }

    if (message.displayRole !== undefined && typeof message.displayRole !== 'string') {
      console.warn('Invalid displayRole in message:', message.id);
      return false;
    }

    return true;
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

  /**
   * Check if automatic plan evaluation should be executed and do it
   */
  private async checkAndExecuteAutomaticPlanEvaluation(callback?: (update: ChatUpdate) => void): Promise<void> {
    try {
      // Check if automatic evaluation is enabled
      const config = vscode.workspace.getConfiguration('codingagent.plan');
      const autoEvaluationEnabled = config.get('autoEvaluationEnabled', true);
      
      if (!autoEvaluationEnabled) {
        return; // Auto evaluation is disabled
      }
      
      // Check if current mode is allowed for auto evaluation
      const allowedModes: string[] = config.get('autoEvaluationModes', ['Orchestrator']);
      const currentMode = this.openai.getCurrentMode();
      
      if (!allowedModes.includes(currentMode)) {
        return; // Current mode is not in allowed list
      }
      
      // Check if we have an active plan
      const planContextManager = PlanContextManager.getInstance();
      const currentPlanId = planContextManager.getCurrentPlanId();
      
      if (!currentPlanId) {
        return; // No active plan
      }
      
      // Check if this request came from call_under_mode (skip auto evaluation in that case)
      // We can detect this by checking if we're currently in a delegated mode call
      // This is a simple heuristic - in real implementation this would need more sophisticated tracking
      
      // Execute plan evaluation
      const planEvaluate = this.tools.getToolByName('plan_evaluate');
      if (!planEvaluate) {
        console.warn('Plan evaluate tool not found');
        return;
      }
      
      const result = await planEvaluate.execute({ plan_id: currentPlanId }, this.workspaceRoot || '');
      
      if (!result.success) {
        // Evaluation failed - just log it, don't interrupt user flow
        console.warn('Automatic plan evaluation failed:', result.error);
        return;
      }
      
      // Check if plan needs action
      if (result.content && result.content.includes('is not complete')) {
        // Extract the corrective prompt from the result
        const lines = result.content.split('\n');
        const promptIndex = lines.findIndex((line: string) => line.includes('Corrective prompt:'));
        
        if (promptIndex >= 0 && promptIndex + 1 < lines.length) {
          const correctionPrompt = lines.slice(promptIndex + 1).join('\n').trim();
          
          // Send automatic evaluation result as a system message
          const evaluationMessage: ChatMessage = {
            id: this.generateId(),
            role: 'assistant',
            content: `🔍 **Automatic Plan Evaluation**\n\n${result.content}\n\n*This evaluation was triggered automatically after your request. You can continue with the suggested corrective action or proceed with other tasks.*`,
            timestamp: Date.now(),
            model: this.openai.getCurrentModel()
          };
          
          this.messages.push(evaluationMessage);
          this.saveChatHistory();
          
          // Send to UI via callback if available
          if (callback) {
            callback({
              type: 'message_ready',
              message: evaluationMessage
            });
          }
        }
      }
      
    } catch (error) {
      // Don't let automatic evaluation errors interrupt the main flow
      console.warn('Error in automatic plan evaluation:', error);
    }
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

  /**
   * Send message to LLM for algorithm execution
   */
  async sendMessageToLLM(message: string, callback: (response: string) => void): Promise<void> {
    try {
      // Use orchestration message instead of system message for Orchestrator mode
      const response = await this.sendOrchestrationMessage(message);
      callback(response);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      callback(`Error communicating with LLM: ${errorMsg}`);
    }
  }

  /**
   * Send message using orchestration prompt instead of system prompt
   */
  private async sendOrchestrationMessage(message: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('codingagent');
    const currentMode = config.get<string>('currentMode', 'Coder');
    const modes = config.get<Record<string, any>>('modes', {});
    const modeConfig = modes[currentMode] || {};
    
    // Use orchestrationMessage instead of systemMessage for LLM calls from algorithm
    const orchestrationMessage = modeConfig.orchestrationMessage || modeConfig.systemMessage || 'You are a helpful assistant.';
    
    // Create a simple request with orchestration context
    const request: OpenAIChatRequest = {
      model: this.getCurrentModel(),
      messages: [
        {
          role: 'system',
          content: orchestrationMessage
        },
        {
          role: 'user', 
          content: message
        }
      ],
      stream: false, // Don't stream for algorithm calls
      temperature: modeConfig.temperature || 0.7
    };

    try {
      const response = await this.openai.sendChat(request);
      
      // Extract text content from response
      let responseText = '';
      if (response.choices && response.choices.length > 0) {
        const lastChoice = response.choices[response.choices.length - 1];
        if (lastChoice.message && lastChoice.message.content) {
          responseText = lastChoice.message.content;
        }
      }
      
      return responseText || 'No response received from LLM';
    } catch (error) {
      throw new Error(`Failed to get LLM response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send orchestration request with full chat UI integration
   */
  async sendOrchestrationRequest(message: string, callback: (response: string) => void, chatCallback?: (update: ChatUpdate) => void): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('codingagent');
      const currentMode = config.get<string>('currentMode', 'Coder');
      
      // Add orchestration prompt to chat history for visibility
      const promptMessage = this.addUserMessage(message); // Remove [Orchestrator Query] prefix
      
      // Set custom display role for orchestration query
      promptMessage.displayRole = `Algorithm-${currentMode} Query`;
      
      // Send real-time update to show the prompt in UI
      if (chatCallback) {
        chatCallback({
          type: 'message_ready',
          message: promptMessage
        });
      }
      
      // Process with orchestration context and get response
      const responseMessages = await this.processOrchestrationMessage(message, chatCallback);
      
      // Extract text content from response messages for algorithm callback
      let response = '';
      for (const msg of responseMessages) {
        if (msg.role === 'assistant' && msg.content) {
          response += msg.content + '\n';
        }
      }
      
      const finalResponse = response.trim() || 'No response received from LLM';
      
      // Call the algorithm callback with the response
      callback(finalResponse);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      callback(`Error communicating with LLM: ${errorMsg}`);
    }
  }

  /**
   * Get the current chat update callback for orchestration
   */
  getCurrentChatUpdateCallback(): ((update: ChatUpdate) => void) | undefined {
    // Check if there's an active processMessage flow
    // For now, return undefined as we need to explore how to integrate this properly
    return undefined;
  }

  /**
   * Process orchestration message using the same flow as normal chat
   */
  private async processOrchestrationMessage(message: string, chatCallback?: (update: ChatUpdate) => void): Promise<ChatMessage[]> {
    const config = vscode.workspace.getConfiguration('codingagent');
    const currentMode = config.get<string>('currentMode', 'Coder');
    const modes = config.get<Record<string, any>>('modes', {});
    const basicModeConfig = modes[currentMode] || {};
    
    // Use orchestrationMessage instead of systemMessage
    const orchestrationMessage = basicModeConfig.orchestrationMessage || basicModeConfig.systemMessage || 'You are a helpful assistant.';
    
    // Create messages array with orchestration context - fix types
    const messages: OpenAIChatMessage[] = [
      {
        role: 'system' as const,
        content: orchestrationMessage
      },
      {
        role: 'user' as const, 
        content: message
      }
    ];

    // Get allowed tools for current mode - orchestration can use tools too!
    const modeConfig = this.openai.getModeConfiguration(currentMode);
    const allTools = this.tools.getToolDefinitions();
    const allowedTools: ToolDefinition[] = [];
    
    for (const toolName of modeConfig.allowedTools) {
      const toolDef = allTools[toolName];
      if (toolDef) {
        allowedTools.push(toolDef);
      }
    }

    const currentModel = this.getCurrentModel();
    const enableStreaming = this.getEnableStreaming(); // Use normal streaming settings!

    // Create request exactly like normal chat flow
    const request: OpenAIChatRequest = {
      model: currentModel,
      messages: messages,
      stream: enableStreaming, // Keep streaming enabled like normal chat
      temperature: modeConfig.temperature || 0.7,
      top_p: typeof modeConfig.top_p === 'number' ? modeConfig.top_p : null,
      presence_penalty: typeof modeConfig.presence_penalty === 'number' ? modeConfig.presence_penalty : null,
      frequency_penalty: typeof modeConfig.frequency_penalty === 'number' ? modeConfig.frequency_penalty : null,
      tools: allowedTools.length > 0 ? allowedTools : undefined
    };

    const startTime = Date.now();

    try {
      // Use exactly the same flow as normal chat!
      if (enableStreaming) {
        return await this.processStreamingMessage(request, currentModel, currentMode, startTime, chatCallback);
      } else {
        return await this.processNonStreamingMessage(request, currentModel, currentMode, startTime, chatCallback);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.logging.logDebug('Orchestration request failed: ' + errorMsg);
      throw error;
    }
  }

  /**
   * Send message to LLM for algorithm execution (old method)
   */
  async sendMessageToLLMOld(message: string, callback: (response: string) => void): Promise<void> {
    try {
      // Add user message temporarily
      this.addUserMessage(message);
      
      // Process message and get response
      const responseMessages = await this.processMessage(message);
      
      // Extract text content from response messages
      let response = '';
      for (const msg of responseMessages) {
        if (msg.role === 'assistant' && msg.content) {
          response += msg.content + '\n';
        }
      }
      
      // Call the callback with the response
      callback(response.trim() || 'No response received from LLM');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      callback(`Error communicating with LLM: ${errorMsg}`);
    }
  }
}
