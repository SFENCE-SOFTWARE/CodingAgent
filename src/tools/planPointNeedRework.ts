// src/tools/planPointNeedRework.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointNeedReworkTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_need_rework',
      displayName: 'Mark Plan Point as Needing Rework',
      description: 'Mark a plan point as needing rework',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_need_rework',
        description: 'Mark a plan point as needing rework, indicating that the implementation requires changes or fixes',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to mark as needing rework'
            },
            rework_reasons: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of reasons why the point needs rework'
            }
          },
          required: ['point_id', 'rework_reasons'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id, rework_reasons } = args;

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

    if (!Array.isArray(rework_reasons) || rework_reasons.length === 0) {
      return {
        success: false,
        content: '',
        error: 'Rework reasons must be a non-empty array of strings'
      };
    }

    // Validate that all reasons are non-empty strings
    const validReasons = rework_reasons.filter(reason => 
      typeof reason === 'string' && reason.trim().length > 0
    ).map(reason => reason.trim());

    if (validReasons.length === 0) {
      return {
        success: false,
        content: '',
        error: 'At least one non-empty rework reason is required'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      
      // Join reasons into a single string for now (to maintain compatibility with existing backend)
      const combinedReason = validReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n');
      const result = planningService.setNeedRework(plan_id, point_id, combinedReason);

      if (result.success) {
        const reasonsList = validReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n  ');
        return {
          success: true,
          content: `Point '${point_id}' in plan '${plan_id}' marked as needing rework with ${validReasons.length} reason(s):\n  ${reasonsList}`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark point as needing rework'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark point as needing rework: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
