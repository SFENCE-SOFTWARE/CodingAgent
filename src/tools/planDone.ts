// src/tools/planDone.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanDoneTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_done',
      displayName: 'Check if Plan is Done',
      description: 'Check if a plan is completely done (plan is accepted)',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_done',
        description: 'Check if the current active plan is completely done by verifying that the plan has been accepted',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      // Get current active plan from context
      const planContextManager = PlanContextManager.getInstance();
      const currentPlanId = planContextManager.getCurrentPlanId();
      
      if (!currentPlanId) {
        return {
          success: false,
          content: '',
          error: 'No active plan. Use plan_open to select a plan or plan_new to create one.'
        };
      }

      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.isPlanDone(currentPlanId);

      if (result.success) {
        const isDone = result.done || false;
        const pendingPoints = result.pendingPoints || [];

        let content = `Plan: ${currentPlanId}\n`;
        content += `Status: ${isDone ? 'COMPLETE' : 'IN PROGRESS'}\n`;
        
        if (!isDone && pendingPoints.length > 0) {
          content += `Pending Points: [${pendingPoints.join(', ')}]\n`;
        } else if (isDone) {
          content += 'Plan has been accepted!\n';
        }

        return {
          success: true,
          content
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Plan not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to check plan completion: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
