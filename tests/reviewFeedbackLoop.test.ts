/**
 * Test pro ověření kompletního review feedback mechanismu
 * Testuje: review request -> LLM označí needsWork -> detekce přes callback -> rework prompt
 */

import { PlanningService, Plan } from '../src/planningService';
import * as vscode from 'vscode';

// Mock vscode.workspace.getConfiguration
const mockConfig = {
  // Review prompts
  'codingagent.plan.creation.promptDescriptionReview': 'Review descriptions: <checklist>',
  'codingagent.plan.creation.promptArchitectureReview': 'Review architecture: <checklist>',
  
  // Review checklists
  'codingagent.plan.creation.checklistDescriptionReview': '* Check descriptions are complete\n* Verify descriptions match request',
  'codingagent.plan.creation.checklistArchitectureReview': '* Check architecture is complete\n* Verify architecture is technically correct',
  
  // Review callbacks
  'codingagent.plan.creation.callbackDescriptionReview': 'plan.descriptionsReviewed',
  'codingagent.plan.creation.callbackArchitectureReview': 'plan.architectureReviewed',
  
  // Rework prompts
  'codingagent.plan.creation.promptDescriptionReviewRework': 'Description review rework: <plan_needwork>',
  'codingagent.plan.creation.promptArchitectureReviewRework': 'Architecture review rework: <plan_needwork>',
  
  // Recommended modes
  'codingagent.plan.creation.recommendedModeDescriptionReview': 'Plan Reviewer',
  'codingagent.plan.creation.recommendedModeArchitectureReview': 'Plan Reviewer',
  'codingagent.plan.recommendedModePlanRework': 'Architect'
};

// Mock vscode configuration
Object.defineProperty(vscode.workspace, 'getConfiguration', {
  value: (section?: string) => ({
    get: (key: string, defaultValue?: any) => {
      const fullKey = section ? `${section}.${key}` : key;
      return mockConfig[fullKey as keyof typeof mockConfig] || defaultValue;
    }
  }),
  writable: true,
  configurable: true
});

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTest(testName: string, testFn: () => void): void {
  try {
    testFn();
    console.log(`✅ ${testName}`);
  } catch (error) {
    console.error(`❌ ${testName}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

function testReviewFeedbackLoop(): void {
  console.log('\n=== Testing Review Feedback Loop ===');
  
  let planningService: PlanningService;
  const testPlanId = 'test-feedback-plan';

  function setup(): void {
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance('/tmp/test-workspace');
    planningService.createPlan(testPlanId, 'Test Plan', 'Short description', 'Long description');
  }

  function cleanup(): void {
    planningService.deletePlan(testPlanId, true);
  }

  runTest('Description Review -> needsWork Detection -> Rework Prompt', () => {
    setup();
    try {
      // Setup plan for description review
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = false;
      plan.needsWork = false;
      
      // Step 1: Request description review (should return first checklist item)
      let result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'First review request should be successful');
      assert(result.result?.isDone === false, 'Should not be done');
      assert(result.result?.failedStep === 'plan_description_review', 'Should be in description review step');
      assert(result.result?.nextStepPrompt?.includes('Check descriptions are complete') === true, 'Should contain first checklist item');
      assert(typeof result.result?.completionCallback === 'function', 'Should have completion callback');
      
      // Step 2: Simulate LLM marking review as needing work (LLM calls plan_need_works tool)
      planningService.setPlanNeedsWork(testPlanId, ['Descriptions are not detailed enough']);
      
      // Step 3: Re-evaluate - should detect needsWork and return rework prompt
      result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'Rework detection should be successful');
      assert(result.result?.isDone === false, 'Should not be done');
      assert(result.result?.failedStep === 'plan_description_review_rework', 'Should be in description review rework step');
      assert(result.result?.nextStepPrompt?.includes('Description review rework:') === true, 'Should use description review rework template');
      assert(result.result?.nextStepPrompt?.includes('Descriptions are not detailed enough') === true, 'Should include feedback comment');
      
      console.log(`  💡 Feedback loop working: Review request -> LLM needsWork -> Rework prompt`);
      
    } finally {
      cleanup();
    }
  });

  runTest('Architecture Review -> needsWork Detection -> Rework Prompt', () => {
    setup();
    try {
      // Setup plan for architecture review
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = true;
      plan.architectureCreated = true;
      plan.architecture = '{"components": [{"id": "comp1", "name": "Component 1"}], "connections": []}';
      plan.architectureReviewed = false;
      plan.needsWork = false;
      
      // Step 1: Request architecture review (should return first checklist item)
      let result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'First review request should be successful');
      assert(result.result?.isDone === false, 'Should not be done');
      assert(result.result?.failedStep === 'plan_architecture_review', 'Should be in architecture review step');
      assert(result.result?.nextStepPrompt?.includes('Check architecture is complete') === true, 'Should contain first checklist item');
      assert(typeof result.result?.completionCallback === 'function', 'Should have completion callback');
      
      // Step 2: Test completion callback before needsWork
      const completionResult = result.result!.completionCallback!();
      assert(completionResult === false, 'Completion callback should return false when architecture not reviewed and no needsWork');
      
      // Step 3: Simulate LLM marking review as needing work (LLM calls plan_need_works tool)
      planningService.setPlanNeedsWork(testPlanId, ['Architecture is missing key components']);
      
      // Step 4: Test completion callback after needsWork (should still be false - needsWork blocks completion)
      const completionResult2 = result.result!.completionCallback!();
      assert(completionResult2 === false, 'Completion callback should return false when needsWork is true');
      
      // Step 5: Re-evaluate - should detect needsWork and return rework prompt
      result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'Rework detection should be successful');
      assert(result.result?.isDone === false, 'Should not be done');
      assert(result.result?.failedStep === 'plan_architecture_review_rework', 'Should be in architecture review rework step');
      assert(result.result?.nextStepPrompt?.includes('Architecture review rework:') === true, 'Should use architecture review rework template');
      assert(result.result?.nextStepPrompt?.includes('Architecture is missing key components') === true, 'Should include feedback comment');
      
      console.log(`  💡 Architecture review feedback loop working correctly`);
      
    } finally {
      cleanup();
    }
  });

  runTest('Review Success Path (no needsWork)', () => {
    setup();
    try {
      // Setup plan for description review
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = false;
      plan.needsWork = false;
      
      // Step 1: Request review
      let result = planningService.evaluatePlanCreation(testPlanId);
      assert(result.result?.completionCallback !== undefined, 'Should have completion callback');
      
      // Step 2: Test callback before review completion
      let completionResult = result.result!.completionCallback!();
      assert(completionResult === false, 'Should return false when descriptionsReviewed is false');
      
      // Step 3: Simulate successful review (LLM calls plan_reviewed tool)
      planningService.setPlanReviewed(testPlanId, 'Descriptions look good');
      
      // Step 4: Test callback after review completion
      completionResult = result.result!.completionCallback!();
      assert(completionResult === true, 'Should return true when descriptionsReviewed is true and no needsWork');
      
      // Step 5: Re-evaluate should move to next step
      result = planningService.evaluatePlanCreation(testPlanId);
      assert(result.result?.failedStep !== 'plan_description_review', 'Should have moved past description review');
      
      console.log(`  💡 Success path working: Review completion detected by callback`);
      
    } finally {
      cleanup();
    }
  });

  console.log('\n✅ All review feedback tests passed!');
}

// Run the tests
if (require.main === module) {
  try {
    testReviewFeedbackLoop();
    console.log('\n=== All review feedback tests completed successfully ===');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}
