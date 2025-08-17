// src/tools/patchFile.ts

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class PatchFileTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'patch_file',
      displayName: 'Patch File',
      description: 'Replace existing text in a file - finds and replaces specific text content',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'patch_file',
        description: 'Replace existing text in a file by finding and replacing specific content. Use this to modify existing code/text, not to add new lines.',
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

  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const inputPath = args.path;
      const oldText = args.old_text;
      const newText = args.new_text;
      const lineNumber = args.line_number;

      const fullPath = this.getFilePath(args, workspaceRoot);
      
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

  protected getFilePath(args: any, workspaceRoot: string): string {
    const inputPath = args.path;
    return path.isAbsolute(inputPath) ? inputPath : path.join(workspaceRoot, inputPath);
  }

  protected getOperationType(args: any): 'create' | 'modify' | 'delete' | 'rename' {
    return 'modify';
  }
}
