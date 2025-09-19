// src/tools/planAddPoints.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanAddPointsTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_add_points',
      displayName: 'Add Plan Points',
      description: 'Add multiple new points to a plan as a batch operation',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_add_points',
        description: 'Add multiple new points to the current active plan as a batch operation. Points will be added sequentially starting at the specified position.',
        parameters: {
          type: 'object',
          properties: {
            after_point_id: {
              type: ['string', 'null'],
              description: 'ID of the point after which to insert the new points. Use null to add at the beginning'
            },
            points: {
              type: 'array',
              description: 'Array of points to add',
              items: {
                type: 'object',
                properties: {
                  short_name: {
                    type: 'string',
                    description: 'Short name/title of the point'
                  },
                  short_description: {
                    type: 'string',
                    description: 'Brief description of the point'
                  },
                  detailed_description: {
                    type: 'string',
                    description: 'Detailed description of the point'
                  },
                  review_instructions: {
                    type: 'string',
                    description: 'Instructions for reviewing this point - what should be checked when reviewing the implementation'
                  },
                  testing_instructions: {
                    type: 'string',
                    description: 'Instructions for testing this point - what tests should be performed to validate the implementation'
                  },
                  expected_outputs: {
                    type: 'string',
                    description: 'Expected outputs and deliverables. For analysis tasks, specify memory keys or files to be created. Example: "Analysis stored in memory key \'user-research-2024\'" or "Updated config.json file" or "Documentation in docs/api.md"'
                  },
                  expected_inputs: {
                    type: 'string',
                    description: 'Expected inputs and prerequisites for this point. Specify what data, files, or previous work is needed. Example: "User research data from memory key \'survey-2024\'" or "Existing config.json file" or "Requirements from point 1"'
                  },
                  depends_on: {
                    type: 'array',
                    description: 'Array of point IDs that this point depends on. Use ["-1"] for no dependencies',
                    items: {
                      type: 'string'
                    }
                  },
                  care_on: {
                    type: 'array',
                    description: 'Array of point IDs that this point cares about (will be notified when those points change)',
                    items: {
                      type: 'string'
                    }
                  }
                },
                required: ['short_name', 'short_description', 'detailed_description', 'review_instructions', 'testing_instructions', 'expected_outputs', 'expected_inputs'],
                additionalProperties: false
              },
              minItems: 1
            }
          },
          required: ['after_point_id', 'points'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { after_point_id, points } = args;

    if (!points || !Array.isArray(points) || points.length === 0) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: points (must be non-empty array)'
      };
    }

    // Validate each point structure
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point.short_name || !point.short_description || !point.detailed_description || !point.review_instructions || !point.testing_instructions || !point.expected_outputs || !point.expected_inputs) {
        return {
          success: false,
          content: '',
          error: `Point at index ${i} is missing required fields: short_name, short_description, detailed_description, review_instructions, testing_instructions, expected_outputs, expected_inputs`
        };
      }
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
      const result = planningService.addPoints(
        currentPlanId,
        after_point_id,
        points
      );

      if (result.success) {
        const position = after_point_id === null ? 'at the beginning' : `after point '${after_point_id}'`;
        const pointIds = result.pointIds?.join(', ') || '';
        return {
          success: true,
          content: `${points.length} points added successfully to plan '${currentPlanId}' ${position}. Point IDs: ${pointIds}`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to add points'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to add points: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
