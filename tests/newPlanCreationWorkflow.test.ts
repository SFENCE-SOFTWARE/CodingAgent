import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { PlanningService } from '../src/planningService';

suite('New Plan Creation Workflow Tests', () => {
  let planningService: PlanningService;
  const testWorkspaceRoot = '/tmp/new-plan-creation-test-workspace';

  setup(() => {
    // Ensure workspace directory exists
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }

    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(testWorkspaceRoot);
    
    // Clear any existing plans
    const plansResult = planningService.listPlans();
    if (plansResult.success && plansResult.plans) {
      plansResult.plans.forEach(plan => {
        planningService.deletePlan(plan.id, true);
      });
    }
  });

  teardown(() => {
    // Clean up test plans
    if (planningService) {
      const plansResult = planningService.listPlans();
      if (plansResult.success && plansResult.plans) {
        plansResult.plans.forEach(plan => {
          planningService.deletePlan(plan.id, true);
        });
      }
    }
  });

  test('should start with description update step for new plan', () => {
    // Create a new plan
    const createResult = planningService.createPlan('test-workflow-plan', 'Initial Name', 'Initial short', 'Initial long');
    assert.ok(createResult.success, 'Plan creation should succeed');

    // Evaluate new plan creation workflow
    const evaluationResult = planningService.evaluatePlanCreation('test-workflow-plan', 'Create a web server with REST API');
    
    assert.ok(evaluationResult.success, 'Evaluation should succeed');
    assert.ok(evaluationResult.result, 'Should return result');
    assert.strictEqual(evaluationResult.result.isDone, false, 'Plan creation should not be done');
    assert.strictEqual(evaluationResult.result.failedStep, 'plan_description_update', 'Should start with description update');
    assert.ok(evaluationResult.result.nextStepPrompt.includes('Update Plan Descriptions'), 'Should include description update prompt');
    assert.strictEqual(evaluationResult.result.recommendedMode, 'Architect', 'Should recommend Architect mode');
  });

  test('should proceed to description review after update', () => {
    // Create plan
    planningService.createPlan('test-review-plan', 'Test Plan', 'Test description', 'Detailed description');
    
    // First evaluation - should be description update
    const eval1 = planningService.evaluatePlanCreation('test-review-plan', 'Create a web server');
    assert.ok(eval1.success);
    assert.ok(eval1.result);
    assert.strictEqual(eval1.result.failedStep, 'plan_description_update');
    
    // Simulate completing description update
    assert.ok(eval1.result.doneCallback);
    eval1.result.doneCallback!(true, 'Descriptions updated');
    
    // Second evaluation - should move to description review
    const eval2 = planningService.evaluatePlanCreation('test-review-plan', 'Create a web server');
    assert.ok(eval2.success);
    assert.ok(eval2.result);
    assert.strictEqual(eval2.result.failedStep, 'plan_description_review', 'Should move to description review');
    assert.ok(eval2.result.nextStepPrompt.includes('Review Plan Descriptions'), 'Should include review prompt');
    assert.strictEqual(eval2.result.recommendedMode, 'Plan Reviewer', 'Should recommend Plan Reviewer mode');
  });

  test('should proceed through checklist items for description review', () => {
    // Create plan
    planningService.createPlan('test-checklist-plan', 'Test Plan', 'Test description', 'Detailed description');
    
    // Complete description update step first
    const eval1 = planningService.evaluatePlanCreation('test-checklist-plan', 'Create a web server');
    assert.ok(eval1.success && eval1.result?.doneCallback);
    eval1.result.doneCallback(true, 'Description updated');
    
    // Now should be in description review - get first checklist item
    const eval2 = planningService.evaluatePlanCreation('test-checklist-plan', 'Create a web server');
    assert.ok(eval2.success);
    assert.ok(eval2.result?.doneCallback);
    
    // Simulate completing first checklist item
    eval2.result.doneCallback!(true, 'First item completed');
    
    // Third evaluation - should get second checklist item or proceed to next step
    const eval3 = planningService.evaluatePlanCreation('test-checklist-plan', 'Create a web server');
    assert.ok(eval3.success);
    
    // The result should either have another checklist item or move to architecture creation
    const isStillInReview = eval3.result?.failedStep === 'plan_description_review';
    const movedToArchitecture = eval3.result?.failedStep === 'plan_architecture_creation';
    
    assert.ok(isStillInReview || movedToArchitecture, 'Should either continue review or move to architecture');
  });

  test('should proceed to architecture creation after description review', () => {
    // Create plan
    planningService.createPlan('test-arch-plan', 'Test Plan', 'Test description', 'Detailed description');
    
    // Complete description update step
    const eval1 = planningService.evaluatePlanCreation('test-arch-plan', 'Create a web server');
    assert.ok(eval1.success && eval1.result?.doneCallback);
    eval1.result.doneCallback(true, 'Description updated');
    
    // Complete all description review checklist items
    let currentEval = planningService.evaluatePlanCreation('test-arch-plan', 'Create a web server');
    while (currentEval.success && currentEval.result?.failedStep === 'plan_description_review') {
      assert.ok(currentEval.result.doneCallback);
      currentEval.result.doneCallback(true, 'Checklist item completed');
      currentEval = planningService.evaluatePlanCreation('test-arch-plan', 'Create a web server');
    }
    
    // Should now be in architecture creation
    assert.ok(currentEval.success);
    assert.ok(currentEval.result);
    assert.strictEqual(currentEval.result.failedStep, 'plan_architecture_creation', 'Should move to architecture creation');
    assert.ok(currentEval.result.nextStepPrompt.includes('Create Architecture Design'), 'Should include architecture prompt');
    assert.strictEqual(currentEval.result.recommendedMode, 'Architect', 'Should recommend Architect mode');
  });

  test('should validate architecture JSON format', () => {
    // Create plan and complete prerequisite steps
    planningService.createPlan('test-validation-plan', 'Test Plan', 'Test', 'Detailed');
    
    // Complete description steps
    let currentEval = planningService.evaluatePlanCreation('test-validation-plan', 'Create a web server');
    while (currentEval.success && currentEval.result?.failedStep?.startsWith('plan_description_')) {
      assert.ok(currentEval.result.doneCallback);
      currentEval.result.doneCallback(true, 'Step completed');
      currentEval = planningService.evaluatePlanCreation('test-validation-plan', 'Create a web server');
    }
    
    // Should be in architecture creation - set invalid architecture
    assert.strictEqual(currentEval.result?.failedStep, 'plan_architecture_creation');
    planningService.setArchitecture('test-validation-plan', '{"invalid": "json without required fields"}');
    assert.ok(currentEval.result?.doneCallback);
    currentEval.result.doneCallback(true, 'Architecture created');
    
    // Next evaluation should detect validation issues
    const evaluationResult = planningService.evaluatePlanCreation('test-validation-plan', 'Create a web server');
    
    assert.ok(evaluationResult.success);
    assert.ok(evaluationResult.result);
    assert.strictEqual(evaluationResult.result.failedStep, 'plan_architecture_rework', 'Should require architecture rework');
    assert.ok(evaluationResult.result.nextStepPrompt.includes('validation issues'), 'Should mention validation issues');
  });

  test('should proceed to architecture review with valid architecture', () => {
    // Create plan and complete prerequisite steps
    planningService.createPlan('test-arch-review-plan', 'Test Plan', 'Test', 'Detailed');
    
    // Complete description steps
    let currentEval = planningService.evaluatePlanCreation('test-arch-review-plan', 'Create a web server');
    while (currentEval.success && currentEval.result?.failedStep?.startsWith('plan_description_')) {
      assert.ok(currentEval.result?.doneCallback);
      currentEval.result.doneCallback(true, 'Step completed');
      currentEval = planningService.evaluatePlanCreation('test-arch-review-plan', 'Create a web server');
    }
    
    // Should be in architecture creation - create valid architecture
    assert.strictEqual(currentEval.result?.failedStep, 'plan_architecture_creation');
    const validArchitecture = JSON.stringify({
      components: [
        { id: 'web-server', name: 'Web Server', type: 'service', description: 'Main server' }
      ],
      connections: []
    });
    planningService.setArchitecture('test-arch-review-plan', validArchitecture);
    assert.ok(currentEval.result?.doneCallback);
    currentEval.result.doneCallback(true, 'Architecture created');
    
    // Next evaluation should move to architecture review
    const evaluationResult = planningService.evaluatePlanCreation('test-arch-review-plan', 'Create a web server');
    
    assert.ok(evaluationResult.success);
    assert.ok(evaluationResult.result);
    assert.strictEqual(evaluationResult.result.failedStep, 'plan_architecture_review', 'Should move to architecture review');
    assert.ok(evaluationResult.result.nextStepPrompt.includes('Review Architecture Design'), 'Should include review prompt');
    assert.strictEqual(evaluationResult.result.recommendedMode, 'Plan Reviewer', 'Should recommend Plan Reviewer mode');
  });

  test('should proceed to points creation after architecture review', () => {
    // Create plan and complete all prerequisite steps
    planningService.createPlan('test-points-plan', 'Test Plan', 'Test', 'Detailed');
    
    // Complete description steps
    let currentEval = planningService.evaluatePlanCreation('test-points-plan', 'Create a web server');
    while (currentEval.success && currentEval.result?.failedStep?.startsWith('plan_description_')) {
      assert.ok(currentEval.result?.doneCallback);
      currentEval.result.doneCallback(true, 'Step completed');
      currentEval = planningService.evaluatePlanCreation('test-points-plan', 'Create a web server');
    }
    
    // Complete architecture creation
    const validArch = JSON.stringify({ components: [{ id: 'web-server', name: 'Web Server' }], connections: [] });
    planningService.setArchitecture('test-points-plan', validArch);
    assert.ok(currentEval.result?.doneCallback);
    currentEval.result.doneCallback(true, 'Architecture created');
    
    // Complete architecture review
    currentEval = planningService.evaluatePlanCreation('test-points-plan', 'Create a web server');
    while (currentEval.success && currentEval.result?.failedStep === 'plan_architecture_review') {
      assert.ok(currentEval.result.doneCallback);
      currentEval.result.doneCallback(true, 'Review item completed');
      currentEval = planningService.evaluatePlanCreation('test-points-plan', 'Create a web server');
    }
    
    // Should now be in points creation
    assert.ok(currentEval.success);
    assert.ok(currentEval.result);
    assert.strictEqual(currentEval.result.failedStep, 'plan_points_creation', 'Should move to points creation');
    assert.ok(currentEval.result.nextStepPrompt.includes('Create Implementation Points'), 'Should include points prompt');
    assert.strictEqual(currentEval.result.recommendedMode, 'Architect', 'Should recommend Architect mode');
  });

  test('should validate plan points procedurally', () => {
    // Create plan and complete all prerequisite steps
    planningService.createPlan('test-points-validation', 'Test Plan', 'Test', 'Detailed');
    
    // Complete all steps until points creation
    let currentEval = planningService.evaluatePlanCreation('test-points-validation', 'Create a web server');
    while (currentEval.success && currentEval.result && !currentEval.result.isDone) {
      if (currentEval.result.failedStep === 'plan_points_creation') {
        break;
      }
      if (currentEval.result.failedStep?.startsWith('plan_architecture_creation')) {
        const validArch = JSON.stringify({ components: [{ id: 'web-server', name: 'Web Server' }], connections: [] });
        planningService.setArchitecture('test-points-validation', validArch);
      }
      assert.ok(currentEval.result.doneCallback);
      currentEval.result.doneCallback(true, 'Step completed');
      currentEval = planningService.evaluatePlanCreation('test-points-validation', 'Create a web server');
    }
    
    // Add invalid point (missing expected_inputs)
    planningService.addPoints('test-points-validation', null, [{
      short_name: 'Test Point',
      short_description: 'Test point',
      detailed_description: 'Detailed description',
      review_instructions: 'Review',
      testing_instructions: 'Test',
      expected_outputs: 'Output',
      expected_inputs: '', // Missing - should cause validation error
      depends_on: []
    }]);
    
    // Mark points as created and evaluate
    assert.ok(currentEval.result?.doneCallback);
    currentEval.result.doneCallback(true, 'Points created');
    
    // Should detect procedural validation issues
    const evaluationResult = planningService.evaluatePlanCreation('test-points-validation', 'Create a web server');
    
    assert.ok(evaluationResult.success);
    assert.ok(evaluationResult.result);
    assert.strictEqual(evaluationResult.result.failedStep, 'plan_points_rework', 'Should require points rework');
    assert.ok(evaluationResult.result.nextStepPrompt.includes('fix this issue'), 'Should mention validation issues');
  });

  test('should complete workflow when everything is valid', () => {
    // Create plan and complete all steps
    planningService.createPlan('test-complete-plan', 'Complete Plan', 'Complete test', 'Detailed complete test');
    
    // Complete all steps until points creation
    let currentEval = planningService.evaluatePlanCreation('test-complete-plan', 'Create a web server');
    while (currentEval.success && currentEval.result && !currentEval.result.isDone) {
      if (currentEval.result.failedStep === 'plan_points_creation') {
        break;
      }
      if (currentEval.result.failedStep?.startsWith('plan_architecture_creation')) {
        const validArch = JSON.stringify({ components: [{ id: 'web-server', name: 'Web Server' }], connections: [] });
        planningService.setArchitecture('test-complete-plan', validArch);
      }
      assert.ok(currentEval.result.doneCallback);
      currentEval.result.doneCallback(true, 'Step completed');
      currentEval = planningService.evaluatePlanCreation('test-complete-plan', 'Create a web server');
    }
    
    // Add valid point
    planningService.addPoints('test-complete-plan', null, [{
      short_name: 'Create Server',
      short_description: 'Create the web server',
      detailed_description: 'Create a simple web server using Node.js',
      review_instructions: 'Check server implementation',
      testing_instructions: 'Test server endpoints',
      expected_outputs: 'Working web server',
      expected_inputs: 'Node.js runtime',
      depends_on: ['-1'] // Independent point
    }]);
    
    // Mark points as created
    assert.ok(currentEval.result?.doneCallback);
    currentEval.result.doneCallback(true, 'Points created');
    
    // Final evaluation - should be complete
    const evaluationResult = planningService.evaluatePlanCreation('test-complete-plan', 'Create a web server');
    
    assert.ok(evaluationResult.success);
    assert.ok(evaluationResult.result);
    assert.strictEqual(evaluationResult.result.isDone, true, 'Plan creation should be done');
    assert.ok(evaluationResult.result.nextStepPrompt.includes('COMPLETED SUCCESSFULLY'), 'Should show completion message');
    
    // Check that plan step is marked as complete
    const finalPlanResult = planningService.showPlan('test-complete-plan');
    assert.ok(finalPlanResult.success && finalPlanResult.plan);
    assert.strictEqual(finalPlanResult.plan.creationStep, 'complete', 'Plan creation step should be complete');
  });

  test('should store original request in plan', () => {
    // Create plan
    planningService.createPlan('test-request-plan', 'Test Plan', 'Test', 'Detailed');
    
    // Evaluate with original request
    const originalRequest = 'Create a comprehensive web application with authentication';
    const evaluationResult = planningService.evaluatePlanCreation('test-request-plan', originalRequest);
    
    assert.ok(evaluationResult.success);
    
    // Check that original request was stored
    const planResult = planningService.showPlan('test-request-plan');
    assert.ok(planResult.success && planResult.plan);
    assert.strictEqual(planResult.plan.originalRequest, originalRequest, 'Should store original request');
  });
});
