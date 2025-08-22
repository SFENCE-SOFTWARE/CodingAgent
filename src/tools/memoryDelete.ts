// src/tools/memoryDelete.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class MemoryDeleteTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_delete',
      displayName: 'Memory Delete',
      description: `Delete a memory entry by key. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches and deletes from all available types.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_delete',
        description: `Delete a memory entry by key. If type is not specified, searches and deletes from all available memory types. Available types: ${availableTypes.join(', ')}`,
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key of the memory entry to delete'
            },
            type: {
              type: 'string',
              enum: availableTypes,
              description: `Optional memory type to delete from. If not specified, searches and deletes from all available types. Options: ${availableTypes.join(', ')}`
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

      const deleted = await this.memoryService.delete(key, type as MemoryType);

      if (!deleted) {
        const searchLocation = type ? `in ${type} memory` : 'in any available memory type';
        console.log(`[MemoryDelete] Failed to delete key '${key}' ${searchLocation} - entry not found`);
        return { 
          success: false, 
          content: '',
          error: `No memory entry found with key '${key}' ${searchLocation}` 
        };
      }

      const deleteLocation = type ? `from ${type} memory` : 'from memory';
      console.log(`[MemoryDelete] Successfully deleted key '${key}' ${deleteLocation}`);
      return {
        success: true,
        content: `Successfully deleted memory entry with key '${key}' ${deleteLocation}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to delete memory: ${errorMsg}` };
    }
  }
}
