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
      description: `Retrieve a value from memory by key with optional partial reading. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches all available types. SAFETY: Values >10KB are auto-limited to 5KB unless explicit length is specified. Use metadata_only=true to inspect large values first.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();

    return {
      type: 'function',
      function: {
        name: 'memory_retrieve',
        description: `Retrieve a value from memory by key with optional partial reading for large values. If type is not specified, searches all available memory types. Available types: ${availableTypes.join(', ')}. SAFETY: Values >10KB auto-limited to 5KB unless explicit length specified. Use metadata_only=true for large values inspection.`,
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
            },
            offset: {
              type: 'number',
              description: 'Character offset to start reading from (default: 0). Use for partial reading of large values.',
              minimum: 0,
              default: 0
            },
            length: {
              type: 'number',
              description: 'Maximum number of characters to read (default: unlimited). Use for partial reading of large values.',
              minimum: 1,
              maximum: 100000
            },
            metadata_only: {
              type: 'boolean',
              description: 'If true, returns only metadata without the value content (default: false). Useful for inspecting large entries.',
              default: false
            }
          },
          required: ['key']
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { 
        key, 
        type, 
        offset = 0, 
        length, 
        metadata_only = false 
      } = args;

      if (!key) {
        return { success: false, content: '', error: 'Key is required' };
      }

      // Validate parameters
      if (offset < 0) {
        return { 
          success: false, 
          content: '',
          error: 'Offset must be non-negative' 
        };
      }

      if (length !== undefined && (length < 1 || length > 100000)) {
        return { 
          success: false, 
          content: '',
          error: 'Length must be between 1 and 100000 characters' 
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

      const entry = await this.memoryService.retrieve(key, type as MemoryType);

      if (!entry) {
        const searchLocation = type ? `in ${type} memory` : 'in any available memory type';
        return { 
          success: false, 
          content: '',
          error: `No memory entry found with key '${key}' ${searchLocation}` 
        };
      }

      const result: any = {
        key: entry.key,
        type: entry.type,
        timestamp: entry.timestamp,
        created: new Date(entry.timestamp).toISOString()
      };

      // Process value with partial reading
      const originalValue = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
      const totalLength = originalValue.length;

      // Auto-apply safety limits for large values (>10KB without explicit length)
      const LARGE_VALUE_THRESHOLD = 10000;
      const AUTO_SAFETY_LIMIT = 5000;
      const MAX_SAFE_LENGTH = 50000;

      let effectiveOffset = offset;
      let effectiveLength = length;

      if (!metadata_only && totalLength > LARGE_VALUE_THRESHOLD) {
        if (effectiveLength === undefined) {
          // Auto-apply safety limit for large values
          effectiveLength = AUTO_SAFETY_LIMIT;
          console.log(`[MemoryRetrieve] Auto-applying safety limit (${AUTO_SAFETY_LIMIT} chars) for large value (${totalLength} chars) with key '${key}'`);
        } else if (effectiveLength > MAX_SAFE_LENGTH) {
          // Cap extremely large requests
          effectiveLength = MAX_SAFE_LENGTH;
          console.log(`[MemoryRetrieve] Capping large length request from ${length} to ${MAX_SAFE_LENGTH} chars for key '${key}'`);
        }
      }

      if (metadata_only) {
        result.valueLength = totalLength;
        result.valuePreview = totalLength > 100 ? originalValue.substring(0, 100) + '...' : originalValue;
        console.log(`[MemoryRetrieve] Metadata-only retrieval for key '${key}', length: ${totalLength} chars`);
      } else {
        // Apply offset and length
        const startIndex = Math.min(effectiveOffset, totalLength);
        const endIndex = effectiveLength !== undefined 
          ? Math.min(startIndex + effectiveLength, totalLength)
          : totalLength;
        
        const partialValue = originalValue.substring(startIndex, endIndex);
        const isPartial = startIndex > 0 || endIndex < totalLength;
        
        result.value = partialValue;
        result.valueLength = totalLength;
        
        console.log(`[MemoryRetrieve] Retrieved ${partialValue.length} chars (${startIndex}-${endIndex}) from total ${totalLength} chars for key '${key}'`);
        
        if (isPartial) {
          result.isPartial = true;
          result.readRange = `${startIndex}-${endIndex - 1}`;
          result.readInfo = `Showing characters ${startIndex + 1}-${endIndex} of ${totalLength}`;
          
          if (endIndex < totalLength) {
            result.nextOffset = endIndex;
            result.remainingLength = totalLength - endIndex;
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
        if (metadata.expiresAt) result.expiresAt = new Date(metadata.expiresAt).toISOString();
        if (metadata.sizeBytes) result.sizeBytes = metadata.sizeBytes;
        if (metadata.complexity) result.complexity = metadata.complexity;
        
        // Include full metadata for LLM reference
        result.fullMetadata = metadata;
      }

      const readingInfo = metadata_only 
        ? ' (metadata only)'
        : result.isPartial 
          ? ` (${result.readInfo})`
          : '';

      return {
        success: true,
        content: `Retrieved memory entry${readingInfo}:\n${JSON.stringify(result, null, 2)}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to retrieve memory: ${errorMsg}` };
    }
  }
}
