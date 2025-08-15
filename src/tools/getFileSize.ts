// src/tools/getFileSize.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class GetFileSizeTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'get_file_size',
      displayName: 'Get File Size',
      description: 'Get file size in lines and bytes',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'get_file_size',
        description: 'Get file size in lines and bytes',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
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

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const lines = content.split('\n');

      return {
        success: true,
        content: `File: ${fullPath}\nSize: ${stat.size} bytes\nLines: ${lines.length}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to get file size: ${error instanceof Error ? error.message : String(error)}`
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
