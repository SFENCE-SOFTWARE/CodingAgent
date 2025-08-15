// src/tools/executeTerminal.ts

import { promisify } from 'util';
import { exec } from 'child_process';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

const execAsync = promisify(exec);

export class ExecuteTerminalTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'execute_terminal',
      displayName: 'Execute Terminal',
      description: 'Execute a terminal command and return its output',
      category: 'system'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'execute_terminal',
        description: 'Execute a terminal command and return its output',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute'
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the command (optional)'
            },
            timeout: {
              type: 'integer',
              description: 'Timeout in milliseconds (default: 30000)'
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
      const timeout = args.timeout || 30000;

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      const output = stdout.trim();
      const errorOutput = stderr.trim();

      if (errorOutput && !output) {
        return {
          success: false,
          content: errorOutput,
          error: `Command failed with error: ${errorOutput}`
        };
      }

      return {
        success: true,
        content: output + (errorOutput ? `\nSTDERR: ${errorOutput}` : '')
      };
    } catch (error: any) {
      return {
        success: false,
        content: error.stdout || '',
        error: `Command failed: ${error.message}${error.stderr ? `\nSTDERR: ${error.stderr}` : ''}`
      };
    }
  }
}
