// src/tools/planPointAccepted.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointAcceptedTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_accepted',
      displayName: 'Mark Point as Accepted',
      description: 'Mark a point in the current active plan as accepted',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_accepted',
        description: 'Mark a point in the current active plan as accepted',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to mark as accepted'
            }
          },
          required: ['point_id'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id } = args;

    if (!point_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: point_id'
      };
    }

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
      const result = planningService.setAccepted(currentPlanId, point_id);

      if (result.success) {
        return {
          success: true,
          content: `Point '${point_id}' in plan '${currentPlanId}' marked as accepted`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark point as accepted'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark point as accepted: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
