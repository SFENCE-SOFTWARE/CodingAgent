// src/tools.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { ToolDefinition, ToolResult } from './types';

const execAsync = promisify(exec);

export class ToolsService {
  private workspaceRoot: string;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }

  getToolDefinitions(): Record<string, ToolDefinition> {
    return {
      list_files: {
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
      },
      read_file: {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read content of a text file within specified line range',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute or relative path to the file'
              },
              start_line: {
                type: 'integer',
                description: 'Starting line number (1-based, optional)'
              },
              end_line: {
                type: 'integer',
                description: 'Ending line number (1-based, optional)'
              },
              max_bytes: {
                type: 'integer',
                description: 'Maximum bytes to read from start (optional)'
              }
            },
            required: ['path'],
            additionalProperties: false
          }
        }
      },
      write_file: {
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
      },
      get_file_size: {
        type: 'function',
        function: {
          name: 'get_file_size',
          description: 'Get file size in lines and bytes',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute or relative path to the file'
              }
            },
            required: ['path'],
            additionalProperties: false
          }
        }
      },
      execute_terminal: {
        type: 'function',
        function: {
          name: 'execute_terminal',
          description: 'Execute a terminal command and return its output',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Command to execute'
              },
              cwd: {
                type: 'string',
                description: 'Working directory for the command (optional)'
              },
              timeout: {
                type: 'integer',
                description: 'Timeout in milliseconds (default: 30000)'
              }
            },
            required: ['command'],
            additionalProperties: false
          }
        }
      },
      read_webpage: {
        type: 'function',
        function: {
          name: 'read_webpage',
          description: 'Read content from a webpage',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the webpage to read'
              },
              max_length: {
                type: 'integer',
                description: 'Maximum content length to return'
              }
            },
            required: ['url'],
            additionalProperties: false
          }
        }
      },
      read_pdf: {
        type: 'function',
        function: {
          name: 'read_pdf',
          description: 'Read text content from a PDF file',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute or relative path to the PDF file'
              },
              max_pages: {
                type: 'integer',
                description: 'Maximum number of pages to read'
              }
            },
            required: ['path'],
            additionalProperties: false
          }
        }
      }
    };
  }

  async executeTool(name: string, args: any): Promise<ToolResult> {
    try {
      switch (name) {
        case 'list_files':
          return await this.listFiles(args.path, args.recursive);
        case 'read_file':
          return await this.readFile(args.path, args.start_line, args.end_line, args.max_bytes);
        case 'write_file':
          return await this.writeFile(args.path, args.content, args.append);
        case 'get_file_size':
          return await this.getFileSize(args.path);
        case 'execute_terminal':
          return await this.executeTerminal(args.command, args.cwd, args.timeout);
        case 'read_webpage':
          return await this.readWebpage(args.url, args.max_length);
        case 'read_pdf':
          return await this.readPdf(args.path, args.max_pages);
        default:
          return {
            success: false,
            content: '',
            error: `Unknown tool: ${name}`
          };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private resolvePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    if (inputPath === '.') {
      return this.workspaceRoot;
    }
    return path.join(this.workspaceRoot, inputPath);
  }

  private async listFiles(inputPath: string, recursive: boolean = false): Promise<ToolResult> {
    const targetPath = this.resolvePath(inputPath);
    
    if (!fs.existsSync(targetPath)) {
      return {
        success: false,
        content: '',
        error: `Path does not exist: ${targetPath}`
      };
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return {
        success: false,
        content: '',
        error: `Path is not a directory: ${targetPath}`
      };
    }

    try {
      const files: string[] = [];
      
      const readDir = (dir: string, prefix: string = '') => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = prefix ? `${prefix}/${item}` : item;
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            files.push(`${relativePath}/`);
            if (recursive) {
              readDir(fullPath, relativePath);
            }
          } else {
            files.push(relativePath);
          }
        }
      };

      readDir(targetPath);
      return {
        success: true,
        content: files.join('\n')
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read directory: ${error}`
      };
    }
  }

  private async readFile(inputPath: string, startLine?: number, endLine?: number, maxBytes?: number): Promise<ToolResult> {
    const targetPath = this.resolvePath(inputPath);
    
    if (!fs.existsSync(targetPath)) {
      return {
        success: false,
        content: '',
        error: `File does not exist: ${targetPath}`
      };
    }

    try {
      let content = fs.readFileSync(targetPath, 'utf8');

      if (maxBytes && content.length > maxBytes) {
        content = content.substring(0, maxBytes) + '\n... (truncated)';
      }

      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = (startLine || 1) - 1;
        const end = endLine ? endLine : lines.length;
        content = lines.slice(start, end).join('\n');
      }

      return {
        success: true,
        content
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read file: ${error}`
      };
    }
  }

  private async writeFile(inputPath: string, content: string, append: boolean = false): Promise<ToolResult> {
    const targetPath = this.resolvePath(inputPath);
    
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (append) {
        fs.appendFileSync(targetPath, content);
      } else {
        fs.writeFileSync(targetPath, content, 'utf8');
      }

      return {
        success: true,
        content: `File ${append ? 'appended' : 'written'} successfully: ${targetPath}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to write file: ${error}`
      };
    }
  }

  private async getFileSize(inputPath: string): Promise<ToolResult> {
    const targetPath = this.resolvePath(inputPath);
    
    if (!fs.existsSync(targetPath)) {
      return {
        success: false,
        content: '',
        error: `File does not exist: ${targetPath}`
      };
    }

    try {
      const content = fs.readFileSync(targetPath, 'utf8');
      const lines = content.split('\n').length;
      const bytes = Buffer.byteLength(content, 'utf8');

      return {
        success: true,
        content: `Lines: ${lines}, Bytes: ${bytes}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to get file size: ${error}`
      };
    }
  }

  private async executeTerminal(command: string, cwd?: string, timeout: number = 30000): Promise<ToolResult> {
    try {
      const workingDir = cwd ? this.resolvePath(cwd) : this.workspaceRoot;
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
      return {
        success: true,
        content: output || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        content: error.stdout || '',
        error: `Command failed: ${error.message}${error.stderr ? `\nSTDERR: ${error.stderr}` : ''}`
      };
    }
  }

  private async readWebpage(url: string, maxLength?: number): Promise<ToolResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          content: '',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      let content = await response.text();
      
      // Basic HTML stripping (for better readability)
      content = content.replace(/<script[^>]*>.*?<\/script>/gis, '');
      content = content.replace(/<style[^>]*>.*?<\/style>/gis, '');
      content = content.replace(/<[^>]*>/g, ' ');
      content = content.replace(/\s+/g, ' ').trim();

      if (maxLength && content.length > maxLength) {
        content = content.substring(0, maxLength) + '... (truncated)';
      }

      return {
        success: true,
        content
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read webpage: ${error}`
      };
    }
  }

  private async readPdf(inputPath: string, maxPages?: number): Promise<ToolResult> {
    // Note: This is a placeholder implementation
    // For production, you'd want to use a proper PDF parsing library
    return {
      success: false,
      content: '',
      error: 'PDF reading not implemented yet. Consider using pdf-parse or similar library.'
    };
  }
}
