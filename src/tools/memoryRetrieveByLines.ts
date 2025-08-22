// src/tools/memoryRetrieveByLines.ts

import * as vscode from 'vscode';
import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class MemoryRetrieveByLinesTool implements BaseTool {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    
    return {
      name: 'memory_retrieve_by_lines',
      displayName: 'Memory Retrieve by Lines',
      description: `Retrieve memory content by line numbers. Use for structured reading of memory content. To save retrieved content to a file, use memory_export. Available memory types: ${availableTypes.join(', ')}. If type is not specified, searches all available types.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService.getAvailableMemoryTypes();
    const config = vscode.workspace.getConfiguration('codingagent.memory');
    const maxLines = config.get('maxLines', 1000);

    return {
      type: 'function',
      function: {
        name: 'memory_retrieve_by_lines',
        description: `Retrieve memory content by line boundaries. Maximum ${maxLines} lines per operation. Use for structured reading of text-based memory content. To save retrieved content to files, use memory_export. Available memory types: ${availableTypes.join(', ')}.`,
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
            start_line: {
              type: 'integer',
              description: 'Starting line number (1-based, default: 1)',
              minimum: 1,
              default: 1
            },
            end_line: {
              type: 'integer',
              description: 'Ending line number (1-based, optional). If not specified, reads from start_line to end',
              minimum: 1
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
        start_line = 1,
        end_line,
        metadata_only = false 
      } = args;

      if (!key) {
        return { success: false, content: '', error: 'Key is required' };
      }

      // Validate parameters
      if (start_line < 1) {
        return { 
          success: false, 
          content: '',
          error: 'start_line must be 1 or greater' 
        };
      }

      if (end_line !== undefined && end_line < 1) {
        return { 
          success: false, 
          content: '',
          error: 'end_line must be 1 or greater' 
        };
      }

      if (start_line !== undefined && end_line !== undefined && end_line < start_line) {
        return { 
          success: false, 
          content: '',
          error: 'end_line must be greater than or equal to start_line' 
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

      // Process value with line-based reading
      const originalValue = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
      const totalLength = originalValue.length;

      // Get configuration
      const config = vscode.workspace.getConfiguration('codingagent.memory');
      const maxLines = config.get('maxLines', 1000);

      if (metadata_only) {
        const allLines = originalValue.split('\n');
        result.valueLength = totalLength;
        result.lineCount = allLines.length;
        result.valuePreview = totalLength > 100 ? originalValue.substring(0, 100) + '...' : originalValue;
        console.log(`[MemoryRetrieveByLines] Metadata-only retrieval for key '${key}', length: ${totalLength} chars, lines: ${allLines.length}`);
      } else {
        // Line-based reading
        const allLines = originalValue.split('\n');
        const totalLines = allLines.length;

        let startLineIndex = Math.max(0, start_line - 1);
        let endLineIndex = end_line ? Math.min(allLines.length, end_line) : allLines.length;
        
        // Apply max lines limit
        const requestedLines = endLineIndex - startLineIndex;
        let isLimitedBySettings = false;
        if (requestedLines > maxLines) {
          endLineIndex = startLineIndex + maxLines;
          isLimitedBySettings = true;
        }

        const resultLines = allLines.slice(startLineIndex, endLineIndex);
        const partialValue = resultLines.join('\n');
        const isPartial = startLineIndex > 0 || endLineIndex < totalLines || isLimitedBySettings;

        result.value = partialValue;
        result.valueLength = totalLength;
        result.lineCount = totalLines;
        result.readLines = `${startLineIndex + 1}-${endLineIndex}`;
        
        let readInfo = `Showing lines ${startLineIndex + 1}-${endLineIndex} of ${totalLines}`;
        if (isLimitedBySettings) {
          readInfo += ` (limited by maxLines setting: ${maxLines})`;
        }

        if (isPartial) {
          result.isPartial = true;
          result.readInfo = readInfo;
        }

        if (endLineIndex < totalLines) {
          result.nextStartLine = endLineIndex + 1;
          result.remainingLines = totalLines - endLineIndex;
        }

        console.log(`[MemoryRetrieveByLines] Line-based retrieval for key '${key}': lines ${startLineIndex + 1}-${endLineIndex} of ${totalLines}, chars: ${partialValue.length}`);
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
        content: `Retrieved memory entry by lines${readingInfo}:\n${JSON.stringify(result, null, 2)}`
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, content: '', error: `Failed to retrieve memory by lines: ${errorMsg}` };
    }
  }
}
