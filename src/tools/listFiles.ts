// src/tools/listFiles.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class ListFilesTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'list_files',
      displayName: 'List Files',
      description: 'List files and directories in a folder',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'list_files',
        description: 'List files and directories in a folder',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the directory. Use "." for workspace root.'
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to list files recursively'
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

      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `Path not found: ${fullPath}`
        };
      }

      const stat = await fs.promises.stat(fullPath);
      if (!stat.isDirectory()) {
        return {
          success: false,
          content: '',
          error: `Path is not a directory: ${fullPath}`
        };
      }

      const items = await this.listDirectoryContents(fullPath, recursive);
      return {
        success: true,
        content: items.join('\n')
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to list files: ${error instanceof Error ? error.message : String(error)}`
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

  private async listDirectoryContents(dirPath: string, recursive: boolean): Promise<string[]> {
    const items: string[] = [];
    
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        items.push(`${entry.name}/`);
        if (recursive) {
          const subItems = await this.listDirectoryContents(fullPath, recursive);
          items.push(...subItems.map(item => path.join(entry.name, item)));
        }
      } else {
        items.push(entry.name);
      }
    }
    
    return items.sort();
  }
}
