// src/tools/readWebpageAsHTML.ts

import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';
import { MemoryService, MemoryType } from '../memoryService';

export class ReadWebpageAsHTMLTool implements BaseTool {
  private memoryService?: MemoryService;

  constructor(memoryService?: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    return {
      name: 'read_webpage_as_html',
      displayName: 'Read Webpage as HTML',
      description: 'Read webpage content, clean HTML, and store in memory with metadata',
      category: 'web'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_webpage_as_html',
        description: 'Read webpage content, clean HTML, and store in memory with metadata',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the webpage to read'
            },
            max_length: {
              type: 'integer',
              description: 'Maximum content length before truncation'
            },
            memory_key: {
              type: 'string',
              description: 'Memory key to store the webpage content. Content will be stored in memory instead of being returned.'
            },
            memory_type: {
              type: 'string',
              enum: ['temporary', 'project'],
              description: 'Memory type for storage. "temporary" - session memory, "project" - persistent workspace memory. Defaults to temporary.',
              default: 'temporary'
            },
            split_content: {
              type: 'boolean',
              description: 'Whether to split large content into multiple memory entries for better LLM processing. Default: false',
              default: false
            },
            split_size: {
              type: 'integer',
              description: 'Target size (in characters) for content splits when split_content is true. Default: 8000',
              default: 8000,
              minimum: 1000,
              maximum: 20000
            },
            category: {
              type: 'string',
              description: 'Category for memory storage (e.g., "documentation", "research", "reference")'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for memory storage (e.g., ["html", "webpage", "documentation"])'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Priority level for memory storage',
              default: 'medium'
            }
          },
          required: ['url', 'memory_key'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { 
        url, 
        max_length,
        memory_key,
        memory_type = 'temporary',
        split_content = false,
        split_size = 8000,
        category,
        tags,
        priority = 'medium'
      } = args;

      if (!this.memoryService) {
        return {
          success: false,
          content: '',
          error: 'Memory service not available - cannot store webpage content'
        };
      }

      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          content: '',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      let content = await response.text();
      
      // Extract title from HTML for better metadata
      const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
      
      // Remove script and style tags but keep HTML structure
      content = content.replace(/<script[^>]*>.*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>.*?<\/style>/gi, '');
      content = content.replace(/<!--[\s\S]*?-->/g, ''); // Remove comments
      
      // Clean up whitespace but preserve HTML structure
      content = content.replace(/\s+/g, ' ').trim();

      try {
        const baseMetadata = {
          dataType: 'text' as const,
          category: category || 'web_content',
          tags: [...(tags || []), 'html', 'webpage'],
          priority: priority as any,
          description: `HTML content from: ${pageTitle}`,
          context: `Webpage content fetched from ${url}`,
          source: 'web_fetch',
          format: 'html',
          projectPath: url,
          relatedKeys: [] as string[]
        };

        if (!split_content || content.length <= split_size) {
          // Store as single entry
          let finalContent = content;
          if (max_length && finalContent.length > max_length) {
            finalContent = finalContent.substring(0, max_length) + '... (truncated)';
          }

          await this.memoryService.store(memory_key, finalContent, memory_type as MemoryType, {
            ...baseMetadata,
            description: `Complete HTML content from: ${pageTitle}`
          });

          return {
            success: true,
            content: `Webpage content successfully stored in memory as '${memory_key}'. Content length: ${finalContent.length} characters. Page title: "${pageTitle}". Use memory tools to retrieve content when needed.`
          };
        } else {
          // Split content into chunks
          const chunks = this.splitContent(content, split_size);
          const storedKeys: string[] = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunkKey = `${memory_key}_part_${i + 1}`;
            const chunk = chunks[i];
            
            await this.memoryService.store(chunkKey, chunk, memory_type as MemoryType, {
              ...baseMetadata,
              description: `HTML content part ${i + 1}/${chunks.length} from: ${pageTitle}`,
              context: `Part ${i + 1} of ${chunks.length} from ${url}`,
              relatedKeys: storedKeys.length > 0 ? [storedKeys[storedKeys.length - 1]] : undefined
            });
            
            storedKeys.push(chunkKey);
          }

          // Update related keys for all chunks
          for (let i = 0; i < storedKeys.length; i++) {
            const relatedKeys = storedKeys.filter((_, idx) => idx !== i);
            const entry = await this.memoryService.retrieve(storedKeys[i]);
            if (entry && entry.metadata) {
              entry.metadata.relatedKeys = relatedKeys;
              await this.memoryService.store(storedKeys[i], entry.value, entry.type, entry.metadata);
            }
          }

          return {
            success: true,
            content: `Webpage content successfully split into ${chunks.length} parts and stored in memory as '${storedKeys.join("', '")}'. Total content length: ${content.length} characters. Page title: "${pageTitle}". Use memory tools to retrieve content when needed.`
          };
        }
      } catch (memoryError) {
        return {
          success: false,
          content: '',
          error: `Failed to store content in memory: ${memoryError}`
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to read webpage: ${error}`
      };
    }
  }

  /**
   * Split content into manageable chunks for LLM processing
   */
  private splitContent(content: string, targetSize: number): string[] {
    const chunks: string[] = [];
    
    // Try to split by HTML elements first
    const elementPattern = /<\/(?:div|section|article|main|header|footer|nav|aside|p|h[1-6]|li|td|th)>/gi;
    const elements = content.split(elementPattern);
    
    let currentChunk = '';
    
    for (const element of elements) {
      if (element.trim().length === 0) {continue;}
      
      if (currentChunk.length + element.length <= targetSize) {
        currentChunk += element;
      } else {
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
        
        if (element.length > targetSize) {
          // If single element is too large, split by sentences
          const sentences = this.splitByParagraphs(element, targetSize);
          chunks.push(...sentences);
          currentChunk = '';
        } else {
          currentChunk = element;
        }
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Split text by paragraphs when HTML splitting isn't sufficient
   */
  private splitByParagraphs(text: string, targetSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= targetSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
        
        if (paragraph.length > targetSize) {
          // Split long paragraphs by sentences
          const sentences = paragraph.split(/[.!?]+\s+/);
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length <= targetSize) {
              sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
            } else {
              if (sentenceChunk.trim().length > 0) {
                chunks.push(sentenceChunk.trim());
              }
              sentenceChunk = sentence;
            }
          }
          
          if (sentenceChunk.trim().length > 0) {
            chunks.push(sentenceChunk.trim());
          }
          
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}
