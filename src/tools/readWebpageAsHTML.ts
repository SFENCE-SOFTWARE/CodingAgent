// src/tools/readWebpageAsHTML.ts

import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';

export class ReadWebpageAsHTMLTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'read_webpage_as_html',
      displayName: 'Read Webpage as HTML',
      description: 'Read webpage content and return it as cleaned HTML',
      category: 'web'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_webpage_as_html',
        description: 'Read webpage content and return it as cleaned HTML',
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
      
      // Remove script and style tags but keep HTML structure
      content = content.replace(/<script[^>]*>.*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>.*?<\/style>/gi, '');
      content = content.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
      
      // Clean up whitespace but preserve HTML structure
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
