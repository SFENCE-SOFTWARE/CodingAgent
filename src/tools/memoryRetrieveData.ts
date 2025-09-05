// src/tools/memoryRetrieveData.ts

import * as vscode from 'vscode';
import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class MemoryRetrieveDataTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_retrieve_data',
      displayName: 'Memory Retrieve Data',
      description: `Retrieve raw memory data by character offset and length. Use for precise data extraction from memory content. To save retrieved content to a file, use memory_export. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches all available types. SAFETY: Auto-limits applied for large values.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    const config = vscode.workspace.getConfiguration('codingagent.memory');
    const maxChars = config.get('maxChars', 50000);

    return {
      type: 'function',
      function: {
        name: 'memory_retrieve_data',
        description: `Retrieve raw memory data by character offset and length. Maximum ${maxChars} characters per operation. Use for precise data extraction and binary/raw content access. To save retrieved data to files, use memory_export. Available memory types: ${availableTypes.join(', ')}.`,
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
              description: 'Character offset to start reading from (default: 0)',
              minimum: 0,
              default: 0
            },
            length: {
              type: 'number',
              description: 'Maximum number of characters to read (default: auto-limited based on settings)',
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

      // Process value with character-based reading
      const originalValue = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
      const totalLength = originalValue.length;

      // Get configuration
      const config = vscode.workspace.getConfiguration('codingagent.memory');
      const maxChars = config.get('maxChars', 50000);
      const autoSafetyLimit = config.get('autoSafetyLimit', true);
      const largeValueThreshold = config.get('largeValueThreshold', 10000);

      if (metadata_only) {
        const allLines = originalValue.split('\n');
        result.valueLength = totalLength;
        result.lineCount = allLines.length;
        result.valuePreview = totalLength > 100 ? originalValue.substring(0, 100) + '...' : originalValue;
        console.log(`[MemoryRetrieveData] Metadata-only retrieval for key '${key}', length: ${totalLength} chars, lines: ${allLines.length}`);
      } else {
        // Character-based reading with auto-safety limits
        let effectiveOffset = offset;
        let effectiveLength = length;

        // Auto-apply safety limits for large values
        const AUTO_SAFETY_LIMIT = 5000;
        const MAX_SAFE_LENGTH = Math.min(maxChars, 100000);

        if (autoSafetyLimit && totalLength > largeValueThreshold) {
          if (effectiveLength === undefined) {
            // Auto-apply safety limit for large values
            effectiveLength = AUTO_SAFETY_LIMIT;
            console.log(`[MemoryRetrieveData] Auto-applying safety limit (${AUTO_SAFETY_LIMIT} chars) for large value (${totalLength} chars) with key '${key}'`);
          } else if (effectiveLength > MAX_SAFE_LENGTH) {
            // Cap extremely large requests
            effectiveLength = MAX_SAFE_LENGTH;
            console.log(`[MemoryRetrieveData] Capping large length request from ${length} to ${MAX_SAFE_LENGTH} chars for key '${key}'`);
          }
        }

        // Apply character limits from settings
        let isLimitedBySettings = false;
        if (effectiveLength === undefined || effectiveLength > maxChars) {
          if (effectiveLength !== undefined && effectiveLength > maxChars) {
            isLimitedBySettings = true;
          }
          effectiveLength = Math.min(effectiveLength || totalLength, maxChars);
        }

        // Apply offset and length
        const startIndex = Math.min(effectiveOffset, totalLength);
        const endIndex = effectiveLength !== undefined 
          ? Math.min(startIndex + effectiveLength, totalLength)
          : totalLength;
        
        const partialValue = originalValue.substring(startIndex, endIndex);
        const isPartial = startIndex > 0 || endIndex < totalLength;
        
        result.value = partialValue;
        result.valueLength = totalLength;
        result.readRange = `${startIndex}-${endIndex - 1}`;
        
        let readInfo = `Showing characters ${startIndex + 1}-${endIndex} of ${totalLength}`;
        if (isLimitedBySettings) {
          readInfo += ` (limited by maxChars setting: ${maxChars})`;
        }
        
        if (isPartial) {
          result.isPartial = true;
          result.readInfo = readInfo;
        }
        
        if (endIndex < totalLength) {
          result.nextOffset = endIndex;
          result.remainingLength = totalLength - endIndex;
        }

        console.log(`[MemoryRetrieveData] Character-based retrieval for key '${key}': chars ${startIndex}-${endIndex} from total ${totalLength}`);
      }

      // Include rich metadata if available
      if (entry.metadata) {
        const metadata = entry.metadata;
        if (metadata.dataType) {result.dataType = metadata.dataType;}
        if (metadata.category) {result.category = metadata.category;}
        if (metadata.tags) {result.tags = metadata.tags;}
        if (metadata.priority) {result.priority = metadata.priority;}
        if (metadata.description) {result.description = metadata.description;}
        if (metadata.context) {result.context = metadata.context;}
        if (metadata.lastAccessed) {result.lastAccessed = new Date(metadata.lastAccessed).toISOString();}
        if (metadata.accessCount) {result.accessCount = metadata.accessCount;}
        if (metadata.relatedKeys) {result.relatedKeys = metadata.relatedKeys;}
        if (metadata.expiresAt) {result.expiresAt = new Date(metadata.expiresAt).toISOString();}
        if (metadata.sizeBytes) {result.sizeBytes = metadata.sizeBytes;}
        if (metadata.complexity) {result.complexity = metadata.complexity;}
        
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
        content: `Retrieved memory data${readingInfo}:\n${JSON.stringify(result, null, 2)}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to retrieve memory data: ${errorMsg}` };
    }
  }
}
