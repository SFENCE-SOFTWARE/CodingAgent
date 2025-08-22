// src/tools/memorySearch.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType, MemorySearchOptions } from '../memoryService';

export class MemorySearchTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_search',
      displayName: 'Memory Search',
      description: `Search memory entries by key or value patterns. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches all available types.`,
      category: 'search'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_search',
        description: `Search memory entries by key or value patterns. If type is not specified, searches all available memory types. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            key_pattern: {
              type: 'string',
              description: 'Pattern to search in memory keys (optional)'
            },
            value_pattern: {
              type: 'string',
              description: 'Pattern to search in memory values (optional)'
            },
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Optional memory type to search in. If not specified, searches all available types. Options: ${availableTypes.join(', ')}`
            },
            case_sensitive: {
              type: 'boolean',
              description: 'Whether the search should be case sensitive (default: false)',
              default: false
            },
            is_regex: {
              type: 'boolean',
              description: 'Whether the patterns are regular expressions (default: false)',
              default: false
            },
            max_results: {
              type: 'number',
              description: 'Maximum number of results to return (default: 50)',
              default: 50,
              minimum: 1,
              maximum: 1000
            }
          },
          required: []
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { 
        key_pattern, 
        value_pattern, 
        type, 
        case_sensitive = false, 
        is_regex = false, 
        max_results = 50 
      } = args;

      // Validate that at least one pattern is provided
      if (!key_pattern && !value_pattern) {
        return { 
          success: false, 
          content: '', 
          error: 'At least one of key_pattern or value_pattern must be provided' 
        };
      }

      // Validate memory type if provided
      if (type) {
        const availableTypes = this.memoryService.getAvailableMemoryTypes();
        if (!availableTypes.includes(type as MemoryType)) {
          return { 
            success: false, 
            content: '',
            error: `Invalid memory type '${type}'. Available types: ${availableTypes.join(', ')}` 
          };
        }
      }

      const searchOptions: MemorySearchOptions = {
        keyPattern: key_pattern,
        valuePattern: value_pattern,
        type: type as MemoryType,
        caseSensitive: case_sensitive,
        isRegex: is_regex,
        maxResults: max_results
      };

      const results = await this.memoryService.search(searchOptions);

      if (results.length === 0) {
        const searchLocation = type ? `in ${type} memory` : 'in any available memory type';
        return {
          success: true,
          content: `No memory entries found matching the search criteria ${searchLocation}`
        };
      }

      const formattedResults = results.map(entry => ({
        key: entry.key,
        value: entry.value,
        type: entry.type,
        timestamp: entry.timestamp,
        created: new Date(entry.timestamp).toISOString(),
        metadata: entry.metadata || {}
      }));

      const truncated = results.length === max_results ? ' (results may be truncated)' : '';
      
      return {
        success: true,
        content: `Found ${results.length} memory entries${truncated}:\n${JSON.stringify(formattedResults, null, 2)}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to search memory: ${errorMsg}` };
    }
  }
}
