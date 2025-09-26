// tests/planProceduralValidation.test.ts

import * as assert from 'assert';
import { PlanningService } from '../src/planningService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Plan Procedural Validation Test Suite', () => {
  let planningService: PlanningService;
  let tempDir: string;

  setup(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-test-'));
    
    // Reset singleton instance
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(tempDir);
  });

  teardown(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  suite('validatePlanProcedurally', () => {
    test('should pass validation for complete plan with all required fields', () => {
      // Create plan
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      
      // Add complete point
      planningService.addPoint(
        'test-plan',
        null,
        'Point 1',
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        'Expected inputs'
      );

      // Set dependencies
      planningService.setPointDependencies('test-plan', '1', ['-1'], []);

      // Validate
      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.issue, undefined);
    });

    test('should fail validation when point is missing short name', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      planningService.addPoint(
        'test-plan',
        null,
        '', // Empty short name
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        'Expected inputs'
      );

      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.notStrictEqual(result.issue, undefined);
      assert.strictEqual(result.issue!.type, 'missing_field');
      assert.strictEqual(result.issue!.pointId, '1');
      assert.ok(result.issue!.message.includes('missing short name'));
    });

    test('should fail validation when point is missing expected inputs', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      planningService.addPoint(
        'test-plan',
        null,
        'Point 1',
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        '' // Empty expected inputs
      );

      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.notStrictEqual(result.issue, undefined);
      assert.strictEqual(result.issue!.type, 'missing_field');
      assert.strictEqual(result.issue!.pointId, '1');
      assert.ok(result.issue!.message.includes('missing expected inputs'));
    });

    test('should fail validation when point has no dependencies set', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      planningService.addPoint(
        'test-plan',
        null,
        'Point 1',
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        'Expected inputs'
      );
      // Don't set dependencies - should fail

      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.notStrictEqual(result.issue, undefined);
      assert.strictEqual(result.issue!.type, 'missing_dependencies');
      assert.strictEqual(result.issue!.pointId, '1');
      assert.ok(result.issue!.message.includes('no dependencies set'));
    });

    test('should fail validation when point depends on non-existent point', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      planningService.addPoint(
        'test-plan',
        null,
        'Point 1',
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        'Expected inputs'
      );
      
      // Set dependency on non-existent point (this will fail in setPointDependencies)
      const setResult = planningService.setPointDependencies('test-plan', '1', ['999'], []);
      assert.strictEqual(setResult.success, false);
      assert.ok(setResult.error!.includes('Depends-on point with ID \'999\' not found'));
    });

    test('should fail validation when point has invalid dependency in storage', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      planningService.addPoint(
        'test-plan',
        null,
        'Point 1',
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        'Expected inputs'
      );
      
      // First set valid dependency
      planningService.setPointDependencies('test-plan', '1', ['-1'], []);
      
      // Now manually corrupt the data to have invalid dependency (simulating corrupted storage)
      const plan = (planningService as any).plans.get('test-plan');
      plan.points[0].dependsOn = ['999']; // invalid point ID
      (planningService as any).savePlan(plan);

      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.notStrictEqual(result.issue, undefined);
      assert.strictEqual(result.issue!.type, 'invalid_dependency');
      assert.strictEqual(result.issue!.pointId, '1');
      assert.ok(result.issue!.message.includes('depends on non-existent point 999'));
    });

    test('should pass validation with -1 dependency (independent point)', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      planningService.addPoint(
        'test-plan',
        null,
        'Point 1',
        'Short description',
        'Detailed description',
        'Review instructions',
        'Testing instructions',
        'Expected outputs',
        'Expected inputs'
      );
      
      // Set -1 dependency (independent)
      planningService.setPointDependencies('test-plan', '1', ['-1'], []);

      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.issue, undefined);
    });

    test('should pass validation with valid dependencies', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      
      // Add two points
      planningService.addPoint(
        'test-plan', null, 'Point 1', 'Short desc 1', 'Detailed desc 1',
        'Review instructions 1', 'Testing instructions 1', 'Outputs 1', 'Inputs 1'
      );
      planningService.addPoint(
        'test-plan', '1', 'Point 2', 'Short desc 2', 'Detailed desc 2',
        'Review instructions 2', 'Testing instructions 2', 'Outputs 2', 'Inputs 2'
      );
      
      // Set valid dependencies
      planningService.setPointDependencies('test-plan', '1', ['-1'], []);
      planningService.setPointDependencies('test-plan', '2', ['1'], []);

      const result = planningService.validatePlanProcedurally('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.issue, undefined);
    });
  });

  suite('evaluatePlanCompletion with procedural validation', () => {
    test('should run procedural validation before LLM review for unreviewed plans', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      
      // Add incomplete point (missing expected inputs)
      planningService.addPoint(
        'test-plan', null, 'Point 1', 'Short desc', 'Detailed desc',
        'Review instructions', 'Testing instructions', 'Outputs', '' // Missing expected inputs
      );

      const result = planningService.evaluatePlanCompletion('test-plan');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result!.isDone, false);
      assert.ok(result.result!.nextStepPrompt.includes('missing expected inputs'));
      assert.strictEqual(result.result!.failedStep, 'plan_review');
    });

    test('should skip procedural validation for reviewed plans', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      
      // Add incomplete point but mark plan as reviewed
      planningService.addPoint(
        'test-plan', null, 'Point 1', 'Short desc', 'Detailed desc',
        'Criteria', 'Outputs', '' // Missing expected inputs
      );
      planningService.setPlanReviewed('test-plan', 'Reviewed');

      const result = planningService.evaluatePlanCompletion('test-plan');
      
      // Should not fail on procedural validation since plan is already reviewed
      assert.strictEqual(result.success, true);
      assert.ok(!result.result!.nextStepPrompt.includes('missing expected inputs'));
    });

    test('should skip procedural validation for plans that need work', () => {
      planningService.createPlan('test-plan', 'Test Plan', 'Short desc', 'Long desc');
      
      // Add incomplete point and mark plan as needing work
      planningService.addPoint(
        'test-plan', null, 'Point 1', 'Short desc', 'Detailed desc',
        'Criteria', 'Outputs', '' // Missing expected inputs
      );
      planningService.setPlanNeedsWork('test-plan', ['Needs work']);

      // Since plan.needsWork is only handled in evaluatePlanCreation, not evaluatePlanCompletion,
      // we should use evaluatePlanCreation for this test
      const result = planningService.evaluatePlanCreation('test-plan');
      
      // Should handle plan rework, not procedural validation
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result!.failedStep, 'plan_rework');
      assert.ok(!result.result!.nextStepPrompt.includes('missing expected inputs'));
    });
  });
});
