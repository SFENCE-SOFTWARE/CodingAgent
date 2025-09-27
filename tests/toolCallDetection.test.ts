// Tool Call Detection Test

import * as assert from 'assert';
import * as fs from 'fs';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { PlanChangeTool } from '../src/tools/planChange';
import { PlanSetArchitectureTool } from '../src/tools/planSetArchitecture';
import { PlanAddPointsTool } from '../src/tools/planAddPoints';

// Mock vscode BEFORE any imports
const testWorkspaceRoot = '/tmp/test-tool-call-detection';
const mockVscode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: testWorkspaceRoot } }],
    getConfiguration: () => ({
      get: (key: string, defaultValue: any) => defaultValue
    })
  }
};
(global as any).vscode = mockVscode;

suite('Tool Call Detection Tests', () => {
  let planningService: PlanningService;
  let planContextManager: PlanContextManager;

  function setupTest() {
    // Clean setup
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceRoot, { recursive: true });

    // Ensure vscode mock is properly set
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

  test('plan_change tool should set planChangeToolCalled flag', async () => {
    setupTest();
    
    try {
      // Create test plan
      const planId = 'tool-call-test-plan-change';
      const createResult = planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc for testing');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active
      planContextManager.setCurrentPlanId(planId);

      // Get initial state
      const initialPlan = planningService.showPlan(planId);
      assert.strictEqual(initialPlan.success, true);
      assert.strictEqual(initialPlan.plan?.planChangeToolCalled, false, 'Flag should be false initially');

      // Execute plan_change tool
      const planChangeTool = new PlanChangeTool();
      const toolResult = await planChangeTool.execute({
        short_description: 'Updated description'
      }, testWorkspaceRoot);

      assert.strictEqual(toolResult.success, true, 'Tool execution should succeed');

      // Verify flag is set
      const updatedPlan = planningService.showPlan(planId);
      assert.strictEqual(updatedPlan.success, true);
      assert.strictEqual(updatedPlan.plan?.planChangeToolCalled, true, 'planChangeToolCalled flag should be set');
      assert.ok(updatedPlan.plan?.lastToolCallTimestamp, 'lastToolCallTimestamp should be set');

      // Verify evaluateCompletionCallback detects the flag
      const callbackResult = (planningService as any).evaluateCompletionCallback('plan.planChangeToolCalled', planId);
      assert.strictEqual(callbackResult, true, 'Completion callback should return true');

      console.log('✅ plan_change tool call detection test passed!');
    } finally {
      cleanupTest();
    }
  });

  test('plan_set_architecture tool should set setArchitectureToolCalled flag', async () => {
    setupTest();
    
    try {
      // Create test plan
      const planId = 'tool-call-test-architecture';
      const createResult = planningService.createPlan(planId, 'Test Plan 2', 'Short desc 2', 'Long desc 2');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active
      planContextManager.setCurrentPlanId(planId);

      // Get initial state
      const initialPlan = planningService.showPlan(planId);
      assert.strictEqual(initialPlan.success, true);
      assert.strictEqual(initialPlan.plan?.setArchitectureToolCalled, false, 'Flag should be false initially');

      // Execute plan_set_architecture tool
      const setArchTool = new PlanSetArchitectureTool();
      const toolResult = await setArchTool.execute({
        architecture: '{"components": ["web", "api", "database"], "connections": [{"from": "web", "to": "api"}]}'
      }, testWorkspaceRoot);

      assert.strictEqual(toolResult.success, true, 'Tool execution should succeed');

      // Verify flag is set
      const updatedPlan = planningService.showPlan(planId);
      assert.strictEqual(updatedPlan.success, true);
      assert.strictEqual(updatedPlan.plan?.setArchitectureToolCalled, true, 'setArchitectureToolCalled flag should be set');
      assert.ok(updatedPlan.plan?.lastToolCallTimestamp, 'lastToolCallTimestamp should be set');

      // Verify evaluateCompletionCallback detects the flag
      const callbackResult = (planningService as any).evaluateCompletionCallback('plan.setArchitectureToolCalled', planId);
      assert.strictEqual(callbackResult, true, 'Completion callback should return true');

      console.log('✅ plan_set_architecture tool call detection test passed!');
    } finally {
      cleanupTest();
    }
  });

  test('plan_add_points tool should set pointsToolsCalled flag', async () => {
    setupTest();
    
    try {
      // Create test plan
      const planId = 'tool-call-test-points';
      const createResult = planningService.createPlan(planId, 'Test Plan 3', 'Short desc 3', 'Long desc 3');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Set the plan as active
      planContextManager.setCurrentPlanId(planId);

      // Get initial state
      const initialPlan = planningService.showPlan(planId);
      assert.strictEqual(initialPlan.success, true);
      assert.strictEqual(initialPlan.plan?.pointsToolsCalled, false, 'Flag should be false initially');

      // Execute plan_add_points tool
      const addPointsTool = new PlanAddPointsTool();
      const toolResult = await addPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'Test description',
          detailed_description: 'Detailed test description',
          review_instructions: 'Review instructions',
          testing_instructions: 'Testing instructions',
          expected_outputs: 'Expected outputs',
          expected_inputs: 'Expected inputs',
          depends_on: ['-1'],
          care_on: []
        }]
      }, testWorkspaceRoot);

      assert.strictEqual(toolResult.success, true, 'Tool execution should succeed');

      // Verify flag is set
      const updatedPlan = planningService.showPlan(planId);
      assert.strictEqual(updatedPlan.success, true);
      assert.strictEqual(updatedPlan.plan?.pointsToolsCalled, true, 'pointsToolsCalled flag should be set');
      assert.ok(updatedPlan.plan?.lastToolCallTimestamp, 'lastToolCallTimestamp should be set');

      // Verify evaluateCompletionCallback detects the flag
      const callbackResult = (planningService as any).evaluateCompletionCallback('plan.pointsToolsCalled', planId);
      assert.strictEqual(callbackResult, true, 'Completion callback should return true');

      console.log('✅ plan_add_points tool call detection test passed!');
    } finally {
      cleanupTest();
    }
  });

  test('clearToolCallFlags should reset all flags', async () => {
    setupTest();
    
    try {
      // Create test plan
      const planId = 'tool-call-test-clear';
      const createResult = planningService.createPlan(planId, 'Test Plan 4', 'Short desc 4', 'Long desc 4');
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');

      // Manually set all flags
      planningService.markPlanChangeToolCalled(planId);
      planningService.markSetArchitectureToolCalled(planId);
      planningService.markPointsToolsCalled(planId);

      // Verify all flags are set
      let plan = planningService.showPlan(planId);
      assert.strictEqual(plan.success, true);
      assert.strictEqual(plan.plan?.planChangeToolCalled, true);
      assert.strictEqual(plan.plan?.setArchitectureToolCalled, true);
      assert.strictEqual(plan.plan?.pointsToolsCalled, true);
      assert.ok(plan.plan?.lastToolCallTimestamp);

      // Clear flags
      planningService.clearToolCallFlags(planId);

      // Verify all flags are cleared
      plan = planningService.showPlan(planId);
      assert.strictEqual(plan.success, true);
      assert.strictEqual(plan.plan?.planChangeToolCalled, false);
      assert.strictEqual(plan.plan?.setArchitectureToolCalled, false);
      assert.strictEqual(plan.plan?.pointsToolsCalled, false);
      assert.strictEqual(plan.plan?.lastToolCallTimestamp, undefined);

      console.log('✅ clearToolCallFlags test passed!');
    } finally {
      cleanupTest();
    }
  });
});
