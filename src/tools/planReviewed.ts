// src/tools/planReviewed.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanReviewedTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_reviewed',
      displayName: 'Mark Plan as Reviewed',
      description: 'Mark the current active plan as reviewed with a required comment',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_reviewed',
        description: 'Mark the current active plan as reviewed with a required comment',
        parameters: {
          type: 'object',
          properties: {
            comment: {
              type: 'string',
              description: 'Required comment explaining the plan review outcome, approval, and any findings'
            }
          },
          required: ['comment'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { comment } = args;

    if (!comment) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: comment (explanation of plan review outcome and approval)'
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
      const result = planningService.setPlanReviewed(currentPlanId, comment);

      if (result.success) {
        return {
          success: true,
          content: `Plan '${currentPlanId}' marked as reviewed with comment: "${comment}"`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark plan as reviewed'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark plan as reviewed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
