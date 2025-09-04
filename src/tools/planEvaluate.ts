// src/tools/planEvaluate.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanEvaluateTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_evaluate',
      displayName: 'Evaluate Plan Progress',
      description: 'Evaluate the current plan progress and determine next steps',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_evaluate',
        description: 'Evaluate the current active plan progress, return completion status and next step prompt. May include a done callback for completed tasks.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
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
      const result = planningService.evaluatePlanCompletion(currentPlanId);

      if (result.success && result.result) {
        const evaluation = result.result;
        
        let content = `Plan Evaluation for '${currentPlanId}':\n\n`;
        content += `Status: ${evaluation.isDone ? '✅ COMPLETE' : '⏳ IN PROGRESS'}\n\n`;
        content += `Next Step: ${evaluation.nextStepPrompt}\n`;
        
        if (evaluation.failedStep) {
          content += `\nFailed Step: ${evaluation.failedStep}`;
        }
        
        if (evaluation.failedPoints && evaluation.failedPoints.length > 0) {
          content += `\nAffected Points: ${evaluation.failedPoints.join(', ')}`;
        }
        
        if (evaluation.reason) {
          content += `\nReason: ${evaluation.reason}`;
        }

        // Store the doneCallback in the result for the orchestrator to use
        const resultWithCallback: any = {
          success: true,
          content: content.trim(),
          evaluation: evaluation
        };

        return resultWithCallback;
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to evaluate plan'
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
