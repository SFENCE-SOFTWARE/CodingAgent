// src/tools/planPointDependsOn.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointDependsOnTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_depends_on',
      displayName: 'Set Plan Point Dependencies',
      description: 'Set dependencies and care-on relationships for a plan point',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_depends_on',
        description: 'Set both depends-on and care-on relationships for a plan point. Depends-on points must be completed before this point can be implemented. Care-on points are related and should be considered together.',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to set dependencies for'
            },
            depends_on: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of point IDs that this point depends on (must be completed first)',
              default: []
            },
            care_on: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of point IDs that are related to this point (should be considered together)',
              default: []
            }
          },
          required: ['point_id'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id, depends_on = [], care_on = [] } = args;

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

    // Validate arrays
    if (!Array.isArray(depends_on)) {
      return {
        success: false,
        content: '',
        error: 'depends_on must be an array of point IDs'
      };
    }

    if (!Array.isArray(care_on)) {
      return {
        success: false,
        content: '',
        error: 'care_on must be an array of point IDs'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.setPointDependencies(plan_id, point_id, depends_on, care_on);

      if (result.success) {
        let message = `Point '${point_id}' dependencies updated:`;
        
        if (depends_on.length > 0) {
          message += `\n  Depends on: ${depends_on.join(', ')}`;
        } else {
          message += `\n  Depends on: none`;
        }
        
        if (care_on.length > 0) {
          message += `\n  Care on: ${care_on.join(', ')}`;
        } else {
          message += `\n  Care on: none`;
        }

        return {
          success: true,
          content: message
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to set point dependencies'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to set point dependencies: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
