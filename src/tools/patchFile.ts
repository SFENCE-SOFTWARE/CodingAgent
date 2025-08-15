// src/tools/patchFile.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class PatchFileTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'patch_file',
      displayName: 'Patch File',
      description: 'Apply a diff patch to a file without fully rewriting it',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'patch_file',
        description: 'Apply a diff patch to a file without fully rewriting it',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file to patch'
            },
            old_text: {
              type: 'string',
              description: 'The exact text to find and replace'
            },
            new_text: {
              type: 'string',
              description: 'The new text to replace the old text with'
            },
            line_number: {
              type: 'integer',
              description: 'Optional line number hint for where to apply the patch'
            }
          },
          required: ['path', 'old_text', 'new_text'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const inputPath = args.path;
      const oldText = args.old_text;
      const newText = args.new_text;
      const lineNumber = args.line_number;

      const fullPath = this.resolvePath(inputPath, workspaceRoot);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `File not found: ${fullPath}`
        };
      }

      // Read the file
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const lines = content.split('\n');

      // Find and replace the text
      let found = false;
      let modifiedLines = lines;

      if (lineNumber && lineNumber > 0 && lineNumber <= lines.length) {
        // If line number is provided, check that line first
        const targetLine = lines[lineNumber - 1];
        if (targetLine.includes(oldText)) {
          modifiedLines[lineNumber - 1] = targetLine.replace(oldText, newText);
          found = true;
        }
      }

      if (!found) {
        // Search through all lines
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(oldText)) {
            modifiedLines[i] = lines[i].replace(oldText, newText);
            found = true;
            break; // Replace only first occurrence
          }
        }
      }

      if (!found) {
        return {
          success: false,
          content: '',
          error: `Text not found in file: "${oldText}"`
        };
      }

      // Write the modified content back
      const newContent = modifiedLines.join('\n');
      await fs.promises.writeFile(fullPath, newContent, 'utf8');

      return {
        success: true,
        content: `File patched successfully: ${fullPath}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to patch file: ${error instanceof Error ? error.message : String(error)}`
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
