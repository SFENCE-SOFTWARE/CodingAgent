// src/tools/deleteLines.ts

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class DeleteLinesTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'delete_lines',
      displayName: 'Delete Lines',
      description: 'Delete specific lines from a file by line numbers or content matching',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'delete_lines',
        description: 'Delete one or more lines from a file. You can specify lines by line numbers, by content matching, or by a range.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
            },
            line_numbers: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Array of line numbers to delete (1-based). Example: [5, 10, 15] deletes lines 5, 10, and 15'
            },
            start_line: {
              type: 'integer',
              description: 'Start line number for range deletion (1-based, inclusive)'
            },
            end_line: {
              type: 'integer',
              description: 'End line number for range deletion (1-based, inclusive). Used with start_line to delete a range'
            },
            containing_text: {
              type: 'string',
              description: 'Delete all lines that contain this text. Use with caution as it may delete multiple lines'
            },
            exact_text: {
              type: 'string',
              description: 'Delete lines that exactly match this text (after trimming whitespace)'
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    };
  }

  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const lineNumbers = args.line_numbers;
      const startLine = args.start_line;
      const endLine = args.end_line;
      const containingText = args.containing_text;
      const exactText = args.exact_text;

      const fullPath = this.getFilePath(args, workspaceRoot);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `File not found: ${fullPath}`
        };
      }

      // Validate that at least one deletion criteria is provided
      if (!lineNumbers && !startLine && !containingText && !exactText) {
        return {
          success: false,
          content: '',
          error: 'Must specify at least one deletion criteria: line_numbers, start_line/end_line, containing_text, or exact_text'
        };
      }

      // Read the file
      const fileContent = await fs.promises.readFile(fullPath, 'utf8');
      const lines = fileContent.split('\n');
      const originalLineCount = lines.length;

      let linesToDelete = new Set<number>(); // 0-based indices

      // Process line numbers
      if (lineNumbers && Array.isArray(lineNumbers)) {
        for (const lineNum of lineNumbers) {
          if (lineNum >= 1 && lineNum <= lines.length) {
            linesToDelete.add(lineNum - 1); // Convert to 0-based
          }
        }
      }

      // Process range deletion
      if (startLine !== undefined) {
        const start = Math.max(1, startLine);
        const end = endLine !== undefined ? Math.min(endLine, lines.length) : start;
        
        if (start <= end) {
          for (let i = start; i <= end; i++) {
            linesToDelete.add(i - 1); // Convert to 0-based
          }
        }
      }

      // Process text-based deletion
      if (containingText) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(containingText)) {
            linesToDelete.add(i);
          }
        }
      }

      // Process exact text matching
      if (exactText) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === exactText.trim()) {
            linesToDelete.add(i);
          }
        }
      }

      if (linesToDelete.size === 0) {
        return {
          success: false,
          content: '',
          error: 'No lines found matching the deletion criteria'
        };
      }

      // Create new content with deleted lines removed
      const newLines = lines.filter((_, index) => !linesToDelete.has(index));
      const newContent = newLines.join('\n');
      
      // Write back to file
      await fs.promises.writeFile(fullPath, newContent, 'utf8');

      const deletedCount = linesToDelete.size;
      const remainingCount = newLines.length;

      return {
        success: true,
        content: `Successfully deleted ${deletedCount} line(s) from ${fullPath}. File now has ${remainingCount} lines (was ${originalLineCount})`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to delete lines: ${error instanceof Error ? error.message : String(error)}`
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
