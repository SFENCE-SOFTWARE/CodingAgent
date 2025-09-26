/**
 * Test pro ověření opravy nekonečné smyčky v review callbacks
 */

import { PlanningService, Plan } from '../src/planningService';
import * as vscode from 'vscode';

// Mock vscode.workspace.getConfiguration
const mockConfig = {
  'codingagent.plan.creation.callbackDescriptionReview': 'plan.reviewed',
  'codingagent.plan.creation.callbackArchitectureReview': 'plan.reviewed',
  'codingagent.plan.creation.checklistDescriptionReview': '* Check descriptions are complete',
  'codingagent.plan.creation.checklistArchitectureReview': '* Check architecture is complete',
  'codingagent.plan.creation.promptDescriptionReview': 'Review: <checklist>',
  'codingagent.plan.creation.promptArchitectureReview': 'Review: <checklist>'
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

function testInfiniteLoopFix(): void {
  console.log('\n=== Testing Infinite Loop Fix ===');
  
  let planningService: PlanningService;
  const testPlanId = 'test-loop-plan';

  function setup(): void {
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance('/tmp/test-workspace');
    planningService.createPlan(testPlanId, 'Test Plan', 'Short description', 'Long description');
  }

  function cleanup(): void {
    planningService.deletePlan(testPlanId, true);
  }

  runTest('Description Review - Callback Loop Prevention', () => {
    setup();
    try {
      // Setup plan for description review
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = false;
      
      // Step 1: Request description review - should reset plan.reviewed to false
      let result = planningService.evaluatePlanCreation(testPlanId);
      
      // Verify review was reset
      const planAfterRequest = (planningService as any).plans.get(testPlanId) as Plan;
      assert(planAfterRequest.reviewed === false, 'plan.reviewed should be reset to false for review step');
      assert(result.result?.completionCallback !== undefined, 'Should have completion callback');
      
      // Step 2: Test callback BEFORE LLM response (should return false)
      const callbackBeforeLLM = result.result!.completionCallback!();
      assert(callbackBeforeLLM === false, 'Callback should return false when plan.reviewed is false');
      
      // Step 3: Simulate LLM calling plan_reviewed tool
      planningService.setPlanReviewed(testPlanId, 'Descriptions are good');
      
      // Step 4: Test callback AFTER LLM response (should return true)
      const callbackAfterLLM = result.result!.completionCallback!();
      assert(callbackAfterLLM === true, 'Callback should return true when plan.reviewed is true');
      
      // Step 5: Simulate orchestrator calling doneCallback with success
      if (result.result!.doneCallback) {
        result.result!.doneCallback(true, 'Review completed');
      }
      
      // Step 6: Verify descriptionsReviewed was set in doneCallback
      const planAfterDone = (planningService as any).plans.get(testPlanId) as Plan;
      assert(planAfterDone.descriptionsReviewed === true, 'descriptionsReviewed should be set after successful doneCallback');
      
      console.log(`  💡 Description review loop prevention working correctly`);
      
    } finally {
      cleanup();
    }
  });

  runTest('Architecture Review - Callback Loop Prevention', () => {
    setup();
    try {
      // Setup plan for architecture review
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = true;
      plan.architectureCreated = true;
      plan.architecture = '{"components": [{"id": "comp1", "name": "Component 1"}], "connections": []}';
      plan.architectureReviewed = false;
      
      // Step 1: Request architecture review - should reset plan.reviewed to false
      let result = planningService.evaluatePlanCreation(testPlanId);
      
      // Verify review was reset
      const planAfterRequest = (planningService as any).plans.get(testPlanId) as Plan;
      assert(planAfterRequest.reviewed === false, 'plan.reviewed should be reset to false for architecture review step');
      assert(result.result?.completionCallback !== undefined, 'Should have completion callback');
      
      // Step 2: Test callback BEFORE LLM response (should return false)
      const callbackBeforeLLM = result.result!.completionCallback!();
      assert(callbackBeforeLLM === false, 'Callback should return false when plan.reviewed is false');
      
      // Step 3: Simulate LLM calling plan_reviewed tool
      planningService.setPlanReviewed(testPlanId, 'Architecture looks good');
      
      // Step 4: Test callback AFTER LLM response (should return true)
      const callbackAfterLLM = result.result!.completionCallback!();
      assert(callbackAfterLLM === true, 'Callback should return true when plan.reviewed is true');
      
      // Step 5: Simulate orchestrator calling doneCallback with success
      if (result.result!.doneCallback) {
        result.result!.doneCallback(true, 'Architecture review completed');
      }
      
      // Step 6: Verify architectureReviewed was set in doneCallback
      const planAfterDone = (planningService as any).plans.get(testPlanId) as Plan;
      assert(planAfterDone.architectureReviewed === true, 'architectureReviewed should be set after successful doneCallback');
      
      console.log(`  💡 Architecture review loop prevention working correctly`);
      
    } finally {
      cleanup();
    }
  });

  runTest('Simulate Full Orchestrator Flow Without Loop', () => {
    setup();
    try {
      // Setup plan for description review
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = false;
      
      // Simulate orchestrator evaluation loop
      for (let iteration = 0; iteration < 3; iteration++) {
        console.log(`    Iteration ${iteration + 1}:`);
        
        const result = planningService.evaluatePlanCreation(testPlanId);
        
        if (iteration === 0) {
          // First iteration: should get review request
          assert(result.result?.failedStep === 'plan_description_review', 'First iteration should request review');
          
          // Simulate callback check (should be false initially)
          const callbackResult = result.result!.completionCallback!();
          assert(callbackResult === false, 'Callback should be false initially');
          console.log(`      Callback before LLM: ${callbackResult} ✓`);
          
          // Simulate LLM calling plan_reviewed
          planningService.setPlanReviewed(testPlanId, 'Good descriptions');
          
          // Check callback after LLM
          const callbackAfterLLM = result.result!.completionCallback!();
          assert(callbackAfterLLM === true, 'Callback should be true after LLM');
          console.log(`      Callback after LLM: ${callbackAfterLLM} ✓`);
          
          // Simulate doneCallback execution
          if (result.result!.doneCallback) {
            result.result!.doneCallback(true, 'Review completed');
          }
          console.log(`      DoneCallback executed ✓`);
          
        } else {
          // Subsequent iterations should move to next step (not loop)
          assert(result.result?.failedStep !== 'plan_description_review', 
            `Iteration ${iteration + 1} should not be stuck in description review`);
          console.log(`      Moved to step: ${result.result?.failedStep} ✓`);
          break; // Exit loop when we advance
        }
      }
      
      console.log(`  💡 Full orchestrator flow working without infinite loop`);
      
    } finally {
      cleanup();
    }
  });

  console.log('\n✅ All infinite loop prevention tests passed!');
}

// Run the tests
if (require.main === module) {
  try {
    testInfiniteLoopFix();
    console.log('\n=== All loop prevention tests completed successfully ===');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}
