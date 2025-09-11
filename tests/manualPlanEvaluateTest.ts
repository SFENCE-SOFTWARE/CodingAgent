// tests/manualPlanEvaluateTest.ts

import { PlanningService } from '../src/planningService';
import { PlanEvaluateTool } from '../src/tools/planEvaluate';
import { PlanContextManager } from '../src/planContextManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Manual test to verify planEvaluate tool works with procedural validation
async function testPlanEvaluateWithProceduralValidation() {
  console.log('🧪 Testing Plan Evaluate Tool with Procedural Validation');

  // Setup
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-evaluate-test-'));
  PlanningService.resetInstance();
  const planningService = PlanningService.getInstance(tempDir);
  const planContextManager = PlanContextManager.getInstance();
  const planEvaluateTool = new PlanEvaluateTool();

  try {
    // Test 1: Plan with missing expected inputs should trigger procedural validation
    console.log('\n📋 Test 1: Plan with incomplete point (missing expected inputs)');
    
    planningService.createPlan('test-plan-1', 'Test Plan 1', 'Test plan with incomplete point', 'Long description');
    planContextManager.setCurrentPlanId('test-plan-1');
    
    // Add point with missing expected inputs
    planningService.addPoint(
      'test-plan-1', 
      null, 
      'Point 1', 
      'Short desc', 
      'Detailed desc',
      'Acceptance criteria',
      'Expected outputs',
      '' // Missing expected inputs
    );

    const result1 = await planEvaluateTool.execute({}, tempDir);
    console.log('Result:', result1);
    
    if (result1.success && result1.content.includes('missing expected inputs')) {
      console.log('✅ Test 1 PASSED: Procedural validation correctly detected missing expected inputs');
    } else {
      console.log('❌ Test 1 FAILED: Expected procedural validation error for missing expected inputs');
    }

    // Test 2: Plan with all required fields should pass procedural validation
    console.log('\n📋 Test 2: Plan with complete point');
    
    planningService.createPlan('test-plan-2', 'Test Plan 2', 'Complete test plan', 'Long description');
    planContextManager.setCurrentPlanId('test-plan-2');
    
    // Add complete point
    planningService.addPoint(
      'test-plan-2', 
      null, 
      'Point 1', 
      'Short desc', 
      'Detailed desc',
      'Acceptance criteria',
      'Expected outputs',
      'Expected inputs'
    );
    
    // Set dependencies
    planningService.setPointDependencies('test-plan-2', '1', ['-1'], []);

    const result2 = await planEvaluateTool.execute({}, tempDir);
    console.log('Result:', result2);
    
    if (result2.success && result2.content.includes('Plan needs to be reviewed')) {
      console.log('✅ Test 2 PASSED: Procedural validation passed, moved to plan review');
    } else {
      console.log('❌ Test 2 FAILED: Expected to pass procedural validation and move to plan review');
    }

    // Test 3: Already reviewed plan should skip procedural validation
    console.log('\n📋 Test 3: Already reviewed plan (should skip procedural validation)');
    
    planningService.createPlan('test-plan-3', 'Test Plan 3', 'Reviewed test plan', 'Long description');
    planContextManager.setCurrentPlanId('test-plan-3');
    
    // Add incomplete point
    planningService.addPoint(
      'test-plan-3', 
      null, 
      'Point 1', 
      'Short desc', 
      'Detailed desc',
      'Acceptance criteria',
      'Expected outputs',
      '' // Missing expected inputs
    );
    
    // Mark plan as reviewed
    planningService.setPlanReviewed('test-plan-3', 'Plan reviewed successfully');

    const result3 = await planEvaluateTool.execute({}, tempDir);
    console.log('Result:', result3);
    
    if (result3.success && !result3.content.includes('missing expected inputs')) {
      console.log('✅ Test 3 PASSED: Procedural validation was skipped for reviewed plan');
    } else {
      console.log('❌ Test 3 FAILED: Expected to skip procedural validation for reviewed plan');
    }

    console.log('\n🎉 Manual testing completed!');

  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// Run the test
testPlanEvaluateWithProceduralValidation().catch(console.error);
