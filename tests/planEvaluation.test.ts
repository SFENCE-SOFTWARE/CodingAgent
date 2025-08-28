// tests/planEvaluation.test.ts

import * as assert from 'assert';
import * as vscode from 'vscode';
import { PlanningService } from '../src/planningService';
import { PlanEvaluateTool } from '../src/tools/planEvaluate';

suite('Plan Evaluation Tests', () => {
  let planningService: PlanningService;
  let planEvaluateTool: PlanEvaluateTool;
  const testWorkspaceRoot = '/tmp/test-workspace';

  setup(() => {
    // Reset instances
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(testWorkspaceRoot);
    planEvaluateTool = new PlanEvaluateTool();
  });

  teardown(() => {
    PlanningService.resetInstance();
  });

  test('should detect incomplete plan - plan not reviewed', async () => {
    // Create a test plan
    const planId = 'test-plan-1';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    
    // Evaluate the plan (should fail on plan not reviewed)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'plan_review');
    assert.strictEqual(result.result?.reason, 'Plan has not been reviewed yet');
  // The prompt should instruct requesting the Plan Reviewer to perform a review
  assert.ok(result.result?.nextStepPrompt?.includes('Plan Reviewer') || result.result?.nextStepPrompt?.includes('review the plan'));
  });

  test('should detect incomplete plan - points not implemented', async () => {
    // Create a test plan
    const planId = 'test-plan-2';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Evaluate the plan (should fail on points not implemented)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'implementation');
    assert.strictEqual(result.result?.reason, 'Some plan points are not implemented');
  assert.ok(result.result?.failedPoints?.includes(pointId));
  assert.ok(result.result?.nextStepPrompt?.includes('Coder') || result.result?.nextStepPrompt?.includes('implement'));
  });

  test('should detect incomplete plan - points not reviewed', async () => {
    // Create a test plan
    const planId = 'test-plan-3';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
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
    assert.strictEqual(result.result?.reason, 'Some plan points are not reviewed');
  assert.ok(result.result?.failedPoints?.includes(pointId));
  assert.ok(result.result?.nextStepPrompt?.includes('Reviewer') || result.result?.nextStepPrompt?.includes('review'));
  });

  test('should detect incomplete plan - points not tested', async () => {
    // Create a test plan
    const planId = 'test-plan-4';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Review the point
    planningService.setReviewed(planId, pointId, 'Code looks good');
    
    // Evaluate the plan (should fail on points not tested)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'testing');
    assert.strictEqual(result.result?.reason, 'Some plan points are not tested');
  assert.ok(result.result?.failedPoints?.includes(pointId));
  assert.ok(result.result?.nextStepPrompt?.includes('Tester') || result.result?.nextStepPrompt?.includes('test'));
  });

  test('should detect incomplete plan - plan not accepted', async () => {
    // Create a test plan
    const planId = 'test-plan-5';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Review the point
    planningService.setReviewed(planId, pointId, 'Code looks good');
    
    // Test the point
    planningService.setTested(planId, pointId, 'Tests pass');
    
    // Evaluate the plan (should fail on plan not accepted)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'acceptance');
    assert.strictEqual(result.result?.reason, 'Plan has not been accepted yet');
    assert.ok(result.result?.nextStepPrompt?.includes('acceptance'));
  });

  test('should detect complete plan', async () => {
    // Create a test plan
    const planId = 'test-plan-6';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    const addResult = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    const pointId = addResult.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Implement the point
    planningService.setImplemented(planId, pointId);
    
    // Review the point
    planningService.setReviewed(planId, pointId, 'Code looks good');
    
    // Test the point
    planningService.setTested(planId, pointId, 'Tests pass');
    
    // Accept the plan
    planningService.setPlanAccepted(planId, 'All requirements met');
    
    // Evaluate the plan (should pass)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, true);
    assert.strictEqual(result.result?.failedStep, undefined);
    assert.strictEqual(result.result?.failedPoints, undefined);
    assert.strictEqual(result.result?.nextStepPrompt, undefined);
  });

  test('should generate correct prompts with placeholders replaced', async () => {
    // Create a test plan
    const planId = 'test-plan-7';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add multiple points
    const addResult1 = planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    const addResult2 = planningService.addPoint(planId, addResult1.pointId!, 'Point 2', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    const pointId1 = addResult1.pointId!;
    const pointId2 = addResult2.pointId!;
    
    // Review the plan
    planningService.setPlanReviewed(planId, 'Plan looks good');
    
    // Evaluate the plan (should fail on implementation)
    const result = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.isDone, false);
    assert.strictEqual(result.result?.failedStep, 'implementation');
    
    // Check that prompt contains both point IDs
    const prompt = result.result?.nextStepPrompt || '';
    assert.ok(prompt.includes(pointId1));
    assert.ok(prompt.includes(pointId2));
  assert.ok(prompt.includes('implement'));
  });

  test('should work via PlanEvaluateTool', async () => {
    // Create a test plan
    const planId = 'test-plan-8';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a point
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Acceptance criteria');
    
    // Execute via tool
    const result = await planEvaluateTool.execute({ plan_id: planId }, testWorkspaceRoot);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content?.includes('is not complete'));
    assert.ok(result.content?.includes('plan_review'));
    assert.ok(result.content?.includes('Plan has not been reviewed yet'));
  });
});
