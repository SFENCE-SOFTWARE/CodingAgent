// src/tools/searchUtils.ts

import * as fs from 'fs';
import * as path from 'path';

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
  match?: string;
}

export interface SearchOptions {
  pattern: string;
  fileExtensions?: string[];
  caseSensitive?: boolean;
  isRegex?: boolean;
  maxResults?: number;
  includeBinaryFiles?: boolean;
}

export class SearchUtils {
  
  /**
   * Creates and validates a regex pattern from search options
   */
  static createSearchRegex(options: SearchOptions): RegExp {
    const { pattern, caseSensitive = false, isRegex = false } = options;
    const flags = caseSensitive ? 'g' : 'gi';
    
    if (isRegex) {
      return new RegExp(pattern, flags);
    } else {
      // Escape special regex characters for literal search
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escapedPattern, flags);
    }
  }

  /**
   * Searches for pattern in a single file
   */
  static async searchInFile(
    filePath: string,
    searchRegex: RegExp,
    workspaceRoot: string,
    includeMatchText: boolean = false
  ): Promise<SearchMatch[]> {
    const results: SearchMatch[] = [];
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const relativePath = path.relative(workspaceRoot, filePath) || path.basename(filePath);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        searchRegex.lastIndex = 0; // Reset regex state
        
        if (includeMatchText) {
          const match = searchRegex.exec(line);
          if (match) {
            results.push({
              file: relativePath,
              line: i + 1,
              content: line,
              match: match[0]
            });
          }
        } else {
          if (searchRegex.test(line)) {
            results.push({
              file: relativePath,
              line: i + 1,
              content: line
            });
          }
        }
      }
    } catch (error) {
      // Skip files that can't be read (binary files, permissions, etc.)
    }
    
    return results;
  }

  /**
   * Recursively searches in directory
   */
  static async searchInDirectory(
    dirPath: string,
    searchRegex: RegExp,
    options: SearchOptions,
    workspaceRoot: string,
    includeMatchText: boolean = false
  ): Promise<SearchMatch[]> {
    const results: SearchMatch[] = [];
    const { fileExtensions, maxResults = 100, includeBinaryFiles = false } = options;
    
    await this._searchInDirectoryRecursive(
      dirPath,
      searchRegex,
      fileExtensions,
      results,
      maxResults,
      workspaceRoot,
      includeMatchText,
      includeBinaryFiles
    );
    
    return results;
  }

  private static async _searchInDirectoryRecursive(
    dirPath: string,
    searchRegex: RegExp,
    fileExtensions: string[] | undefined,
    results: SearchMatch[],
    maxResults: number,
    workspaceRoot: string,
    includeMatchText: boolean,
    includeBinaryFiles: boolean
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common ignored directories
          if (this._shouldSkipDirectory(entry.name)) {
            continue;
          }
          await this._searchInDirectoryRecursive(
            fullPath,
            searchRegex,
            fileExtensions,
            results,
            maxResults,
            workspaceRoot,
            includeMatchText,
            includeBinaryFiles
          );
        } else if (entry.isFile()) {
          // Check file extension filter
          if (fileExtensions && fileExtensions.length > 0) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!fileExtensions.some(allowed => allowed.toLowerCase() === ext)) {
              continue;
            }
          }

          // Skip binary files unless explicitly included
          if (!includeBinaryFiles && this._isBinaryFile(entry.name)) {
            continue;
          }

          // Search in file
          const fileResults = await this.searchInFile(fullPath, searchRegex, workspaceRoot, includeMatchText);
          results.push(...fileResults.slice(0, maxResults - results.length));
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      return;
    }
  }

  /**
   * Determines if a directory should be skipped during search
   */
  private static _shouldSkipDirectory(dirName: string): boolean {
    const ignoredDirs = [
      '.git', '.svn', '.hg',           // Version control
      'node_modules',                   // Node.js dependencies
      '.vscode', '.idea',              // IDE files
      'dist', 'build', 'out',         // Build outputs
      'target',                        // Java/Maven build
      '.next', '.nuxt',                // Framework build dirs
      'coverage',                      // Test coverage
      '.nyc_output',                   // NYC coverage
      'tmp', 'temp'                    // Temporary directories
    ];
    
    return dirName.startsWith('.') || ignoredDirs.includes(dirName);
  }

  /**
   * Determines if a file is likely binary based on extension
   */
  private static _isBinaryFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    const binaryExtensions = [
      // Executables
      '.exe', '.dll', '.so', '.dylib', '.bin',
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.tiff', '.webp',
      // Documents
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      // Archives
      '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
      // Media
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
      // Fonts
      '.ttf', '.otf', '.woff', '.woff2'
    ];
    
    return binaryExtensions.includes(ext);
  }

  /**
   * Formats search results for display
   */
  static formatResults(
    results: SearchMatch[],
    pattern: string,
    searchPath: string,
    maxResults: number,
    includeMatchHighlight: boolean = false
  ): string {
    if (results.length === 0) {
      return `No matches found for pattern: "${pattern}"`;
    }

    let output = '';
    
    if (includeMatchHighlight) {
      output = `Found ${results.length} match(es) for pattern "${pattern}" in: ${searchPath}\n\n`;
      for (const result of results) {
        output += `${result.file}:${result.line}\n`;
        output += `  ${result.content.trim()}\n`;
        if (result.match) {
          output += `  Match: "${result.match}"\n`;
        }
        output += '\n';
      }
    } else {
      const resultLines = results.map(r => `${r.file}:${r.line}: ${r.content.trim()}`);
      output = resultLines.join('\n');
    }

    const summary = results.length >= maxResults ? 
      `\n\n(Showing first ${maxResults} results, more may exist)` : 
      `\n\n(${results.length} total matches)`;

    return output + summary;
  }

  /**
   * Resolves a path relative to workspace root
   */
  static resolvePath(inputPath: string, workspaceRoot: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    if (inputPath === '.') {
      return workspaceRoot;
    }
    return path.join(workspaceRoot, inputPath);
  }
}
