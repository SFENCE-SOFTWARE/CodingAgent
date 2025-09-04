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
        description: 'Mark the current active plan as needing work with required comments',
        parameters: {
          type: 'object',
          properties: {
            comments: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of comments explaining what needs to be improved or reworked in the plan'
            }
          },
          required: ['comments'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { comments } = args;

    if (!Array.isArray(comments) || comments.length === 0) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: comments (array of explanations of what needs to be improved in the plan)'
      };
    }

    // Validate that all comments are non-empty strings
    const validComments = comments.filter(comment => 
      typeof comment === 'string' && comment.trim().length > 0
    ).map(comment => comment.trim());

    if (validComments.length === 0) {
      return {
        success: false,
        content: '',
        error: 'At least one non-empty comment is required'
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
      
      // Use the new method that accepts array of comments
      const result = planningService.setPlanNeedsWork(currentPlanId, validComments);

      if (result.success) {
        const commentsList = validComments.map((comment, index) => `${index + 1}. ${comment}`).join('\n  ');
        return {
          success: true,
          content: `Plan '${currentPlanId}' marked as needing work with ${validComments.length} comment(s):\n  ${commentsList}`
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
