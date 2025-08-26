// src/tools/planState.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanStateTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_state',
      displayName: 'Get Plan State',
      description: 'Get the current state of the active plan with statistics and progress information',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_state',
        description: 'Get the current state of the active plan showing summary of all points by status',
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
      const result = planningService.getPlanState(currentPlanId);

      if (result.success && result.state) {
        const state = result.state;
        
        let content = `Plan: ${currentPlanId}\n`;
        content += `Total Points: ${state.totalCount}\n`;
        content += `Progress: ${state.acceptedCount}/${state.totalCount} accepted (${((state.acceptedCount / state.totalCount) * 100).toFixed(1)}%)\n\n`;
        
        content += 'Point Status Breakdown:\n';
        content += `  Implemented: ${state.implementedCount}\n`;
        content += `  Reviewed: ${state.reviewedCount}\n`;
        content += `  Tested: ${state.testedCount}\n`;
        content += `  Accepted: ${state.acceptedCount}\n\n`;
        
        content += 'Overall Status:\n';
        content += `  All Implemented: ${state.allImplemented ? 'Yes' : 'No'}\n`;
        content += `  All Reviewed: ${state.allReviewed ? 'Yes' : 'No'}\n`;
        content += `  All Tested: ${state.allTested ? 'Yes' : 'No'}\n`;
        content += `  All Accepted: ${state.allAccepted ? 'Yes' : 'No'}\n\n`;
        
        if (state.pendingPoints && state.pendingPoints.length > 0) {
          content += `Pending Points: [${state.pendingPoints.join(', ')}]\n`;
        } else {
          content += 'No pending points\n';
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
        error: `Failed to get plan state: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
