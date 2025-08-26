// src/tools/planPointImplemented.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointImplementedTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_implemented',
      displayName: 'Mark Point as Implemented',
      description: 'Mark a point in the current active plan as implemented',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_implemented',
        description: 'Mark a point in the current active plan as implemented',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to mark as implemented'
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
      const result = planningService.setImplemented(currentPlanId, point_id);

      if (result.success) {
        return {
          success: true,
          content: `Point '${point_id}' in plan '${currentPlanId}' marked as implemented`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark point as implemented'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark point as implemented: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
