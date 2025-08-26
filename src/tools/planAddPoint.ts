// src/tools/planAddPoint.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanAddPointTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_add_point',
      displayName: 'Add Plan Point',
      description: 'Add a new point to a plan at specified position',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_add_point',
        description: 'Add a new point to the current active plan. The point will be added after the specified point ID, or at the beginning if after_point_id is null',
        parameters: {
          type: 'object',
          properties: {
            after_point_id: {
              type: ['string', 'null'],
              description: 'ID of the point after which to insert the new point. Use null to add at the beginning'
            },
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
          required: ['after_point_id', 'short_name', 'short_description', 'detailed_description', 'acceptance_criteria'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { after_point_id, short_name, short_description, detailed_description, acceptance_criteria } = args;

    if (!short_name || !short_description || !detailed_description || !acceptance_criteria) {
      return {
        success: false,
        content: '',
        error: 'Required parameters: short_name, short_description, detailed_description, acceptance_criteria'
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
      const result = planningService.addPoint(
        currentPlanId,
        after_point_id,
        short_name,
        short_description,
        detailed_description,
        acceptance_criteria
      );

      if (result.success) {
        const position = after_point_id === null ? 'at the beginning' : `after point '${after_point_id}'`;
        return {
          success: true,
          content: `Point '${result.pointId}' added successfully to plan '${currentPlanId}' ${position}`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to add point'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to add point: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
