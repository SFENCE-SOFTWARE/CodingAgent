// src/tools/planEvaluate.ts

import { BaseTool } from '../types';
import { ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

/**
 * Tool for evaluating plan completion status and generating corrective prompts
 */
export class PlanEvaluateTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_evaluate',
      description: 'Evaluate plan completion status and generate corrective prompts if needed',
      displayName: 'Plan Evaluate',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_evaluate',
        description: 'Evaluates plan completion status and generates corrective prompts if needed. Checks in order: plan not reviewed -> points need rework -> points not reviewed -> points not tested -> points not implemented -> plan accepted. Note: Points which are not implemented cannot be marked as not reviewed or not tested.',
        parameters: {
          type: 'object',
          properties: {
            plan_id: {
              type: 'string',
              description: 'Plan ID to evaluate. If not provided, uses current active plan.'
            }
          },
          required: [],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    try {
      const planningService = PlanningService.getInstance(workspaceRoot);
      const planContextManager = PlanContextManager.getInstance();
      
      // Use provided plan_id or current active plan
      const planId = args.plan_id || planContextManager.getCurrentPlanId();
      if (!planId) {
        return {
          success: false,
          content: '',
          error: 'No plan_id provided and no active plan set. Use plan_open to set active plan or provide plan_id parameter.'
        };
      }

      // Evaluate plan completion
      const result = planningService.evaluatePlanCompletion(planId);
      if (!result.success) {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to evaluate plan'
        };
      }

      const evaluation = result.result!;
      
      if (evaluation.isDone) {
        return {
          success: true,
          content: `Plan '${planId}' is complete. All requirements are satisfied: plan reviewed, all points implemented, reviewed, tested, and plan accepted.`
        };
      } else {
        return {
          success: true,
          content: `Plan '${planId}' is not complete.\n\nFailed step: ${evaluation.failedStep}\nReason: ${evaluation.reason}\n\nCorrective prompt:\n${evaluation.nextStepPrompt}`
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to evaluate plan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
