// src/tools/planOpen.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanOpenTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_open',
      displayName: 'Open Plan',
      description: 'Open and set a plan as current active plan',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_open',
        description: 'Open a plan by ID and set it as the current active plan for subsequent operations',
        parameters: {
          type: 'object',
          properties: {
            plan_id: {
              type: 'string',
              description: 'ID of the plan to open and set as active'
            }
          },
          required: ['plan_id'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { plan_id } = args;

    if (!plan_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: plan_id'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.showPlan(plan_id, false);

      if (result.success) {
        // Update the current plan context when opening a plan
        const planContextManager = PlanContextManager.getInstance();
        planContextManager.setCurrentPlanId(plan_id);
        
        const plan = result.plan!;
        return {
          success: true,
          content: `Plan '${plan.name}' (ID: ${plan.id}) is now active. Use plan_show to see details.`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to open plan'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to open plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
