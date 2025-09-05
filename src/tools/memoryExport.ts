// src/tools/memoryExport.ts

import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';
import { MemoryService, MemoryType } from '../memoryService';
import * as path from 'path';
import * as fs from 'fs';

export class MemoryExportTool implements BaseTool {
  private memoryService?: MemoryService;

  constructor(memoryService?: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    const availableTypes = this.memoryService ? this.memoryService.getAvailableMemoryTypes().join(', ') : 'temporary, project';
    return {
      name: 'memory_export',
      displayName: 'Export Memory to File',
      description: `Save/export memory entries to files. Use when user wants to save memory content to a file, create backups, or persist memory data. COMMON TRIGGERS: "save to file", "export memory", "create file from memory", "backup memory". Available memory types: ${availableTypes}. Supports single entries, multiple entries, or entire memory sections.`,
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    const availableTypes = this.memoryService ? this.memoryService.getAvailableMemoryTypes().join(', ') : 'temporary, project';
    return {
      type: 'function',
      function: {
        name: 'memory_export',
        description: `Save/export memory entries to files. Use when user wants to save memory content to a file, backup memory data, or create persistent copies. COMMON USE CASES: 1) User asks to save/export a memory entry to file, 2) User wants to backup memory data, 3) User requests to create a file from memory content, 4) User wants permanent storage of memory information. Available memory types: ${availableTypes}. Can export single entries, multiple entries by pattern, or filtered sets with various output formats.`,
        parameters: {
          type: 'object',
          properties: {
            memory_key: {
              type: 'string',
              description: 'Single memory key to export. Use this OR memory_keys OR search_pattern, not multiple.'
            },
            memory_keys: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of memory keys to export. Use this OR memory_key OR search_pattern, not multiple.'
            },
            search_pattern: {
              type: 'string',
              description: 'Pattern to search for memory keys (supports wildcards like webpage_*, *_part_*). Use this OR memory_key OR memory_keys.'
            },
            file_path: {
              type: 'string',
              description: 'Output file path (relative to workspace or absolute). For multiple entries, use template like "exports/entry_{key}.md"'
            },
            memory_type: {
              type: 'string',
              enum: ['temporary', 'project'],
              description: 'Memory type to export from. If not specified, searches all available types.'
            },
            format: {
              type: 'string',
              enum: ['raw', 'markdown', 'json', 'text'],
              description: 'Export format. "raw" preserves original content, "markdown" adds headers, "json" includes metadata, "text" plain text only.',
              default: 'raw'
            },
            include_metadata: {
              type: 'boolean',
              description: 'Whether to include metadata in the export (affects all formats except raw)',
              default: true
            },
            combine_entries: {
              type: 'boolean',
              description: 'For multiple entries: combine into single file (true) or separate files (false)',
              default: false
            },
            separator: {
              type: 'string',
              description: 'Separator between entries when combine_entries is true',
              default: '\n\n---\n\n'
            },
            overwrite: {
              type: 'boolean',
              description: 'Whether to overwrite existing files',
              default: false
            }
          },
          required: ['file_path'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const {
        memory_key,
        memory_keys,
        search_pattern,
        file_path,
        memory_type,
        format = 'raw',
        include_metadata = true,
        combine_entries = false,
        separator = '\n\n---\n\n',
        overwrite = false
      } = args;

      if (!this.memoryService) {
        return {
          success: false,
          content: '',
          error: 'Memory service not available'
        };
      }

      if (!file_path) {
        return {
          success: false,
          content: '',
          error: 'file_path parameter is required'
        };
      }

      // Validate that only one source is specified
      const sourceCount = [memory_key, memory_keys, search_pattern].filter(x => x !== undefined).length;
      if (sourceCount !== 1) {
        return {
          success: false,
          content: '',
          error: 'Specify exactly one of: memory_key, memory_keys, or search_pattern'
        };
      }

      // Collect memory keys to export
      let keysToExport: string[] = [];

      if (memory_key) {
        keysToExport = [memory_key];
      } else if (memory_keys) {
        keysToExport = memory_keys;
      } else if (search_pattern) {
        // Get all keys and filter by pattern
        const allKeys = await this.memoryService.listKeys(memory_type as MemoryType || undefined);
        const pattern = search_pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        keysToExport = allKeys.filter((key: string) => regex.test(key));
        
        if (keysToExport.length === 0) {
          return {
            success: false,
            content: '',
            error: `No memory entries found matching pattern: ${search_pattern}`
          };
        }
      }

      // Retrieve memory entries
      const entries = [];
      for (const key of keysToExport) {
        const entry = await this.memoryService.retrieve(key, memory_type as MemoryType || undefined);
        if (entry) {
          entries.push({ exportKey: key, ...entry });
        } else {
          console.log(`[MemoryExport] Warning: Key '${key}' not found, skipping`);
        }
      }

      if (entries.length === 0) {
        return {
          success: false,
          content: '',
          error: 'No valid memory entries found to export'
        };
      }

      // Format entries
      const formattedEntries = entries.map(entry => this.formatEntry(entry, format, include_metadata));

      // Handle file output
      if (combine_entries || entries.length === 1) {
        // Single file output
        const combinedContent = formattedEntries.join(separator);
        const outputPath = this.getFilePath(file_path, workspaceRoot);
        
        await this.writeFile(outputPath, combinedContent, overwrite);
        
        return {
          success: true,
          content: `Successfully exported ${entries.length} memory entries to: ${outputPath}\nTotal content length: ${combinedContent.length} characters\nFormat: ${format}${include_metadata ? ' (with metadata)' : ''}`
        };
      } else {
        // Multiple files output
        if (!file_path.includes('{key}')) {
          return {
            success: false,
            content: '',
            error: 'For multiple separate files, file_path must contain {key} template (e.g., "exports/entry_{key}.md")'
          };
        }

        const exportedFiles: string[] = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const content = formattedEntries[i];
          const outputPath = this.getFilePath(file_path.replace('{key}', entry.exportKey), workspaceRoot);
          
          await this.writeFile(outputPath, content, overwrite);
          exportedFiles.push(outputPath);
        }

        return {
          success: true,
          content: `Successfully exported ${entries.length} memory entries to separate files:\n${exportedFiles.map(f => `- ${f}`).join('\n')}\nFormat: ${format}${include_metadata ? ' (with metadata)' : ''}`
        };
      }

    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to export memory entries: ${error}`
      };
    }
  }

  private formatEntry(entry: any, format: string, includeMetadata: boolean): string {
    const { exportKey, key, value, type, metadata } = entry;
    const entryKey = exportKey || key;

    switch (format) {
      case 'raw':
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);

      case 'markdown':
        let content = `# ${entryKey}\n\n`;
        if (includeMetadata && metadata) {
          content += this.formatMetadataAsMarkdown(metadata);
        }
        content += typeof value === 'string' ? value : `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
        return content;

      case 'json':
        const jsonData: any = { key: entryKey, type, value };
        if (includeMetadata && metadata) {
          jsonData.metadata = metadata;
        }
        return JSON.stringify(jsonData, null, 2);

      case 'text':
        let textContent = '';
        if (includeMetadata && metadata) {
          textContent += `Key: ${entryKey}\nType: ${type}\n`;
          if (metadata.description) {textContent += `Description: ${metadata.description}\n`;}
          if (metadata.category) {textContent += `Category: ${metadata.category}\n`;}
          if (metadata.tags) {textContent += `Tags: ${metadata.tags.join(', ')}\n`;}
          textContent += '\n';
        }
        textContent += typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        return textContent;

      default:
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }
  }

  private formatMetadataAsMarkdown(metadata: any): string {
    let content = '## Metadata\n\n';
    
    if (metadata.description) {content += `**Description:** ${metadata.description}\n\n`;}
    if (metadata.category) {content += `**Category:** ${metadata.category}\n\n`;}
    if (metadata.tags && metadata.tags.length > 0) {content += `**Tags:** ${metadata.tags.join(', ')}\n\n`;}
    if (metadata.priority) {content += `**Priority:** ${metadata.priority}\n\n`;}
    if (metadata.context) {content += `**Context:** ${metadata.context}\n\n`;}
    if (metadata.source) {content += `**Source:** ${metadata.source}\n\n`;}
    if (metadata.format) {content += `**Format:** ${metadata.format}\n\n`;}
    if (metadata.projectPath) {content += `**Project Path:** ${metadata.projectPath}\n\n`;}
    if (metadata.relatedKeys && metadata.relatedKeys.length > 0) {
      content += `**Related Keys:** ${metadata.relatedKeys.join(', ')}\n\n`;
    }
    if (metadata.createdAt) {content += `**Created:** ${metadata.createdAt}\n\n`;}
    if (metadata.updatedAt) {content += `**Updated:** ${metadata.updatedAt}\n\n`;}
    if (metadata.expiresAt) {content += `**Expires:** ${metadata.expiresAt}\n\n`;}
    
    return content + '## Content\n\n';
  }

  private getFilePath(filePath: string, workspaceRoot: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(workspaceRoot, filePath);
  }

  private async writeFile(filePath: string, content: string, overwrite: boolean): Promise<void> {
    // Check if file exists
    if (!overwrite && fs.existsSync(filePath)) {
      throw new Error(`File already exists and overwrite is false: ${filePath}`);
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[MemoryExport] Successfully wrote ${content.length} characters to: ${filePath}`);
  }
}
