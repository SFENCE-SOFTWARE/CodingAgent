// src/tools/planShow.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanShowTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_show',
      displayName: 'Show Plan',
      description: 'Display plan details with list of points',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_show',
        description: 'Show current active plan name, long description and list of points with their short names and unique IDs',
        parameters: {
          type: 'object',
          properties: {
            include_point_descriptions: {
              type: 'boolean',
              description: 'Whether to include short descriptions of points (default: false)',
              default: false
            }
          },
          required: [],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { include_point_descriptions = false } = args;

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
      const result = planningService.showPlan(currentPlanId, include_point_descriptions);

      if (result.success) {
        const plan = result.plan!;
        let content = `Plan: ${plan.name} (ID: ${plan.id})\n\n`;
        
        // Show short description if available
        if (plan.shortDescription) {
          content += `Short Description: ${plan.shortDescription}\n\n`;
        }
        
        content += `Long Description:\n${plan.longDescription}\n\n`;
        
        // Show plan review and acceptance status
        if (plan.accepted) {
          content += `✅ Plan Status: ACCEPTED\n`;
          if (plan.acceptedComment) {
            content += `   Acceptance Comment: ${plan.acceptedComment}\n`;
          }
        } else if (plan.reviewed) {
          content += `✅ Plan Status: REVIEWED (pending acceptance)\n`;
          if (plan.reviewedComment) {
            content += `   Review Comment: ${plan.reviewedComment}\n`;
          }
        } else if (plan.needsWork) {
          content += `❌ Plan Status: NEEDS WORK`;
          if (plan.needsWorkComments && plan.needsWorkComments.length > 0) {
            content += ` (${plan.needsWorkComments.length} issue${plan.needsWorkComments.length > 1 ? 's' : ''})`;
          }
          content += `\n`;
        } else {
          content += `⏳ Plan Status: PENDING REVIEW\n`;
        }
        content += '\n';
        
        if (plan.points.length === 0) {
          content += 'No points in this plan yet.';
        } else {
          content += `Points (${plan.points.length}):\n`;
          for (const point of plan.points) {
            content += `- [${point.id}] ${point.shortName}\n`;
            if (include_point_descriptions && point.shortDescription) {
              content += `  ${point.shortDescription}\n`;
            }
          }
        }

        return {
          success: true,
          content: content.trim()
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to show plan'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to show plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
