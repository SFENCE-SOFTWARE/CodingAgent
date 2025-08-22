// src/memoryService.ts

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface MemoryEntry {
  key: string;
  value: any;
  type: MemoryType;
  timestamp: number;
  metadata?: MemoryMetadata;
}

export interface MemoryMetadata {
  // Data type classification for better understanding
  dataType?: 'text' | 'json' | 'code' | 'config' | 'url' | 'file_path' | 'number' | 'boolean' | 'list' | 'object' | 'api_key' | 'credentials' | 'other';
  
  // Categorization for organization
  category?: string; // e.g., 'user_preferences', 'project_config', 'api_endpoints', 'code_snippets', 'documentation'
  
  // Tags for flexible searching
  tags?: string[]; // e.g., ['frontend', 'api', 'important', 'temporary', 'deprecated']
  
  // Importance/priority level
  priority?: 'low' | 'medium' | 'high' | 'critical';
  
  // Expiration handling
  expiresAt?: number; // Unix timestamp
  expiresAfterDays?: number; // Auto-calculate expiration
  
  // Context and relationships
  relatedKeys?: string[]; // Related memory entries
  context?: string; // Where this data comes from or how it's used
  source?: string; // e.g., 'user_input', 'api_response', 'file_analysis', 'conversation'
  
  // Access patterns
  accessCount?: number; // How many times accessed
  lastAccessed?: number; // Last access timestamp
  
  // Content description
  description?: string; // Human-readable description
  format?: string; // Data format details, e.g., 'typescript_interface', 'json_schema', 'markdown'
  
  // Size and complexity hints
  sizeBytes?: number; // Approximate size
  complexity?: 'simple' | 'medium' | 'complex'; // Content complexity
  
  // Project/workspace context
  projectPath?: string; // Relative to workspace root
  fileExtension?: string; // If related to specific file type
  
  // Versioning
  version?: string; // Data version
  lastModified?: number; // Last modification timestamp
  
  // Security and sensitivity
  sensitive?: boolean; // Contains sensitive data
  encrypted?: boolean; // Whether value is encrypted
  
  // Additional flexible metadata
  [key: string]: any;
}

export enum MemoryType {
  TEMPORARY = 'temporary',
  PROJECT = 'project'
}

export interface MemorySearchOptions {
  keyPattern?: string;
  valuePattern?: string;
  metadataPattern?: string;
  type?: MemoryType;
  caseSensitive?: boolean;
  isRegex?: boolean;
  maxResults?: number;
  
  // Metadata-based filters
  dataType?: MemoryMetadata['dataType'];
  category?: string;
  tags?: string[];
  priority?: MemoryMetadata['priority'];
  
  // Date range filters
  fromDate?: number;
  toDate?: number;
  
  // Sorting options
  sortBy?: 'timestamp' | 'lastModified' | 'lastAccessed' | 'accessCount' | 'priority' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export class MemoryService {
  private temporaryMemory: Map<string, MemoryEntry> = new Map();
  private workspaceRoot: string;
  private projectMemoryDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.projectMemoryDir = path.join(workspaceRoot, '.codingagent', 'memory');
    this.ensureProjectMemoryDir();
  }

