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
        content += `Title: ${point.shortName}\n`;
        content += `Short Description: ${point.shortDescription}\n`;
        content += `Detailed Description: ${point.detailedDescription}\n`;
        content += `Acceptance Criteria: ${point.acceptanceCriteria}\n\n`;
        
        // Status information
        content += `Status:\n`;
        content += `  Implemented: ${point.state.implemented ? '✅' : '❌'}\n`;
        content += `  Reviewed: ${point.state.reviewed ? '✅' : '❌'}`;
        if (point.state.reviewed && point.state.reviewedComment) {
          content += ` - ${point.state.reviewedComment}`;
        }
        content += `\n`;
        content += `  Tested: ${point.state.tested ? '✅' : '❌'}`;
        if (point.state.tested && point.state.testedComment) {
          content += ` - ${point.state.testedComment}`;
        }
        content += `\n`;
        content += `  Accepted: ${point.state.accepted ? '✅' : '❌'}\n`;
        content += `  Needs Rework: ${point.state.needRework ? '❌' : '✅'}`;
        if (point.state.needRework && point.state.reworkReason) {
          content += ` - ${point.state.reworkReason}`;
        }
        content += `\n\n`;

        if (point.careOnPoints && point.careOnPoints.length > 0) {
          content += `Care-On Points:\n`;
          point.careOnPoints.forEach((carePoint: any) => {
            content += `  - [${carePoint.id}] ${carePoint.shortName}\n`;
          });
          content += '\n';
        }

        if (point.comments && point.comments.length > 0) {
          content += 'Comments:\n';
          point.comments.forEach((comment: string, index: number) => {
            content += `  ${index + 1}. ${comment}\n`;
          });
        }

        return {
          success: true,
          content: content.trim()
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
