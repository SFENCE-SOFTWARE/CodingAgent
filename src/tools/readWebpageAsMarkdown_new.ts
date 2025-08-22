// src/tools/readWebpageAsMarkdown.ts

import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from '../types';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { MemoryService, MemoryType } from '../memoryService';

export class ReadWebpageAsMarkdownTool implements BaseTool {
  private memoryService?: MemoryService;

  constructor(memoryService?: MemoryService) {
    this.memoryService = memoryService;
  }

  getToolInfo(): ToolInfo {
    return {
      name: 'read_webpage_as_markdown',
      displayName: 'Read Webpage as Markdown',
      description: 'Read webpage content, convert to Markdown, and store in memory with metadata',
      category: 'web'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'read_webpage_as_markdown',
        description: 'Read webpage content, convert to Markdown, and store in memory with metadata',
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
              description: 'Whether to split large content into multiple memory entries for better LLM processing. Default: true for Markdown',
              default: true
            },
            split_size: {
              type: 'integer',
              description: 'Target size (in characters) for content splits when split_content is true. Default: 6000 (optimized for Markdown)',
              default: 6000,
              minimum: 1000,
              maximum: 15000
            },
            category: {
              type: 'string',
              description: 'Category for memory storage (e.g., "documentation", "research", "reference")'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for memory storage (e.g., ["markdown", "documentation", "api"])'
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
        split_content = true,
        split_size = 6000,
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

      let htmlContent = await response.text();
      
      // Extract title from HTML for better metadata
      const titleMatch = htmlContent.match(/<title[^>]*>([^<]*)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
      
      // Convert HTML to Markdown
      let markdownContent = NodeHtmlMarkdown.translate(htmlContent);
      
      // Clean up the markdown content
      markdownContent = markdownContent
        .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
        .replace(/^\s+|\s+$/gm, '') // Trim whitespace from lines
        .trim();

      try {
        const baseMetadata = {
          dataType: 'text' as const,
          category: category || 'web_content',
          tags: [...(tags || []), 'markdown', 'webpage'],
          priority: priority as any,
          description: `Markdown content from: ${pageTitle}`,
          context: `Webpage content fetched from ${url}`,
          source: 'web_fetch',
          format: 'markdown',
          projectPath: url,
          relatedKeys: [] as string[]
        };

        if (!split_content || markdownContent.length <= split_size) {
          // Store as single entry
          let finalContent = markdownContent;
          if (max_length && finalContent.length > max_length) {
            finalContent = finalContent.substring(0, max_length) + '\n\n... (truncated)';
          }

          await this.memoryService.store(memory_key, finalContent, memory_type as MemoryType, {
            ...baseMetadata,
            description: `Complete Markdown content from: ${pageTitle}`
          });

          return {
            success: true,
            content: `Webpage content successfully converted to Markdown and stored in memory as '${memory_key}'. Content length: ${finalContent.length} characters. Page title: "${pageTitle}". Use memory tools to retrieve content when needed.`
          };
        } else {
          // Split content into logical sections
          const sections = this.splitMarkdownIntoSections(markdownContent, split_size);
          const storedKeys: string[] = [];

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const chunkKey = `${memory_key}_part_${i + 1}`;
            const sectionTitle = this.extractSectionTitle(section.content);
            
            await this.memoryService.store(chunkKey, section.content, memory_type as MemoryType, {
              ...baseMetadata,
              description: `${sectionTitle} - Part ${i + 1}/${sections.length} from: ${pageTitle}`,
              context: `Section "${sectionTitle}" from ${url}`,
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
            content: `Webpage content successfully converted to Markdown and split into ${sections.length} sections, stored in memory as '${storedKeys.join("', '")}'. Total content length: ${markdownContent.length} characters. Page title: "${pageTitle}". Use memory tools to retrieve content when needed.`
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
        error: `Failed to read webpage and convert to markdown: ${error}`
      };
    }
  }

  /**
   * Split Markdown content into logical sections for optimal LLM processing
   */
  private splitMarkdownIntoSections(content: string, targetSize: number): Array<{content: string, title: string}> {
    const sections: Array<{content: string, title: string}> = [];
    
    // Split by headers (# ## ### etc.)
    const headerPattern = /^(#{1,6})\s+(.+)$/gm;
    const parts = content.split(headerPattern);
    
    let currentSection = '';
    let currentTitle = 'Introduction';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.match(/^#{1,6}$/)) {
        // This is a header level indicator
        const headerLevel = part;
        const headerText = parts[i + 1] || 'Untitled Section';
        
        // Save previous section if it exists and is substantial
        if (currentSection.trim().length > 100) {
          if (currentSection.length > targetSize) {
            // Split large sections further
            const subSections = this.splitLargeSection(currentSection, targetSize, currentTitle);
            sections.push(...subSections);
          } else {
            sections.push({
              content: currentSection.trim(),
              title: currentTitle
            });
          }
        }
        
        // Start new section
        currentTitle = headerText;
        currentSection = `${headerLevel} ${headerText}\n\n`;
        i++; // Skip the header text in next iteration
        
      } else if (!part.match(/^#{1,6}$/)) {
        // This is content
        currentSection += part;
      }
    }
    
    // Add the last section
    if (currentSection.trim().length > 0) {
      if (currentSection.length > targetSize) {
        const subSections = this.splitLargeSection(currentSection, targetSize, currentTitle);
        sections.push(...subSections);
      } else {
        sections.push({
          content: currentSection.trim(),
          title: currentTitle
        });
      }
    }
    
    // If no sections were created (no headers), split by paragraphs
    if (sections.length === 0) {
      const paragraphSections = this.splitByParagraphs(content, targetSize);
      for (let i = 0; i < paragraphSections.length; i++) {
        sections.push({
          content: paragraphSections[i],
          title: `Section ${i + 1}`
        });
      }
    }
    
    return sections.filter(section => section.content.length > 0);
  }

  /**
   * Split large sections that exceed target size
   */
  private splitLargeSection(content: string, targetSize: number, sectionTitle: string): Array<{content: string, title: string}> {
    const subSections: Array<{content: string, title: string}> = [];
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentChunk = '';
    let partNumber = 1;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= targetSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk.trim().length > 0) {
          subSections.push({
            content: currentChunk.trim(),
            title: `${sectionTitle} (Part ${partNumber})`
          });
          partNumber++;
        }
        currentChunk = paragraph;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      subSections.push({
        content: currentChunk.trim(),
        title: `${sectionTitle} (Part ${partNumber})`
      });
    }
    
    return subSections;
  }

  /**
   * Split content by paragraphs when no logical structure is found
   */
  private splitByParagraphs(content: string, targetSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= targetSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
        
        if (paragraph.length > targetSize) {
          // Split very long paragraphs by sentences
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

  /**
   * Extract a meaningful title from section content
   */
  private extractSectionTitle(content: string): string {
    // Look for header
    const headerMatch = content.match(/^(#{1,6})\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[2].trim();
    }
    
    // Look for first bold text
    const boldMatch = content.match(/\*\*([^*]+)\*\*/);
    if (boldMatch) {
      return boldMatch[1].trim();
    }
    
    // Use first few words
    const firstLine = content.split('\n')[0];
    const words = firstLine.trim().split(/\s+/).slice(0, 5);
    return words.join(' ') || 'Content Section';
  }
}
