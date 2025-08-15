// src/tools/readWebpage.ts

import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class ReadWebpageTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'read_webpage',
      displayName: 'Read Webpage',
      description: 'Read content from a webpage',
      category: 'web'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_webpage',
        description: 'Read content from a webpage',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the webpage to read'
            },
            max_length: {
              type: 'integer',
              description: 'Maximum content length to return'
            }
          },
          required: ['url'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const url = args.url;
      const maxLength = args.max_length;

      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          content: '',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      let content = await response.text();
      
      // Basic HTML stripping (for better readability)
      content = content.replace(/<script[^>]*>.*?<\/script>/gis, '');
      content = content.replace(/<style[^>]*>.*?<\/style>/gis, '');
      content = content.replace(/<[^>]*>/g, ' ');
      content = content.replace(/\s+/g, ' ').trim();

      if (maxLength && content.length > maxLength) {
        content = content.substring(0, maxLength) + '... (truncated)';
      }

      return {
        success: true,
        content
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read webpage: ${error}`
      };
    }
  }
}
