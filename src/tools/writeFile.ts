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
      description: 'Write or overwrite content to a file',
      category: 'file'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write or overwrite content to a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            },
            append: {
              type: 'boolean',
              description: 'Whether to append to file instead of overwriting'
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
        const content = args.content;
        const append = args.append || false;

        const fullPath = this.resolvePath(inputPath, workspaceRoot);

        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
        }

        if (append) {
          await fs.promises.appendFile(fullPath, content, 'utf8');
        } else {
          await fs.promises.writeFile(fullPath, content, 'utf8');
        }

        const action = append ? 'appended to' : 'written to';
        return {
          success: true,
          content: `Content ${action}: ${fullPath}`
        };
      } catch (error) {
        return {
          success: false,
          content: '',
          error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }, workspaceRoot);
  }
}
