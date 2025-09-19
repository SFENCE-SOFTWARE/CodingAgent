import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';

export class PlanReplacePlaceholdersTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_replace_placeholders',
      displayName: 'Plan Replace Placeholders',
      description: 'Replaces placeholders in prompt templates with actual values from plans and points. Supports placeholders like <plan_long_description>, <plan_short_description>, <point_id>, etc.',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_replace_placeholders',
        description: 'Replaces placeholders in prompt templates with actual values from plans and points. Use this before sending prompts to LLM to ensure all placeholders are replaced with current plan/point data.',
        parameters: {
          type: 'object',
          properties: {
            template: {
              type: 'string',
              description: 'The template string containing placeholders to replace'
            },
            plan_id: {
              type: 'string',
              description: 'The ID of the plan to use for placeholder replacement'
            },
            point_id: {
              type: 'string',
              description: 'Optional: The ID of a specific point to use for point-related placeholders'
            }
          },
          required: ['template', 'plan_id'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { template, plan_id, point_id } = args;

    if (!template || typeof template !== 'string') {
      return {
        success: false,
        content: '',
        error: 'template is required and must be a string'
      };
    }

    if (!plan_id || typeof plan_id !== 'string') {
      return {
        success: false,
        content: '',
        error: 'plan_id is required and must be a string'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      
      // Use the centralized placeholder replacement method
      const result = planningService.replacePlaceholders(template, plan_id, point_id);
      
      const response = {
        originalTemplate: template,
        processedTemplate: result,
        planId: plan_id,
        pointId: point_id || null,
        replacementsFound: template !== result
      };
      
      return {
        success: true,
        content: JSON.stringify(response, null, 2)
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Placeholder replacement error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
