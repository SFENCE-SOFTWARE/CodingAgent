// src/tools/searchInProject.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';
import { SearchUtils, SearchOptions } from '../searchUtils';

export class SearchInProjectTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'search_in_project',
      displayName: 'Search in Project',
      description: 'Search for a pattern in all files in the active VS Code project',
      category: 'search'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'search_in_project',
        description: 'Search for a pattern in all files in the active VS Code project',
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
      const options: SearchOptions = {
        pattern: args.pattern,
        fileExtensions: args.file_extensions,
        caseSensitive: args.case_sensitive || false,
        isRegex: args.is_regex || false,
        maxResults: args.max_results || 100,
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

      const results = await SearchUtils.searchInDirectory(
        workspaceRoot,
        searchRegex,
        options,
        workspaceRoot,
        false // Don't include match text for project search
      );

      const formattedResults = SearchUtils.formatResults(
        results,
        options.pattern,
        'project',
        options.maxResults || 100,
        false
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
