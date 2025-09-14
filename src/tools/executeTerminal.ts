// src/tools/executeTerminal.ts

import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

interface PendingCommand {
  id: string;
  command: string;
  cwd: string; // Always workspace root
  newTerminal?: boolean;
  resolvePromise: (approved: boolean) => void;
  rejectPromise: (error: Error) => void;
}

/**
 * Parse command string and extract individual commands from complex command lines
 * Handles operators: &&, ||, |, ;, &
 */
function parseCommandString(command: string): string[] {
  // Split by common command separators
  // Note: This is a simplified parser - complex shell parsing would require a proper lexer
  const separators = /(\s*&&\s*|\s*\|\|\s*|\s*[|;&]\s*)/;
  const parts = command.split(separators);
  
  const commands: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    // Skip empty parts and separator operators
    if (trimmed && !trimmed.match(/^(&&|\|\||[|;&])$/)) {
      // Extract just the command name (first word)
      const commandName = trimmed.split(/\s+/)[0];
      if (commandName) {
        commands.push(commandName);
      }
    }
  }
  
  return commands;
}

/**
 * Check if command(s) are in the auto-approve list
 */
function isCommandAutoApproved(command: string): boolean {
  const config = vscode.workspace.getConfiguration('codingagent');
  const autoApproveCommands = config.get<string>('tools.autoApproveCommands', '');
  
  if (!autoApproveCommands.trim()) {
    return false; // No auto-approve list configured
  }
  
  // Parse the auto-approve list (comma-separated)
  const approvedCommands = autoApproveCommands
    .split(',')
    .map(cmd => cmd.trim().toLowerCase())
    .filter(cmd => cmd.length > 0);
  
  if (approvedCommands.length === 0) {
    return false;
  }
  
  // Parse the command to extract individual commands
  const commandsInInput = parseCommandString(command);
  
  console.log(`[ExecuteTerminalTool] Checking auto-approval for command: "${command}"`);
  console.log(`[ExecuteTerminalTool] Extracted commands: [${commandsInInput.join(', ')}]`);
  console.log(`[ExecuteTerminalTool] Auto-approved commands: [${approvedCommands.join(', ')}]`);
  
  // All extracted commands must be in the approved list
  const allApproved = commandsInInput.every(cmd => 
    approvedCommands.includes(cmd.toLowerCase())
  );
  
  console.log(`[ExecuteTerminalTool] Auto-approval result: ${allApproved}`);
  return allApproved;
}

export class ExecuteTerminalTool implements BaseTool {
  private static chatService: any = null; // Reference to ChatService for user interaction management
  private static activeTerminal: vscode.Terminal | undefined;
  private static pendingCommands: Map<string, PendingCommand> = new Map();
  private static commandApprovalCallback?: (commandId: string, command: string, cwd: string) => Promise<boolean>;

  static setChatService(chatService: any) {
    ExecuteTerminalTool.chatService = chatService;
  }

  getToolInfo(): ToolInfo {
    return {
      name: 'execute_terminal',
      displayName: 'Execute Terminal',
      description: 'Execute a terminal command in VS Code terminal with user approval',
      category: 'system'
    };
  }

