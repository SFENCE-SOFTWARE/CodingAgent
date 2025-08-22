// src/tools/searchInPath.ts

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';
import { SearchUtils, SearchOptions } from './searchUtils';

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
      const searchPath = args.path;
      const fullPath = SearchUtils.resolvePath(searchPath, workspaceRoot);

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

      const options: SearchOptions = {
        pattern: args.pattern,
        fileExtensions: args.file_extensions || [],
        caseSensitive: args.case_sensitive || false,
        isRegex: args.is_regex || false,
        maxResults: args.max_results || 50,
        includeBinaryFiles: false
      };

      let searchRegex: RegExp;
      try {
        searchRegex = SearchUtils.createSearchRegex(options);
      } catch (error) {
        return {
          success: false,
          content: '',
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      let results;
      if (isFile) {
        // Search in single file
        results = await SearchUtils.searchInFile(fullPath, searchRegex, workspaceRoot, true);
      } else {
        // Search in directory recursively
        results = await SearchUtils.searchInDirectory(fullPath, searchRegex, options, workspaceRoot, true);
      }

      const relativePath = path.relative(workspaceRoot, fullPath) || '.';
      const formattedResults = SearchUtils.formatResults(
        results,
        options.pattern,
        relativePath,
        options.maxResults || 50,
        true // Include match highlighting for path search
      );

      return {
        success: true,
        content: formattedResults
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
