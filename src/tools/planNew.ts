// src/tools/planNew.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanNewTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_new',
      displayName: 'Create New Plan',
      description: 'Create a new empty plan with given ID and name',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_new',
        description: 'Create a new empty plan with specified ID, name, and descriptions',
        parameters: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the plan'
            },
            name: {
              type: 'string',
              description: 'Name of the plan'
            },
            short_description: {
              type: 'string',
              description: 'Short description of the plan'
            },
            long_description: {
              type: 'string',
              description: 'Detailed description of the plan'
            }
          },
          required: ['id', 'name', 'short_description', 'long_description'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { id, name, short_description, long_description } = args;

    if (!id || !name || !short_description || !long_description) {
      return {
        success: false,
        content: '',
        error: 'All parameters (id, name, short_description, long_description) are required'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.createPlan(id, name, short_description, long_description);

      if (result.success) {
        // Update the current plan context
        const planContextManager = PlanContextManager.getInstance();
        planContextManager.setCurrentPlanId(id);
        
        return {
          success: true,
          content: `Plan '${id}' created successfully with name '${name}'`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to create plan'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to create plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
