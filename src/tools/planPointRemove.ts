import * as vscode from 'vscode';
import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointRemoveTool implements BaseTool {

    getToolInfo(): ToolInfo {
        return {
            name: 'plan_point_remove',
            displayName: 'Plan Point Remove',
            description: 'Remove specific points from a plan',
            category: 'other'
        };
    }

    getToolDefinition(): ToolDefinition {
        return {
            type: 'function',
            function: {
                name: 'plan_point_remove',
                description: 'Remove one or more specific points from the current active plan by their IDs. This permanently deletes the points and their associated data.',
                parameters: {
                    type: 'object',
                    properties: {
                        point_ids: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'Array of point IDs (strings) to remove from the current active plan',
                            minItems: 1
                        }
                    },
                    required: ['point_ids']
                }
            }
        };
    }

    async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
        try {
            const { point_ids } = args;

            if (!Array.isArray(point_ids) || point_ids.length === 0) {
                return {
                    success: false,
                    error: 'point_ids must be a non-empty array of point IDs',
                    content: ''
                };
            }

            // Validate that all point_ids are strings (not numbers as originally implemented)
            const invalidIds = point_ids.filter(id => typeof id !== 'string' || id.trim() === '');
            if (invalidIds.length > 0) {
                return {
                    success: false,
                    error: `Invalid point IDs: ${invalidIds.join(', ')}. Point IDs must be non-empty strings.`,
                    content: ''
                };
            }

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

            // Use PlanningService to remove the points
            const planningService = PlanningService.getInstance(workspaceRoot);
            const result = planningService.removePoints(currentPlanId, point_ids);

            if (result.success) {
                // Generate summary of removed points
                const pointSummaries = result.removedPoints?.map(point => 
                    `ID ${point.id}: ${point.shortDescription.substring(0, 50)}${point.shortDescription.length > 50 ? '...' : ''}`
                ) || [];

                return {
                    success: true,
                    content: `Successfully removed ${point_ids.length} point(s) from plan '${currentPlanId}':\n${pointSummaries.join('\n')}`
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Failed to remove points',
                    content: ''
                };
            }

        } catch (error) {
            return {
                success: false,
                error: `Error removing points from plan: ${error instanceof Error ? error.message : String(error)}`,
                content: ''
            };
        }
    }
}
