// src/tools/createFolder.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class CreateFolderTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'create_folder',
      displayName: 'Create Folder',
      description: 'Create a new folder/directory',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'create_folder',
        description: 'Create a new folder/directory',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the folder to create'
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to create parent directories if they don\'t exist'
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
      const recursive = args.recursive || false;

      const fullPath = this.resolvePath(inputPath, workspaceRoot);
      
      if (recursive) {
        await fs.promises.mkdir(fullPath, { recursive: true });
      } else {
        await fs.promises.mkdir(fullPath);
      }

      return {
        success: true,
        content: `Folder created: ${fullPath}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
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
