// src/tools/planChange.ts

import { ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export interface BaseTool {
  getToolInfo(): ToolInfo;
  getToolDefinition(): ToolDefinition;
  execute(args: any, workspaceRoot: string): Promise<ToolResult>;
}

export class PlanChangeTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_change',
      displayName: 'Plan Change',
      description: 'Update plan name and descriptions',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_change',
        description: 'Update plan name, short description, or long description. At least one parameter must be provided.',
        parameters: {
          type: 'object',
          properties: {
            plan_id: {
              type: 'string',
              description: 'ID of the plan to update (optional if plan is already open in context)'
            },
            name: {
              type: 'string',
              description: 'New name for the plan (optional)'
            },
            short_description: {
              type: 'string',
              description: 'New short description for the plan (optional)'
            },
            long_description: {
              type: 'string',
              description: 'New long description for the plan (optional)'
            }
          },
          required: []
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const { plan_id, name, short_description, long_description } = args;

      // Validate that at least one field is provided
      if (!name && !short_description && !long_description) {
        return {
          success: false,
          content: '',
          error: 'At least one of name, short_description, or long_description must be provided'
        };
      }

      // Determine plan ID - use provided plan_id or get from context
      let targetPlanId = plan_id;
      if (!targetPlanId) {
        const contextManager = PlanContextManager.getInstance();
        targetPlanId = contextManager.getCurrentPlanId();
        if (!targetPlanId) {
          return {
            success: false,
            content: '',
            error: 'No plan_id provided and no plan is currently open. Please specify plan_id or open a plan first.'
          };
        }
      }

      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.updatePlanDetails(targetPlanId, name, short_description, long_description);

      if (!result.success) {
        return { 
          success: false, 
          content: '',
          error: result.error 
        };
      }

      // Build response message
      const updatedFields: string[] = [];
      if (name) {
        updatedFields.push(`name to "${name}"`);
      }
      if (short_description) {
        updatedFields.push(`short description to "${short_description}"`);
      }
      if (long_description) {
        updatedFields.push(`long description to "${long_description}"`);
      }

      return {
        success: true,
        content: `Plan '${targetPlanId}' successfully updated: ${updatedFields.join(', ')}.`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to update plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
