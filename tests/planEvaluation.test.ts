// tests/planEvaluation.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { PlanEvaluateTool } from '../src/tools/planEvaluate';

suite('Plan Evaluation Tests', () => {
  let testWorkspaceRoot: string;
  let planningService: PlanningService;
  let planEvaluateTool: PlanEvaluateTool;

  setup(() => {
    // Create a unique temporary directory for each test
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-evaluation-test-'));
    
    // Reset the singleton instance before each test
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(testWorkspaceRoot);
    planEvaluateTool = new PlanEvaluateTool();
  });

  teardown(() => {
    PlanningService.resetInstance();
  });

  test('should detect plan rework as highest priority', async () => {
    // Create a test plan
    const planId = 'test-plan-rework';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Set plan to need rework (highest priority) with array of comments
    planningService.setPlanNeedsWork(planId, ['Architecture needs major revision']);
    
    // Evaluate the plan
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'plan_rework');
    assert.strictEqual(result.result?.reason, 'Architecture needs major revision');
    assert.ok(result.result?.nextStepPrompt?.includes('Plan needs rework'));
  });

  test('should detect incomplete plan - plan not reviewed', async () => {
    // Create a test plan
    const planId = 'test-plan-1';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Set point as independent (no dependencies)
    planningService.setPointDependencies(planId, pointId, ['-1'], []);
    
    // Evaluate the plan (should fail on plan not reviewed)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'plan_review');
    assert.strictEqual(result.result?.reason, 'Plan review checklist in progress');
    
    // The prompt should provide a specific checklist item for review
    assert.ok(result.result?.nextStepPrompt, 'Should have a next step prompt');
    assert.ok(result.result?.nextStepPrompt?.includes('Point') || result.result?.nextStepPrompt?.includes('Plan:'), 'Should provide specific checklist item');
  });

  test('should detect incomplete plan - points need rework', async () => {
    // Create a test plan
    const planId = 'test-plan-rework';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Mark point as needing rework
    planningService.setNeedRework(planId, pointId, 'Implementation needs improvement');
    
    // Evaluate the plan (should fail on points needing rework)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'rework');
    assert.strictEqual(result.result?.reason, `Plan point ${pointId} needs rework`);
    assert.ok(result.result?.failedPoints?.includes(pointId));
    assert.ok(result.result?.nextStepPrompt?.includes('rework'));
  });

  test('should detect incomplete plan - points not implemented', async () => {
    // Create a test plan
    const planId = 'test-plan-2';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Evaluate the plan (should fail on points not implemented)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'implementation');
    assert.strictEqual(result.result?.reason, `Plan point ${pointId} is not implemented`);
    assert.ok(result.result?.failedPoints?.includes(pointId));
    assert.ok(result.result?.nextStepPrompt?.includes('implement'));
  });

  test('should detect incomplete plan - points not reviewed', async () => {
    // Create a test plan
    const planId = 'test-plan-3';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Evaluate the plan (should fail on points not reviewed)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'code_review');
    assert.strictEqual(result.result?.reason, `Plan point ${pointId} is not reviewed`);
    assert.ok(result.result?.failedPoints?.includes(pointId));
    assert.ok(result.result?.nextStepPrompt?.includes('review'));
  });

  test('should detect incomplete plan - points not tested', async () => {
    // Create a test plan
    const planId = 'test-plan-4';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Review the point
    planningService.setReviewed(planId, pointId, 'Implementation looks good');
    
    // Evaluate the plan (should fail on points not tested)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'testing');
    assert.strictEqual(result.result?.reason, `Plan point ${pointId} is not tested`);
    assert.ok(result.result?.failedPoints?.includes(pointId));
    assert.ok(result.result?.nextStepPrompt?.includes('test'));
  });

  test('should detect incomplete plan - plan not accepted', async () => {
    // Create a test plan
    const planId = 'test-plan-5';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Review the point
    planningService.setReviewed(planId, pointId, 'Implementation looks good');
    
    // Test the point
    planningService.setTested(planId, pointId, 'All tests pass');
    
    // Evaluate the plan (should fail on plan not accepted)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'acceptance');
    assert.strictEqual(result.result?.reason, 'Plan has not been accepted yet');
    assert.ok(result.result?.nextStepPrompt?.includes('accept'));
  });

  test('should detect complete plan', async () => {
    // Create a test plan
    const planId = 'test-plan-complete';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Review the point
    planningService.setReviewed(planId, pointId, 'Implementation looks good');
    
    // Test the point
    planningService.setTested(planId, pointId, 'All tests pass');
    
    // Accept the plan
    planningService.setPlanAccepted(planId, 'Plan is complete and ready');
    
    // Evaluate the plan (should be complete)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, true);
    assert.ok(result.result?.nextStepPrompt?.includes('done') || result.result?.nextStepPrompt?.includes('complete'));
  });

  test('should prioritize implementation over review/testing for non-implemented points', async () => {
    // Create a test plan
    const planId = 'test-plan-priority';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add two points
    const addResult1 = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId1 = addResult1.pointId!;
    const addResult2 = planningService.addPoint(planId, pointId1, 'Point 2', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Coder');
    const pointId2 = addResult2.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement only the first point
    planningService.setImplemented(planId, pointId1);
    
    // Evaluate the plan (should prioritize review of implemented point over implementation of other points)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'code_review');
    assert.ok(result.result?.failedPoints?.includes(pointId1));
    assert.ok(result.result?.nextStepPrompt?.includes('review') || result.result?.nextStepPrompt?.includes('reviewed'));
  });

  test('should generate correct prompts with placeholders replaced', async () => {
    // Create a test plan
    const planId = 'test-plan-prompts';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Evaluate the plan (should fail on implementation)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'implementation');
    
    // Check that placeholders are replaced in prompts
    assert.ok(result.result?.nextStepPrompt?.includes(pointId));
    assert.ok(!result.result?.nextStepPrompt?.includes('<point_id>'));
  });

  test('should work via PlanEvaluateTool', async () => {
    // Create a test plan
    const planId = 'test-plan-tool';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Set plan context
    const planContextManager = PlanContextManager.getInstance();
    planContextManager.setCurrentPlanId(planId);
    
    // Add a point
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria', 'Expected outputs', 'Expected inputs');
    
    // Execute the tool
    const result = await planEvaluateTool.execute({}, testWorkspaceRoot);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('Plan Evaluation'));
    assert.ok(result.content.includes('IN PROGRESS'));
    
    // Check that the evaluation is included in the result
    const anyResult = result as any;
    assert.ok(anyResult.evaluation);
    assert.strictEqual(anyResult.evaluation.isDone, false);
  });
});
