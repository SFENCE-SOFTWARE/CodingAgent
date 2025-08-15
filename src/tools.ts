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
      },
      create_folder: {
        type: 'function',
        function: {
          name: 'create_folder',
          description: 'Create a new folder/directory',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Absolute or relative path to the folder to create'
              },
              recursive: {
                type: 'boolean',
                description: 'Whether to create parent directories if they don\'t exist'
              }
            },
            required: ['path'],
            additionalProperties: false
          }
        }
      },
      patch_file: {
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
      },
      rename_file: {
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
      },
      search_pattern: {
        type: 'function',
        function: {
          name: 'search_pattern',
          description: 'Search for a pattern in all files in the current workspace',
          parameters: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Text pattern or regex to search for'
              },
              file_extensions: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Optional array of file extensions to limit search (e.g., [".ts", ".js"])'
              },
              case_sensitive: {
                type: 'boolean',
                description: 'Whether the search should be case sensitive (default: false)'
              },
              is_regex: {
                type: 'boolean',
                description: 'Whether the pattern is a regular expression (default: false)'
              },
              max_results: {
                type: 'integer',
                description: 'Maximum number of matches to return (default: 100)'
              }
            },
            required: ['pattern'],
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
        case 'create_folder':
          return await this.createFolder(args.path, args.recursive);
        case 'patch_file':
          return await this.patchFile(args.path, args.old_text, args.new_text, args.line_number);
        case 'rename_file':
          return await this.renameFile(args.old_path, args.new_path);
        case 'search_pattern':
          return await this.searchPattern(args.pattern, args.file_extensions, args.case_sensitive, args.is_regex, args.max_results);
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

  private async createFolder(inputPath: string, recursive?: boolean): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(inputPath);
      
      if (recursive) {
        await fs.promises.mkdir(fullPath, { recursive: true });
      } else {
        await fs.promises.mkdir(fullPath);
      }

      return {
        success: true,
        content: `Folder created: ${fullPath}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async patchFile(inputPath: string, oldText: string, newText: string, lineNumber?: number): Promise<ToolResult> {
    try {
      const fullPath = this.resolvePath(inputPath);
      
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

  private async renameFile(oldPath: string, newPath: string): Promise<ToolResult> {
    try {
      const oldFullPath = this.resolvePath(oldPath);
      const newFullPath = this.resolvePath(newPath);

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

  private async searchPattern(
    pattern: string, 
    fileExtensions?: string[], 
    caseSensitive?: boolean, 
    isRegex?: boolean, 
    maxResults?: number
  ): Promise<ToolResult> {
    try {
      const results: string[] = [];
      const maxMatches = maxResults || 100;
      const flags = caseSensitive ? 'g' : 'gi';
      
      let searchRegex: RegExp;
      try {
        if (isRegex) {
          searchRegex = new RegExp(pattern, flags);
        } else {
          // Escape special regex characters for literal search
          const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escapedPattern, flags);
        }
      } catch (error) {
        return {
          success: false,
          content: '',
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      const searchInDirectory = async (dirPath: string): Promise<void> => {
        if (results.length >= maxMatches) return;

        try {
          const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            if (results.length >= maxMatches) break;

            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
              // Skip common ignored directories
              if (!entry.name.startsWith('.') && 
                  entry.name !== 'node_modules' && 
                  entry.name !== 'out' && 
                  entry.name !== 'dist') {
                await searchInDirectory(fullPath);
              }
            } else if (entry.isFile()) {
              // Check file extension filter
              if (fileExtensions && fileExtensions.length > 0) {
                const ext = path.extname(entry.name);
                if (!fileExtensions.includes(ext)) {
                  continue;
                }
              }

              // Search in file
              try {
                const content = await fs.promises.readFile(fullPath, 'utf8');
                const lines = content.split('\n');
                
                for (let i = 0; i < lines.length; i++) {
                  if (results.length >= maxMatches) break;
                  
                  const line = lines[i];
                  if (searchRegex.test(line)) {
                    const relativePath = path.relative(this.workspaceRoot, fullPath);
                    results.push(`${relativePath}:${i + 1}: ${line.trim()}`);
                  }
                }
              } catch (readError) {
                // Skip files that can't be read (binary files, etc.)
                continue;
              }
            }
          }
        } catch (error) {
          // Skip directories that can't be read
          return;
        }
      };

      await searchInDirectory(this.workspaceRoot);

      if (results.length === 0) {
        return {
          success: true,
          content: `No matches found for pattern: "${pattern}"`
        };
      }

      const resultText = results.join('\n');
      const summary = results.length >= maxMatches ? 
        `\n\n(Showing first ${maxMatches} results, more may exist)` : 
        `\n\n(${results.length} total matches)`;

      return {
        success: true,
        content: resultText + summary
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
