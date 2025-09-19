// tests/planningTools.test.ts

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { PlanNewTool } from '../src/tools/planNew';
import { PlanListTool } from '../src/tools/planList';
import { PlanAddPointsTool } from '../src/tools/planAddPoints';
import { PlanChangePointTool } from '../src/tools/planChangePoint';
import { PlanShowTool } from '../src/tools/planShow';
import { PlanPointShowTool } from '../src/tools/planPointShow';
import { PlanPointCommentTool } from '../src/tools/planPointComment';
import { PlanPointImplementedTool } from '../src/tools/planPointImplemented';
import { PlanPointReviewedTool } from '../src/tools/planPointReviewed';
import { PlanPointTestedTool } from '../src/tools/planPointTested';
import { PlanPointNeedReworkTool } from '../src/tools/planPointNeedRework';
import { PlanReviewedTool } from '../src/tools/planReviewed';
import { PlanNeedWorksTool } from '../src/tools/planNeedWorks';
import { PlanAcceptedTool } from '../src/tools/planAccepted';
import { PlanStateTool } from '../src/tools/planState';
import { PlanDoneTool } from '../src/tools/planDone';
import { PlanDeleteTool } from '../src/tools/planDelete';
import { PlanOpenTool } from '../src/tools/planOpen';

suite('Planning Tools Test Suite', () => {
  const testWorkspaceRoot = '/tmp/planning-test-workspace';
  let testPlanId: string;
  let currentPointId: string;
  let testPointId: string;
  let planContextManager: PlanContextManager;
  
  let planNewTool: PlanNewTool;
  let planListTool: PlanListTool;
  let planAddPointsTool: PlanAddPointsTool;
  let planChangePointTool: PlanChangePointTool;
  let planShowTool: PlanShowTool;
  let planPointShowTool: PlanPointShowTool;
  let planPointCommentTool: PlanPointCommentTool;
  let planPointImplementedTool: PlanPointImplementedTool;
  let planPointReviewedTool: PlanPointReviewedTool;
  let planPointTestedTool: PlanPointTestedTool;
  let planPointNeedReworkTool: PlanPointNeedReworkTool;
  let planReviewedTool: PlanReviewedTool;
  let planNeedWorksTool: PlanNeedWorksTool;
  let planAcceptedTool: PlanAcceptedTool;
  let planStateTool: PlanStateTool;
  let planDoneTool: PlanDoneTool;
  let planDeleteTool: PlanDeleteTool;
  let planOpenTool: PlanOpenTool;

  setup(() => {
    // Generate unique plan ID for each test run
    testPlanId = `test-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get singleton instance of plan context manager
    planContextManager = PlanContextManager.getInstance();
    // Ensure workspace directory exists
    const fs = require('fs');
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }
    
    // Initialize all planning tools
    planNewTool = new PlanNewTool();
    planListTool = new PlanListTool();
    planAddPointsTool = new PlanAddPointsTool();
    planChangePointTool = new PlanChangePointTool();
    planShowTool = new PlanShowTool();
    planPointShowTool = new PlanPointShowTool();
    planPointCommentTool = new PlanPointCommentTool();
    planPointImplementedTool = new PlanPointImplementedTool();
    planPointReviewedTool = new PlanPointReviewedTool();
    planPointTestedTool = new PlanPointTestedTool();
    planPointNeedReworkTool = new PlanPointNeedReworkTool();
    planReviewedTool = new PlanReviewedTool();
    planNeedWorksTool = new PlanNeedWorksTool();
    planAcceptedTool = new PlanAcceptedTool();
    planStateTool = new PlanStateTool();
    planDoneTool = new PlanDoneTool();
    planDeleteTool = new PlanDeleteTool();
    planOpenTool = new PlanOpenTool();
  });

  teardown(async () => {
    // Clean up test files by deleting the plan if it exists
    try {
      // Try to delete the plan with current instance
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
      const path = require('path');
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
  suite('Tool Info and Definitions', () => {
    test('All tools have proper info', () => {
      const tools = [
        planNewTool, planListTool, planAddPointsTool, planChangePointTool,
        planShowTool, planPointShowTool, planPointCommentTool,
        planPointImplementedTool, planPointReviewedTool, planPointTestedTool,
        planPointNeedReworkTool, planReviewedTool,
        planNeedWorksTool, planAcceptedTool, planStateTool, planDoneTool, planDeleteTool
      ];
      tools.forEach(tool => {
        const info = tool.getToolInfo();
        assert.ok(info.name, `Tool should have a name: ${tool.constructor.name}`);
        assert.ok(info.displayName, `Tool should have a display name: ${tool.constructor.name}`);
        assert.ok(info.description, `Tool should have a description: ${tool.constructor.name}`);
        assert.strictEqual(info.category, 'other', `Tool should have 'other' category: ${tool.constructor.name}`);
        const definition = tool.getToolDefinition();
        assert.strictEqual(definition.type, 'function', `Tool should be function type: ${tool.constructor.name}`);
        assert.ok(definition.function, `Tool should have function definition: ${tool.constructor.name}`);
        assert.ok(definition.function.name, `Tool function should have name: ${tool.constructor.name}`);
        assert.ok(definition.function.description, `Tool function should have description: ${tool.constructor.name}`);
        assert.ok(definition.function.parameters, `Tool function should have parameters: ${tool.constructor.name}`);
      });
    });
  });
  suite('Plan Creation and Management', () => {
    test('Create new plan', async () => {
      const result = await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      if (!result.success) {
        console.error('Plan creation failed with error:', result.error);
      }

      assert.strictEqual(result.success, true, 'Plan creation should succeed');
      assert.ok(result.content.includes(testPlanId), 'Result should mention plan ID');
    });

    test('List plans includes created plan', async () => {
      // First create a plan
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const result = await planListTool.execute({}, testWorkspaceRoot);
      assert.strictEqual(result.success, true, 'Plan listing should succeed');
      assert.ok(result.content.includes(testPlanId), 'List should include created plan');
    });
    test('Show plan details', async () => {
      // First create a plan
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
      
      // Set current plan context
      planContextManager.setCurrentPlanId(testPlanId);

      const result = await planShowTool.execute({}, testWorkspaceRoot);
      assert.strictEqual(result.success, true, 'Plan show should succeed');
      assert.ok(result.content.includes('Test Plan'), 'Should show plan name');
      assert.ok(result.content.includes('A comprehensive test plan used for validating'), 'Should show plan description');
    });
  });
  suite('Point Management', () => {
    setup(async () => {
      // Create test plan for point operations
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
      
      // Set current plan context for all point operations
      planContextManager.setCurrentPlanId(testPlanId);
    });

    test('Add points to plan', async () => {
      // Plan context is already set in setup

      const result = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_outputs: 'Test output',
          expected_inputs: 'Test plan and requirements'
        }]
      }, testWorkspaceRoot);

      if (!result.success) {
        console.log('Add points failed:', result.error);
      }
      assert.strictEqual(result.success, true, 'Points addition should succeed');
      
      // Extract point ID from the response content for use in other tests
      const match = result.content.match(/Point IDs: ([^)]+)/);
      if (match) {
        testPointId = match[1].split(', ')[0]; // Get first point ID
      }
      
      assert.ok(result.content.includes('Point'), 'Result should mention point creation');
    });

    test('Add multiple points to plan at once', async () => {
      // Plan context is already set in setup

      const result = await planAddPointsTool.execute({
        after_point_id: null,
        points: [
          {
            short_name: 'Point 1',
            short_description: 'First test point',
            detailed_description: 'Detailed description for the first test point',
            review_instructions: 'First point review instructions',
            testing_instructions: 'First point testing instructions',
            expected_outputs: 'Test output 1',
            expected_inputs: 'Initial requirements'
          },
          {
            short_name: 'Point 2',
            short_description: 'Second test point',
            detailed_description: 'Detailed description for the second test point',
            review_instructions: 'Second point review instructions',
            testing_instructions: 'Second point testing instructions',
            expected_outputs: 'Test output 2',
            expected_inputs: 'Results from Point 1'
          },
          {
            short_name: 'Point 3',
            short_description: 'Third test point',
            detailed_description: 'Detailed description for the third test point',
            review_instructions: 'Third point review instructions',
            testing_instructions: 'Third point testing instructions',
            expected_outputs: 'Test output 3',
            expected_inputs: 'Results from Point 2'
          }
        ]
      }, testWorkspaceRoot);

      if (!result.success) {
        console.log('Add multiple points failed:', result.error);
      }
      assert.strictEqual(result.success, true, 'Multiple points addition should succeed');
      assert.ok(result.content.includes('3 points added'), 'Result should mention 3 points created');
      
      // Extract point IDs from the response for verification
      const match = result.content.match(/Point IDs: ([^)]+)/);
      assert.ok(match, 'Should have point IDs in response');
      const pointIds = match[1].split(', ');
      assert.strictEqual(pointIds.length, 3, 'Should have 3 point IDs');
      
      // Verify that all IDs are unique
      const uniqueIds = new Set(pointIds);
      assert.strictEqual(uniqueIds.size, 3, 'All point IDs should be unique');
      
      // Verify that IDs are sequential
      const numericIds = pointIds.map((id: string) => parseInt(id)).sort((a: number, b: number) => a - b);
      assert.strictEqual(numericIds[1] - numericIds[0], 1, 'IDs should be sequential');
      assert.strictEqual(numericIds[2] - numericIds[1], 1, 'IDs should be sequential');
    });

    test('Change point details', async () => {
      // Plan context is already set in setup, add a point first
      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point IDs: ([^)]+)/);
      if (match) {
        testPointId = match[1].split(', ')[0];
      }

      const result = await planChangePointTool.execute({
        point_id: testPointId,
        short_name: 'Updated Test Point',
        short_description: 'An updated test point description'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Point change should succeed');
      assert.ok(result.content.includes('updated'), 'Result should show updated status');
    });

    test('Show point details', async () => {
      // First create a plan
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      // Then add a point
      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point IDs: ([^)]+)/);
      if (match) {
        testPointId = match[1].split(', ')[0];
      }

      const result = await planPointShowTool.execute({
        point_id: testPointId,
        sections: ['short_description', 'long_description', 'state']
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Point show should succeed');
      assert.ok(result.content.includes('Point') || result.content.includes('Test'), 'Should show point information');
    });
  });

  suite('Point Status Management', () => {
    setup(async () => {
      // Create test plan and point for status operations
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
      
      // Set current plan context for all status operations
      planContextManager.setCurrentPlanId(testPlanId);

      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point '([^']+)'/);
      if (match) {
        testPointId = match[1].split(', ')[0];
      }
    });

    test('Mark point as implemented', async () => {
      const result = await planPointImplementedTool.execute({
        point_id: testPointId
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Mark implemented should succeed');
      assert.ok(result.content.includes('implemented'), 'Result should mention implemented status');
    });

    test('Mark point as reviewed', async () => {
      // First create a plan and add a point
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point '([^']+)'/);
      if (match) {
        testPointId = match[1].split(', ')[0];
      }

      // First mark as implemented
      await planPointImplementedTool.execute({
        point_id: testPointId
      }, testWorkspaceRoot);

      const result = await planPointReviewedTool.execute({
        point_id: testPointId,
        comment: 'Code review passed - implementation meets requirements'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Mark reviewed should succeed');
      assert.ok(result.content.includes('reviewed'), 'Result should mention reviewed status');
    });

    test('Mark point as tested', async () => {
      // First create a plan and add a point
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point '([^']+)'/);
      if (match) {
        testPointId = match[1].split(', ')[0];
      }

      // First mark as implemented and reviewed
      await planPointImplementedTool.execute({
        point_id: testPointId
      }, testWorkspaceRoot);

      await planPointReviewedTool.execute({
        point_id: testPointId,
        comment: 'Code review passed - good implementation'
      }, testWorkspaceRoot);

      const result = await planPointTestedTool.execute({
        point_id: testPointId,
        comment: 'All tests passed successfully'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Mark tested should succeed');
      assert.ok(result.content.includes('tested'), 'Result should mention tested status');
    });

    test('Mark point as needing rework', async () => {
      const result = await planPointNeedReworkTool.execute({
        point_id: testPointId,
        rework_reasons: ['Failed unit tests', 'Code review issues']
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Mark need rework should succeed');
      assert.ok(result.content.includes('rework'), 'Result should mention rework status');
      assert.ok(result.content.includes('Failed unit tests'), 'Result should include rework reason');
    });

    test('Mark plan as accepted', async () => {
      // Create a new plan with a fresh point for this test
      const planAcceptanceTestId = 'plan-acceptance-test-' + Date.now();
      
      await planNewTool.execute({
        id: planAcceptanceTestId,
        name: 'Plan Acceptance Test',
        short_description: 'A test plan for plan acceptance validation',
        long_description: 'A test plan created specifically to validate plan acceptance functionality'
      }, testWorkspaceRoot);

      // Set context to this plan
      const planContextManager = PlanContextManager.getInstance();
      planContextManager.setCurrentPlanId(planAcceptanceTestId);

      // Add a point to this plan
      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Acceptance Test Point',
          short_description: 'A point for plan acceptance testing',
          detailed_description: 'A point created specifically for testing plan acceptance workflow',
          review_instructions: 'Point should be properly reviewed and tested before plan acceptance',
          testing_instructions: 'Test all functionality before accepting plan',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output for acceptance test'
        }]
      }, testWorkspaceRoot);

      console.log('Add point result:', addResult);

      // Extract point ID from the response
      const match = addResult.content.match(/Point IDs?: ([^.\s]+)/);
      let acceptanceTestPointId: string;
      if (match) {
        acceptanceTestPointId = match[1].trim();
      } else {
        throw new Error(`Failed to extract point ID from add result: ${addResult.content}`);
      }

      // Complete the workflow: implement, review, and test the point
      await planPointImplementedTool.execute({
        point_id: acceptanceTestPointId
      }, testWorkspaceRoot);

      await planPointReviewedTool.execute({
        point_id: acceptanceTestPointId,
        comment: 'Code review completed successfully - all requirements met'
      }, testWorkspaceRoot);

      await planPointTestedTool.execute({
        point_id: acceptanceTestPointId,
        comment: 'All tests pass and coverage is adequate'
      }, testWorkspaceRoot);

      // Now test plan acceptance with all points reviewed and tested
      const result = await planAcceptedTool.execute({
        comment: 'All plan requirements have been met. Implementation is complete, tested, and reviewed. Ready for production.'
      }, testWorkspaceRoot);

      console.log('Plan acceptance result:', result);
      assert.strictEqual(result.success, true, `Mark plan accepted should succeed. Error: ${result.error}`);
      assert.ok(result.content.includes('accepted'), 'Result should mention accepted status');
      assert.ok(result.content.includes('production'), 'Result should include acceptance comment');

      // Reset context back to original plan
      planContextManager.setCurrentPlanId(testPlanId);
    });

    test('Mark plan as reviewed', async () => {
      const result = await planReviewedTool.execute({
        comment: 'Plan structure is well-designed and comprehensive. All requirements are clearly defined.'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Mark plan reviewed should succeed');
      assert.ok(result.content.includes('reviewed'), 'Result should mention reviewed status');
      assert.ok(result.content.includes('comprehensive'), 'Result should include comment');
    });

    test('Mark plan as needing work', async () => {
      const result = await planNeedWorksTool.execute({
        comments: [
          'Plan needs more detailed acceptance criteria',
          'Additional test cases required',
          'Consider adding security requirements'
        ]
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Mark plan need works should succeed');
      assert.ok(result.content.includes('needing work'), 'Result should mention need work status');
      assert.ok(result.content.includes('acceptance criteria'), 'Result should include comment');
    });
  });

  suite('Point Features', () => {
    setup(async () => {
      // Create test plan and points for feature operations
      const createResult = await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);
      
      assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
      
      // Set current plan context for all feature operations
      planContextManager.setCurrentPlanId(testPlanId);

      const addResult1 = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract first point ID
      const match1 = addResult1.content.match(/Point '([^']+)'/);
      if (match1) {
        testPointId = match1[1];
      }

      await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Second Point',
          short_description: 'Another test point',
          detailed_description: 'Another comprehensive test point used for validating dependencies',
          review_instructions: 'Point should be created successfully and can be used as dependency',
          testing_instructions: 'Test that point can be properly used as dependency for other points',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);
    });

    test('Add comment to point', async () => {
      const result = await planPointCommentTool.execute({
        point_id: testPointId,
        comment: 'This is a test comment'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Add comment should succeed');
      assert.ok(result.content.includes('test comment'), 'Result should mention comment text');
    });
  });

  suite('Plan State and Completion', () => {
    setup(async () => {
      // Create test plan and point for state operations
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point '([^']+)'/);
      if (match) {
        testPointId = match[1].split(', ')[0];
      }
    });

    test('Get plan state', async () => {
      const result = await planStateTool.execute({
        plan_id: testPlanId
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Get state should succeed');
      assert.ok(result.content.includes('Total Points'), 'Should show total points');
      assert.ok(result.content.includes('Progress'), 'Should show progress information');
    });

    test('Check plan completion status', async () => {
      const result = await planDoneTool.execute({
        plan_id: testPlanId
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Check done should succeed');
      assert.ok(result.content.includes('Status'), 'Should show completion status');
    });

    test('Plan is not done when plan is not accepted', async () => {
      const result = await planDoneTool.execute({
        plan_id: testPlanId
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Check should succeed');
      assert.ok(result.content.includes('IN PROGRESS'), 'Should show in progress status');
    });

    test('Plan is done when plan is accepted', async () => {
      // Use unique plan ID for this test
      const uniquePlanId = `test-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Ensure clean state by deleting any existing plan
      try {
        await planDeleteTool.execute({ plan_id: uniquePlanId, confirm: true }, testWorkspaceRoot);
      } catch (error) {
        // Ignore if plan doesn't exist
      }
      // First create a plan and add a point
      await planNewTool.execute({
        id: uniquePlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      // Set the plan as active for all operations
      await planOpenTool.execute({
        plan_id: uniquePlanId
      }, testWorkspaceRoot);

      const addResult = await planAddPointsTool.execute({
        after_point_id: null,
        points: [{
          short_name: 'Test Point',
          short_description: 'A test point for validation',
          detailed_description: 'A comprehensive test point used for validating the planning point system functionality',
          review_instructions: 'Point should be created successfully and appear in plan',
          testing_instructions: 'Test that point appears correctly in plan output',
          expected_inputs: 'Test requirements',
          expected_outputs: 'Test output'
        }]
      }, testWorkspaceRoot);

      // Extract point ID from the response
      const match = addResult.content.match(/Point IDs: ([^,\s]+)/);
      let localTestPointId = '';
      if (match) {
        localTestPointId = match[1];
      }

      // Mark point through the full workflow: implemented -> reviewed -> tested -> accepted
      await planPointImplementedTool.execute({
        point_id: localTestPointId
      }, testWorkspaceRoot);

      await planPointReviewedTool.execute({
        point_id: localTestPointId,
        comment: 'Code review passed - implementation complete'
      }, testWorkspaceRoot);

      await planPointTestedTool.execute({
        point_id: localTestPointId,
        comment: 'All tests passing - validation complete'
      }, testWorkspaceRoot);

      // Mark entire plan as accepted instead of individual points
      await planAcceptedTool.execute({
        comment: 'All plan requirements have been met and implementation is complete'
      }, testWorkspaceRoot);

      const result = await planDoneTool.execute({}, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Check should succeed');
      assert.ok(result.content.includes('COMPLETE') || result.content.includes('done'), 'Should show complete status');
      
      // Clean up
      await planDeleteTool.execute({ plan_id: uniquePlanId, confirm: true }, testWorkspaceRoot);
    });
  });
  suite('Plan Deletion', () => {
    test('Delete plan requires confirmation', async () => {
      // First create a plan
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const result = await planDeleteTool.execute({
        plan_id: testPlanId,
        confirm: false
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Delete without confirmation should fail');
      assert.ok(result.error?.includes('confirmation'), 'Error should mention confirmation requirement');
    });

    test('Delete plan with confirmation', async () => {
      // First create a plan
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const result = await planDeleteTool.execute({
        plan_id: testPlanId,
        confirm: true
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, true, 'Delete with confirmation should succeed');
      assert.ok(result.content.includes('deleted'), 'Result should mention deletion');
    });
  });

  suite('Error Handling', () => {
    test('Invalid plan ID handling', async () => {
      const result = await planShowTool.execute({
        plan_id: 'non-existent-plan'
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Should fail for non-existent plan');
      assert.ok(result.error, 'Should provide error message');
    });

    test('Invalid point ID handling', async () => {
      // Create plan first
      await planNewTool.execute({
        id: testPlanId,
        name: 'Test Plan',
        short_description: 'A test plan for validation',
        long_description: 'A comprehensive test plan used for validating the planning system functionality'
      }, testWorkspaceRoot);

      const result = await planPointShowTool.execute({
        point_id: 'non-existent-point',
        sections: ['short_description']
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Should fail for non-existent point');
      assert.ok(result.error, 'Should provide error message');
    });

    test('Missing required parameters', async () => {
      const result = await planNewTool.execute({
        id: testPlanId
        // Missing name and descriptions
      }, testWorkspaceRoot);

      assert.strictEqual(result.success, false, 'Should fail for missing parameters');
      assert.ok(result.error, 'Should provide error message');
    });
  });
});
