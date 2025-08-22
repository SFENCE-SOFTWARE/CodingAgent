// src/tools/memoryList.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

/**
 * Calculate content statistics for memory entry
 */
function getContentStats(value: any): { length: number; lines: number; type: string } {
  let stringValue: string;
  let type: string;
  
  if (typeof value === 'string') {
    stringValue = value;
    type = 'string';
  } else {
    stringValue = JSON.stringify(value, null, 2);
    type = typeof value;
  }
  
  const length = stringValue.length;
  const lines = stringValue.split(/\r\n|\r|\n/).length;
  
  return { length, lines, type };
}

/**
 * Format size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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
      description: `List memory entries with enhanced metadata overview including line counts, sizes, and content statistics. Use memory_export to save listed entries to files. Available memory types: ${availableTypes.join(', ')}. If type is not specified, lists all available types. Use offset/limit for large memory sets.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_list',
        description: `List memory entries with enhanced metadata overview including line counts, sizes, and content statistics. If type is not specified, lists all available types. Available types: ${availableTypes.join(', ')}`,
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
        // Show detailed view with enhanced metadata
        const detailed = entries.map(entry => {
          const contentStats = getContentStats(entry.value);
          
          const result: any = {
            key: entry.key,
            type: entry.type,
            created: new Date(entry.timestamp).toISOString(),
            content: {
              length: contentStats.length,
              lines: contentStats.lines,
              size: formatSize(contentStats.length),
              valueType: contentStats.type
            }
          };

          if (entry.metadata) {
            const metadata = entry.metadata;
            if (metadata.dataType) result.dataType = metadata.dataType;
            if (metadata.category) result.category = metadata.category;
            if (metadata.tags && metadata.tags.length > 0) result.tags = metadata.tags;
            if (metadata.priority && metadata.priority !== 'medium') result.priority = metadata.priority;
            if (metadata.description) result.description = metadata.description;
            if (metadata.context) result.context = metadata.context;
            if (metadata.source) result.source = metadata.source;
            if (metadata.format) result.format = metadata.format;
            if (metadata.complexity) result.complexity = metadata.complexity;
            if (metadata.version) result.version = metadata.version;
            if (metadata.accessCount) result.accessCount = metadata.accessCount;
            if (metadata.lastAccessed) result.lastAccessed = new Date(metadata.lastAccessed).toISOString();
            if (metadata.lastModified) result.lastModified = new Date(metadata.lastModified).toISOString();
            if (metadata.expiresAt) result.expiresAt = new Date(metadata.expiresAt).toISOString();
            if (metadata.sensitive) result.sensitive = metadata.sensitive;
            if (metadata.relatedKeys && metadata.relatedKeys.length > 0) result.relatedKeys = metadata.relatedKeys;
          }

          return result;
        });

        return {
          success: true,
          content: `Found ${totalCount} memory entries ${location}${paginationInfo}:\n${JSON.stringify(detailed, null, 2)}`
        };
      } else {
        // Show enhanced compact overview with line counts
        const overview = entries.map(entry => {
          const contentStats = getContentStats(entry.value);
          const parts = [entry.key];
          
          // Add content info
          parts.push(`[${contentStats.lines}L, ${formatSize(contentStats.length)}]`);
          
          // Add metadata info
          if (entry.metadata?.dataType) parts.push(`{${entry.metadata.dataType}}`);
          if (entry.metadata?.category) parts.push(`(${entry.metadata.category})`);
          if (entry.metadata?.priority && entry.metadata.priority !== 'medium') {
            parts.push(`!${entry.metadata.priority}`);
          }
          if (entry.metadata?.tags?.length) parts.push(`#${entry.metadata.tags.join(' #')}`);
          if (entry.metadata?.description) {
            const desc = entry.metadata.description.length > 50 
              ? entry.metadata.description.substring(0, 47) + '...' 
              : entry.metadata.description;
            parts.push(`"${desc}"`);
          }
          
          return `- ${parts.join(' ')}`;
        }).join('\n');

        // Enhanced summary with content statistics
        const typeGroups = allEntries.reduce((acc, entry) => {
          const t = entry.type;
          if (!acc[t]) acc[t] = { count: 0, totalLines: 0, totalSize: 0 };
          acc[t].count++;
          const stats = getContentStats(entry.value);
          acc[t].totalLines += stats.lines;
          acc[t].totalSize += stats.length;
          return acc;
        }, {} as Record<string, { count: number; totalLines: number; totalSize: number }>);

        const typeSummary = Object.entries(typeGroups)
          .map(([t, stats]) => `${t}: ${stats.count} entries, ${stats.totalLines} lines, ${formatSize(stats.totalSize)}`)
          .join('; ');

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
