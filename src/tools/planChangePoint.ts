// src/tools/planChangePoint.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanChangePointTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_change_point',
      displayName: 'Change Plan Point',
      description: 'Modify an existing plan point properties',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_change_point',
        description: 'Update properties of an existing point in the current active plan. Only provided parameters will be changed, others remain unchanged',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to modify'
            },
            short_name: {
              type: ['string', 'null'],
              description: 'New short name/title of the point (null to keep current)'
            },
            short_description: {
              type: ['string', 'null'],
              description: 'New brief description of the point (null to keep current)'
            },
            detailed_description: {
              type: ['string', 'null'],
              description: 'New detailed description of the point (null to keep current)'
            },
            acceptance_criteria: {
              type: ['string', 'null'],
              description: 'New acceptance criteria for the point (null to keep current)'
            },
            expected_outputs: {
              type: ['string', 'null'],
              description: 'New expected outputs and deliverables (null to keep current). For analysis tasks, specify memory keys or files to be created. Example: "Analysis stored in memory key \'user-research-2024\'" or "Updated config.json file"'
            },
            expected_inputs: {
              type: ['string', 'null'],
              description: 'New expected inputs and prerequisites (null to keep current). Specify what data, files, or previous work is needed. Example: "User research data from memory key \'survey-2024\'" or "Existing config.json file"'
            }
          },
          required: ['point_id'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id, short_name, short_description, detailed_description, acceptance_criteria, expected_outputs, expected_inputs } = args;

    // Get current plan from context
    const planContextManager = PlanContextManager.getInstance();
    const plan_id = planContextManager.getCurrentPlanId();
    
    if (!plan_id) {
      return {
        success: false,
        content: '',
        error: 'No active plan set. Use plan_open to set the current plan context'
      };
    }

    if (!point_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: point_id'
      };
    }

    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      
      // Build updates object with only non-null values
      const updates: any = {};
      if (short_name !== null && short_name !== undefined) {updates.shortName = short_name;}
      if (short_description !== null && short_description !== undefined) {updates.shortDescription = short_description;}
      if (detailed_description !== null && detailed_description !== undefined) {updates.detailedDescription = detailed_description;}
      if (acceptance_criteria !== null && acceptance_criteria !== undefined) {updates.acceptanceCriteria = acceptance_criteria;}
      if (expected_outputs !== null && expected_outputs !== undefined) {updates.expectedOutputs = expected_outputs;}
      if (expected_inputs !== null && expected_inputs !== undefined) {updates.expectedInputs = expected_inputs;}

      if (Object.keys(updates).length === 0) {
        return {
          success: false,
          content: '',
          error: 'No valid updates provided (all parameters were null)'
        };
      }

      const result = planningService.changePoint(plan_id, point_id, updates);

      if (result.success) {
        const changedFields = Object.keys(updates).join(', ');
        return {
          success: true,
          content: `Point '${point_id}' in plan '${plan_id}' updated successfully. Changed fields: ${changedFields}`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to change point'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to change point: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
