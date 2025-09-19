// tests/planActivityLogging.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Plan, PlanningService } from '../src/planningService';

suite('Plan Activity Logging Test Suite', () => {
  let planningService: PlanningService;
  let tempDir: string;

  setup(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-logging-test-'));
    planningService = PlanningService.getInstance(tempDir);
  });

  teardown(() => {
    // Clean up
    PlanningService.resetInstance();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  suite('Plan Creation Logging', () => {
  test('should log plan creation', () => {
    const planId = `test-plan-logging-${Date.now()}-${Math.random()}`;
    const planName = 'Test Plan with Logging';      const result = planningService.createPlan(planId, planName, 'Short desc', 'Long desc');
      assert.strictEqual(result.success, true);
      
      // Get logs
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      assert.strictEqual(logsResult.logs!.length, 1);
      
      const log = logsResult.logs![0];
      assert.strictEqual(log.type, 'plan');
      assert.strictEqual(log.action, 'created');
      assert.strictEqual(log.target, planId);
      assert.strictEqual(log.message, 'Plan created');
      assert.strictEqual(log.details, planName);
      assert.ok(log.timestamp > 0, 'Timestamp should be set');
    });
  });

  suite('Point Status Logging', () => {
    let planId: string;
    let pointId: string;

    setup(() => {
      planId = `test-plan-point-logging-${Date.now()}-${Math.random()}`;
      planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
      
      // Add a point
      const addResult = planningService.addPoints(planId, null, [{
        short_name: 'Test Point',
        short_description: 'Test point description',
        detailed_description: 'Detailed description',
        review_instructions: 'Review criteria',
        testing_instructions: 'Testing criteria',
        expected_outputs: 'Test outputs',
        expected_inputs: 'Test inputs'
      }]);
      
      assert.strictEqual(addResult.success, true);
      pointId = '1';
    });

    test('should log point implementation', () => {
      const result = planningService.setImplemented(planId, pointId);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Should have creation log + implementation log
      assert.strictEqual(logsResult.logs!.length, 2);
      
      const implementLog = logsResult.logs![0]; // newest first
      assert.strictEqual(implementLog.type, 'point');
      assert.strictEqual(implementLog.action, 'implemented');
      assert.strictEqual(implementLog.target, pointId);
      assert.strictEqual(implementLog.message, `Point ${pointId} new state implemented`);
      assert.strictEqual(implementLog.details, 'Test Point');
    });

    test('should log point review', () => {
      // First implement the point
      planningService.setImplemented(planId, pointId);
      
      const reviewComment = 'Looks good';
      const result = planningService.setReviewed(planId, pointId, reviewComment);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Should have creation + implementation + review logs
      assert.strictEqual(logsResult.logs!.length, 3);
      
      const reviewLog = logsResult.logs![0]; // newest first
      assert.strictEqual(reviewLog.type, 'point');
      assert.strictEqual(reviewLog.action, 'reviewed');
      assert.strictEqual(reviewLog.target, pointId);
      assert.strictEqual(reviewLog.message, `Point ${pointId} new state reviewed`);
      assert.strictEqual(reviewLog.details, reviewComment);
    });

    test('should log point testing', () => {
      // First implement and review the point
      planningService.setImplemented(planId, pointId);
      planningService.setReviewed(planId, pointId, 'Reviewed');
      
      const testComment = 'All tests pass';
      const result = planningService.setTested(planId, pointId, testComment);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Should have creation + implementation + review + test logs
      assert.strictEqual(logsResult.logs!.length, 4);
      
      const testLog = logsResult.logs![0]; // newest first
      assert.strictEqual(testLog.type, 'point');
      assert.strictEqual(testLog.action, 'tested');
      assert.strictEqual(testLog.target, pointId);
      assert.strictEqual(testLog.message, `Point ${pointId} new state tested`);
      assert.strictEqual(testLog.details, testComment);
    });

    test('should log point needs rework', () => {
      // First implement the point
      planningService.setImplemented(planId, pointId);
      
      const reworkReason = 'Needs better error handling';
      const result = planningService.setNeedRework(planId, pointId, reworkReason);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Should have creation + implementation + rework logs
      assert.strictEqual(logsResult.logs!.length, 3);
      
      const reworkLog = logsResult.logs![0]; // newest first
      assert.strictEqual(reworkLog.type, 'point');
      assert.strictEqual(reworkLog.action, 'needs_rework');
      assert.strictEqual(reworkLog.target, pointId);
      assert.strictEqual(reworkLog.message, `Point ${pointId} new state needs rework`);
      assert.strictEqual(reworkLog.details, reworkReason);
    });
  });

  suite('Plan Status Logging', () => {
    let planId: string;
    let pointId: string;

    setup(() => {
      planId = `test-plan-status-logging-${Date.now()}-${Math.random()}`;
      planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
      
      // Add and complete a point
      planningService.addPoints(planId, null, [{
        short_name: 'Test Point',
        short_description: 'Test point description',
        detailed_description: 'Detailed description',
        review_instructions: 'Review criteria',
        testing_instructions: 'Testing criteria',
        expected_outputs: 'Test outputs',
        expected_inputs: 'Test inputs'
      }]);
      
      pointId = '1';
      planningService.setImplemented(planId, pointId);
      planningService.setReviewed(planId, pointId, 'Reviewed');
      planningService.setTested(planId, pointId, 'Tested');
    });

    test('should log plan review', () => {
      const reviewComment = 'Plan structure is good';
      const result = planningService.setPlanReviewed(planId, reviewComment);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Find the plan review log
      const planReviewLog = logsResult.logs!.find(log => log.action === 'reviewed' && log.type === 'plan');
      assert.ok(planReviewLog !== undefined, 'Plan review log should exist');
      assert.strictEqual(planReviewLog!.target, planId);
      assert.strictEqual(planReviewLog!.message, 'Plan new state reviewed');
      assert.strictEqual(planReviewLog!.details, reviewComment);
    });

    test('should log plan needs work', () => {
      const workComments = ['Missing implementation details', 'Need better acceptance criteria'];
      const result = planningService.setPlanNeedsWork(planId, workComments);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Find the plan needs work log
      const needsWorkLog = logsResult.logs!.find(log => log.action === 'needs_work' && log.type === 'plan');
      assert.ok(needsWorkLog !== undefined, 'Plan needs work log should exist');
      assert.strictEqual(needsWorkLog!.target, planId);
      assert.strictEqual(needsWorkLog!.message, 'Plan new state needs work');
      assert.strictEqual(needsWorkLog!.details, workComments.join('; '));
    });

    test('should log plan acceptance', () => {
      const acceptComment = 'All requirements met, ready for production';
      const result = planningService.setPlanAccepted(planId, acceptComment);
      assert.strictEqual(result.success, true);
      
      const logsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(logsResult.success, true);
      
      // Find the plan acceptance log
      const acceptanceLog = logsResult.logs!.find(log => log.action === 'accepted' && log.type === 'plan');
      assert.ok(acceptanceLog !== undefined, 'Plan acceptance log should exist');
      assert.strictEqual(acceptanceLog!.target, planId);
      assert.strictEqual(acceptanceLog!.message, 'Plan new state accepted');
      assert.strictEqual(acceptanceLog!.details, acceptComment);
    });
  });

  suite('Log Management', () => {
    test('should limit number of logs returned', () => {
      const planId = `test-plan-log-limit-${Date.now()}-${Math.random()}`;
      planningService.createPlan(planId, 'Test Plan', 'Short desc', 'Long desc');
      
      // Add a point and perform multiple actions
      planningService.addPoints(planId, null, [{
        short_name: 'Test Point',
        short_description: 'Test point description',
        detailed_description: 'Detailed description',
        review_instructions: 'Review criteria',
        testing_instructions: 'Testing criteria',
        expected_outputs: 'Test outputs',
        expected_inputs: 'Test inputs'
      }]);
      
      const pointId = '1';
      
      // Perform actions to generate multiple logs
      planningService.setImplemented(planId, pointId);
      planningService.setNeedRework(planId, pointId, 'First rework');
      planningService.setImplemented(planId, pointId);
      planningService.setReviewed(planId, pointId, 'Reviewed');
      planningService.setTested(planId, pointId, 'Tested');
      
      // Get limited logs
      const limitedLogsResult = planningService.getPlanLogs(planId, 3);
      assert.strictEqual(limitedLogsResult.success, true);
      assert.strictEqual(limitedLogsResult.logs!.length, 3);
      
      // Get all logs
      const allLogsResult = planningService.getPlanLogs(planId);
      assert.strictEqual(allLogsResult.success, true);
      assert.ok(allLogsResult.logs!.length > 3, 'Should have more than 3 logs total');
      
      // Verify logs are sorted by newest first
      const logs = allLogsResult.logs!;
      for (let i = 1; i < logs.length; i++) {
        assert.ok(logs[i - 1].timestamp >= logs[i].timestamp, 'Logs should be sorted by timestamp descending');
      }
    });

    test('should return empty array for non-existent plan', () => {
      const nonExistentPlanId = `non-existent-plan-${Date.now()}-${Math.random()}`;
      const logsResult = planningService.getPlanLogs(nonExistentPlanId);
      assert.strictEqual(logsResult.success, false);
      assert.strictEqual(logsResult.error, `Plan with ID '${nonExistentPlanId}' not found`);
    });
  });
});
