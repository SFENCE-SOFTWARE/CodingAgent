// src/tools/planNeedWorks.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanNeedWorksTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_need_works',
      displayName: 'Mark Plan as Needing Work',
      description: 'Mark the current active plan as needing work with a required comment',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_need_works',
        description: 'Mark the current active plan as needing work with a required comment',
        parameters: {
          type: 'object',
          properties: {
            comment: {
              type: 'string',
              description: 'Required comment explaining what needs to be improved or reworked in the plan'
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
        error: 'Required parameter: comment (explanation of what needs to be improved in the plan)'
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
      const result = planningService.setPlanNeedsWork(currentPlanId, comment);

      if (result.success) {
        return {
          success: true,
          content: `Plan '${currentPlanId}' marked as needing work with comment: "${comment}"`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark plan as needing work'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark plan as needing work: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
