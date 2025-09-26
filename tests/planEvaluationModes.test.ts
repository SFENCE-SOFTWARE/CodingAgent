// tests/planEvaluationModes.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock vscode module
const mockConfig = {
  get: (key: string, defaultValue?: any) => {
    const configs: { [key: string]: any } = {
      'recommendedModePlanRework': 'Architect',
      'recommendedModePlanReview': 'Plan Reviewer', 
      'recommendedModeRework': 'Coder',
      'recommendedModeImplementation': 'Coder',
      'recommendedModeCodeReview': 'Reviewer',
      'recommendedModeTesting': 'Tester',
      'recommendedModeAcceptance': 'Approver'
    };
    return configs[key] !== undefined ? configs[key] : defaultValue;
  }
};

const mockVscode = {
  workspace: {
    getConfiguration: (section?: string) => {
      return mockConfig;
    }
  }
};

// Mock the vscode module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

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

  suiteTeardown(() => {
    // Restore original require
    Module.prototype.require = originalRequire;
  });

  test('should return recommended modes for different plan states', () => {
    // Create a test plan
    const planId = 'test-plan-modes';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add a test point with proper dependencies to avoid procedural validation failure
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');
    planningService.setPointDependencies(planId, '1', ['-1'], []); // Set as independent point
    
    // Test plan review state (should skip procedural validation since point has dependencies)
    const result1 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result1.success, true);
    assert.strictEqual(result1.result?.failedStep, 'implementation'); // Should be implementation now, not plan_review
    assert.strictEqual(result1.result?.recommendedMode, 'Coder'); // Should return 'Coder' for implementation
    assert.strictEqual(typeof result1.result?.recommendedMode, 'string');
    
    // Review plan and test implementation state (plan is reviewed but point needs implementation)
    planningService.setPlanReviewed(planId, 'Plan reviewed');
    const result2 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result2.success, true);
    assert.strictEqual(result2.result?.failedStep, 'implementation');
    assert.strictEqual(result2.result?.recommendedMode, 'Coder'); // Should return 'Coder' for implementation
    assert.strictEqual(typeof result2.result?.recommendedMode, 'string');
    
    // Set implemented and test review state
    planningService.setImplemented(planId, '1');
    const result3 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result3.success, true);
    assert.strictEqual(result3.result?.failedStep, 'code_review');
    assert.strictEqual(result3.result?.recommendedMode, 'Reviewer'); // Should return Reviewer for code_review
    assert.strictEqual(typeof result3.result?.recommendedMode, 'string');
    
    // Set reviewed and test testing state
    planningService.setReviewed(planId, '1', 'Code looks good');
    const result4 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result4.success, true);
    assert.strictEqual(result4.result?.failedStep, 'testing');
    assert.strictEqual(result4.result?.recommendedMode, 'Tester'); // Should return Tester for testing
    assert.strictEqual(typeof result4.result?.recommendedMode, 'string');
    
    // Set tested and test acceptance state
    planningService.setTested(planId, '1', 'Tests pass');
    const result5 = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result5.success, true);
    assert.strictEqual(result5.result?.failedStep, 'acceptance');
    assert.strictEqual(result5.result?.recommendedMode, 'Approver'); // Should return Approver for acceptance
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
    assert.strictEqual(result.result?.recommendedMode, 'Architect'); // Should return Architect for plan_rework
    assert.strictEqual(typeof result.result?.recommendedMode, 'string');
  });

  test('should return recommended mode for point rework state', () => {
    // Create a test plan
    const planId = 'test-point-rework-mode';
    planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
    
    // Add and review plan with proper dependencies
    planningService.addPoint(planId, null, 'Point 1', 'Short desc', 'Detailed desc', 'Review instructions',
        'Testing instructions', 'Expected outputs', 'Expected inputs');
    planningService.setPointDependencies(planId, '1', ['-1'], []); // Set as independent point
    planningService.setPlanReviewed(planId, 'Plan reviewed');
    
    // Set point to need rework
    planningService.setNeedRework(planId, '1', 'Implementation needs improvement');
    
    // Test point rework state
    const result = planningService.evaluatePlanCompletion(planId);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result?.failedStep, 'rework');
    assert.strictEqual(result.result?.recommendedMode, 'Coder'); // Should return Coder for rework
    assert.strictEqual(typeof result.result?.recommendedMode, 'string');
  });
});
