// src/tools/writeFile.ts

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class WriteFileTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'write_file',
      displayName: 'Write File',
      description: 'Write content to a file',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The file path to write to'
            },
            content: {
              type: 'string',
              description: 'The content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }
    };
  }

  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { path: inputPath, content } = args;

    if (!inputPath || typeof inputPath !== 'string') {
      return {
        success: false,
        error: 'Path is required and must be a string',
        content: ''
      };
    }

    if (content === undefined || content === null) {
      return {
        success: false,
        error: 'Content is required',
        content: ''
      };
    }

    try {
      const fullPath = this.getFilePath(args, workspaceRoot);

      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

      await fs.promises.writeFile(fullPath, content, 'utf8');

      return {
        success: true,
        content: `File written successfully to ${inputPath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        content: ''
      };
    }
  }

  protected getFilePath(args: any, workspaceRoot: string): string {
    const inputPath = args.path;
    return path.isAbsolute(inputPath) ? inputPath : path.join(workspaceRoot, inputPath);
  }

  protected getOperationType(args: any): 'create' | 'modify' | 'delete' | 'rename' {
    // For write_file, we determine if it's create or modify based on whether the file exists
    // This will be checked in the parent class
    return 'modify'; // Default, will be adjusted in parent based on before content
  }
}
