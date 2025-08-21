// src/tools/readWebpageAsMarkdown.ts

import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';
import { NodeHtmlMarkdown } from 'node-html-markdown';

export class ReadWebpageAsMarkdownTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'read_webpage_as_markdown',
      displayName: 'Read Webpage as Markdown',
      description: 'Read webpage content and convert HTML to Markdown for better context utilization',
      category: 'web'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_webpage_as_markdown',
        description: 'Read webpage content and convert HTML to Markdown for better context utilization',
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

      let htmlContent = await response.text();
      
      // Remove script, style tags and comments
      htmlContent = htmlContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
      htmlContent = htmlContent.replace(/<style[^>]*>.*?<\/style>/gi, '');
      htmlContent = htmlContent.replace(/<!--[\s\S]*?-->/g, '');
      
      // Convert HTML to Markdown
      const nhm = new NodeHtmlMarkdown({
        // Configure options for better LLM context usage
        useInlineLinks: true,
        bulletMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        maxConsecutiveNewlines: 2
      });

      let markdownContent = nhm.translate(htmlContent);
      
      // Additional cleanup for better context window usage
      markdownContent = markdownContent
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive newlines
        .replace(/^\s+|\s+$/gm, '') // Trim lines
        .trim();

      if (maxLength && markdownContent.length > maxLength) {
        markdownContent = markdownContent.substring(0, maxLength) + '\n\n... (truncated)';
      }

      return {
        success: true,
        content: markdownContent
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read webpage and convert to markdown: ${error}`
      };
    }
  }
}
