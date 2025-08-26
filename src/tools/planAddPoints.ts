// src/tools/planAddPoints.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanAddPointsTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_add_points',
      displayName: 'Add Plan Points',
      description: 'Add multiple new points to a plan as a batch operation',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_add_points',
        description: 'Add multiple new points to the current active plan as a batch operation. Points will be added sequentially starting at the specified position.',
        parameters: {
          type: 'object',
          properties: {
            after_point_id: {
              type: ['string', 'null'],
              description: 'ID of the point after which to insert the new points. Use null to add at the beginning'
            },
            points: {
              type: 'array',
              description: 'Array of points to add',
              items: {
                type: 'object',
                properties: {
                  short_name: {
                    type: 'string',
                    description: 'Short name/title of the point'
                  },
                  short_description: {
                    type: 'string',
                    description: 'Brief description of the point'
                  },
                  detailed_description: {
                    type: 'string',
                    description: 'Detailed description of the point'
                  },
                  acceptance_criteria: {
                    type: 'string',
                    description: 'Acceptance criteria for the point'
                  }
                },
                required: ['short_name', 'short_description', 'detailed_description', 'acceptance_criteria'],
                additionalProperties: false
              },
              minItems: 1
            }
          },
          required: ['after_point_id', 'points'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { after_point_id, points } = args;

    if (!points || !Array.isArray(points) || points.length === 0) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: points (must be non-empty array)'
      };
    }

    // Validate each point structure
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point.short_name || !point.short_description || !point.detailed_description || !point.acceptance_criteria) {
        return {
          success: false,
          content: '',
          error: `Point at index ${i} is missing required fields: short_name, short_description, detailed_description, acceptance_criteria`
        };
      }
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
      const result = planningService.addPoints(
        currentPlanId,
        after_point_id,
        points
      );

      if (result.success) {
        const position = after_point_id === null ? 'at the beginning' : `after point '${after_point_id}'`;
        const pointIds = result.pointIds?.join(', ') || '';
        return {
          success: true,
          content: `${points.length} points added successfully to plan '${currentPlanId}' ${position}. Point IDs: ${pointIds}`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to add points'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to add points: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
