// src/tools/renameFile.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class RenameFileTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'rename_file',
      displayName: 'Rename File',
      description: 'Rename or move a file or folder',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'rename_file',
        description: 'Rename or move a file or folder',
        parameters: {
          type: 'object',
          properties: {
            old_path: {
              type: 'string',
              description: 'Current absolute or relative path to the file/folder'
            },
            new_path: {
              type: 'string',
              description: 'New absolute or relative path for the file/folder'
            }
          },
          required: ['old_path', 'new_path'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const oldPath = args.old_path;
      const newPath = args.new_path;

      const oldFullPath = this.resolvePath(oldPath, workspaceRoot);
      const newFullPath = this.resolvePath(newPath, workspaceRoot);

      // Check if source exists
      if (!fs.existsSync(oldFullPath)) {
        return {
          success: false,
          content: '',
          error: `Source path not found: ${oldFullPath}`
        };
      }

      // Check if target already exists
      if (fs.existsSync(newFullPath)) {
        return {
          success: false,
          content: '',
          error: `Target path already exists: ${newFullPath}`
        };
      }

      // Create target directory if it doesn't exist
      const targetDir = path.dirname(newFullPath);
      if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }

      // Rename/move the file or folder
      await fs.promises.rename(oldFullPath, newFullPath);

      return {
        success: true,
        content: `Successfully renamed: ${oldFullPath} → ${newFullPath}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to rename: ${error instanceof Error ? error.message : String(error)}`
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
