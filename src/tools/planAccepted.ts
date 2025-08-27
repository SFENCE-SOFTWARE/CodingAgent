// src/tools/planAccepted.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanAcceptedTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_accepted',
      displayName: 'Mark Plan as Accepted',
      description: 'Mark the entire current active plan as accepted with required acceptance comment',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_accepted',
        description: 'Mark the entire current active plan as accepted with required acceptance comment',
        parameters: {
          type: 'object',
          properties: {
            comment: {
              type: 'string',
              description: 'Required detailed comment explaining why the plan is accepted, what was validated, and overall assessment'
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

    if (!comment || comment.trim().length === 0) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: comment (must be a detailed explanation of why the plan is accepted)'
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
      const result = planningService.setPlanAccepted(currentPlanId, comment.trim());

      if (result.success) {
        return {
          success: true,
          content: `Plan '${currentPlanId}' marked as accepted with comment: "${comment.trim()}"`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark plan as accepted'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark plan as accepted: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
