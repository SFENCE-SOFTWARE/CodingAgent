// tests/planPointShowEnhanced.test.ts

import * as assert from 'assert';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { PlanPointShowTool } from '../src/tools/planPointShow';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Enhanced Plan Point Show Test Suite', () => {
  let planningService: PlanningService;
  let planContextManager: PlanContextManager;
  let planPointShowTool: PlanPointShowTool;
  let tempDir: string;

  setup(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-test-'));
    
    // Reset singleton instance
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(tempDir);
    planContextManager = PlanContextManager.getInstance();
    planPointShowTool = new PlanPointShowTool();
  });

  teardown(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should show all sections when "all" is specified', async () => {
    // Create plan with complete data
    planningService.createPlan('test-plan', 'Test Plan', 'Plan short desc', 'Plan long description');
    planContextManager.setCurrentPlanId('test-plan');
    
    // Add complete point
    planningService.addPoint(
      'test-plan',
      null,
      'Point 1',
      'Short description',
      'Detailed description',
      'Acceptance criteria',
      'Expected outputs',
      'Expected inputs'
    );
    
    // Set dependencies
    planningService.setPointDependencies('test-plan', '1', ['-1'], ['2']);
    
    const result = await planPointShowTool.execute({
      point_id: '1',
      sections: ['all']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('Plan Short Description'));
    assert.ok(result.content.includes('Plan Long Description'));
    assert.ok(result.content.includes('Short Description'));
    assert.ok(result.content.includes('Detailed Description'));
    assert.ok(result.content.includes('Expected Inputs'));
    assert.ok(result.content.includes('Expected Outputs'));
    assert.ok(result.content.includes('Acceptance Criteria'));
    assert.ok(result.content.includes('Depends On Points'));
    assert.ok(result.content.includes('Care-On Points'));
    assert.ok(result.content.includes('Status'));
    assert.ok(result.content.includes('Comments'));
  });

  test('should show expected_inputs section correctly', async () => {
    planningService.createPlan('test-plan', 'Test Plan', 'Short', 'Long');
    planContextManager.setCurrentPlanId('test-plan');
    
    planningService.addPoint(
      'test-plan',
      null,
      'Point 1',
      'Short desc',
      'Detailed desc',
      'Criteria',
      'Outputs',
      'User data from database, config file'
    );
    
    const result = await planPointShowTool.execute({
      point_id: '1',
      sections: ['expected_inputs']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('📥 Expected Inputs'));
    assert.ok(result.content.includes('User data from database, config file'));
  });

  test('should show depends_on_points section correctly for independent point', async () => {
    planningService.createPlan('test-plan', 'Test Plan', 'Short', 'Long');
    planContextManager.setCurrentPlanId('test-plan');
    
    planningService.addPoint(
      'test-plan',
      null,
      'Point 1',
      'Short desc',
      'Detailed desc',
      'Criteria',
      'Outputs',
      'Inputs'
    );
    
    // Set as independent
    planningService.setPointDependencies('test-plan', '1', ['-1'], []);
    
    const result = await planPointShowTool.execute({
      point_id: '1',
      sections: ['depends_on_points']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('🔗 Depends On Points'));
    assert.ok(result.content.includes('Independent (no dependencies)'));
  });

  test('should show depends_on_points section correctly for dependent point', async () => {
    planningService.createPlan('test-plan', 'Test Plan', 'Short', 'Long');
    planContextManager.setCurrentPlanId('test-plan');
    
    // Add two points
    planningService.addPoint(
      'test-plan', null, 'Point 1', 'Short 1', 'Detailed 1',
      'Criteria 1', 'Outputs 1', 'Inputs 1'
    );
    planningService.addPoint(
      'test-plan', '1', 'Point 2', 'Short 2', 'Detailed 2',
      'Criteria 2', 'Outputs 2', 'Inputs 2'
    );
    
    // Set dependencies
    planningService.setPointDependencies('test-plan', '1', ['-1'], []);
    planningService.setPointDependencies('test-plan', '2', ['1'], []);
    
    const result = await planPointShowTool.execute({
      point_id: '2',
      sections: ['depends_on_points']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('🔗 Depends On Points'));
    assert.ok(result.content.includes('[1] Point 1'));
  });

  test('should show not set dependencies correctly', async () => {
    planningService.createPlan('test-plan', 'Test Plan', 'Short', 'Long');
    planContextManager.setCurrentPlanId('test-plan');
    
    planningService.addPoint(
      'test-plan',
      null,
      'Point 1',
      'Short desc',
      'Detailed desc',
      'Criteria',
      'Outputs',
      'Inputs'
    );
    
    // Don't set dependencies
    
    const result = await planPointShowTool.execute({
      point_id: '1',
      sections: ['depends_on_points']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('🔗 Depends On Points: Not set'));
  });

  test('should show specific sections only', async () => {
    planningService.createPlan('test-plan', 'Test Plan', 'Plan short', 'Plan long');
    planContextManager.setCurrentPlanId('test-plan');
    
    planningService.addPoint(
      'test-plan',
      null,
      'Point 1',
      'Short desc',
      'Detailed desc',
      'Criteria',
      'Outputs',
      'Inputs'
    );
    
    const result = await planPointShowTool.execute({
      point_id: '1',
      sections: ['short_description', 'expected_inputs']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('🏷️ Point Title'));
    assert.ok(result.content.includes('📝 Short Description'));
    assert.ok(result.content.includes('📥 Expected Inputs'));
    
    // Should NOT include other sections
    assert.ok(!result.content.includes('Plan Short Description'));
    assert.ok(!result.content.includes('Detailed Description'));
    assert.ok(!result.content.includes('Acceptance Criteria'));
  });

  test('should handle missing expected_inputs gracefully', async () => {
    planningService.createPlan('test-plan', 'Test Plan', 'Short', 'Long');
    planContextManager.setCurrentPlanId('test-plan');
    
    planningService.addPoint(
      'test-plan',
      null,
      'Point 1',
      'Short desc',
      'Detailed desc',
      'Criteria',
      'Outputs',
      '' // Empty expected inputs
    );
    
    const result = await planPointShowTool.execute({
      point_id: '1',
      sections: ['expected_inputs']
    }, tempDir);
    
    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('📥 Expected Inputs: Not specified'));
  });
});
