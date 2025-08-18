// src/tools/executeTerminal.ts

import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

interface PendingCommand {
  id: string;
  command: string;
  cwd: string; // Always workspace root
  newTerminal?: boolean;
  resolvePromise: (approved: boolean) => void;
  rejectPromise: (error: Error) => void;
}

export class ExecuteTerminalTool implements BaseTool {
  private static activeTerminal: vscode.Terminal | undefined;
  private static pendingCommands: Map<string, PendingCommand> = new Map();
  private static commandApprovalCallback?: (commandId: string, command: string, cwd: string) => Promise<boolean>;

  getToolInfo(): ToolInfo {
    return {
      name: 'execute_terminal',
      displayName: 'Execute Terminal',
      description: 'Execute a terminal command in VS Code terminal with user approval',
      category: 'system'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'execute_terminal',
        description: 'Execute a terminal command in VS Code terminal with user approval. Commands run in workspace root directory.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute in VS Code terminal (runs in workspace root)'
            },
            newTerminal: {
              type: 'boolean',
              description: 'Create a new terminal instead of using existing one (default: false)'
            }
          },
          required: ['command'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const command = args.command;
      const newTerminal = args.newTerminal || false;

      console.log(`[ExecuteTerminalTool] Requesting approval for command: ${command}`);
      console.log(`[ExecuteTerminalTool] Working directory: ${workspaceRoot} (workspace root)`);
      console.log(`[ExecuteTerminalTool] New terminal: ${newTerminal}`);

      // Generate unique command ID
      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create pending command entry (no cwd parameter)
      const pendingCommand: PendingCommand = {
        id: commandId,
        command,
        cwd: workspaceRoot, // Always use workspace root
        newTerminal,
        resolvePromise: () => {},
        rejectPromise: () => {}
      };

      // Create promise for user approval
      const approvalPromise = new Promise<boolean>((resolve, reject) => {
        pendingCommand.resolvePromise = resolve;
        pendingCommand.rejectPromise = reject;
        
        // Set timeout for approval (5 minutes)
        setTimeout(() => {
          ExecuteTerminalTool.pendingCommands.delete(commandId);
          reject(new Error('Command approval timeout - no user response within 5 minutes'));
        }, 5 * 60 * 1000);
      });

      // Store pending command
      ExecuteTerminalTool.pendingCommands.set(commandId, pendingCommand);

      // Request approval from UI (pass workspace root as cwd)
      if (ExecuteTerminalTool.commandApprovalCallback) {
        console.log(`[ExecuteTerminalTool] Calling approval callback for command: ${commandId}`);
        ExecuteTerminalTool.commandApprovalCallback(commandId, command, workspaceRoot);
      } else {
        console.error(`[ExecuteTerminalTool] No approval callback set - cannot request user approval`);
        ExecuteTerminalTool.pendingCommands.delete(commandId);
        return {
          success: false,
          content: '',
          error: 'Terminal execution requires user approval, but approval system is not initialized'
        };
      }

      // Wait for user approval
      console.log(`[ExecuteTerminalTool] Waiting for user approval for command: ${commandId}`);
      const approved = await approvalPromise;
      
      // Clean up pending command
      ExecuteTerminalTool.pendingCommands.delete(commandId);

      if (!approved) {
        console.log(`[ExecuteTerminalTool] Command rejected by user: ${command}`);
        return {
          success: false,
          content: '',
          error: 'Command execution was denied by user'
        };
      }

      console.log(`[ExecuteTerminalTool] Command approved by user, executing: ${command}`);

      // Execute the approved command (always in workspace root)
      const terminal = this.getOrCreateTerminal(newTerminal, workspaceRoot);
      
      // Show the terminal so user can see what's happening
      terminal.show(true); // true = take focus to show the command execution

      // Execute command
      terminal.sendText(command);

      console.log(`[ExecuteTerminalTool] Command sent to terminal successfully: ${command}`);

      return {
        success: true,
        content: `Command executed in VS Code terminal: ${command}\n\nThe terminal is now active and you can see the command execution. You can interact with the command if it requires input.\nWorking directory: ${workspaceRoot}`
      };

    } catch (error: any) {
      console.error(`[ExecuteTerminalTool] Error executing command:`, error);
      return {
        success: false,
        content: '',
        error: `Failed to execute command in terminal: ${error.message}`
      };
    }
  }

  private getOrCreateTerminal(forceNew: boolean = false, workspaceRoot?: string): vscode.Terminal {
    // If forcing new terminal or no active terminal exists, create new one
    if (forceNew || !ExecuteTerminalTool.activeTerminal || ExecuteTerminalTool.activeTerminal.exitStatus) {
      const terminalOptions: vscode.TerminalOptions = {
        name: 'CodingAgent',
        cwd: workspaceRoot // Always use workspace root
      };

      ExecuteTerminalTool.activeTerminal = vscode.window.createTerminal(terminalOptions);
    }

    return ExecuteTerminalTool.activeTerminal;
  }

  // Method to get current terminal for external use
  static getCurrentTerminal(): vscode.Terminal | undefined {
    return ExecuteTerminalTool.activeTerminal;
  }

  // Clean up when terminal is disposed
  static disposeTerminal(): void {
    if (ExecuteTerminalTool.activeTerminal) {
      ExecuteTerminalTool.activeTerminal.dispose();
      ExecuteTerminalTool.activeTerminal = undefined;
    }
  }

  // Set callback for command approval requests
  static setCommandApprovalCallback(callback: (commandId: string, command: string, cwd: string) => Promise<boolean>): void {
    console.log(`[ExecuteTerminalTool] Setting command approval callback`);
    ExecuteTerminalTool.commandApprovalCallback = callback;
  }

  // Handle user approval/rejection
  static approveCommand(commandId: string): void {
    console.log(`[ExecuteTerminalTool] Approving command: ${commandId}`);
    const pendingCommand = ExecuteTerminalTool.pendingCommands.get(commandId);
    if (pendingCommand) {
      pendingCommand.resolvePromise(true);
    } else {
      console.warn(`[ExecuteTerminalTool] No pending command found for ID: ${commandId}`);
    }
  }

  static rejectCommand(commandId: string): void {
    console.log(`[ExecuteTerminalTool] Rejecting command: ${commandId}`);
    const pendingCommand = ExecuteTerminalTool.pendingCommands.get(commandId);
    if (pendingCommand) {
      pendingCommand.resolvePromise(false);
    } else {
      console.warn(`[ExecuteTerminalTool] No pending command found for ID: ${commandId}`);
    }
  }

  // Get pending commands for UI display
  static getPendingCommands(): Array<{id: string, command: string, cwd: string}> {
    return Array.from(ExecuteTerminalTool.pendingCommands.values()).map(cmd => ({
      id: cmd.id,
      command: cmd.command,
      cwd: cmd.cwd
    }));
  }
}
