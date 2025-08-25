// src/tools/callUnderMode.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import * as vscode from 'vscode';

export class CallUnderModeTool implements BaseTool {
  private static modeChangeCallback?: (targetMode: string, task: string, originalMode: string) => Promise<string>;
  
  static setModeChangeCallback(callback: (targetMode: string, task: string, originalMode: string) => Promise<string>) {
    this.modeChangeCallback = callback;
  }

  getToolInfo(): ToolInfo {
    return {
      name: 'call_under_mode',
      displayName: 'Call Under Mode',
      description: 'Delegate a task to another specialized mode and return with the response',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    // Get available modes dynamically and their descriptions
    const config = vscode.workspace.getConfiguration('codingagent');
    const modes = config.get<any>('modes', {});
    
    // Filter out modes that have call_under_mode in their allowedTools to prevent infinite recursion
    const availableModes = Object.entries(modes)
      .filter(([modeName, modeConfig]: [string, any]) => 
        !modeConfig.allowedTools?.includes('call_under_mode')
      )
      .map(([modeName, modeConfig]: [string, any]) => ({
        name: modeName,
        description: modeConfig.description || `${modeName} mode`
      }));

    const modeDescriptions = availableModes
      .map(mode => `- ${mode.name}: ${mode.description}`)
      .join('\n');

    const modeNames = availableModes.map(mode => mode.name);

    return {
      type: 'function',
      function: {
        name: 'call_under_mode',
        description: `Delegate a specific task to another specialized AI mode and return with the complete response. This tool switches to the target mode, executes the task, and returns the result.

IMPORTANT: You should provide clear, specific instructions and specify the expected response format. Be explicit about what you want the target mode to accomplish.

Available modes:
${modeDescriptions}

Usage Guidelines:
- Specify clear task instructions with context
- Define expected response format (e.g., "Provide a summary", "Generate code with comments", "List step-by-step instructions")
- Include any constraints or requirements
- The target mode will have access to its specialized tools
- The conversation will show the mode switch and the delegated task

Examples:
- Use Coder mode for: code generation, file modifications, debugging, terminal operations
- Use Ask mode for: research questions, documentation lookup, general explanations
- Use Architect mode for: system design, architecture reviews, technical planning`,
        parameters: {
          type: 'object',
          properties: {
            target_mode: {
              type: 'string',
              enum: modeNames,
              description: `Target mode to delegate the task to. Available modes: ${modeNames.join(', ')}`
            },
            task: {
              type: 'string',
              description: 'Clear and specific task instruction for the target mode. Include context, requirements, and expected response format.'
            }
          },
          required: ['target_mode', 'task'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { target_mode, task } = args;

    if (!target_mode || !task) {
      return {
        success: false,
        content: '',
        error: 'Both target_mode and task parameters are required'
      };
    }

    // Validate target mode exists and doesn't have call_under_mode tool (prevent recursion)
    const config = vscode.workspace.getConfiguration('codingagent');
    const modes = config.get<any>('modes', {});
    
    if (!modes[target_mode]) {
      return {
        success: false,
        content: '',
        error: `Target mode '${target_mode}' does not exist`
      };
    }

    if (modes[target_mode].allowedTools?.includes('call_under_mode')) {
      return {
        success: false,
        content: '',
        error: `Cannot delegate to mode '${target_mode}' as it also has call_under_mode tool (would cause infinite recursion)`
      };
    }

    if (!CallUnderModeTool.modeChangeCallback) {
      return {
        success: false,
        content: '',
        error: 'Mode change callback not initialized'
      };
    }

    try {
      // Get current mode
      const currentMode = config.get<string>('currentMode', 'Orchestrator');
      
      // Call the mode change callback which handles the delegation
      const response = await CallUnderModeTool.modeChangeCallback(target_mode, task, currentMode);
      
      return {
        success: true,
        content: `LLM ${target_mode.toUpperCase()} MODE answer: ${response}`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to execute task in ${target_mode} mode: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
