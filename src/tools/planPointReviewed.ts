// src/tools/planPointReviewed.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointReviewedTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_reviewed',
      displayName: 'Mark Point as Reviewed',
      description: 'Mark a point in the current active plan as reviewed',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_reviewed',
        description: 'Mark a point in the current active plan as reviewed with a required comment',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to mark as reviewed'
            },
            comment: {
              type: 'string',
              description: 'Required comment explaining the review outcome and any findings'
            }
          },
          required: ['point_id', 'comment'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id, comment } = args;

    if (!point_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: point_id'
      };
    }

    if (!comment) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: comment (explanation of review outcome and findings)'
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
      const result = planningService.setReviewed(currentPlanId, point_id, comment);

      if (result.success) {
        return {
          success: true,
          content: `Point '${point_id}' in plan '${currentPlanId}' marked as reviewed with comment: "${comment}"`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark point as reviewed'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark point as reviewed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
