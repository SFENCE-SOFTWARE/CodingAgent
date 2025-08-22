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
      description: `Store a value in memory with a unique key. Available memory types: ${availableTypes.join(', ')}`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_store',
        description: `Store a value in memory with a unique key. Memory type must be explicitly specified. Available types: ${availableTypes.join(', ')}`,
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
            metadata: {
              type: 'object',
              description: 'Optional metadata object to associate with the memory entry',
              additionalProperties: true
            }
          },
          required: ['key', 'value', 'type']
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { key, value, type, metadata } = args;

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

      await this.memoryService.store(key, value, type as MemoryType, metadata);

      return {
        success: true,
        content: `Successfully stored value with key '${key}' in ${type} memory`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to store memory: ${errorMsg}` };
    }
  }
}
