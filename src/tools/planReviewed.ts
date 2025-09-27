// src/tools/planReviewed.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanReviewedTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_reviewed',
      displayName: 'Mark Plan as Reviewed',
      description: 'Mark the current active plan as reviewed with a required comment',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_reviewed',
        description: 'Mark the current active plan as reviewed with a required comment',
        parameters: {
          type: 'object',
          properties: {
            comment: {
              type: 'string',
              description: 'Required comment explaining the plan review outcome, approval, and any findings'
            }
          },
          required: ['comment'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { comment } = args;

    if (!comment) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: comment (explanation of plan review outcome and approval)'
      };
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
      const result = planningService.setPlanReviewed(currentPlanId, comment);

      if (result.success) {
        // Update workflow flags based on current creation step
        // Get fresh plan data after setPlanReviewed 
        const planState = planningService.showPlan(currentPlanId);
        if (planState.success && planState.plan) {
          const currentStep = planState.plan.creationStep;
          console.log(`[DEBUG] planReviewed: currentStep = ${currentStep}`);
          
          // Update workflow-specific flags based on current creation step
          // We need to call the proper API methods or ensure our change is atomic
          const planData = (planningService as any).plans.get(currentPlanId);
          if (planData) {
            let needsUpdate = false;
            switch (currentStep) {
              case 'plan_description_review':
                planData.descriptionsReviewed = true;
                needsUpdate = true;
                console.log('[DEBUG] planReviewed: Setting descriptionsReviewed = true');
                break;
              case 'plan_architecture_review':
                planData.architectureReviewed = true;
                needsUpdate = true;
                console.log('[DEBUG] planReviewed: Setting architectureReviewed = true');
                break;
              case 'plan_points_review':
                planData.pointsReviewed = true;
                needsUpdate = true;
                console.log('[DEBUG] planReviewed: Setting pointsReviewed = true');
                break;
              case 'plan_checklist_review':
                planData.checklistReviewed = true;
                needsUpdate = true;
                console.log('[DEBUG] planReviewed: Setting checklistReviewed = true');
                break;
              default:
                console.log(`[DEBUG] planReviewed: No specific workflow flag for step ${currentStep}`);
                break;
            }
            if (needsUpdate) {
              planData.updatedAt = Date.now();
              (planningService as any).savePlan(planData);
              console.log(`[DEBUG] planReviewed: Updated workflow flags for step ${currentStep}`);
            }
          }
        }

        // Verify the change was applied
        const verifyState = planningService.showPlan(currentPlanId);
        console.log(`[DEBUG] planReviewed: Final verification - plan.reviewed = ${verifyState.plan?.reviewed}`);
        
        // Check raw memory one more time before return
        const finalRawPlan = (planningService as any).plans.get(currentPlanId);
        console.log(`[DEBUG] planReviewed: Final raw memory check - plan.reviewed = ${finalRawPlan?.reviewed}`);

        return {
          success: true,
          content: `Plan '${currentPlanId}' marked as reviewed with comment: "${comment}"`
        };
      } else {
        return {
          success: false,
          content: '',
          error: result.error || 'Failed to mark plan as reviewed'
        };
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to mark plan as reviewed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
