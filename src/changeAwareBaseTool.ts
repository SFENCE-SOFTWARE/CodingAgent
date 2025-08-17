// src/changeAwareBaseTool.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from './types';
import { ChangeTrackingService, FileOperation } from './changeTrackingService';

export abstract class ChangeAwareBaseTool implements BaseTool {
  constructor(protected changeTracker: ChangeTrackingService) {}

  // Abstract methods that must be implemented by subclasses
  abstract getToolInfo(): ToolInfo;
  abstract getToolDefinition(): ToolDefinition;

  // Protected method for capturing file changes
  protected async captureFileChange(
    filePath: string,
    operation: () => Promise<ToolResult>,
    workspaceRoot: string
  ): Promise<ToolResult & { changeId?: string }> {
    const absolutePath = this.resolvePath(filePath, workspaceRoot);
    
    // Capture before state
    const beforeContent = await this.readFileIfExists(absolutePath);
    
    // Execute the operation
    const result = await operation();
    
    // If operation was successful, track the change
    if (result.success) {
      const afterContent = await this.readFileIfExists(absolutePath);
      
      // Only track if there was actually a change
      if (beforeContent !== afterContent) {
        try {
          const changeId = await this.changeTracker.trackFileOperation(absolutePath, {
            type: this.determineChangeType(beforeContent, afterContent),
            beforeContent,
            afterContent,
            toolName: this.getToolInfo().name
          });
          
          return {
            ...result,
            changeId,
            content: result.content + ` [Change ID: ${changeId}]`
          };
        } catch (error) {
          console.warn('Failed to track change:', error);
        }
      }
    }
    
    return result;
  }

  // Helper method to read file content if it exists
  protected async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      if (fs.existsSync(filePath)) {
        return await fs.promises.readFile(filePath, 'utf8');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Determine the type of change based on before/after content
  protected determineChangeType(
    beforeContent: string | null, 
    afterContent: string | null
  ): 'create' | 'modify' | 'delete' {
    if (beforeContent === null && afterContent !== null) {
      return 'create';
    } else if (beforeContent !== null && afterContent === null) {
      return 'delete';
    } else {
      return 'modify';
    }
  }

  // Resolve relative paths to absolute paths
  protected resolvePath(inputPath: string, workspaceRoot: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    if (inputPath === '.') {
      return workspaceRoot;
    }
    return path.join(workspaceRoot, inputPath);
  }

  // Abstract execute method - subclasses should implement this
  abstract execute(args: any, workspaceRoot: string): Promise<ToolResult>;
}
