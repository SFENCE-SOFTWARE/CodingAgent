// src/tools.ts

import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from './types';
import { ChangeTrackingService } from './changeTrackingService';

// Import all tool classes
import { ListFilesTool } from './tools/listFiles';
import { ReadFileTool } from './tools/readFile';
import { WriteFileTool } from './tools/writeFile';
import { GetFileSizeTool } from './tools/getFileSize';
import { ExecuteTerminalTool } from './tools/executeTerminal';
import { CreateFolderTool } from './tools/createFolder';
import { PatchFileTool } from './tools/patchFile';
import { InsertLinesTool } from './tools/insertLines';
import { DeleteLinesTool } from './tools/deleteLines';
import { ReplaceLinesTool } from './tools/replaceLines';
import { RenameFileTool } from './tools/renameFile';
import { SearchPatternTool } from './tools/searchPattern';
import { SearchInPathTool } from './tools/searchInPath';
import { ReadWebpageTool } from './tools/readWebpage';
import { ReadPdfTool } from './tools/readPdf';

export class ToolsService {
  private workspaceRoot: string;
  private tools: Map<string, BaseTool> = new Map();
  private changeTrackingService: ChangeTrackingService;
  private changeNotificationCallback?: (changeId: string) => void;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.changeTrackingService = new ChangeTrackingService(this.workspaceRoot);
    this.initializeTools();
  }

  // Set callback for change notifications to UI
  public setChangeNotificationCallback(callback: (changeId: string) => void): void {
    this.changeNotificationCallback = callback;
    
    // Update all change-aware tools with the callback
    this.tools.forEach(tool => {
      if ('setChangeNotificationCallback' in tool) {
        (tool as any).setChangeNotificationCallback(callback);
      }
    });
  }

  private initializeTools(): void {
    // Register all available tools
    const toolInstances: BaseTool[] = [
      new ListFilesTool(),
      new ReadFileTool(),
      new WriteFileTool(this.changeTrackingService),
      new GetFileSizeTool(),
      new ExecuteTerminalTool(),
      new CreateFolderTool(),
      new PatchFileTool(this.changeTrackingService),
      new InsertLinesTool(this.changeTrackingService),
      new DeleteLinesTool(this.changeTrackingService),
      new ReplaceLinesTool(this.changeTrackingService),
      new RenameFileTool(),
      new SearchPatternTool(),
      new SearchInPathTool(),
      new ReadWebpageTool(),
      new ReadPdfTool()
    ];

    // Add each tool to the registry
    for (const tool of toolInstances) {
      const info = tool.getToolInfo();
      this.tools.set(info.name, tool);
    }
  }

  /**
   * Get all available tools with their information
   */
  getAllToolsInfo(): ToolInfo[] {
    return Array.from(this.tools.values()).map(tool => tool.getToolInfo());
  }

  /**
   * Get tool definitions for specified tools (for LLM)
   */
  getToolDefinitions(toolNames?: string[]): Record<string, ToolDefinition> {
    const definitions: Record<string, ToolDefinition> = {};
    
    if (toolNames) {
      // Get definitions for specified tools only
      for (const toolName of toolNames) {
        const tool = this.tools.get(toolName);
        if (tool) {
          definitions[toolName] = tool.getToolDefinition();
        }
      }
    } else {
      // Get all tool definitions
      for (const [name, tool] of Array.from(this.tools)) {
        definitions[name] = tool.getToolDefinition();
      }
    }
    
    return definitions;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        success: false,
        content: '',
        error: `Unknown tool: ${name}`
      };
    }

    try {
      return await tool.execute(args, this.workspaceRoot);
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get the change tracking service
   */
  getChangeTrackingService(): ChangeTrackingService {
    return this.changeTrackingService;
  }

  /**
   * Get pending changes for UI
   */
  async getPendingChanges() {
    return await this.changeTrackingService.getAllPendingChanges();
  }

  /**
   * Accept a change
   */
  async acceptChange(changeId: string): Promise<void> {
    await this.changeTrackingService.acceptChange(changeId);
  }

  /**
   * Reject a change
   */
  async rejectChange(changeId: string): Promise<void> {
    await this.changeTrackingService.rejectChange(changeId);
  }

  /**
   * Get HTML diff for a change
   */
  async getChangeHtmlDiff(changeId: string): Promise<string | null> {
    const allChanges = await this.changeTrackingService.getAllChanges();
    const change = allChanges.find(c => c.id === changeId);
    if (change) {
      return await this.changeTrackingService.generateHtmlDiff(change);
    }
    return null;
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tools grouped by category
   */
  getToolsByCategory(): Record<string, ToolInfo[]> {
    const categorized: Record<string, ToolInfo[]> = {};
    
    for (const tool of Array.from(this.tools.values())) {
      const info = tool.getToolInfo();
      if (!categorized[info.category]) {
        categorized[info.category] = [];
      }
      categorized[info.category].push(info);
    }
    
    return categorized;
  }
}
