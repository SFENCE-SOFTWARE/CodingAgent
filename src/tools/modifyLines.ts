// src/tools/modifyLines.ts

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class ModifyLinesTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'modify_lines',
      displayName: 'Modify Lines',
      description: 'Universal tool for line-based file modifications: insert, delete, or replace lines',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'modify_lines',
        description: 'Universal tool for modifying lines in files. Supports insert, delete, and replace operations on entire lines.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
            },
            operation: {
              type: 'string',
              enum: ['insert', 'delete', 'replace'],
              description: 'Type of operation: "insert" to add new lines, "delete" to remove lines, "replace" to replace existing lines'
            },
            // Targeting parameters (used by all operations)
            line_number: {
              type: 'integer',
              description: 'Single line number (1-based). For insert: position to insert at. For delete/replace: line to modify. Use 0 for beginning, -1 for end (insert only)'
            },
            line_numbers: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Array of line numbers (1-based) for delete/replace operations. Cannot be used with line_number'
            },
            start_line: {
              type: 'integer',
              description: 'Start line number for range operations (1-based, inclusive). Used with end_line'
            },
            end_line: {
              type: 'integer',
              description: 'End line number for range operations (1-based, inclusive). Used with start_line'
            },
            containing_text: {
              type: 'string',
              description: 'Target lines that contain this text. Use with caution as it may affect multiple lines'
            },
            exact_text: {
              type: 'string',
              description: 'Target lines that exactly match this text (after trimming whitespace)'
            },
            after_text: {
              type: 'string',
              description: 'For insert operation: Insert after the first line containing this text'
            },
            before_text: {
              type: 'string',
              description: 'For insert operation: Insert before the first line containing this text'
            },
            // Content parameter (used by insert and replace)
            content: {
              type: 'string',
              description: 'Content for insert/replace operations. Use \\n to specify multiple lines. Example: "line1\\nline2" creates 2 lines'
            }
          },
          required: ['path', 'operation'],
          additionalProperties: false
        }
      }
    };
  }

  protected async executeOperation(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const operation = args.operation;
      const fullPath = this.getFilePath(args, workspaceRoot);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `File not found: ${fullPath}`
        };
      }

      // Validate operation-specific requirements
      if ((operation === 'insert' || operation === 'replace') && !args.content) {
        return {
          success: false,
          content: '',
          error: `Content is required for ${operation} operation`
        };
      }

      switch (operation) {
        case 'insert':
          return await this.handleInsert(args, fullPath);
        case 'delete':
          return await this.handleDelete(args, fullPath);
        case 'replace':
          return await this.handleReplace(args, fullPath);
        default:
          return {
            success: false,
            content: '',
            error: `Unknown operation: ${operation}. Use 'insert', 'delete', or 'replace'`
          };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to modify lines: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async handleInsert(args: any, fullPath: string): Promise<ToolResult> {
    const lineNumber = args.line_number;
    const content = args.content;
    const afterText = args.after_text;
    const beforeText = args.before_text;

    // Read the file
    const fileContent = await fs.promises.readFile(fullPath, 'utf8');
    const lines = fileContent.split('\n');
    
    // Determine insertion position
    let insertPosition = 0;
    
    if (afterText) {
      // Find line containing afterText and insert after it
      const afterLineIndex = lines.findIndex(line => line.includes(afterText));
      if (afterLineIndex === -1) {
        return {
          success: false,
          content: '',
          error: `Text not found for insertion: "${afterText}"`
        };
      }
      insertPosition = afterLineIndex + 1;
    } else if (beforeText) {
      // Find line containing beforeText and insert before it
      const beforeLineIndex = lines.findIndex(line => line.includes(beforeText));
      if (beforeLineIndex === -1) {
        return {
          success: false,
          content: '',
          error: `Text not found for insertion: "${beforeText}"`
        };
      }
      insertPosition = beforeLineIndex;
    } else if (lineNumber !== undefined) {
      // Use line number
      if (lineNumber === -1) {
        // Append at end
        insertPosition = lines.length;
      } else if (lineNumber === 0) {
        // Insert at beginning
        insertPosition = 0;
      } else {
        // Insert at specific line (1-based)
        insertPosition = Math.max(0, Math.min(lineNumber - 1, lines.length));
      }
    } else {
      // Default: append at end
      insertPosition = lines.length;
    }

    // Split content into lines if it's multi-line
    const contentLines = content.split('\n');
    
    // Insert the new lines
    const newLines = [
      ...lines.slice(0, insertPosition),
      ...contentLines,
      ...lines.slice(insertPosition)
    ];
    
    // Write back to file
    const newContent = newLines.join('\n');
    await fs.promises.writeFile(fullPath, newContent, 'utf8');

    const insertedLinesCount = contentLines.length;
    const positionDescription = afterText 
      ? `after line containing "${afterText}"`
      : beforeText 
      ? `before line containing "${beforeText}"`
      : lineNumber === -1 
      ? 'at end of file'
      : lineNumber === 0
      ? 'at beginning of file'
      : `at line ${insertPosition + 1}`;

    return {
      success: true,
      content: `Successfully inserted ${insertedLinesCount} line(s) ${positionDescription} in ${fullPath}`
    };
  }

  private async handleDelete(args: any, fullPath: string): Promise<ToolResult> {
    const lineNumbers = args.line_numbers;
    const lineNumber = args.line_number;
    const startLine = args.start_line;
    const endLine = args.end_line;
    const containingText = args.containing_text;
    const exactText = args.exact_text;

    // Validate that at least one deletion criteria is provided
    if (!lineNumbers && !lineNumber && !startLine && !containingText && !exactText) {
      return {
        success: false,
        content: '',
        error: 'Must specify at least one deletion criteria: line_number, line_numbers, start_line/end_line, containing_text, or exact_text'
      };
    }

    // Read the file
    const fileContent = await fs.promises.readFile(fullPath, 'utf8');
    const lines = fileContent.split('\n');
    const originalLineCount = lines.length;

    let linesToDelete = new Set<number>(); // 0-based indices

    // Process single line number
    if (lineNumber !== undefined) {
      if (lineNumber >= 1 && lineNumber <= lines.length) {
        linesToDelete.add(lineNumber - 1); // Convert to 0-based
      }
    }

    // Process line numbers array
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
  }

  private async handleReplace(args: any, fullPath: string): Promise<ToolResult> {
    const lineNumber = args.line_number;
    const lineNumbers = args.line_numbers;
    const startLine = args.start_line;
    const endLine = args.end_line;
    const exactText = args.exact_text;
    const containingText = args.containing_text;
    const newContent = args.content;

    // Validate that at least one target criteria is provided
    if (!lineNumber && !lineNumbers && !startLine && !exactText && !containingText) {
      return {
        success: false,
        content: '',
        error: 'Must specify target lines: line_number, line_numbers, start_line/end_line, exact_text, or containing_text'
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
    if (exactText !== undefined) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === exactText.trim()) {
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
  }

  protected getFilePath(args: any, workspaceRoot: string): string {
    const inputPath = args.path;
    return path.isAbsolute(inputPath) ? inputPath : path.join(workspaceRoot, inputPath);
  }

  protected getOperationType(args: any): 'create' | 'modify' | 'delete' | 'rename' {
    return 'modify';
  }
}
