// src/tools/planShowPoint.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanShowPointTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_show_point',
      displayName: 'Show Plan Point Details',
      description: 'Show detailed information about a specific point in the current active plan',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_show_point',
        description: 'Show details of a specific point in the current active plan',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to display'
            }
          },
          required: ['point_id'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id } = args;

    if (!point_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: point_id'
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
      const result = planningService.showPoint(currentPlanId, point_id);

      if (result.success && result.point) {
        const point = result.point;
        
        let content = `Plan: ${currentPlanId}\n`;
        content += `Point ID: ${point.id}\n`;
        content += `Title: ${point.title}\n`;
        content += `Description: ${point.description}\n`;
        content += `Priority: ${point.priority}\n`;
        content += `Assigned To: ${point.assignedTo || 'Unassigned'}\n`;
        content += `Status: ${point.status}\n`;
        content += `Created: ${point.createdAt}\n`;
        content += `Updated: ${point.updatedAt}\n`;

        if (point.careOnPoints && point.careOnPoints.length > 0) {
          content += `Care-On Points: [${point.careOnPoints.join(', ')}]\n`;
        }

        if (point.comments && point.comments.length > 0) {
          content += '\nComments:\n';
          point.comments.forEach((comment: any, index: number) => {
            content += `  ${index + 1}. [${comment.timestamp}] ${comment.text}\n`;
          });
        }

        return {
          success: true,
          content
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Point not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to show point: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
