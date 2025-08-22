// src/tools/memoryRetrieve.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class MemoryRetrieveTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_retrieve',
      displayName: 'Memory Retrieve',
      description: `Retrieve a value from memory by key. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches all available types.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_retrieve',
        description: `Retrieve a value from memory by key. If type is not specified, searches all available memory types. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key of the memory entry to retrieve'
            },
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Optional memory type to search in. If not specified, searches all available types. Options: ${availableTypes.join(', ')}`
            }
          },
          required: ['key']
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { key, type } = args;

      if (!key) {
        return { success: false, content: '', error: 'Key is required' };
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

      const entry = await this.memoryService.retrieve(key, type as MemoryType);

      if (!entry) {
        const searchLocation = type ? `in ${type} memory` : 'in any available memory type';
        return { 
          success: false, 
          content: '',
          error: `No memory entry found with key '${key}' ${searchLocation}` 
        };
      }

      const result = {
        key: entry.key,
        value: entry.value,
        type: entry.type,
        timestamp: entry.timestamp,
        created: new Date(entry.timestamp).toISOString(),
        metadata: entry.metadata || {}
      };

      return {
        success: true,
        content: `Retrieved memory entry:\n${JSON.stringify(result, null, 2)}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to retrieve memory: ${errorMsg}` };
    }
  }
}
