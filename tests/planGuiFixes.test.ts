// tests/planGuiFixes.test.ts

import * as assert from 'assert';
import { PlanningService } from '../src/planningService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Plan GUI Data Loading Fixes', () => {
  let tempDir: string;
  let planningService: PlanningService;

  setup(() => {
    // Create a temporary directory for this test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-gui-test-'));
    
    // Reset singleton before each test
    (PlanningService as any).instance = undefined;
    planningService = PlanningService.getInstance(tempDir);
  });

  teardown(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // Reset singleton after test
    (PlanningService as any).instance = undefined;
  });

  test('should load plan data with includePointDescriptions=true containing all necessary fields', async () => {
    // Create a test plan with points that have all the fields
    const planResult = planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long description');
    assert.strictEqual(planResult.success, true);

    // Add a point with all required fields (using correct API signature)
    const addPointResult = planningService.addPoints('test-plan', null, [{
      short_name: 'Test Point',
      short_description: 'Test point short description',
      detailed_description: 'Test point detailed description',
      review_instructions: 'Review instructions',
      testing_instructions: 'Testing instructions',
      expected_outputs: 'Test expected outputs',
      expected_inputs: 'Test expected inputs'
    }]);
    assert.strictEqual(addPointResult.success, true);

    // Load plan data with includePointDescriptions=true (as GUI should do)
    const planDataResult = planningService.showPlan('test-plan', true);
    assert.strictEqual(planDataResult.success, true);
    assert.ok(planDataResult.plan);

    const plan = planDataResult.plan;
    assert.strictEqual(plan.points.length, 1);

    const point = plan.points[0];
    console.log('Point data loaded:', JSON.stringify(point, null, 2));

    // Verify all necessary fields are present
    assert.ok(point.reviewInstructions, 'reviewInstructions should be present');
    assert.strictEqual(point.reviewInstructions, 'Review instructions');
    
    assert.ok(point.testingInstructions, 'testingInstructions should be present');
    assert.strictEqual(point.testingInstructions, 'Testing instructions');
    
    assert.ok(point.expectedInputs, 'expectedInputs should be present');
    assert.strictEqual(point.expectedInputs, 'Test expected inputs');
    
    assert.ok(point.expectedOutputs, 'expectedOutputs should be present');
    assert.strictEqual(point.expectedOutputs, 'Test expected outputs');

    // Verify status fields are accessible directly (not nested in state)
    assert.strictEqual(typeof point.implemented, 'boolean');
    assert.strictEqual(typeof point.reviewed, 'boolean');
    assert.strictEqual(typeof point.tested, 'boolean');
    assert.strictEqual(typeof point.needRework, 'boolean');
  });

  test('should load plan data without includePointDescriptions missing detailed fields', async () => {
    // Create a test plan with points
    const planResult = planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long description');
    assert.strictEqual(planResult.success, true);

    // Add a point with all required fields
    const addPointResult = planningService.addPoints('test-plan', null, [{
      short_name: 'Test Point',
      short_description: 'Test point short description',
      detailed_description: 'Test point detailed description',
      review_instructions: 'Review instructions',
      testing_instructions: 'Testing instructions',
      expected_outputs: 'Test expected outputs',
      expected_inputs: 'Test expected inputs'
    }]);
    assert.strictEqual(addPointResult.success, true);

    // Load plan data without includePointDescriptions (as GUI was doing incorrectly)
    const planDataResult = planningService.showPlan('test-plan', false);
    assert.strictEqual(planDataResult.success, true);
    assert.ok(planDataResult.plan);

    const plan = planDataResult.plan;
    assert.strictEqual(plan.points.length, 1);

    const point = plan.points[0];
    console.log('Point data without descriptions:', JSON.stringify(point, null, 2));

    // Verify detailed fields are NOT present (this proves the bug existed)
    assert.strictEqual(point.reviewInstructions, undefined, 'reviewInstructions should be missing');
    assert.strictEqual(point.testingInstructions, undefined, 'testingInstructions should be missing');
    assert.strictEqual(point.expectedInputs, undefined, 'expectedInputs should be missing');
    assert.strictEqual(point.expectedOutputs, undefined, 'expectedOutputs should be missing');

    // But basic fields should be present
    assert.ok(point.shortName);
    assert.ok(point.shortDescription);
    assert.ok(point.detailedDescription);
  });

  test('should provide status data in the format expected by GUI', async () => {
    // Create a test plan with points
    const planResult = planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long description');
    assert.strictEqual(planResult.success, true);

    // Add a point
    const addPointResult = planningService.addPoints('test-plan', null, [{
      short_name: 'Test Point',
      short_description: 'Test point short description',
      detailed_description: 'Test point detailed description',
      review_instructions: 'Review instructions',
      testing_instructions: 'Testing instructions',
      expected_outputs: 'Test expected outputs',
      expected_inputs: 'Test expected inputs'
    }]);
    assert.strictEqual(addPointResult.success, true);

    // Get point ID and update some status fields using existing API
    const pointId = addPointResult.pointIds![0];
    planningService.setImplemented('test-plan', pointId);
    planningService.setReviewed('test-plan', pointId, 'Reviewed OK');

    // Load plan data (as GUI should do)
    const planDataResult = planningService.showPlan('test-plan', true);
    assert.strictEqual(planDataResult.success, true);
    assert.ok(planDataResult.plan);

    const point = planDataResult.plan.points[0];

    // Verify status fields are in the expected format for GUI
    assert.strictEqual(point.implemented, true);
    assert.strictEqual(point.reviewed, true);
    assert.strictEqual(point.tested, false);
    assert.strictEqual(point.needRework, false);

    // These should be direct boolean properties, not nested in a state object
    assert.strictEqual(typeof point.implemented, 'boolean');
    assert.strictEqual(typeof point.reviewed, 'boolean');
    assert.strictEqual(typeof point.tested, 'boolean');
    assert.strictEqual(typeof point.needRework, 'boolean');
  });
});
