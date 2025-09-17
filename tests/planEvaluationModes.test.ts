// tests/planEvaluationModes.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PlanningService } from '../src/planningService';

suite('Plan Evaluation Mode Recommendations', () => {
  let testWorkspaceRoot: string;
  let planningService: PlanningService;

  setup(() => {
    // Create a unique temporary directory for each test
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-evaluation-modes-test-'));
    
    // Reset the singleton instance before each test
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(testWorkspaceRoot);
  });

  teardown(() => {
    PlanningService.resetInstance();
  });

  test('should return recommended modes for different plan states', () => {
    // Create a test plan
    const planId = 'test-plan-modes';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a test point
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    
    // Test plan review state
    const result1 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result1.success, true);
    assert.strictEqual(result1.result?.failedStep, 'plan_review');
    assert.ok(result1.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result1.result?.recommendedMode, 'string');
    
    // Review plan and test implementation state
    planningService.setPlanReviewed(planId, 'Plan reviewed');
    const result2 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.result?.failedStep, 'implementation');
    assert.ok(result2.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result2.result?.recommendedMode, 'string');
    
    // Set implemented and test review state
    planningService.setImplemented(planId, '1');
    const result3 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result3.success, true);
    assert.strictEqual(result3.result?.failedStep, 'code_review');
    assert.ok(result3.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result3.result?.recommendedMode, 'string');
    
    // Set reviewed and test testing state
    planningService.setReviewed(planId, '1', 'Code looks good');
    const result4 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result4.success, true);
    assert.strictEqual(result4.result?.failedStep, 'testing');
    assert.ok(result4.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result4.result?.recommendedMode, 'string');
    
    // Set tested and test acceptance state
    planningService.setTested(planId, '1', 'Tests pass');
    const result5 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result5.success, true);
    assert.strictEqual(result5.result?.failedStep, 'acceptance');
    assert.ok(result5.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result5.result?.recommendedMode, 'string');
    
    // Set accepted - plan should be done
    planningService.setPlanAccepted(planId, 'Plan is ready');
    const result6 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result6.success, true);
    assert.strictEqual(result6.result?.isDone, true);
    // Done state should have empty recommendedMode
    assert.strictEqual(result6.result?.recommendedMode, '');
  });

  test('should return recommended mode for plan rework state', () => {
    // Create a test plan
    const planId = 'test-plan-rework-mode';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Set plan to need rework
    planningService.setPlanNeedsWork(planId, ['Architecture needs revision']);
    
    // Test plan rework state
    const result = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.failedStep, 'plan_rework');
    assert.ok(result.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result.result?.recommendedMode, 'string');
  });

  test('should return recommended mode for point rework state', () => {
    // Create a test plan
    const planId = 'test-point-rework-mode';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add and review plan
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    planningService.setPlanReviewed(planId, 'Plan reviewed');
    
    // Set point to need rework
    planningService.setNeedRework(planId, '1', 'Implementation needs improvement');
    
    // Test point rework state
    const result = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.failedStep, 'rework');
    assert.ok(result.result?.recommendedMode); // Should have a recommended mode
    assert.strictEqual(typeof result.result?.recommendedMode, 'string');
  });
});
