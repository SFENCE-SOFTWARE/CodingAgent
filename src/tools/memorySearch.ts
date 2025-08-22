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
      description: `Search memory entries by key or value patterns. Returns metadata and pattern match locations, not full content. Use memory_retrieve_by_lines or memory_retrieve_data to get full content or memory_export to save found entries to files. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches all available types.`,
      category: 'search'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_search',
        description: `Advanced search in memory entries with metadata filtering and sorting. Returns entry information and pattern match locations, not full content values. Use memory_retrieve_by_lines or memory_retrieve_data to get full content or memory_export to save found entries to files. If type is not specified, searches all available memory types. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            key_pattern: {
              type: 'string',
              description: 'Pattern to search in memory keys'
            },
            value_pattern: {
              type: 'string',
              description: 'Pattern to search in memory values'
            },
            metadata_pattern: {
              type: 'string',
              description: 'Pattern to search in metadata (searches JSON representation)'
            },
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Memory type to search in. If not specified, searches all available types. Options: ${availableTypes.join(', ')}`
            },
            data_type: {
              type: 'string',
              enum: ['text', 'json', 'code', 'config', 'url', 'file_path', 'number', 'boolean', 'list', 'object', 'api_key', 'credentials', 'other'],
              description: 'Filter by data type classification'
            },
            category: {
              type: 'string',
              description: 'Filter by category (e.g., "user_preferences", "project_config")'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags (entries with any of these tags will match)'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Filter by priority level'
            },
            from_date: {
              type: 'string',
              description: 'Filter entries created after this date (ISO 8601 format)'
            },
            to_date: {
              type: 'string',
              description: 'Filter entries created before this date (ISO 8601 format)'
            },
            sort_by: {
              type: 'string',
              enum: ['timestamp', 'lastModified', 'lastAccessed', 'accessCount', 'priority', 'relevance'],
              description: 'Sort results by specified field (default: relevance)',
              default: 'relevance'
            },
            sort_order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order (default: desc)',
              default: 'desc'
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
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip (default: 0). Use for pagination.',
              minimum: 0,
              default: 0
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
        metadata_pattern,
        type, 
        data_type,
        category,
        tags,
        priority,
        from_date,
        to_date,
        sort_by = 'relevance',
        sort_order = 'desc',
        case_sensitive = false, 
        is_regex = false, 
        max_results = 50,
        offset = 0
      } = args;

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

      // Parse date filters
      let fromDate: number | undefined;
      let toDate: number | undefined;
      
      if (from_date) {
        fromDate = new Date(from_date).getTime();
        if (isNaN(fromDate)) {
          return { success: false, content: '', error: 'Invalid from_date format. Use ISO 8601 format.' };
        }
      }
      
      if (to_date) {
        toDate = new Date(to_date).getTime();
        if (isNaN(toDate)) {
          return { success: false, content: '', error: 'Invalid to_date format. Use ISO 8601 format.' };
        }
      }

      const searchOptions: MemorySearchOptions = {
        keyPattern: key_pattern,
        valuePattern: value_pattern,
        metadataPattern: metadata_pattern,
        type: type as MemoryType,
        dataType: data_type,
        category,
        tags,
        priority,
        fromDate,
        toDate,
        sortBy: sort_by,
        sortOrder: sort_order,
        caseSensitive: case_sensitive,
        isRegex: is_regex,
        maxResults: 10000  // Get all results first to calculate total count
      };

      const allResults = await this.memoryService.search(searchOptions);
      
      // Apply pagination manually since memoryService doesn't support offset
      const totalCount = allResults.length;
      const startIndex = Math.min(offset, totalCount);
      const endIndex = Math.min(startIndex + max_results, totalCount);
      const results = allResults.slice(startIndex, endIndex);
      const hasMore = endIndex < totalCount;

      if (totalCount === 0) {
        const searchLocation = type ? `in ${type} memory` : 'in any available memory type';
        return {
          success: true,
          content: `No memory entries found matching the search criteria ${searchLocation}`
        };
      }

      const formattedResults = results.map(entry => {
        const result: any = {
          key: entry.key,
          type: entry.type,
          timestamp: entry.timestamp,
          created: new Date(entry.timestamp).toISOString(),
          valueLength: entry.value ? entry.value.length : 0,
          valuePreview: entry.value ? entry.value.substring(0, 100) + (entry.value.length > 100 ? '...' : '') : null
        };

        // Add pattern match information
        if (value_pattern && entry.value) {
          const pattern = is_regex ? new RegExp(value_pattern, case_sensitive ? 'g' : 'gi') : value_pattern;
          const searchValue = case_sensitive ? entry.value : entry.value.toLowerCase();
          const searchPattern = case_sensitive ? value_pattern : value_pattern.toLowerCase();
          
          if (is_regex && pattern instanceof RegExp) {
            const matches = [...entry.value.matchAll(pattern)];
            if (matches.length > 0) {
              result.patternMatches = matches.map(match => ({
                position: match.index || 0,
                text: match[0],
                context: entry.value.substring(Math.max(0, (match.index || 0) - 20), (match.index || 0) + match[0].length + 20)
              }));
            }
          } else {
            const positions: number[] = [];
            let index = searchValue.indexOf(searchPattern);
            while (index !== -1 && positions.length < 5) { // Limit to 5 matches
              positions.push(index);
              index = searchValue.indexOf(searchPattern, index + 1);
            }
            if (positions.length > 0) {
              result.patternMatches = positions.map(pos => ({
                position: pos,
                text: entry.value.substring(pos, pos + value_pattern.length),
                context: entry.value.substring(Math.max(0, pos - 20), pos + value_pattern.length + 20)
              }));
            }
          }
        }

        // Include rich metadata if available
        if (entry.metadata) {
          const metadata = entry.metadata;
          if (metadata.dataType) result.dataType = metadata.dataType;
          if (metadata.category) result.category = metadata.category;
          if (metadata.tags) result.tags = metadata.tags;
          if (metadata.priority) result.priority = metadata.priority;
          if (metadata.description) result.description = metadata.description;
          if (metadata.context) result.context = metadata.context;
          if (metadata.lastAccessed) result.lastAccessed = new Date(metadata.lastAccessed).toISOString();
          if (metadata.accessCount) result.accessCount = metadata.accessCount;
          if (metadata.relatedKeys) result.relatedKeys = metadata.relatedKeys;
          
          // Include essential metadata for LLM reference (without full content)
          result.metadata = {
            dataType: metadata.dataType,
            category: metadata.category,
            tags: metadata.tags,
            priority: metadata.priority,
            description: metadata.description
          };
        }

        return result;
      });

      const searchSummary = [];
      if (key_pattern) searchSummary.push(`key: "${key_pattern}"`);
      if (value_pattern) searchSummary.push(`value: "${value_pattern}"`);
      if (data_type) searchSummary.push(`dataType: ${data_type}`);
      if (category) searchSummary.push(`category: ${category}`);
      if (tags?.length) searchSummary.push(`tags: ${tags.join(', ')}`);
      if (priority) searchSummary.push(`priority: ${priority}`);

      const paginationInfo = totalCount > max_results 
        ? ` (showing ${startIndex + 1}-${endIndex} of ${totalCount}${hasMore ? ', use offset=' + endIndex + ' for next page' : ''})`
        : '';
      const summaryText = searchSummary.length > 0 ? ` (${searchSummary.join(', ')})` : '';
      
      return {
        success: true,
        content: `Found ${totalCount} memory entries${summaryText}${paginationInfo}. Use memory_retrieve with specific keys to get full content:\n${JSON.stringify(formattedResults, null, 2)}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to search memory: ${errorMsg}` };
    }
  }
}
