// src/tools/planSetArchitecture.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanSetArchitectureTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_set_architecture',
      displayName: 'Set Plan Architecture',
      description: 'Set the architectural design for a plan in JSON format',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_set_architecture',
        description: 'Set the architectural design for a plan. The architecture should be provided as a JSON string containing the architectural design.',
        parameters: {
          type: 'object',
          properties: {
            plan_id: {
              type: 'string',
              description: 'ID of the plan to set architecture for. If not provided, uses the currently active plan from context.'
            },
            architecture: {
              type: 'string',
              description: 'JSON string containing the architectural design. This should include components, relationships, data flows, and other architectural elements.'
            }
          },
          required: ['architecture'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { plan_id, architecture } = args;

    if (!architecture) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: architecture (JSON string)'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const planContextManager = PlanContextManager.getInstance();
      
      // Determine which plan to use
      let targetPlanId = plan_id;
      if (!targetPlanId) {
        targetPlanId = planContextManager.getCurrentPlanId();
        if (!targetPlanId) {
          return {
            success: false,
            content: '',
            error: 'No plan ID provided and no active plan. Use plan_open to select a plan or provide plan_id parameter.'
          };
        }
      }

      // Set the architecture
      const result = planningService.setArchitecture(targetPlanId, architecture);
      
      if (!result.success) {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to set architecture'
        };
      }

      return {
        success: true,
        content: `Architecture has been set for plan '${targetPlanId}'. The architectural design is now stored and will be available in the plan visualization panel.`
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to set architecture: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
