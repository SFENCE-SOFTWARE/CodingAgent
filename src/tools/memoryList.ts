// src/tools/memoryList.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class MemoryListTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_list',
      displayName: 'Memory List',
      description: `List memory entries with metadata overview and pagination support. Available memory types: ${availableTypes.join(', ')}. If type is not specified, lists all available types. Use offset/limit for large memory sets.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_list',
        description: `List memory entries with metadata overview and pagination support. If type is not specified, lists all available types. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Optional memory type to list. If not specified, lists all available types. Options: ${availableTypes.join(', ')}`
            },
            show_details: {
              type: 'boolean',
              description: 'Whether to show detailed metadata for each entry (default: false)',
              default: false
            },
            offset: {
              type: 'number',
              description: 'Number of entries to skip (default: 0). Use for pagination.',
              minimum: 0,
              default: 0
            },
            limit: {
              type: 'number',
              description: 'Maximum number of entries to return (default: 50, max: 1000). Use for pagination.',
              minimum: 1,
              maximum: 1000,
              default: 50
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
        type, 
        show_details = false, 
        offset = 0, 
        limit = 50 
      } = args;

      // Validate parameters
      if (offset < 0) {
        return { 
          success: false, 
          content: '',
          error: 'Offset must be non-negative' 
        };
      }

      if (limit < 1 || limit > 1000) {
        return { 
          success: false, 
          content: '',
          error: 'Limit must be between 1 and 1000' 
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

      // Use search to get all entries with metadata (no limit to get total count first)
      const searchOptions = { type: type as MemoryType, maxResults: 10000 };
      const allEntries = await this.memoryService.search(searchOptions);
      const totalCount = allEntries.length;

      if (totalCount === 0) {
        const location = type ? `in ${type} memory` : 'in any available memory type';
        return {
          success: true,
          content: `No memory entries found ${location}`
        };
      }

      // Apply pagination
      const startIndex = offset;
      const endIndex = Math.min(startIndex + limit, totalCount);
      const entries = allEntries.slice(startIndex, endIndex);
      const hasMore = endIndex < totalCount;

      const location = type ? `in ${type} memory` : 'across all available memory types';
      const paginationInfo = totalCount > limit 
        ? ` (showing ${startIndex + 1}-${endIndex} of ${totalCount}${hasMore ? ', use offset=' + endIndex + ' for next page' : ''})`
        : '';

      if (show_details) {
        // Show detailed view with metadata
        const detailed = entries.map(entry => {
          const result: any = {
            key: entry.key,
            type: entry.type,
            created: new Date(entry.timestamp).toISOString(),
            valueLength: typeof entry.value === 'string' ? entry.value.length : JSON.stringify(entry.value).length
          };

          if (entry.metadata) {
            const metadata = entry.metadata;
            if (metadata.dataType) result.dataType = metadata.dataType;
            if (metadata.category) result.category = metadata.category;
            if (metadata.tags) result.tags = metadata.tags;
            if (metadata.priority) result.priority = metadata.priority;
            if (metadata.description) result.description = metadata.description;
            if (metadata.accessCount) result.accessCount = metadata.accessCount;
            if (metadata.lastAccessed) result.lastAccessed = new Date(metadata.lastAccessed).toISOString();
          }

          return result;
        });

        return {
          success: true,
          content: `Found ${totalCount} memory entries ${location}${paginationInfo}:\n${JSON.stringify(detailed, null, 2)}`
        };
      } else {
        // Show compact overview
        const overview = entries.map(entry => {
          const parts = [entry.key];
          if (entry.metadata?.dataType) parts.push(`[${entry.metadata.dataType}]`);
          if (entry.metadata?.category) parts.push(`(${entry.metadata.category})`);
          if (entry.metadata?.priority && entry.metadata.priority !== 'medium') {
            parts.push(`{${entry.metadata.priority}}`);
          }
          if (entry.metadata?.tags?.length) parts.push(`#${entry.metadata.tags.join(' #')}`);
          return `- ${parts.join(' ')}`;
        }).join('\n');

        // Group by type summary
        const typeGroups = allEntries.reduce((acc, entry) => {
          const t = entry.type;
          if (!acc[t]) acc[t] = 0;
          acc[t]++;
          return acc;
        }, {} as Record<string, number>);

        const typeSummary = Object.entries(typeGroups)
          .map(([t, count]) => `${t}: ${count}`)
          .join(', ');

        return {
          success: true,
          content: `Found ${totalCount} memory entries ${location} (${typeSummary})${paginationInfo}:\n${overview}`
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to list memory: ${errorMsg}` };
    }
  }
}
