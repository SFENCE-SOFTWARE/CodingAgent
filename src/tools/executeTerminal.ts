// src/tools/executeTerminal.ts

import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class ExecuteTerminalTool implements BaseTool {
  private static activeTerminal: vscode.Terminal | undefined;

  getToolInfo(): ToolInfo {
    return {
      name: 'execute_terminal',
      displayName: 'Execute Terminal',
      description: 'Execute a terminal command in VS Code terminal',
      category: 'system'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'execute_terminal',
        description: 'Execute a terminal command in VS Code terminal for user to see and interact with',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute in VS Code terminal'
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the command (optional, defaults to workspace root)'
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
      const cwd = args.cwd || workspaceRoot;
      const newTerminal = args.newTerminal || false;

      // Get or create terminal
      const terminal = this.getOrCreateTerminal(newTerminal, cwd);
      
      // Show the terminal so user can see what's happening
      terminal.show(true); // true = take focus to show the command execution

      // Execute command
      terminal.sendText(command);

      return {
        success: true,
        content: `Command sent to VS Code terminal: ${command}\n\nThe terminal is now active and you can see the command execution. You can interact with the command if it requires input.`
      };

    } catch (error: any) {
      return {
        success: false,
        content: '',
        error: `Failed to execute command in terminal: ${error.message}`
      };
    }
  }

  private getOrCreateTerminal(forceNew: boolean = false, cwd?: string): vscode.Terminal {
    // If forcing new terminal or no active terminal exists, create new one
    if (forceNew || !ExecuteTerminalTool.activeTerminal || ExecuteTerminalTool.activeTerminal.exitStatus) {
      const terminalOptions: vscode.TerminalOptions = {
        name: 'CodingAgent',
        cwd: cwd
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
}
