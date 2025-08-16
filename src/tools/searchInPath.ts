// src/tools/searchInPath.ts

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class SearchInPathTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'search_in_path',
      displayName: 'Search in Path',
      description: 'Search for patterns in a specific file or directory',
      category: 'search'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'search_in_path',
        description: 'Search for a pattern in a specific file or directory (recursive)',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Text pattern or regex to search for'
            },
            path: {
              type: 'string',
              description: 'Absolute or relative path to file or directory to search in'
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
              description: 'Maximum number of matches to return (default: 50)'
            }
          },
          required: ['pattern', 'path'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const pattern = args.pattern;
      const searchPath = args.path;
      const fileExtensions = args.file_extensions || [];
      const caseSensitive = args.case_sensitive || false;
      const isRegex = args.is_regex || false;
      const maxResults = args.max_results || 50;

      const fullPath = this.resolvePath(searchPath, workspaceRoot);

      if (!fs.existsSync(fullPath)) {
        return {
          success: false,
          content: '',
          error: `Path not found: ${fullPath}`
        };
      }

      const stat = await fs.promises.stat(fullPath);
      const isFile = stat.isFile();
      const isDirectory = stat.isDirectory();

      if (!isFile && !isDirectory) {
        return {
          success: false,
          content: '',
          error: `Path is neither a file nor directory: ${fullPath}`
        };
      }

      let searchRegex: RegExp;
      try {
        if (isRegex) {
          searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        } else {
          const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escapedPattern, caseSensitive ? 'g' : 'gi');
        }
      } catch (error) {
        return {
          success: false,
          content: '',
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      const results: Array<{
        file: string;
        line: number;
        content: string;
        match: string;
      }> = [];

      if (isFile) {
        // Search in single file
        await this.searchInFile(fullPath, searchRegex, results, maxResults, workspaceRoot);
      } else {
        // Search in directory recursively
        await this.searchInDirectory(fullPath, searchRegex, fileExtensions, results, maxResults, workspaceRoot);
      }

      if (results.length === 0) {
        return {
          success: true,
          content: `No matches found for pattern "${pattern}" in ${isFile ? 'file' : 'directory'}: ${this.getRelativePath(fullPath, workspaceRoot)}`
        };
      }

      // Format results
      let output = `Found ${results.length} match(es) for pattern "${pattern}" in ${isFile ? 'file' : 'directory'}: ${this.getRelativePath(fullPath, workspaceRoot)}\n\n`;
      
      for (const result of results) {
        output += `${result.file}:${result.line}\n`;
        output += `  ${result.content.trim()}\n`;
        output += `  Match: "${result.match}"\n\n`;
      }

      if (results.length >= maxResults) {
        output += `[Note: Results limited to ${maxResults} matches. Use max_results parameter to see more.]\n`;
      }

      return {
        success: true,
        content: output
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async searchInFile(
    filePath: string, 
    searchRegex: RegExp, 
    results: Array<{ file: string; line: number; content: string; match: string; }>,
    maxResults: number,
    workspaceRoot: string
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const relativePath = this.getRelativePath(filePath, workspaceRoot);

      for (let i = 0; i < lines.length && results.length < maxResults; i++) {
        const line = lines[i];
        searchRegex.lastIndex = 0; // Reset regex state
        const match = searchRegex.exec(line);
        if (match) {
          results.push({
            file: relativePath,
            line: i + 1,
            content: line,
            match: match[0]
          });
        }
      }
    } catch (error) {
      // Skip files that can't be read (binary, permissions, etc.)
    }
  }

  private async searchInDirectory(
    dirPath: string,
    searchRegex: RegExp,
    fileExtensions: string[],
    results: Array<{ file: string; line: number; content: string; match: string; }>,
    maxResults: number,
    workspaceRoot: string
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that usually don't contain searchable content
          if (['.git', '.svn', '.hg', 'node_modules', '.vscode', 'dist', 'build', 'target'].includes(entry.name)) {
            continue;
          }
          await this.searchInDirectory(fullPath, searchRegex, fileExtensions, results, maxResults, workspaceRoot);
        } else if (entry.isFile()) {
          // Check file extension filter
          if (fileExtensions.length > 0) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!fileExtensions.some(allowed => allowed.toLowerCase() === ext)) {
              continue;
            }
          }

          // Skip binary files by extension
          const ext = path.extname(entry.name).toLowerCase();
          const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz'];
          if (binaryExtensions.includes(ext)) {
            continue;
          }

          await this.searchInFile(fullPath, searchRegex, results, maxResults, workspaceRoot);
        }
      }
    } catch (error) {
      // Skip directories that can't be read (permissions, etc.)
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

  private getRelativePath(fullPath: string, workspaceRoot: string): string {
    return path.relative(workspaceRoot, fullPath) || '.';
  }
}
