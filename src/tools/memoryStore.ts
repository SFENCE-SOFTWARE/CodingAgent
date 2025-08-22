// src/tools/memoryStore.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class MemoryStoreTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_store',
      displayName: 'Memory Store',
      description: `Store a value in memory with a unique key. Stored data can later be retrieved with memory_retrieve_by_lines or memory_retrieve_data, or saved to files using memory_export. Available memory types: ${availableTypes.join(', ')}`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_store',
        description: `Store a value in memory with optional rich metadata for LLM searching and organization. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Unique key for the memory entry (must be unique across all memory types)'
            },
            value: {
              type: 'string',
              description: 'Value to store (can be any string, including JSON)'
            },
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Memory type where to store the value. Options: ${availableTypes.join(', ')}`
            },
            dataType: {
              type: 'string',
              enum: ['text', 'json', 'code', 'config', 'url', 'file_path', 'number', 'boolean', 'list', 'object', 'api_key', 'credentials', 'other'],
              description: 'Data type classification (auto-detected if not provided)'
            },
            category: {
              type: 'string',
              description: 'Category for organization (e.g., "user_preferences", "project_config", "api_endpoints")'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for flexible searching (e.g., ["frontend", "api", "important"])'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Priority level for importance ranking'
            },
            description: {
              type: 'string',
              description: 'Human-readable description of the data'
            },
            context: {
              type: 'string',
              description: 'Context about where this data comes from or how it is used'
            },
            expiresAfterDays: {
              type: 'number',
              description: 'Number of days after which this entry should expire'
            },
            relatedKeys: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keys of related memory entries'
            }
          },
          required: ['key', 'value', 'type']
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { 
        key, 
        value, 
        type, 
        dataType,
        category,
        tags,
        priority,
        description,
        context,
        expiresAfterDays,
        relatedKeys
      } = args;

      if (!key) {
        return { success: false, content: '', error: 'Key is required' };
      }

      if (!value) {
        return { success: false, content: '', error: 'Value is required' };
      }

      if (!type) {
        return { success: false, content: '', error: 'Memory type must be explicitly specified' };
      }

      // Validate memory type
      const availableTypes = this.memoryService.getAvailableMemoryTypes();
      if (!availableTypes.includes(type as MemoryType)) {
        return { 
          success: false, 
          content: '',
          error: `Invalid memory type '${type}'. Available types: ${availableTypes.join(', ')}` 
        };
      }

      // Build structured metadata
      const metadata: any = {};
      
      if (dataType) metadata.dataType = dataType;
      if (category) metadata.category = category;
      if (tags && Array.isArray(tags)) metadata.tags = tags;
      if (priority) metadata.priority = priority;
      if (description) metadata.description = description;
      if (context) metadata.context = context;
      if (expiresAfterDays && typeof expiresAfterDays === 'number') {
        metadata.expiresAfterDays = expiresAfterDays;
      }
      if (relatedKeys && Array.isArray(relatedKeys)) metadata.relatedKeys = relatedKeys;

      // Set default source
      metadata.source = 'tool_input';

      await this.memoryService.store(key, value, type as MemoryType, metadata);

      // Build result message with metadata summary
      let resultMessage = `Successfully stored value with key '${key}' in ${type} memory`;
      
      const metadataSummary = [];
      if (dataType) metadataSummary.push(`type: ${dataType}`);
      if (category) metadataSummary.push(`category: ${category}`);
      if (priority) metadataSummary.push(`priority: ${priority}`);
      if (tags?.length) metadataSummary.push(`tags: ${tags.join(', ')}`);
      
      if (metadataSummary.length > 0) {
        resultMessage += ` (${metadataSummary.join(', ')})`;
      }

      return {
        success: true,
        content: resultMessage
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to store memory: ${errorMsg}` };
    }
  }
}
