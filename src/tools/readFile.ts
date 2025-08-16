// src/tools/readFile.ts

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
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
    const config = vscode.workspace.getConfiguration('codingagent.tools');
    const maxLines = config.get('readFileMaxLines', 1000);
    
    return {
      type: 'function',
      function: {
        name: 'read_file',
        description: `Read content of a text file within specified line range. Maximum ${maxLines} lines per operation.`,
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
      const config = vscode.workspace.getConfiguration('codingagent.tools');
      const maxLines = config.get('readFileMaxLines', 1000);
      
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

      // Split into lines for processing
      const allLines = content.split('\n');
      const totalLines = allLines.length;

      // Apply line range if specified
      let start = Math.max(0, (startLine || 1) - 1);
      let end = endLine ? Math.min(allLines.length, endLine) : allLines.length;
      
      // Apply max lines limit
      let isLimitedBySettings = false;
      const requestedLines = end - start;
      if (requestedLines > maxLines) {
        end = start + maxLines;
        isLimitedBySettings = true;
      }

      const resultLines = allLines.slice(start, end);
      const resultContent = resultLines.join('\n');

      // Create informative message about limitations
      let statusInfo = '';
      if (isLimitedBySettings) {
        statusInfo += `\n\n[Note: Output limited to ${maxLines} lines due to settings. Requested lines ${start + 1}-${startLine ? Math.min(allLines.length, endLine || allLines.length) : allLines.length}, showing lines ${start + 1}-${end}. Use start_line/end_line parameters to read other parts.]`;
      } else if (end >= totalLines && !endLine && !maxBytes) {
        // Only add end-of-file note if we're not using byte limits
        statusInfo += `\n\n[Note: Reached end of file. Total lines: ${totalLines}]`;
      }

      return {
        success: true,
        content: resultContent + statusInfo
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