  /**
   * Check if project memory is enabled in settings
   */
  isProjectMemoryEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('codingagent');
    return config.get('memory.enableProjectMemory', false);
  }

  /**
   * Get available memory types based on configuration
   */
  getAvailableMemoryTypes(): MemoryType[] {
    const types = [MemoryType.TEMPORARY];
    if (this.isProjectMemoryEnabled()) {
      types.push(MemoryType.PROJECT);
    }
    return types;
  }

  /**
   * Store a value in memory
   */
  public async store(key: string, value: any, type: MemoryType = MemoryType.TEMPORARY, metadata?: MemoryMetadata): Promise<void> {
    // Check for duplicate keys across all memory types
    const existingEntry = await this.retrieve(key);
    if (existingEntry) {
      throw new Error(`Memory key '${key}' already exists in ${existingEntry.type} memory`);
    }

    // Auto-detect data type if not provided
    const autoDetectedType = this.detectDataType(value);
    
    // Merge auto-detected type with provided metadata
    const enrichedMetadata: MemoryMetadata = {
      dataType: autoDetectedType,
      timestamp: Date.now(),
      lastModified: Date.now(),
      accessCount: 0,
      source: 'user_input', // Default source
      ...metadata, // User-provided metadata takes precedence
    };

    // Handle expiration calculation
    if (enrichedMetadata.expiresAfterDays && !enrichedMetadata.expiresAt) {
      enrichedMetadata.expiresAt = Date.now() + (enrichedMetadata.expiresAfterDays * 24 * 60 * 60 * 1000);
    }

    // Calculate approximate size
    if (!enrichedMetadata.sizeBytes) {
      enrichedMetadata.sizeBytes = this.calculateSize(value);
    }

    // Auto-detect complexity
    if (!enrichedMetadata.complexity) {
      enrichedMetadata.complexity = this.detectComplexity(value);
    }

    const entry: MemoryEntry = {
      key,
      value,
      type,
      timestamp: Date.now(),
      metadata: enrichedMetadata
    };

    if (type === MemoryType.TEMPORARY) {
      this.temporaryMemory.set(key, entry);
    } else {
      await this.storeProjectMemory(key, entry);
    }
  }

  /**
   * Retrieve a value from memory
   */
  async retrieve(key: string, type?: MemoryType): Promise<MemoryEntry | null> {
    // If type is specified, search only in that type
    if (type) {
      if (!this.isMemoryTypeAvailable(type)) {
        return null;
      }
      const entry = await this.retrieveFromType(key, type);
      if (entry) {
        await this.updateAccessMetadata(entry, type);
      }
      return entry;
    }

    // Search across all available memory types
    for (const memoryType of this.getAvailableMemoryTypes()) {
      const entry = await this.retrieveFromType(key, memoryType);
      if (entry) {
        await this.updateAccessMetadata(entry, memoryType);
        return entry;
      }
    }

    return null;
  }

  /**
   * Delete a value from memory
   */
  async delete(key: string, type?: MemoryType): Promise<boolean> {
    let deleted = false;

    // If type is specified, delete only from that type
    if (type) {
      if (!this.isMemoryTypeAvailable(type)) {
        return false;
      }
      return await this.deleteFromType(key, type);
    }

    // Delete from all available memory types
    for (const memoryType of this.getAvailableMemoryTypes()) {
      const result = await this.deleteFromType(key, memoryType);
      if (result) {
        deleted = true;
      }
    }

    return deleted;
  }

  /**
   * Search memory entries
   */
  async search(options: MemorySearchOptions): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    const maxResults = options.maxResults || 50;

    // Determine which memory types to search
    const typesToSearch = options.type 
      ? [options.type].filter(t => this.isMemoryTypeAvailable(t))
      : this.getAvailableMemoryTypes();

    for (const memoryType of typesToSearch) {
      const typeResults = await this.searchInType(memoryType, options);
      results.push(...typeResults);

      if (results.length >= maxResults) {
        break;
      }
    }

    // Sort results by relevance and recency
    const sortedResults = this.sortSearchResults(results, options);

    return sortedResults.slice(0, maxResults);
  }

  /**
   * List all keys in memory
   */
  async listKeys(type?: MemoryType): Promise<string[]> {
    const keys: string[] = [];

    const typesToList = type 
      ? [type].filter(t => this.isMemoryTypeAvailable(t))
      : this.getAvailableMemoryTypes();

    for (const memoryType of typesToList) {
      const typeKeys = await this.getKeysFromType(memoryType);
      keys.push(...typeKeys);
    }

    return [...new Set(keys)]; // Remove duplicates
  }

  /**
   * Clear all memory of specified type
   */
  async clear(type: MemoryType): Promise<void> {
    if (!this.isMemoryTypeAvailable(type)) {
      throw new Error(`Memory type '${type}' is not available or not enabled`);
    }

    if (type === MemoryType.TEMPORARY) {
      this.temporaryMemory.clear();
    } else if (type === MemoryType.PROJECT) {
      await this.clearProjectMemory();
    }
  }

  // Private helper methods

  private isMemoryTypeAvailable(type: MemoryType): boolean {
    return this.getAvailableMemoryTypes().includes(type);
  }

  private async keyExists(key: string): Promise<boolean> {
    for (const memoryType of this.getAvailableMemoryTypes()) {
      const entry = await this.retrieveFromType(key, memoryType);
      if (entry) {
        return true;
      }
    }
    return false;
  }

  private async retrieveFromType(key: string, type: MemoryType): Promise<MemoryEntry | null> {
    if (type === MemoryType.TEMPORARY) {
      return this.temporaryMemory.get(key) || null;
    } else if (type === MemoryType.PROJECT) {
      return await this.retrieveProjectMemory(key);
    }
    return null;
  }

  private async deleteFromType(key: string, type: MemoryType): Promise<boolean> {
    if (type === MemoryType.TEMPORARY) {
      return this.temporaryMemory.delete(key);
    } else if (type === MemoryType.PROJECT) {
      return await this.deleteProjectMemory(key);
    }
    return false;
  }

  private async searchInType(type: MemoryType, options: MemorySearchOptions): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];

    if (type === MemoryType.TEMPORARY) {
      entries.push(...Array.from(this.temporaryMemory.values()));
    } else if (type === MemoryType.PROJECT) {
      entries.push(...await this.getAllProjectMemoryEntries());
    }

    return this.filterEntries(entries, options);
  }

  private async getKeysFromType(type: MemoryType): Promise<string[]> {
    if (type === MemoryType.TEMPORARY) {
      return Array.from(this.temporaryMemory.keys());
    } else if (type === MemoryType.PROJECT) {
      return await this.getProjectMemoryKeys();
    }
    return [];
  }

  private filterEntries(entries: MemoryEntry[], options: MemorySearchOptions): MemoryEntry[] {
    let filtered = entries;

    // Filter by expiration
    const now = Date.now();
    filtered = filtered.filter(entry => {
      if (entry.metadata?.expiresAt) {
        return entry.metadata.expiresAt > now;
      }
      return true;
    });

    // Filter by key pattern
    if (options.keyPattern) {
      const keyRegex = this.createRegex(options.keyPattern, options.caseSensitive, options.isRegex);
      filtered = filtered.filter(entry => keyRegex.test(entry.key));
    }

    // Filter by value pattern
    if (options.valuePattern) {
      const valueRegex = this.createRegex(options.valuePattern, options.caseSensitive, options.isRegex);
      filtered = filtered.filter(entry => {
        const valueStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
        return valueRegex.test(valueStr);
      });
    }

    // Filter by data type
    if (options.dataType) {
      filtered = filtered.filter(entry => entry.metadata?.dataType === options.dataType);
    }

    // Filter by category
    if (options.category) {
      filtered = filtered.filter(entry => entry.metadata?.category === options.category);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(entry => {
        if (!entry.metadata?.tags) return false;
        return options.tags!.some(tag => entry.metadata!.tags!.includes(tag));
      });
    }

    // Filter by priority
    if (options.priority) {
      filtered = filtered.filter(entry => entry.metadata?.priority === options.priority);
    }

    // Filter by date range
    if (options.fromDate) {
      filtered = filtered.filter(entry => entry.timestamp >= options.fromDate!);
    }
    if (options.toDate) {
      filtered = filtered.filter(entry => entry.timestamp <= options.toDate!);
    }

    // Filter by metadata patterns
    if (options.metadataPattern) {
      const metadataRegex = this.createRegex(options.metadataPattern, options.caseSensitive, options.isRegex);
      filtered = filtered.filter(entry => {
        if (!entry.metadata) return false;
        const metadataStr = JSON.stringify(entry.metadata);
        return metadataRegex.test(metadataStr);
      });
    }

    return filtered;
  }

  private createRegex(pattern: string, caseSensitive?: boolean, isRegex?: boolean): RegExp {
    const flags = caseSensitive ? 'g' : 'gi';
    if (isRegex) {
      return new RegExp(pattern, flags);
    } else {
      // Escape special regex characters for literal string search
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escapedPattern, flags);
    }
  }

  // Project memory file operations

  private ensureProjectMemoryDir(): void {
    if (!fs.existsSync(this.projectMemoryDir)) {
      fs.mkdirSync(this.projectMemoryDir, { recursive: true });
    }
  }

  private getProjectMemoryFilePath(key: string): string {
    // Use base64 encoding to handle special characters in keys
    const encodedKey = Buffer.from(key).toString('base64').replace(/[/+=]/g, '_');
    return path.join(this.projectMemoryDir, `${encodedKey}.json`);
  }

  private async storeProjectMemory(key: string, entry: MemoryEntry): Promise<void> {
    const filePath = this.getProjectMemoryFilePath(key);
    await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
  }

  private async retrieveProjectMemory(key: string): Promise<MemoryEntry | null> {
    const filePath = this.getProjectMemoryFilePath(key);
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content) as MemoryEntry;
    } catch (error) {
      return null;
    }
  }

  private async deleteProjectMemory(key: string): Promise<boolean> {
    const filePath = this.getProjectMemoryFilePath(key);
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getAllProjectMemoryEntries(): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];
    try {
      const files = await fs.promises.readdir(this.projectMemoryDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.projectMemoryDir, file);
          try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const entry = JSON.parse(content) as MemoryEntry;
            entries.push(entry);
          } catch (error) {
            // Skip corrupted files
            continue;
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or is not accessible
    }
    return entries;
  }

  private async getProjectMemoryKeys(): Promise<string[]> {
    const entries = await this.getAllProjectMemoryEntries();
    return entries.map(entry => entry.key);
  }

  private async clearProjectMemory(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.projectMemoryDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.projectMemoryDir, file);
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is not accessible
    }
  }

  /**
   * Auto-detect data type from value
   */
  private detectDataType(value: any): MemoryMetadata['dataType'] {
    if (value === null || value === undefined) {
      return 'other';
    }

    const type = typeof value;

    switch (type) {
      case 'string':
        // Check for specific string patterns
        if (value.startsWith('http://') || value.startsWith('https://')) {
          return 'url';
        }
        if (value.includes('/') && !value.includes(' ')) {
          return 'file_path';
        }
        if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
          try {
            JSON.parse(value);
            return 'json';
          } catch {
            // Not valid JSON, could be code
          }
        }
        if (value.includes('function') || value.includes('class') || value.includes('import') || value.includes('export')) {
          return 'code';
        }
        return 'text';

      case 'number':
        return 'number';

      case 'boolean':
        return 'boolean';

      case 'object':
        if (Array.isArray(value)) {
          return 'list';
        }
        return 'object';

      default:
        return 'other';
    }
  }

  /**
   * Calculate approximate size of value in bytes
   */
  private calculateSize(value: any): number {
    try {
      const serialized = JSON.stringify(value);
      return Buffer.byteLength(serialized, 'utf8');
    } catch {
      // Fallback for non-serializable values
      return String(value).length * 2; // Rough estimate for UTF-8
    }
  }

  /**
   * Detect complexity level of value
   */
  private detectComplexity(value: any): MemoryMetadata['complexity'] {
    if (value === null || value === undefined) {
      return 'simple';
    }

    const type = typeof value;

    if (type === 'string') {
      if (value.length < 100) {
        return 'simple';
      } else if (value.length < 1000) {
        return 'medium';
      } else {
        return 'complex';
      }
    }

    if (type === 'number' || type === 'boolean') {
      return 'simple';
    }

    if (Array.isArray(value)) {
      if (value.length < 10) {
        return 'simple';
      } else if (value.length < 100) {
        return 'medium';
      } else {
        return 'complex';
      }
    }

    if (type === 'object') {
      const keys = Object.keys(value);
      if (keys.length < 5) {
        return 'simple';
      } else if (keys.length < 20) {
        return 'medium';
      } else {
        return 'complex';
      }
    }

    return 'medium';
  }

  /**
   * Update access metadata for an entry
   */
  private async updateAccessMetadata(entry: MemoryEntry, type: MemoryType): Promise<void> {
    if (!entry.metadata) {
      entry.metadata = {};
    }

    entry.metadata.lastAccessed = Date.now();
    entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;

    // Update the stored entry
    if (type === MemoryType.TEMPORARY) {
      this.temporaryMemory.set(entry.key, entry);
    } else {
      await this.storeProjectMemory(entry.key, entry);
    }
  }

  /**
   * Sort search results based on options
   */
  private sortSearchResults(results: MemoryEntry[], options: MemorySearchOptions): MemoryEntry[] {
    const sortBy = options.sortBy || 'timestamp';
    const sortOrder = options.sortOrder || 'desc';

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'lastModified':
          const aLastMod = a.metadata?.lastModified || a.timestamp;
          const bLastMod = b.metadata?.lastModified || b.timestamp;
          comparison = aLastMod - bLastMod;
          break;
        case 'lastAccessed':
          const aLastAccess = a.metadata?.lastAccessed || 0;
          const bLastAccess = b.metadata?.lastAccessed || 0;
          comparison = aLastAccess - bLastAccess;
          break;
        case 'accessCount':
          const aAccessCount = a.metadata?.accessCount || 0;
          const bAccessCount = b.metadata?.accessCount || 0;
          comparison = aAccessCount - bAccessCount;
          break;
        case 'priority':
          const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
          const aPriority = priorityOrder[a.metadata?.priority || 'medium'];
          const bPriority = priorityOrder[b.metadata?.priority || 'medium'];
          comparison = aPriority - bPriority;
          break;
        case 'relevance':
          // For relevance, combine multiple factors
          const aScore = this.calculateRelevanceScore(a, options);
          const bScore = this.calculateRelevanceScore(b, options);
          comparison = aScore - bScore;
          break;
        default:
          comparison = a.timestamp - b.timestamp;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Calculate relevance score for search result ranking
   */
  private calculateRelevanceScore(entry: MemoryEntry, options: MemorySearchOptions): number {
    let score = 0;

    // Base score from access patterns
    score += (entry.metadata?.accessCount || 0) * 10;

    // Recent access bonus
    const daysSinceLastAccess = (Date.now() - (entry.metadata?.lastAccessed || 0)) / (24 * 60 * 60 * 1000);
    if (daysSinceLastAccess < 1) score += 50;
    else if (daysSinceLastAccess < 7) score += 25;
    else if (daysSinceLastAccess < 30) score += 10;

    // Priority bonus
    const priorityBonus = { 'critical': 100, 'high': 50, 'medium': 25, 'low': 10 };
    score += priorityBonus[entry.metadata?.priority || 'medium'];

    // Pattern match relevance
    if (options.keyPattern && entry.key.includes(options.keyPattern)) {
      score += 30;
    }
    if (options.valuePattern) {
      const valueStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
      if (valueStr.includes(options.valuePattern)) {
        score += 20;
      }
    }

    // Tag relevance
    if (options.tags && entry.metadata?.tags) {
      const matchingTags = options.tags.filter(tag => entry.metadata!.tags!.includes(tag));
      score += matchingTags.length * 15;
    }

    return score;
  }
}
