// Mock vscode BEFORE any imports
const testWorkspaceRoot = '/tmp/test-direct-tool-execution';
const mockVscode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: testWorkspaceRoot } }],
    getConfiguration: () => ({
      get: (key: string, defaultValue: any) => defaultValue
    })
  }
};
(global as any).vscode = mockVscode;

// Jednoduchý test direct tool execution
import * as assert from 'assert';
import * as fs from 'fs';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';

suite('Direct Tool Execution Test', () => {
  let planningService: PlanningService;
  let planContextManager: PlanContextManager;

  function setupTest() {
    // Clean setup
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceRoot, { recursive: true });

    // Ensure vscode mock is properly set before creating ToolsService
    (global as any).vscode = mockVscode;
    
    planningService = PlanningService.getInstance(testWorkspaceRoot);
    planContextManager = PlanContextManager.getInstance();
  }

  function cleanupTest() {
    try {
      if (fs.existsSync(testWorkspaceRoot)) {
        fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Cleanup warning: ${error}`);
    }
  }

  test('direct plan_reviewed tool execution should update workflow flags', async () => {
    setupTest();
    
    try {
      console.log('🧪 Testing direct plan_reviewed tool execution...');
      
      // Create test plan
      const planId = 'direct-tool-test';
      const createResult = planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc for testing');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active manually since plan_open has workspace issues
      planContextManager.setCurrentPlanId(planId);

      // Get the plan to work with for creating the step manually
      const showResult = planningService.showPlan(planId);
      assert.strictEqual(showResult.success, true, 'Should be able to show plan');
      if (showResult.plan) {
        // Directly set the plan state in memory without calling updatePlanDetails
        const planData = (planningService as any).plans.get(planId);
        if (planData) {
          planData.creationStep = 'plan_description_review';
          planData.updatedAt = Date.now();
          (planningService as any).savePlan(planData);
        }
      }

      // Use direct tool instance instead of ToolsService to avoid workspace issues
      const planReviewedTool = new (require('../src/tools/planReviewed').PlanReviewedTool)();
      const toolResult = await planReviewedTool.execute({
        comment: 'Description looks good'
      }, testWorkspaceRoot);

      console.log('Tool execution result:', toolResult);
      assert.strictEqual(toolResult.success, true, 'Tool execution should succeed');

      // Verify plan state
      const plan = planningService.showPlan(planId);
      assert.strictEqual(plan.success, true, 'Plan should exist');
      assert.ok(plan.plan, 'Plan data should exist');
      console.log('Plan state after tool execution:', {
        reviewed: plan.plan.reviewed,
        descriptionsReviewed: plan.plan.descriptionsReviewed,
        creationStep: plan.plan.creationStep
      });

      // Verify both legacy and workflow flags are set
      assert.strictEqual(plan.plan.reviewed, true, 'Legacy reviewed flag should be true');
      assert.strictEqual(plan.plan.descriptionsReviewed, true, 'Workflow descriptionsReviewed flag should be true');
      
      console.log('✅ Direct tool execution test passed!');
    } finally {
      cleanupTest();
    }
  });

  test('direct plan_need_works tool execution should reset workflow flags', async () => {
    setupTest();
    
    try {
      console.log('🧪 Testing direct plan_need_works tool execution...');
      
      // Create test plan  
      const planId = 'direct-tool-need-works-test';
      const createResult = planningService.createPlan(planId, 'Test Plan 2', 'Short desc 2', 'Long desc for testing 2');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active manually since plan_open has workspace issues
      planContextManager.setCurrentPlanId(planId);

      // Get the plan and set up architecture review state manually
      const showResult = planningService.showPlan(planId);
      assert.strictEqual(showResult.success, true, 'Should be able to show plan');
      if (showResult.plan) {
        // Directly set the plan state in memory without calling updatePlanDetails
        const planData = (planningService as any).plans.get(planId);
        if (planData) {
          planData.creationStep = 'architecture_review';
          planData.descriptionsReviewed = true;
          planData.architectureReviewed = true;
          planData.updatedAt = Date.now();
          (planningService as any).savePlan(planData);
        }
      }

      // Use direct tool instance instead of ToolsService to avoid workspace issues
      const planNeedWorksTool = new (require('../src/tools/planNeedWorks').PlanNeedWorksTool)();
      const toolResult = await planNeedWorksTool.execute({
        comments: ['Architecture needs improvement']
      }, testWorkspaceRoot);

      console.log('Tool execution result:', toolResult);
      assert.strictEqual(toolResult.success, true, 'Tool execution should succeed');

      // Verify plan state after need_works
      const updatedPlan = planningService.showPlan(planId);
      assert.strictEqual(updatedPlan.success, true, 'Updated plan should exist');
      assert.ok(updatedPlan.plan, 'Updated plan data should exist');
      console.log('Plan state after tool execution:', {
        needsWork: updatedPlan.plan.needsWork,
        descriptionsReviewed: updatedPlan.plan.descriptionsReviewed,
        architectureReviewed: updatedPlan.plan.architectureReviewed,
        creationStep: updatedPlan.plan.creationStep
      });

      // Verify legacy flag is set and appropriate workflow flags are reset
      assert.strictEqual(updatedPlan.plan.needsWork, true, 'Legacy needsWork flag should be true');
      assert.strictEqual(updatedPlan.plan.architectureReviewed, false, 'Architecture reviewed flag should be reset');
      // Description reviewed should remain true (previous step)
      assert.strictEqual(updatedPlan.plan.descriptionsReviewed, true, 'Description reviewed should remain true');
      
      console.log('✅ Direct tool execution test for need_works passed!');
    } finally {
      cleanupTest();
    }
  });
});
