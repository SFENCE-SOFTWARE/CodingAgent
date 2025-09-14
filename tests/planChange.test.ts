// tests/planChange.test.ts

import * as assert from 'assert';
import * as path from 'path';
import { PlanChangeTool } from '../src/tools/planChange';
import { PlanNewTool } from '../src/tools/planNew';
import { PlanOpenTool } from '../src/tools/planOpen';
import { PlanShowTool } from '../src/tools/planShow';
import { PlanDeleteTool } from '../src/tools/planDelete';
import { PlanContextManager } from '../src/planContextManager';
import { PlanningService } from '../src/planningService';

suite('Plan Change Tool Tests', () => {
  const testWorkspaceRoot = '/tmp/plan-change-test-workspace';
  let testPlanId: string;
  let planChangeTool: PlanChangeTool;
  let planNewTool: PlanNewTool;
  let planOpenTool: PlanOpenTool;
  let planShowTool: PlanShowTool;
  let planDeleteTool: PlanDeleteTool;
  let planContextManager: PlanContextManager;

  setup(() => {
    // Generate unique plan ID for each test run
    testPlanId = `test-plan-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get singleton instance of plan context manager
    planContextManager = PlanContextManager.getInstance();
    
    // Ensure workspace directory exists
    const fs = require('fs');
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }

    // Initialize tools
    planChangeTool = new PlanChangeTool();
    planNewTool = new PlanNewTool();
    planOpenTool = new PlanOpenTool();
    planShowTool = new PlanShowTool();
    planDeleteTool = new PlanDeleteTool();
  });

  teardown(async () => {
    // Clean up test files by deleting the plan if it exists
    try {
      await planDeleteTool.execute({ plan_id: testPlanId, confirm: true }, testWorkspaceRoot);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Reset singleton for next test
    PlanningService.resetInstance();
    
    // Clear plan context
    planContextManager.setCurrentPlanId(null);
    
    // Also clean up the .codingagent/plans directory
    try {
      const fs = require('fs');
      const plansDir = path.join(testWorkspaceRoot, '.codingagent', 'plans');
      if (fs.existsSync(plansDir)) {
        const files = fs.readdirSync(plansDir);
        for (const file of files) {
          if (file.startsWith(testPlanId)) {
            fs.unlinkSync(path.join(plansDir, file));
          }
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  suite('Tool Info and Definition', () => {
    test('should provide correct tool info', () => {
      const info = planChangeTool.getToolInfo();
      assert.strictEqual(info.name, 'plan_change');
      assert.strictEqual(info.displayName, 'Plan Change');
      assert.strictEqual(info.description, 'Update plan name and descriptions');
      assert.strictEqual(info.category, 'other');
    });

    test('should provide correct tool definition', () => {
      const definition = planChangeTool.getToolDefinition();
      assert.strictEqual(definition.type, 'function');
      assert.strictEqual(definition.function.name, 'plan_change');
      assert.ok(definition.function.description.includes('Update plan name'));
      assert.ok(definition.function.parameters.properties.plan_id);
      assert.ok(definition.function.parameters.properties.name);
      assert.ok(definition.function.parameters.properties.short_description);
      assert.ok(definition.function.parameters.properties.long_description);
      assert.strictEqual(definition.function.parameters.required.length, 0);
    });
  });

  suite('Plan Change Operations', () => {
    setup(async () => {
      // Create a test plan for each test
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Original Plan Name',
        short_description: 'Original short description',
        long_description: 'Original long description'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
    });

    test('should update plan name with explicit plan_id', async () => {
      const result = await planChangeTool.execute({
        plan_id: testPlanId,
        name: 'Updated Plan Name'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('Updated Plan Name'), 'Result should mention new name');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({ plan_id: testPlanId }, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Updated Plan Name'), 'Plan should show updated name');
    });

    test('should update plan short description', async () => {
      const result = await planChangeTool.execute({
        plan_id: testPlanId,
        short_description: 'New short description'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('New short description'), 'Result should mention new description');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({ plan_id: testPlanId }, testWorkspaceRoot);
      assert.ok(showResult.content.includes('New short description'), 'Plan should show updated description');
    });

    test('should update plan long description', async () => {
      const result = await planChangeTool.execute({
        plan_id: testPlanId,
        long_description: 'New comprehensive long description with detailed information'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('long description'), 'Result should mention long description');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({ plan_id: testPlanId }, testWorkspaceRoot);
      assert.ok(showResult.content.includes('comprehensive long description'), 'Plan should show updated long description');
    });

    test('should update multiple fields at once', async () => {
      const result = await planChangeTool.execute({
        plan_id: testPlanId,
        name: 'Multi-Update Plan',
        short_description: 'Updated short desc',
        long_description: 'Updated long description'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('Multi-Update Plan'), 'Result should mention new name');
      assert.ok(result.content.includes('Updated short desc'), 'Result should mention new short description');
      assert.ok(result.content.includes('Updated long description'), 'Result should mention new long description');
      
      // Verify all changes were applied
      const showResult = await planShowTool.execute({ plan_id: testPlanId }, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Multi-Update Plan'), 'Plan should show updated name');
      assert.ok(showResult.content.includes('Updated short desc'), 'Plan should show updated short description');
      assert.ok(showResult.content.includes('Updated long description'), 'Plan should show updated long description');
    });

    test('should work with plan context (without explicit plan_id)', async () => {
      // Set the plan as current context
      planContextManager.setCurrentPlanId(testPlanId);
      
      const result = await planChangeTool.execute({
        name: 'Context-Based Update'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('Context-Based Update'), 'Result should mention new name');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({ plan_id: testPlanId }, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Context-Based Update'), 'Plan should show updated name');
    });
  });

  suite('Error Handling', () => {
    test('should fail when no fields are provided', async () => {
      const result = await planChangeTool.execute({
        plan_id: testPlanId
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Should fail when no fields provided');
      assert.ok(result.error?.includes('At least one'), 'Error should mention required fields');
    });

    test('should fail when no plan_id and no context', async () => {
      // Clear any existing context
      planContextManager.setCurrentPlanId(null);
      
      const result = await planChangeTool.execute({
        name: 'Test Name'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Should fail when no plan_id or context');
      assert.ok(result.error?.includes('No plan_id provided'), 'Error should mention missing plan_id');
    });

    test('should fail when plan does not exist', async () => {
      const result = await planChangeTool.execute({
        plan_id: 'non-existent-plan',
        name: 'Test Name'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Should fail for non-existent plan');
      assert.ok(result.error?.includes('not found'), 'Error should mention plan not found');
    });
  });

  suite('Integration with Other Tools', () => {
    setup(async () => {
      // Create a test plan
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Integration Test Plan',
        short_description: 'Plan for integration testing',
        long_description: 'Original request: "Create a test plan"\nTranslated request: "Create a test plan"\nLanguage: English'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
    });

    test('should work with plan_open context', async () => {
      // Open the plan (sets context)
      const openResult = await planOpenTool.execute({
        plan_id: testPlanId
      }, testWorkspaceRoot);
      
      assert.strictEqual(openResult.success, true, 'Plan open should succeed');
      
      // Update using context
      const changeResult = await planChangeTool.execute({
        name: 'Opened Plan Updated',
        short_description: 'Updated via context'
      }, testWorkspaceRoot);
      
      assert.strictEqual(changeResult.success, true, 'Plan change should succeed with context');
      assert.ok(changeResult.content.includes('Opened Plan Updated'), 'Should update name');
      assert.ok(changeResult.content.includes('Updated via context'), 'Should update description');
    });

    test('should preserve original request format in long description', async () => {
      const result = await planChangeTool.execute({
        plan_id: testPlanId,
        long_description: 'Original request: "Modify the system"\nTranslated request: "Modify the system"\nLanguage: English\n\nAdditional details: This is an updated plan with more information.'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      
      // Verify the long description format is preserved
      const showResult = await planShowTool.execute({ plan_id: testPlanId }, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Original request: "Modify the system"'), 'Should preserve original request format');
      assert.ok(showResult.content.includes('Additional details'), 'Should include additional content');
    });
  });
});
