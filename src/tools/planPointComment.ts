// src/tools/planPointComment.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointCommentTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_comment',
      displayName: 'Add Plan Point Comment',
      description: 'Add a comment to a specific point in the current active plan. This tool only adds comments and does NOT change point status.',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_comment',
        description: 'Add a timestamped comment to a specific point in the current active plan for tracking progress, notes, or discussion. IMPORTANT: This tool is only for adding comments and does NOT change point status (implemented, tested, reviewed, etc.). Use other plan tools like plan_point_implemented, plan_point_tested, plan_point_reviewed to change status.',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to add comment to'
            },
            comment: {
              type: 'string',
              description: 'Comment text to add (for notes, progress updates, or discussion only - does not change status)'
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

    // Get current plan from context
    const planContextManager = PlanContextManager.getInstance();
    const plan_id = planContextManager.getCurrentPlanId();
    
    if (!plan_id) {
      return {
        success: false,
        content: '',
        error: 'No active plan set. Use plan_open to set the current plan context'
      };
    }

    if (!point_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: point_id'
      };
    }

    if (typeof comment !== 'string' || comment.trim().length === 0) {
      return {
        success: false,
        content: '',
        error: 'Comment must be a non-empty string'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.addComment(plan_id, point_id, comment.trim());

      if (result.success) {
        return {
          success: true,
          content: `Comment added to point '${point_id}' in plan '${plan_id}': "${comment.trim()}"`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to add comment'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to add comment: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
