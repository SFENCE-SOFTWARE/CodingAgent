// src/tools/askUser.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import * as vscode from 'vscode';

export class AskUserTool implements BaseTool {
  private static chatService: any = null; // Reference to ChatService for user interaction management
  getToolInfo(): ToolInfo {
    return {
      name: 'ask_user',
      displayName: 'Ask User',
      description: 'Request feedback or clarification from the user and wait for their response',
      category: 'system'
    };
  }

  getToolDefinition(): ToolDefinition {
    // Get uncertainty threshold from configuration
    const config = vscode.workspace.getConfiguration('codingagent');
    const uncertaintyThreshold = config.get('askUser.uncertaintyThreshold', 70);
    
    return {
      type: 'function',
      function: {
        name: 'ask_user',
        description: `Request feedback or clarification from the user and wait for their response. Use this tool when you are uncertain about something and need user input to proceed correctly. Use this when your uncertainty is ${uncertaintyThreshold}% or higher.`,
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question or request for clarification to ask the user'
            },
            context: {
              type: 'string',
              description: 'Additional context explaining why you need this information'
            },
            urgency: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'How urgent the question is (affects UI appearance)'
            }
          },
          required: ['question']
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { question, context, urgency = 'medium' } = args;

      if (!question || typeof question !== 'string') {
        return {
          success: false,
          error: 'Question parameter is required and must be a string',
          content: ''
        };
      }

      // Generate unique ID for this request
      const requestId = Date.now().toString();

      // Send message to chat service to show user prompt dialog
      const response = await this.requestUserInput(requestId, question, context, urgency);

      if (response.cancelled) {
        return {
          success: false,
          error: 'User cancelled the request',
          content: 'Operation cancelled by user'
        };
      }

      return {
        success: true,
        content: `User responded: "${response.answer}"`
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        content: ''
      };
    }
  }

  private async requestUserInput(
    requestId: string, 
    question: string, 
    context?: string, 
    urgency: string = 'medium'
  ): Promise<{ answer?: string; cancelled: boolean }> {
    return new Promise((resolve) => {
      // Store the resolver for this request
      AskUserTool.pendingRequests.set(requestId, resolve);

      // Notify ChatService that we're waiting for user interaction
      if (AskUserTool.chatService && AskUserTool.chatService.setWaitingForUserInteraction) {
        AskUserTool.chatService.setWaitingForUserInteraction(true);
      }

      // Send request to extension
      const payload = {
        type: 'askUserRequest',
        requestId,
        question,
        context,
        urgency
      };

      // Get the extension context and send message
      // This will be handled by chatService.ts
      if (AskUserTool.messageHandler) {
        AskUserTool.messageHandler(payload);
      }

      // Set timeout (5 minutes)
      setTimeout(() => {
        if (AskUserTool.pendingRequests.has(requestId)) {
          AskUserTool.pendingRequests.delete(requestId);
          
          // Notify ChatService that user interaction is complete
          if (AskUserTool.chatService && AskUserTool.chatService.setWaitingForUserInteraction) {
            AskUserTool.chatService.setWaitingForUserInteraction(false);
          }
          
          resolve({ cancelled: true });
        }
      }, 5 * 60 * 1000);
    });
  }

  // Static members for handling async communication
  private static pendingRequests = new Map<string, (response: { answer?: string; cancelled: boolean }) => void>();
  private static messageHandler: ((payload: any) => void) | null = null;
  private static interruptHandler: (() => void) | null = null;

  static setChatService(chatService: any) {
    AskUserTool.chatService = chatService;
  }

  static setMessageHandler(handler: (payload: any) => void) {
    AskUserTool.messageHandler = handler;
  }

  static setInterruptHandler(handler: () => void) {
    AskUserTool.interruptHandler = handler;
  }

  static resolveRequest(requestId: string, answer?: string, cancelled: boolean = false) {
    const resolver = AskUserTool.pendingRequests.get(requestId);
    if (resolver) {
      AskUserTool.pendingRequests.delete(requestId);
      
      // Notify ChatService that user interaction is complete
      if (AskUserTool.chatService && AskUserTool.chatService.setWaitingForUserInteraction) {
        AskUserTool.chatService.setWaitingForUserInteraction(false);
      }
      
      // If user cancelled, immediately trigger interrupt
      if (cancelled && AskUserTool.interruptHandler) {
        AskUserTool.interruptHandler();
      }
      
      resolver({ answer, cancelled });
    }
  }
}
