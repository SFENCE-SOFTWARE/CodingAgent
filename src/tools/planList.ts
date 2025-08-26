// src/tools/planList.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';

export class PlanListTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_list',
      displayName: 'List Plans',
      description: 'Show list of known plan names and optionally their short descriptions',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_list',
        description: 'List all existing plans with their names and optionally short descriptions',
        parameters: {
          type: 'object',
          properties: {
            include_short_description: {
              type: 'boolean',
              description: 'Whether to include short descriptions of plans (default: false)',
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
    const { include_short_description = false } = args;

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const result = planningService.listPlans(include_short_description);

      if (result.success) {
        if (!result.plans || result.plans.length === 0) {
          return {
            success: true,
            content: 'No plans found'
          };
        }

        let content = `Found ${result.plans.length} plan(s):\n\n`;
        for (const plan of result.plans) {
          content += `- ID: ${plan.id}\n  Name: ${plan.name}\n`;
          if (include_short_description && plan.shortDescription) {
            content += `  Description: ${plan.shortDescription}\n`;
          }
          content += '\n';
        }

        return {
          success: true,
          content: content.trim()
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to list plans'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to list plans: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