  getToolDefinition(): ToolDefinition {
    // Get OS info dynamically
    const osType = process.platform;
    const osNames: Record<string, string> = {
      'win32': 'Windows',
      'darwin': 'macOS', 
      'linux': 'Linux',
      'freebsd': 'FreeBSD',
      'openbsd': 'OpenBSD',
      'aix': 'AIX',
      'android': 'Android',
      'cygwin': 'Cygwin',
      'haiku': 'Haiku',
      'netbsd': 'NetBSD',
      'sunos': 'SunOS'
    };
    const osName = osNames[osType] || osType;
    
    return {
      type: 'function',
      function: {
        name: 'execute_terminal',
        description: `Execute a terminal command in VS Code terminal with user approval. Commands run in workspace root directory on ${osName} (${osType}). Some commands may be auto-approved based on user settings. Output includes both stdout and stderr.`,
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: `Command to execute in VS Code terminal (runs in workspace root on ${osName}). Simple commands like ls, pwd, git status may be auto-approved.`
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

      console.log(`[ExecuteTerminalTool] Requesting execution for command: ${command}`);
      console.log(`[ExecuteTerminalTool] Working directory: ${workspaceRoot} (workspace root)`);
      console.log(`[ExecuteTerminalTool] New terminal: ${newTerminal}`);

      // Check if command is auto-approved
      const autoApproved = isCommandAutoApproved(command);
      
      if (autoApproved) {
        console.log(`[ExecuteTerminalTool] Command auto-approved, executing immediately: ${command}`);
        return await this.executeCommandWithOutput(command, workspaceRoot);
      }

      // Command requires manual approval
      console.log(`[ExecuteTerminalTool] Command requires manual approval: ${command}`);

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
        
        // No timeout - wait indefinitely for user response
        // User must explicitly approve or reject the command
      });

      // Store pending command
      ExecuteTerminalTool.pendingCommands.set(commandId, pendingCommand);

      // Request approval from UI (pass workspace root as cwd)
      if (ExecuteTerminalTool.commandApprovalCallback) {
        console.log(`[ExecuteTerminalTool] Calling approval callback for command: ${commandId}`);
        
        // Notify ChatService that we're waiting for user interaction
        if (ExecuteTerminalTool.chatService && ExecuteTerminalTool.chatService.setWaitingForUserInteraction) {
          ExecuteTerminalTool.chatService.setWaitingForUserInteraction(true);
        }
        
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
      
      // Notify ChatService that user interaction is complete
      if (ExecuteTerminalTool.chatService && ExecuteTerminalTool.chatService.setWaitingForUserInteraction) {
        ExecuteTerminalTool.chatService.setWaitingForUserInteraction(false);
      }
      
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

      // Execute the approved command using child_process to capture output
      return await this.executeCommandWithOutput(command, workspaceRoot);

    } catch (error: any) {
      console.error(`[ExecuteTerminalTool] Error executing command:`, error);
      return {
        success: false,
        content: '',
        error: `Failed to execute command in terminal: ${error.message}`
      };
    }
  }

  private async executeCommandWithOutput(command: string, workspaceRoot: string): Promise<ToolResult> {
    return new Promise((resolve) => {
      console.log(`[ExecuteTerminalTool] Executing command with output capture: ${command}`);
      console.log(`[ExecuteTerminalTool] Working directory: ${workspaceRoot}`);

      // Also show in VS Code terminal for user visibility
      const terminal = this.getOrCreateTerminal(false, workspaceRoot);
      terminal.show(true);
      terminal.sendText(`# Executing: ${command}`);
      terminal.sendText(command);

      // Execute with child_process to capture output
      const child = childProcess.exec(command, {
        cwd: workspaceRoot,
        timeout: 60000, // 60 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: { ...process.env } // Inherit environment variables
      });

      let stdout = '';
      let stderr = '';
      let hasOutput = false;

      // Capture stdout
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          const text = data.toString();
          stdout += text;
          hasOutput = true;
        });
      }

      // Capture stderr
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          hasOutput = true;
        });
      }

      // Handle completion
      child.on('close', (code: number | null, signal: string | null) => {
        console.log(`[ExecuteTerminalTool] Command completed with code: ${code}, signal: ${signal}`);
        
        // Combine stdout and stderr as user would see in terminal
        let combinedOutput = '';
        if (stdout) {
          combinedOutput += stdout;
        }
        if (stderr) {
          if (combinedOutput) {combinedOutput += '\n';}
          combinedOutput += stderr;
        }

        // If no output, indicate command completed
        if (!hasOutput) {
          combinedOutput = '(Command completed with no output)';
        }

        // Include exit code info for non-zero exits
        let statusInfo = '';
        if (code !== 0 && code !== null) {
          statusInfo = `\n[Exit code: ${code}]`;
        }
        if (signal) {
          statusInfo += `\n[Terminated by signal: ${signal}]`;
        }

        const fullOutput = `Command: ${command}\nWorking directory: ${workspaceRoot}\n\nOutput:\n${combinedOutput}${statusInfo}`;
        const isSuccess = code === 0 || code === null;

        resolve({
          success: isSuccess,
          content: isSuccess ? fullOutput : '',
          error: isSuccess ? undefined : fullOutput
        });
      });

      // Handle errors
      child.on('error', (error: Error) => {
        console.error(`[ExecuteTerminalTool] Command execution error:`, error);
        resolve({
          success: false,
          content: '',
          error: `Failed to execute command: ${error.message}`
        });
      });
    });
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

  // Get current auto-approve settings for UI display
  static getAutoApproveCommands(): string[] {
    const config = vscode.workspace.getConfiguration('codingagent');
    const autoApproveCommands = config.get<string>('tools.autoApproveCommands', '');
    
    if (!autoApproveCommands.trim()) {
      return [];
    }
    
    return autoApproveCommands
      .split(',')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);
  }

  // Check if a command would be auto-approved (for UI preview)
  static wouldCommandBeAutoApproved(command: string): boolean {
    return isCommandAutoApproved(command);
  }
}
