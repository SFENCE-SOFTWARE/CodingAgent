// src/tools/readFile.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class ReadFileTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'read_file',
      displayName: 'Read File',
      description: 'Read content of a text file within specified line range',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read content of a text file within specified line range',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
            },
            start_line: {
              type: 'integer',
              description: 'Starting line number (1-based, optional)'
            },
            end_line: {
              type: 'integer',
              description: 'Ending line number (1-based, optional)'
            },
            max_bytes: {
              type: 'integer',
              description: 'Maximum bytes to read from start (optional)'
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const inputPath = args.path;
      const startLine = args.start_line;
      const endLine = args.end_line;
      const maxBytes = args.max_bytes;

      const fullPath = this.resolvePath(inputPath, workspaceRoot);

      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `File not found: ${fullPath}`
        };
      }

      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) {
        return {
          success: false,
          content: '',
          error: `Path is not a file: ${fullPath}`
        };
      }

      let content: string;

      if (maxBytes) {
        // Read with byte limit
        const buffer = Buffer.alloc(maxBytes);
        const fd = await fs.promises.open(fullPath, 'r');
        try {
          const { bytesRead } = await fd.read(buffer, 0, maxBytes, 0);
          content = buffer.subarray(0, bytesRead).toString('utf8');
        } finally {
          await fd.close();
        }
      } else {
        // Read entire file
        content = await fs.promises.readFile(fullPath, 'utf8');
      }

      // Apply line range if specified
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = Math.max(0, (startLine || 1) - 1);
        const end = endLine ? Math.min(lines.length, endLine) : lines.length;
        content = lines.slice(start, end).join('\n');
      }

      return {
        success: true,
        content
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private resolvePath(inputPath: string, workspaceRoot: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    if (inputPath === '.') {
      return workspaceRoot;
    }
    return path.join(workspaceRoot, inputPath);
  }
}
