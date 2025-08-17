// src/changeAwareBaseTool.ts

import * as fs from 'fs';
import * as path from 'path';
import { BaseTool, ToolResult } from './types';
import { ChangeTrackingService, FileOperation } from './changeTrackingService';

export abstract class ChangeAwareBaseTool implements BaseTool {
  protected changeTracker: ChangeTrackingService;
  protected changeNotificationCallback?: (changeId: string) => void;

  constructor(changeTracker: ChangeTrackingService) {
    this.changeTracker = changeTracker;
  }

  // Set callback for UI notifications
  public setChangeNotificationCallback(callback: (changeId: string) => void): void {
    this.changeNotificationCallback = callback;
  }

  abstract getToolInfo(): any;
  abstract getToolDefinition(): any;

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      // Get before content if file exists
      const beforeContent = await this.getBeforeContent(args, workspaceRoot);
      
      // Execute the tool operation
      const result = await this.executeOperation(args, workspaceRoot);
      
      if (result.success) {
        // Get after content
        const afterContent = await this.getAfterContent(args, workspaceRoot);
        
        // Track the change
        const operation: FileOperation = {
          type: beforeContent === null ? 'create' : this.getOperationType(args),
          beforeContent,
          afterContent,
          toolName: this.getToolInfo().name
        };
        
        const changeId = await this.changeTracker.trackFileOperation(
          this.getFilePath(args, workspaceRoot), 
          operation
        );
        
        // Notify UI about the change
        if (this.changeNotificationCallback) {
          this.changeNotificationCallback(changeId);
        }
        
        // Update result to include change ID
        result.content += ` [Change ID: ${changeId}]`;
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        content: ''
      };
    }
  }

  protected abstract executeOperation(args: any, workspaceRoot: string): Promise<ToolResult>;
  protected abstract getFilePath(args: any, workspaceRoot: string): string;
  protected abstract getOperationType(args: any): 'create' | 'modify' | 'delete' | 'rename';
  
  protected async getBeforeContent(args: any, workspaceRoot: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(args, workspaceRoot);
      const fs = require('fs').promises;
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null; // File doesn't exist
    }
  }
  
  protected async getAfterContent(args: any, workspaceRoot: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(args, workspaceRoot);
      const fs = require('fs').promises;
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null; // File doesn't exist or couldn't be read
    }
  }
}
