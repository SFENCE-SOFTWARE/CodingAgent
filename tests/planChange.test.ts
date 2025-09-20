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
      assert.strictEqual(info.description, 'Update active plan name and descriptions');
      assert.strictEqual(info.category, 'other');
    });

    test('should provide correct tool definition', () => {
      const definition = planChangeTool.getToolDefinition();
      assert.strictEqual(definition.type, 'function');
      assert.strictEqual(definition.function.name, 'plan_change');
      assert.ok(definition.function.description.includes('Update the active plan'));
      assert.ok(!definition.function.parameters.properties.plan_id); // plan_id should not exist
      assert.ok(definition.function.parameters.properties.name);
      assert.ok(definition.function.parameters.properties.short_description);
      assert.ok(definition.function.parameters.properties.long_description);
      assert.strictEqual(definition.function.parameters.required.length, 0);
      assert.strictEqual(definition.function.parameters.additionalProperties, false);
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
      
      // Set the plan as active
      planContextManager.setCurrentPlanId(testPlanId);
    });

    test('should update plan name using active plan', async () => {
      const result = await planChangeTool.execute({
        name: 'Updated Plan Name'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('Updated Plan Name'), 'Result should mention new name');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({}, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Updated Plan Name'), 'Plan should show updated name');
    });

    test('should update plan short description', async () => {
      const result = await planChangeTool.execute({
        short_description: 'New short description'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('New short description'), 'Result should mention new description');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({}, testWorkspaceRoot);
      assert.ok(showResult.content.includes('New short description'), 'Plan should show updated description');
    });

    test('should update plan long description', async () => {
      const result = await planChangeTool.execute({
        long_description: 'New comprehensive long description with detailed information'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('long description'), 'Result should mention long description');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({}, testWorkspaceRoot);
      assert.ok(showResult.content.includes('comprehensive long description'), 'Plan should show updated long description');
    });

    test('should update multiple fields at once', async () => {
      const result = await planChangeTool.execute({
        name: 'Multi-Update Plan',
        short_description: 'Updated short desc',
        long_description: 'Updated long description'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      assert.ok(result.content.includes('Multi-Update Plan'), 'Result should mention new name');
      assert.ok(result.content.includes('Updated short desc'), 'Result should mention new short description');
      assert.ok(result.content.includes('Updated long description'), 'Result should mention new long description');
      
      // Verify all changes were applied
      const showResult = await planShowTool.execute({}, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Multi-Update Plan'), 'Plan should show updated name');
      assert.ok(showResult.content.includes('Updated short desc'), 'Plan should show updated short description');
      assert.ok(showResult.content.includes('Updated long description'), 'Plan should show updated long description');
    });

    test('should fail when no update fields provided', async () => {
      const result = await planChangeTool.execute({}, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Plan change should fail with no fields');
      assert.ok(result.error?.includes('At least one of name, short_description, or long_description must be provided'), 'Should indicate no fields provided');
    });

    test('should fail when no active plan exists', async () => {
      // Clear the active plan
      planContextManager.setCurrentPlanId(null);
      
      const result = await planChangeTool.execute({
        name: 'New Name'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Plan change should fail with no active plan');
      assert.ok(result.error?.includes('No active plan'), 'Should indicate no active plan');
    });

    test('should fail when plan file does not exist', async () => {
      // Set a non-existent plan as active
      planContextManager.setCurrentPlanId('non_existent_plan');
      
      const result = await planChangeTool.execute({
        name: 'New Name'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Plan change should fail with non-existent plan');
      assert.ok(result.error?.includes('not found'), 'Should indicate plan not found');
    });
  });

  suite('Error Handling with Active Plan Context', () => {
    setup(async () => {
      // Create a test plan and set as active
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Integration Test Plan',
        short_description: 'Plan for integration testing',
        long_description: 'Original request: "Create a test plan"\nTranslated request: "Create a test plan"\nLanguage: English'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
      
      // Open the plan to set it as active
      const openResult = await planOpenTool.execute({
        plan_id: testPlanId
      }, testWorkspaceRoot);
      
      assert.strictEqual(openResult.success, true, 'Plan open should succeed');
    });

    test('should work with active plan context', async () => {
      // Update using active plan context (no plan_id needed)
      const changeResult = await planChangeTool.execute({
        name: 'Opened Plan Updated',
        short_description: 'Updated via context'
      }, testWorkspaceRoot);
      
      assert.strictEqual(changeResult.success, true, 'Plan change should succeed with active plan');
      assert.ok(changeResult.content.includes('Opened Plan Updated'), 'Should update name');
      assert.ok(changeResult.content.includes('Updated via context'), 'Should update description');
      
      // Verify the change was applied
      const showResult = await planShowTool.execute({}, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Opened Plan Updated'), 'Should show updated name');
      assert.ok(showResult.content.includes('Updated via context'), 'Should show updated description');
    });

    test('should preserve original request format in long description', async () => {
      const result = await planChangeTool.execute({
        long_description: 'Original request: "Modify the system"\nTranslated request: "Modify the system"\nLanguage: English\n\nAdditional details: This is an updated plan with more information.'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Plan change should succeed');
      
      // Verify the long description format is preserved
      const showResult = await planShowTool.execute({}, testWorkspaceRoot);
      assert.ok(showResult.content.includes('Original request: "Modify the system"'), 'Should preserve original request format');
      assert.ok(showResult.content.includes('Additional details'), 'Should include additional content');
    });
  });
});
