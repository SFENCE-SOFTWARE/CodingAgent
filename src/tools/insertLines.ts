// src/tools/insertLines.ts

import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolInfo } from '../types';
import { ChangeAwareBaseTool } from '../changeAwareBaseTool';

export class InsertLinesTool extends ChangeAwareBaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'insert_lines',
      displayName: 'Insert Lines',
      description: 'Insert new lines into a file at a specific position. Content is treated as lines separated by \\n.',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'insert_lines',
        description: 'Insert new lines into a file at a specific position. Each inserted line becomes a separate line in the file. If content contains \\n characters, it will be split into multiple lines. Examples: "console.log();" inserts 1 line, "line1\\nline2" inserts 2 lines. Use this to add new content to existing files.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
            },
            line_number: {
              type: 'integer',
              description: 'Line number where to insert (1-based). Use 0 to insert at the beginning, or -1 to append at the end'
            },
            content: {
              type: 'string',
              description: 'The content to insert. Use \\n to separate multiple lines. Examples: "console.log();" = 1 line, "import x;\\nexport y;" = 2 lines. Each part becomes a separate line in the file.'
            },
            after_text: {
              type: 'string',
              description: 'Optional: Insert after the first line containing this text. Takes precedence over line_number if provided'
            },
            before_text: {
              type: 'string', 
              description: 'Optional: Insert before the first line containing this text. Takes precedence over line_number if provided'
            }
          },
          required: ['path', 'content'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    return this.captureFileChange(args.path, async () => {
      try {
        const inputPath = args.path;
        const lineNumber = args.line_number;
        const content = args.content;
        const afterText = args.after_text;
        const beforeText = args.before_text;

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
      } catch (error) {
        return {
          success: false,
          content: '',
          error: `Failed to insert lines: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }, workspaceRoot);
  }
}
