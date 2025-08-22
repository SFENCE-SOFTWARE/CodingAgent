// src/memoryService.ts

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface MemoryEntry {
  key: string;
  value: any;
  type: MemoryType;
  timestamp: number;
  metadata?: Record<string, any>;
}

export enum MemoryType {
  TEMPORARY = 'temporary',
  PROJECT = 'project'
}

export interface MemorySearchOptions {
  keyPattern?: string;
  valuePattern?: string;
  type?: MemoryType;
  caseSensitive?: boolean;
  isRegex?: boolean;
  maxResults?: number;
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
  async store(key: string, value: any, type: MemoryType, metadata?: Record<string, any>): Promise<void> {
    if (!this.isMemoryTypeAvailable(type)) {
      throw new Error(`Memory type '${type}' is not available or not enabled`);
    }

    // Check for key uniqueness across all available memory types
    if (await this.keyExists(key)) {
      throw new Error(`Key '${key}' already exists in memory`);
    }

    const entry: MemoryEntry = {
      key,
      value,
      type,
      timestamp: Date.now(),
      metadata
    };

    if (type === MemoryType.TEMPORARY) {
      this.temporaryMemory.set(key, entry);
    } else if (type === MemoryType.PROJECT) {
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
      return await this.retrieveFromType(key, type);
    }

    // Search across all available memory types
    for (const memoryType of this.getAvailableMemoryTypes()) {
      const entry = await this.retrieveFromType(key, memoryType);
      if (entry) {
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

    return results.slice(0, maxResults);
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
}
