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
        description: `List all memory keys. If type is not specified, lists keys from all available memory types. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Optional memory type to list keys from. If not specified, lists keys from all available types. Options: ${availableTypes.join(', ')}`
            }
          },
          required: []
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { type } = args;

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

      const keys = await this.memoryService.listKeys(type as MemoryType);

      if (keys.length === 0) {
        const location = type ? `in ${type} memory` : 'in any available memory type';
        return {
          success: true,
          content: `No memory entries found ${location}`
        };
      }

      const location = type ? `in ${type} memory` : 'across all available memory types';
      const keyList = keys.map(key => `- ${key}`).join('\n');
      
      return {
        success: true,
        content: `Found ${keys.length} memory entries ${location}:\n${keyList}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to list memory keys: ${errorMsg}` };
    }
  }
}
