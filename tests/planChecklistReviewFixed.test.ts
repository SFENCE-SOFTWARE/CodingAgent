// tests/planChecklistReviewFixed.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock vscode module
const mockConfig = {
  get: (key: string, defaultValue?: any) => {
    const configs: { [key: string]: any } = {
      'reviewChecklistForPoints': '* Check that point has clear acceptance criteria.\n* Verify point has expected outputs defined.',
      'reviewChecklistForPlan': '* Verify all points are logically ordered.\n* Check that plan has clear overall structure.',
      'recommendedModePlanReview': 'Plan Reviewer',
      'promptPlanReview': 'Plan needs to be reviewed. Ask Plan Reviewer via call_under_mode to review the current plan and mark it as reviewed or as needs rework.'
    };
    return configs[key] !== undefined ? configs[key] : defaultValue;
  }
};

const mockVscode = {
  workspace: {
    getConfiguration: (section?: string) => {
      if (section === 'codingagent.plan') {
        return mockConfig;
      }
      return mockConfig;
    }
  }
};

// Mock the module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

import { PlanningService } from '../src/planningService';

suite('Plan Checklist Review Tests (Fixed)', () => {
  let testWorkspaceRoot: string;
  let planningService: PlanningService;

  setup(() => {
    // Create a unique temporary directory for each test
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-checklist-test-'));
    
    // Reset the singleton instance before each test
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(testWorkspaceRoot);
  });

  teardown(() => {
    PlanningService.resetInstance();
    // Clean up the temporary directory
    if (testWorkspaceRoot && fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
  });

  suiteTeardown(() => {
    // Restore original require
    Module.prototype.require = originalRequire;
  });

  test('should initialize checklist for plan review', () => {
    // Create a test plan with 2 points
    const planId = 'test-checklist-plan';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');
    planningService.addPoint(planId, '1', 'Point 2', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');
    
    // Set dependencies so plan passes structure validation
    planningService.setPointDependencies(planId, '1', ['-1'], []); // Point 1 is independent
    planningService.setPointDependencies(planId, '2', ['1'], []);  // Point 2 depends on Point 1
    
    // Mark all points as implemented so we get to the review step
    planningService.setImplemented(planId, '1');
    planningService.setImplemented(planId, '2');

    // Evaluate plan - this should initialize checklist
    const evaluation = planningService.evaluatePlanCompletion(planId);
    
    assert.strictEqual(evaluation.success, true);
    assert.strictEqual(evaluation.result?.isDone, false);
    assert.strictEqual(evaluation.result?.failedStep, 'plan_review');
    
    // Should have a doneCallback
    assert.ok(evaluation.result?.doneCallback, 'Should have doneCallback for checklist processing');
    
    // Check that checklist was initialized
    const checklistResult = planningService.getPlanReviewChecklist(planId);
    
    assert.strictEqual(checklistResult.success, true);
    assert.ok(checklistResult.checklist);
    
    // Should have 2 point items (2 points × 4 default checklist items) + 4 plan items = 12 total
    assert.strictEqual(checklistResult.checklist!.length, 12);
    
    // Verify checklist content format
    assert.ok(checklistResult.checklist![0].startsWith('Point 1:'), 'First item should start with Point 1:');
    assert.ok(checklistResult.checklist![8].startsWith('Plan:'), 'Plan items should start with Plan:');
  });

  test('should process checklist items one by one', () => {
    // Create a test plan
    const planId = 'test-checklist-processing';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');

    // Set dependencies and implementation status
    planningService.setPointDependencies(planId, '1', ['-1'], []);
    planningService.setImplemented(planId, '1');

    // First evaluation should return first checklist item
    const evaluation1 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(evaluation1.success, true);
    assert.strictEqual(evaluation1.result?.failedStep, 'plan_review');
    
    const firstPrompt = evaluation1.result?.nextStepPrompt;
    assert.ok(firstPrompt, 'Should have a next step prompt');
    assert.ok(firstPrompt.includes('Point 1:'), 'First prompt should include Point 1');
    
    // Execute the done callback to remove first item
    if (evaluation1.result?.doneCallback) {
      evaluation1.result.doneCallback(true, 'First item completed');
    }
    
    // Second evaluation should return second checklist item
    const evaluation2 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(evaluation2.success, true);
    
    const secondPrompt = evaluation2.result?.nextStepPrompt;
    assert.ok(secondPrompt, 'Should have a second prompt');
    assert.notStrictEqual(firstPrompt, secondPrompt, 'Second prompt should be different from first');
    
    // Check remaining checklist length  
    const checklistResult = planningService.getPlanReviewChecklist(planId);
    assert.strictEqual(checklistResult.success, true);
    assert.strictEqual(checklistResult.checklist!.length, 7); // One item removed (8 - 1 = 7, since 1 point × 4 items + 4 plan items = 8)
  });

  test('should mark plan as reviewed when checklist is complete', () => {
    // Use a simple plan that will have a minimal checklist from defaults
    const planId = 'test-checklist-complete';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');

    // Don't add any points to keep the checklist as small as possible (only plan-level items)
    // This will create just 4 plan-level checklist items from defaults
    
    // Need to set up at least one implemented point to pass structural validation
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');
    planningService.setPointDependencies(planId, '1', ['-1'], []);
    planningService.setImplemented(planId, '1');

    // Process all checklist items one by one until done
    let itemsProcessed = 0;
    const maxIterations = 20; // Safety valve
    
    while (itemsProcessed < maxIterations) {
      const evaluation = planningService.evaluatePlanCompletion(planId);
      
      if (evaluation.result?.failedStep !== 'plan_review') {
        // No longer in review step, so plan should be reviewed
        break;
      }
      
      if (evaluation.result?.doneCallback) {
        evaluation.result.doneCallback(true, `Item ${itemsProcessed + 1} completed`);
        itemsProcessed++;
      } else {
        // No more checklist items
        break;
      }
    }
    
    // Plan should now be reviewed
    const plan = (planningService as any).plans.get(planId);
    assert.strictEqual(plan.reviewed, true, 'Plan should be marked as reviewed after processing all checklist items');
    
    // Final evaluation should not be plan_review anymore
    const finalEvaluation = planningService.evaluatePlanCompletion(planId);
    assert.notStrictEqual(finalEvaluation.result?.failedStep, 'plan_review', 'Should not be in plan_review step after completion');
  });

  test('checklist system provides stepwise review functionality', () => {
    // This test verifies that the checklist system provides a systematic way to review plans
    const planId = 'test-checklist-functionality';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add point and set it up properly 
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');
    planningService.setPointDependencies(planId, '1', ['-1'], []);
    planningService.setImplemented(planId, '1');

    // First evaluation should initialize the checklist and return first item
    const evaluation1 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(evaluation1.success, true);
    assert.strictEqual(evaluation1.result?.failedStep, 'plan_review');
    assert.ok(evaluation1.result?.doneCallback, 'Should have doneCallback for checklist processing');
    assert.ok(evaluation1.result?.nextStepPrompt, 'Should provide a specific checklist item to review');
    
    // Process one checklist item
    if (evaluation1.result?.doneCallback) {
      evaluation1.result.doneCallback(true, 'First item reviewed');
    }
    
    // Second evaluation should return the next checklist item
    const evaluation2 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(evaluation2.success, true);
    assert.strictEqual(evaluation2.result?.failedStep, 'plan_review');
    assert.ok(evaluation2.result?.doneCallback, 'Should still have doneCallback for remaining items');
    
    // The prompt should be different (next checklist item)
    assert.notStrictEqual(
      evaluation1.result?.nextStepPrompt, 
      evaluation2.result?.nextStepPrompt,
      'Second evaluation should provide different checklist item'
    );
  });
});
