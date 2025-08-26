// src/tools/planPointCareOn.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointCareOnTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_care_on',
      displayName: 'Set Plan Point Care-On',
      description: 'Set list of points that need to be considered when implementing a point',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_care_on',
        description: 'Set a list of point IDs that need to be considered when implementing the specified point. Validates existence of all point IDs',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to set care-on points for'
            },
            care_on_point_ids: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of point IDs that need to be considered during implementation'
            }
          },
          required: ['point_id', 'care_on_point_ids'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id, care_on_point_ids } = args;

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

    if (!Array.isArray(care_on_point_ids)) {
      return {
        success: false,
        content: '',
        error: 'care_on_point_ids must be an array'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.setCareOnPoints(plan_id, point_id, care_on_point_ids);

      if (result.success) {
        if (care_on_point_ids.length === 0) {
          return {
            success: true,
            content: `Care-on points cleared for point '${point_id}' in plan '${plan_id}'`
          };
        } else {
          return {
            success: true,
            content: `Care-on points set for point '${point_id}' in plan '${plan_id}': [${care_on_point_ids.join(', ')}]`
          };
        }
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to set care-on points'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to set care-on points: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
