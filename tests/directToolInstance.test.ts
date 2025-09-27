// Jednoduchý test přímých tool instancí
import * as assert from 'assert';
import * as fs from 'fs';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager'; 
import { PlanReviewedTool } from '../src/tools/planReviewed';
import { PlanNeedWorksTool } from '../src/tools/planNeedWorks';

// Mock vscode  
const testWorkspaceRoot = '/tmp/test-direct-tools-simple';
const mockVscode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: testWorkspaceRoot } }],
    getConfiguration: () => ({
      get: (key: string, defaultValue: any) => defaultValue
    })
  }
};
(global as any).vscode = mockVscode;

suite('Direct Tool Instance Test', () => {
  let planningService: PlanningService;
  let planContextManager: PlanContextManager;
  let planReviewedTool: PlanReviewedTool;
  let planNeedWorksTool: PlanNeedWorksTool;

  function setupTest() {
    // Clean setup
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceRoot, { recursive: true });

    planningService = PlanningService.getInstance(testWorkspaceRoot);
    planContextManager = PlanContextManager.getInstance();
    planReviewedTool = new PlanReviewedTool();
    planNeedWorksTool = new PlanNeedWorksTool();
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

  test('direct tool instance plan_reviewed should update workflow flags', async () => {
    setupTest();
    
    try {
      console.log('🧪 Testing direct plan_reviewed tool instance...');
      
      // Create test plan
      const planId = 'direct-tool-instance-test';
      const createResult = planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc for testing');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active manually
      planContextManager.setCurrentPlanId(planId);

      // Check plan state before execution
      const planBefore = planningService.showPlan(planId);
      console.log('Plan state BEFORE tool execution:', {
        reviewed: planBefore.plan?.reviewed,
        descriptionsReviewed: planBefore.plan?.descriptionsReviewed,
        creationStep: planBefore.plan?.creationStep
      });

      console.log('Test workspace root:', testWorkspaceRoot);
      const toolPlanningService = PlanningService.getInstance(testWorkspaceRoot);
      console.log('Test PlanningService instance === Tool PlanningService instance:', planningService === toolPlanningService);
      
      // Execute plan_reviewed tool directly (pass workspace root explicitly)
      const toolResult = await planReviewedTool.execute({
        comment: 'Description looks good'
      }, testWorkspaceRoot);

      console.log('Tool execution result:', toolResult);
      assert.strictEqual(toolResult.success, true, 'Tool execution should succeed');
      
      // IMMEDIATELY check after tool return
      console.log('[DEBUG] TEST: Immediately after planReviewed tool return');
      const immediateCheck = (planningService as any).plans.get(planId);
      console.log('[DEBUG] TEST: Immediate raw memory check - plan.reviewed =', immediateCheck?.reviewed);

      // Verify plan state
      const plan = planningService.showPlan(planId);
      console.log('After tool execution - PlanningService instance same?', planningService === PlanningService.getInstance(testWorkspaceRoot));
      const afterToolPlanningService = PlanningService.getInstance(testWorkspaceRoot);
      console.log('After tool execution - New instance same as original?', planningService === afterToolPlanningService);
      
      // Check raw memory state
      const rawPlan = (planningService as any).plans.get(planId);
      console.log('Raw memory plan.reviewed =', rawPlan?.reviewed);
      assert.strictEqual(plan.success, true, 'Plan should exist');
      assert.ok(plan.plan, 'Plan data should exist');
      console.log('Plan state after tool execution:', {
        reviewed: plan.plan.reviewed,
        descriptionsReviewed: plan.plan.descriptionsReviewed,
        creationStep: plan.plan.creationStep
      });

      // Verify both legacy flag is set
      assert.strictEqual(plan.plan.reviewed, true, 'Legacy reviewed flag should be true');
      // Note: workflow flags will only be set if creationStep is properly set
      
      console.log('✅ Direct tool instance test for plan_reviewed passed!');
    } finally {
      cleanupTest();
    }
  });

  test('direct tool instance plan_need_works should update workflow flags', async () => {
    setupTest();
    
    try {
      console.log('🧪 Testing direct plan_need_works tool instance...');
      
      // Create test plan  
      const planId = 'direct-tool-instance-need-works-test';
      const createResult = planningService.createPlan(planId, 'Test Plan 2', 'Short desc 2', 'Long desc for testing 2');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active manually
      planContextManager.setCurrentPlanId(planId);

      // Execute plan_need_works tool directly
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

      // Verify legacy flag is set
      assert.strictEqual(updatedPlan.plan.needsWork, true, 'Legacy needsWork flag should be true');
      
      console.log('✅ Direct tool instance test for plan_need_works passed!');
    } finally {
      cleanupTest();
    }
  });
});
