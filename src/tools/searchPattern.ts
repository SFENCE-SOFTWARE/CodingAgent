// src/tools/searchPattern.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class SearchPatternTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'search_pattern',
      displayName: 'Search Pattern',
      description: 'Search for a pattern in all files in the current workspace',
      category: 'search'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
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
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const pattern = args.pattern;
      const fileExtensions = args.file_extensions;
      const caseSensitive = args.case_sensitive || false;
      const isRegex = args.is_regex || false;
      const maxResults = args.max_results || 100;

      const results: string[] = [];
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

      await this.searchInDirectory(workspaceRoot, workspaceRoot, searchRegex, fileExtensions, results, maxResults);

      if (results.length === 0) {
        return {
          success: true,
          content: `No matches found for pattern: "${pattern}"`
        };
      }

      const resultText = results.join('\n');
      const summary = results.length >= maxResults ? 
        `\n\n(Showing first ${maxResults} results, more may exist)` : 
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

  private async searchInDirectory(
    dirPath: string, 
    workspaceRoot: string, 
    searchRegex: RegExp, 
    fileExtensions: string[] | undefined, 
    results: string[], 
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common ignored directories
          if (!entry.name.startsWith('.') && 
              entry.name !== 'node_modules' && 
              entry.name !== 'out' && 
              entry.name !== 'dist') {
            await this.searchInDirectory(fullPath, workspaceRoot, searchRegex, fileExtensions, results, maxResults);
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
              if (results.length >= maxResults) break;
              
              const line = lines[i];
              if (searchRegex.test(line)) {
                const relativePath = path.relative(workspaceRoot, fullPath);
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
  }
}
