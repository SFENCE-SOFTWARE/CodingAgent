// src/tools.ts

import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from './types';
import { ChangeTrackingService } from './changeTrackingService';
import { MemoryService } from './memoryService';

// Import all tool classes
import { ListFilesTool } from './tools/listFiles';
import { ReadFileTool } from './tools/readFile';
import { WriteFileTool } from './tools/writeFile';
import { GetFileSizeTool } from './tools/getFileSize';
import { ExecuteTerminalTool } from './tools/executeTerminal';
import { CreateFolderTool } from './tools/createFolder';
import { PatchFileTool } from './tools/patchFile';
import { ModifyLinesTool } from './tools/modifyLines';
import { RenameFileTool } from './tools/renameFile';
import { SearchInProjectTool } from './tools/searchInProject';
import { SearchInPathTool } from './tools/searchInPath';
import { ReadWebpageAsHTMLTool } from './tools/readWebpageAsHTML';
import { ReadWebpageAsMarkdownTool } from './tools/readWebpageAsMarkdown';
import { ReadPdfTool } from './tools/readPdf';
import { MemoryStoreTool } from './tools/memoryStore';
import { MemoryRetrieveByLinesTool } from './tools/memoryRetrieveByLines';
import { MemoryRetrieveDataTool } from './tools/memoryRetrieveData';
import { MemoryDeleteTool } from './tools/memoryDelete';
import { MemorySearchTool } from './tools/memorySearch';
import { MemoryListTool } from './tools/memoryList';
import { MemoryExportTool } from './tools/memoryExport';
import { AskUserTool } from './tools/askUser';
import { CallUnderModeTool } from './tools/callUnderMode';

// Planning tools
import { PlanNewTool } from './tools/planNew';
import { PlanOpenTool } from './tools/planOpen';
import { PlanListTool } from './tools/planList';
import { PlanAddPointsTool } from './tools/planAddPoints';
import { PlanChangePointTool } from './tools/planChangePoint';
import { PlanShowTool } from './tools/planShow';
import { PlanPointCareOnTool } from './tools/planPointCareOn';
import { PlanShowPointTool } from './tools/planShowPoint';
import { PlanPointCommentTool } from './tools/planPointComment';
import { PlanPointImplementedTool } from './tools/planPointImplemented';
import { PlanPointReviewedTool } from './tools/planPointReviewed';
import { PlanPointTestedTool } from './tools/planPointTested';
import { PlanPointNeedReworkTool } from './tools/planPointNeedRework';
import { PlanReviewedTool } from './tools/planReviewed';
import { PlanNeedWorksTool } from './tools/planNeedWorks';
import { PlanAcceptedTool } from './tools/planAccepted';
import { PlanStateTool } from './tools/planState';
import { PlanDoneTool } from './tools/planDone';
import { PlanDeleteTool } from './tools/planDelete';
import { PlanPointRemoveTool } from './tools/planPointRemove';

export class ToolsService {
  private workspaceRoot: string;
  private tools: Map<string, BaseTool> = new Map();
  private changeTrackingService: ChangeTrackingService;
  private memoryService: MemoryService;
  private changeNotificationCallback?: (changeId: string) => void;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.changeTrackingService = new ChangeTrackingService(this.workspaceRoot);
    this.memoryService = new MemoryService(this.workspaceRoot);
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

  // Set callback for terminal command approval
  public setTerminalApprovalCallback(callback: (commandId: string, command: string, cwd: string) => Promise<boolean>): void {
    ExecuteTerminalTool.setCommandApprovalCallback(callback);
  }

  // Set callback for mode switching
  public setModeChangeCallback(callback: (targetMode: string, task: string, originalMode: string) => Promise<string>): void {
    CallUnderModeTool.setModeChangeCallback(callback);
  }

  // Handle terminal command approval/rejection
  public approveTerminalCommand(commandId: string): void {
    ExecuteTerminalTool.approveCommand(commandId);
  }

  public rejectTerminalCommand(commandId: string): void {
    ExecuteTerminalTool.rejectCommand(commandId);
  }

  // Get pending terminal commands
  public getPendingTerminalCommands(): Array<{id: string, command: string, cwd: string}> {
    return ExecuteTerminalTool.getPendingCommands();
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
      new ModifyLinesTool(this.changeTrackingService),
      new RenameFileTool(),
      new SearchInProjectTool(),
      new SearchInPathTool(),
      new ReadWebpageAsHTMLTool(this.memoryService),
      new ReadWebpageAsMarkdownTool(this.memoryService),
      new ReadPdfTool(),
      new MemoryStoreTool(this.memoryService),
      new MemoryRetrieveByLinesTool(this.memoryService),
      new MemoryRetrieveDataTool(this.memoryService),
      new MemoryDeleteTool(this.memoryService),
      new MemorySearchTool(this.memoryService),
      new MemoryListTool(this.memoryService),
      new MemoryExportTool(this.memoryService),
      new AskUserTool(),
      new CallUnderModeTool(),

      // Planning tools
      new PlanNewTool(),
      new PlanOpenTool(),
      new PlanListTool(),
      new PlanAddPointsTool(),
      new PlanChangePointTool(),
      new PlanShowTool(),
      new PlanPointCareOnTool(),
      new PlanShowPointTool(),
      new PlanPointCommentTool(),
      new PlanPointImplementedTool(),
      new PlanPointReviewedTool(),
      new PlanPointTestedTool(),
      new PlanPointNeedReworkTool(),
      new PlanReviewedTool(),
      new PlanNeedWorksTool(),
      new PlanAcceptedTool(),
      new PlanStateTool(),
      new PlanDoneTool(),
      new PlanDeleteTool(),
      new PlanPointRemoveTool()
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
