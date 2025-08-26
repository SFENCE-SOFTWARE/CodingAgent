// src/tools/planDelete.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';

export class PlanDeleteTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_delete',
      displayName: 'Delete Plan',
      description: 'Delete a plan and all its associated data',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_delete',
        description: 'Delete a plan permanently, removing it from storage along with all its points and data',
        parameters: {
          type: 'object',
          properties: {
            plan_id: {
              type: 'string',
              description: 'ID of the plan to delete'
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag to prevent accidental deletion'
            }
          },
          required: ['plan_id', 'confirm'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { plan_id, confirm } = args;

    if (!plan_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameters: plan_id, confirm'
      };
    }

    if (!confirm) {
      return {
        success: false,
        content: '',
        error: 'Deletion requires explicit confirmation (confirm: true)'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.deletePlan(plan_id, true); // Force delete when confirm is true

      if (result.success) {
        return {
          success: true,
          content: `Plan '${plan_id}' has been deleted successfully`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to delete plan'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to delete plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
