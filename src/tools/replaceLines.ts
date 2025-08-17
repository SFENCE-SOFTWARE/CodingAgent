// src/tools/replaceLines.ts

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class ReplaceLinesTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'replace_lines',
      displayName: 'Replace Lines',
      description: 'Replace entire lines in a file with new content. Different from patch_file which replaces text within lines.',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'replace_lines',
        description: 'Replace entire lines in a file with new lines. This replaces the whole line(s), not just part of the text. Use this when you want to completely change line content.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
            },
            line_number: {
              type: 'integer',
              description: 'Line number to replace (1-based). Cannot be used with line_numbers array'
            },
            line_numbers: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Array of line numbers to replace (1-based). All specified lines will be replaced with new_content. Cannot be used with line_number'
            },
            start_line: {
              type: 'integer',
              description: 'Start line number for range replacement (1-based, inclusive)'
            },
            end_line: {
              type: 'integer',
              description: 'End line number for range replacement (1-based, inclusive). Used with start_line to replace a range'
            },
            old_content: {
              type: 'string',
              description: 'Find and replace lines that exactly match this content (after trimming whitespace)'
            },
            containing_text: {
              type: 'string',
              description: 'Find and replace lines that contain this text. Use with caution as it may replace multiple lines'
            },
            new_content: {
              type: 'string',
              description: 'The new content to replace the line(s) with. Use \\n to specify multiple replacement lines. Example: "line1\\nline2" will replace with 2 lines'
            }
          },
          required: ['path', 'new_content'],
          additionalProperties: false
        }
      }
    };
  }

  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const lineNumber = args.line_number;
      const lineNumbers = args.line_numbers;
      const startLine = args.start_line;
      const endLine = args.end_line;
      const oldContent = args.old_content;
      const containingText = args.containing_text;
      const newContent = args.new_content;

      const fullPath = this.getFilePath(args, workspaceRoot);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `File not found: ${fullPath}`
        };
      }

      // Validate that at least one target criteria is provided
      if (!lineNumber && !lineNumbers && !startLine && !oldContent && !containingText) {
        return {
          success: false,
          content: '',
          error: 'Must specify target lines: line_number, line_numbers, start_line/end_line, old_content, or containing_text'
        };
      }

      // Validate mutually exclusive options
      if (lineNumber && lineNumbers) {
        return {
          success: false,
          content: '',
          error: 'Cannot use both line_number and line_numbers. Choose one approach'
        };
      }

      // Read the file
      const fileContent = await fs.promises.readFile(fullPath, 'utf8');
      const lines = fileContent.split('\n');
      const originalLineCount = lines.length;

      let linesToReplace = new Set<number>(); // 0-based indices

      // Process single line number
      if (lineNumber !== undefined) {
        if (lineNumber >= 1 && lineNumber <= lines.length) {
          linesToReplace.add(lineNumber - 1); // Convert to 0-based
        } else {
          return {
            success: false,
            content: '',
            error: `Line number ${lineNumber} is out of range (file has ${lines.length} lines)`
          };
        }
      }

      // Process multiple line numbers
      if (lineNumbers && Array.isArray(lineNumbers)) {
        for (const lineNum of lineNumbers) {
          if (lineNum >= 1 && lineNum <= lines.length) {
            linesToReplace.add(lineNum - 1); // Convert to 0-based
          }
        }
      }

      // Process range replacement
      if (startLine !== undefined) {
        const start = Math.max(1, startLine);
        const end = endLine !== undefined ? Math.min(endLine, lines.length) : start;
        
        if (start <= end && start <= lines.length) {
          for (let i = start; i <= end; i++) {
            linesToReplace.add(i - 1); // Convert to 0-based
          }
        }
      }

      // Process content-based replacement
      if (oldContent !== undefined) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === oldContent.trim()) {
            linesToReplace.add(i);
          }
        }
      }

      // Process text-containing replacement
      if (containingText) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(containingText)) {
            linesToReplace.add(i);
          }
        }
      }

      if (linesToReplace.size === 0) {
        return {
          success: false,
          content: '',
          error: 'No lines found matching the replacement criteria'
        };
      }

      // Split new content into lines
      const newContentLines = newContent.split('\n');

      // Create new file content
      const newLines: string[] = [];
      const sortedLinesToReplace = Array.from(linesToReplace).sort((a, b) => a - b);
      let replacementsMade = 0;

      for (let i = 0; i < lines.length; i++) {
        if (linesToReplace.has(i)) {
          // Replace this line
          if (replacementsMade === 0) {
            // Insert all new content lines for the first replacement
            newLines.push(...newContentLines);
          }
          // Skip subsequent lines that should be replaced (they're replaced by the first replacement)
          replacementsMade++;
        } else {
          // Keep the original line
          newLines.push(lines[i]);
        }
      }

      const finalContent = newLines.join('\n');
      
      // Write back to file
      await fs.promises.writeFile(fullPath, finalContent, 'utf8');

      const replacedCount = linesToReplace.size;
      const newLineCount = newLines.length;

      return {
        success: true,
        content: `Successfully replaced ${replacedCount} line(s) in ${fullPath}. File now has ${newLineCount} lines (was ${originalLineCount})`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to replace lines: ${error instanceof Error ? error.message : String(error)}`
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
