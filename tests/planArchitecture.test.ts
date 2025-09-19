// tests/planArchitecture.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PlanningService } from '../src/planningService';
import { PlanSetArchitectureTool } from '../src/tools/planSetArchitecture';

suite('Plan Architecture Tests', () => {
  let testWorkspaceRoot: string;
  let planningService: PlanningService;
  let architectureTool: PlanSetArchitectureTool;
  let testPlanId: string;

  setup(() => {
    // Create a unique temporary directory for each test
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-architecture-test-'));
    
    // Reset the singleton instance before each test
    PlanningService.resetInstance();
    planningService = PlanningService.getInstance(testWorkspaceRoot);
    architectureTool = new PlanSetArchitectureTool();
    
    // Create a test plan
    const planId = `test-plan-${Date.now()}`;
    const createResult = planningService.createPlan(
      planId,
      'Test Architecture Plan',
      'A plan for testing architecture functionality',
      'This plan will be used to test setting and retrieving architecture information.'
    );
    
    assert.strictEqual(createResult.success, true);
    testPlanId = planId;
  });

  teardown(() => {
    // Clean up test plan
    if (planningService) {
      planningService.deletePlan(testPlanId, true);
    }
    PlanningService.resetInstance();
  });

  test('should set plan architecture via tool', async () => {
    const architectureData = {
      nodes: [
        { id: 'frontend', label: 'Frontend', type: 'component' },
        { id: 'backend', label: 'Backend API', type: 'service' },
        { id: 'database', label: 'Database', type: 'database' }
      ],
      edges: [
        { from: 'frontend', to: 'backend', label: 'API calls' },
        { from: 'backend', to: 'database', label: 'queries' }
      ]
    };

    const result = await architectureTool.execute({
      plan_id: testPlanId,
      architecture: JSON.stringify(architectureData)
    }, '/test/workspace');

    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('Architecture set successfully'));
  });

  test('should retrieve plan architecture via showPlan', () => {
    const architectureData = {
      nodes: [{ id: 'test', label: 'Test Node' }],
      edges: []
    };

    // Set architecture using the service directly
    const setResult = planningService.setArchitecture(testPlanId, JSON.stringify(architectureData));
    assert.strictEqual(setResult.success, true);

    // Retrieve plan with architecture
    const showResult = planningService.showPlan(testPlanId);
    assert.strictEqual(showResult.success, true);
    assert.ok(showResult.plan);
    assert.ok(showResult.plan.architecture);
    
    const retrievedArchitecture = JSON.parse(showResult.plan.architecture);
    assert.deepStrictEqual(retrievedArchitecture, architectureData);
  });

  test('should handle invalid JSON architecture gracefully', async () => {
    const result = await architectureTool.execute({
      plan_id: testPlanId,
      architecture: '{ invalid json'
    }, '/test/workspace');

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Invalid JSON'));
  });

  test('should require architecture parameter', async () => {
    const result = await architectureTool.execute({
      plan_id: testPlanId
    }, '/test/workspace');

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Architecture is required'));
  });

  test('should handle non-existent plan gracefully', async () => {
    const result = await architectureTool.execute({
      plan_id: 'non-existent-plan',
      architecture: '{"test": true}'
    }, '/test/workspace');

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Plan with ID'));
  });
});
