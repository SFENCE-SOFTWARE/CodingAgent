// src/tools.ts

import * as vscode from 'vscode';
import { BaseTool, ToolDefinition, ToolResult, ToolInfo } from './types';

// Import all tool classes
import { ListFilesTool } from './tools/listFiles';
import { ReadFileTool } from './tools/readFile';
import { WriteFileTool } from './tools/writeFile';
import { GetFileSizeTool } from './tools/getFileSize';
import { ExecuteTerminalTool } from './tools/executeTerminal';
import { CreateFolderTool } from './tools/createFolder';
import { PatchFileTool } from './tools/patchFile';
import { RenameFileTool } from './tools/renameFile';
import { SearchPatternTool } from './tools/searchPattern';
import { SearchInPathTool } from './tools/searchInPath';
import { ReadWebpageTool } from './tools/readWebpage';
import { ReadPdfTool } from './tools/readPdf';

export class ToolsService {
  private workspaceRoot: string;
  private tools: Map<string, BaseTool> = new Map();

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.initializeTools();
  }

  private initializeTools(): void {
    // Register all available tools
    const toolInstances: BaseTool[] = [
      new ListFilesTool(),
      new ReadFileTool(),
      new WriteFileTool(),
      new GetFileSizeTool(),
      new ExecuteTerminalTool(),
      new CreateFolderTool(),
      new PatchFileTool(),
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
      for (const [name, tool] of this.tools) {
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
    
    for (const tool of this.tools.values()) {
      const info = tool.getToolInfo();
      if (!categorized[info.category]) {
        categorized[info.category] = [];
      }
      categorized[info.category].push(info);
    }
    
    return categorized;
  }
}
