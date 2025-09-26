/**
 * Step-specific rework prompts test
 * Simple assertion-based test without external dependencies
 */

import { PlanningService, Plan } from '../src/planningService';
import * as vscode from 'vscode';

// Mock vscode.workspace.getConfiguration
const mockConfig = {
  'codingagent.plan.creation.promptDescriptionUpdateRework': 'Description update rework: <plan_needwork>',
  'codingagent.plan.creation.promptArchitectureCreationRework': 'Architecture creation rework: <plan_needwork>',
  'codingagent.plan.creation.promptPlanPointsCreationRework': 'Points creation rework: <plan_needwork>',
  'codingagent.plan.promptPlanRework': 'Generic plan rework: <plan_needwork>'
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

function testStepSpecificReworkPrompts(): void {
  console.log('\n=== Testing Step-Specific Rework Prompts ===');
  
  let planningService: PlanningService;
  const testPlanId = 'test-rework-plan';

  function setup(): void {
    // Reset planning service instance for each test
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance('/tmp/test-workspace');
    
    // Create a test plan
    planningService.createPlan(
      testPlanId,
      'Test Plan',
      'Short description',
      'Long description'
    );
  }

  function cleanup(): void {
    planningService.deletePlan(testPlanId, true);
  }

  runTest('Description update rework template', () => {
    setup();
    try {
      // Get the plan and set it to need rework during description update
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.creationStep = 'description_update';
      plan.descriptionsUpdated = false;
      plan.needsWork = true;
      plan.needsWorkComments = ['Descriptions need more detail'];
      
      const result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'Result should be successful');
      assert(result.result?.isDone === false, 'Result should not be done');
      assert(result.result?.failedStep === 'plan_description_update_rework', 'Failed step should be plan_description_update_rework');
      assert(result.result?.nextStepPrompt?.includes('Description update rework:') === true, 'Prompt should contain Description update rework');
      assert(result.result?.nextStepPrompt?.includes('Descriptions need more detail') === true, 'Prompt should contain the need work comment');
    } finally {
      cleanup();
    }
  });

  runTest('Architecture creation rework template', () => {
    setup();
    try {
      // Get the plan and set it to need rework during architecture creation
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.creationStep = 'architecture_creation';
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = true;
      plan.architectureCreated = false;
      plan.needsWork = true;
      plan.needsWorkComments = ['Architecture is incomplete'];
      
      const result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'Result should be successful');
      assert(result.result?.isDone === false, 'Result should not be done');
      assert(result.result?.failedStep === 'plan_architecture_creation_rework', 'Failed step should be plan_architecture_creation_rework');
      assert(result.result?.nextStepPrompt?.includes('Architecture creation rework:') === true, 'Prompt should contain Architecture creation rework');
      assert(result.result?.nextStepPrompt?.includes('Architecture is incomplete') === true, 'Prompt should contain the need work comment');
    } finally {
      cleanup();
    }
  });

  runTest('Points creation rework template', () => {
    setup();
    try {
      // Get the plan and set it to need rework during points creation
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.creationStep = 'points_creation';
      plan.descriptionsUpdated = true;
      plan.descriptionsReviewed = true;
      plan.architectureCreated = true;
      plan.architectureReviewed = true;
      plan.pointsCreated = false;
      plan.needsWork = true;
      plan.needsWorkComments = ['Points are not specific enough'];
      
      const result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'Result should be successful');
      assert(result.result?.isDone === false, 'Result should not be done');
      assert(result.result?.failedStep === 'plan_points_creation_rework', 'Failed step should be plan_points_creation_rework');
      assert(result.result?.nextStepPrompt?.includes('Points creation rework:') === true, 'Prompt should contain Points creation rework');
      assert(result.result?.nextStepPrompt?.includes('Points are not specific enough') === true, 'Prompt should contain the need work comment');
    } finally {
      cleanup();
    }
  });

  runTest('Generic plan rework for unknown steps', () => {
    setup();
    try {
      // Get the plan and set it to need rework with unknown step
      const plan = (planningService as any).plans.get(testPlanId) as Plan;
      plan.creationStep = 'unknown_step' as any;
      plan.needsWork = true;
      plan.needsWorkComments = ['Generic rework needed'];
      
      const result = planningService.evaluatePlanCreation(testPlanId);
      
      assert(result.success === true, 'Result should be successful');
      assert(result.result?.isDone === false, 'Result should not be done');
      assert(result.result?.failedStep === 'plan_rework', 'Failed step should be plan_rework');
      assert(result.result?.nextStepPrompt?.includes('Generic plan rework:') === true, 'Prompt should contain Generic plan rework');
      assert(result.result?.nextStepPrompt?.includes('Generic rework needed') === true, 'Prompt should contain the need work comment');
    } finally {
      cleanup();
    }
  });

  console.log('\n✅ All step-specific rework tests passed!');
}

// Run the tests
if (require.main === module) {
  try {
    testStepSpecificReworkPrompts();
    console.log('\n=== All tests completed successfully ===');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}
