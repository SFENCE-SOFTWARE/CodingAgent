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
      description: `List all memory keys. Available memory types: ${availableTypes.join(', ')}. If type is not specified, lists keys from all available types.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_list',
        description: `List memory entries with metadata overview. If type is not specified, lists all available types. Available types: ${availableTypes.join(', ')}`,
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
            }
          },
          required: []
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { type, show_details = false } = args;

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

      // Use search to get all entries with metadata
      const searchOptions = { type: type as MemoryType, maxResults: 1000 };
      const entries = await this.memoryService.search(searchOptions);

      if (entries.length === 0) {
        const location = type ? `in ${type} memory` : 'in any available memory type';
        return {
          success: true,
          content: `No memory entries found ${location}`
        };
      }

      const location = type ? `in ${type} memory` : 'across all available memory types';

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
          content: `Found ${entries.length} memory entries ${location}:\n${JSON.stringify(detailed, null, 2)}`
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
        const typeGroups = entries.reduce((acc, entry) => {
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
          content: `Found ${entries.length} memory entries ${location} (${typeSummary}):\n${overview}`
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to list memory: ${errorMsg}` };
    }
  }
}
