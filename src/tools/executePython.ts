// src/tools/executePython.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { spawn } from 'child_process';
import * as path from 'path';

export class ExecutePythonTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'execute_python',
      displayName: 'Execute Python Code',
      description: 'Execute Python code in isolated environment and return the result or error',
      category: 'system'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'execute_python',
        description: 'Execute Python code in an isolated environment. Returns the output or any errors encountered.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Python code to execute. Can be multi-line.'
            },
            description: {
              type: 'string',
              description: 'Optional description of what the code is supposed to do'
            }
          },
          required: ['code'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { code, description } = args;

    if (!code || typeof code !== 'string') {
      return {
        success: false,
        content: '',
        error: 'Required parameter: code (string)'
      };
    }

    try {
      console.log(`[ExecutePythonTool] ${description ? `${description} - ` : ''}Executing Python code`);

      const result = await this.runPythonCode(code, workspaceRoot);
      
      if (result.success) {
        return {
          success: true,
          content: result.output || 'Code executed successfully (no output)'
        };
      } else {
        return {
          success: false,
          content: result.output || '',
          error: result.error || 'Python execution failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to execute Python code: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async runPythonCode(code: string, workspaceRoot: string): Promise<{
    success: boolean;
    output?: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      // Use python with -I flag for isolated run (ignore user site-packages)
      const pythonProcess = spawn('python', ['-I', '-c', code], {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PYTHONPATH: '', // Clear PYTHONPATH for isolation
          PYTHONHOME: '', // Clear PYTHONHOME for isolation
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        const output = stdout.trim();
        const errorOutput = stderr.trim();

        if (code === 0) {
          // Success - return output
          resolve({
            success: true,
            output: output || undefined
          });
        } else {
          // Error - return both stdout and stderr
          const combinedOutput = [output, errorOutput].filter(Boolean).join('\n').trim();
          resolve({
            success: false,
            output: output || undefined,
            error: errorOutput || `Python process exited with code ${code}`
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start Python process: ${error.message}`
        });
      });

      // Set timeout for long-running processes (30 seconds)
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill();
          resolve({
            success: false,
            error: 'Python execution timeout (30 seconds)'
          });
        }
      }, 30000);
    });
  }
}
