// tests/newPlanCreationIntegration.test.ts

import * as assert from 'assert';
import { PlanningService } from '../src/planningService';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('New Plan Creation Integration Tests', () => {
  let planningService: PlanningService;
  let tempDir: string;

  suiteSetup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-integration-test-'));
  });

  suiteTeardown(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  setup(() => {
    planningService = PlanningService.getInstance(tempDir);
    const planIds = planningService.listPlans().success ? planningService.listPlans().plans!.map(p => p.id) : [];
    planIds.forEach(id => planningService.deletePlan(id, true));
  });

  test('should complete full plan creation workflow', () => {
    // Step 1: Create initial plan
    const createResult = planningService.createPlanWithLanguageInfo(
      'integration-test-plan',
      'Web Server',
      'Plan created from user request. Will be populated during creation process.',
      'Default placeholder description',
      'czech',
      'Vytvoř webový server s REST API',
      'Create web server with REST API'
    );
    assert.ok(createResult.success, 'Plan creation should succeed');

    // Step 2: Evaluate - should need description update
    let evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Vytvoř webový server s REST API');
    assert.ok(evaluationResult.success);
    assert.ok(evaluationResult.result);
    assert.strictEqual(evaluationResult.result.isDone, false);
    assert.strictEqual(evaluationResult.result.failedStep, 'plan_description_update');
    assert.strictEqual(evaluationResult.result.recommendedMode, 'Architect');
    assert.ok(evaluationResult.result.nextStepPrompt.includes('plan_change tool'), 'Should prompt for plan change tool usage');

    // Step 3: Update descriptions (simulate Architect mode)
    const updateResult = planningService.updatePlanDetails(
      'integration-test-plan',
      undefined,
      'Create a robust web server with REST API endpoints',
      'Build a complete web server application using Node.js and Express.js framework with full REST API functionality including authentication, error handling, and comprehensive endpoint coverage for CRUD operations.'
    );
    assert.ok(updateResult.success, 'Plan update should succeed');

    // Step 4: Use the completion callback to mark the description update as complete
    if (evaluationResult.result?.doneCallback) {
      evaluationResult.result.doneCallback(true, 'Descriptions updated successfully');
    }

    // Step 5: Evaluate after descriptions update - should need description review
    evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Create comprehensive web server');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.failedStep, 'plan_description_review');
    assert.strictEqual(evaluationResult.result?.recommendedMode, 'Plan Reviewer');

    // Step 6: Complete description review (simulate Reviewer mode)
    const reviewEvaluationResult = evaluationResult; // Store the review evaluation result
    if (reviewEvaluationResult.result?.doneCallback) {
      reviewEvaluationResult.result.doneCallback(true, 'Descriptions reviewed and approved');
    }

    // Step 7: Evaluate after description review - should need architecture creation
    evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Create comprehensive web server');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.failedStep, 'plan_architecture_creation');
    assert.strictEqual(evaluationResult.result?.recommendedMode, 'Architect');

    // Step 8: Add architecture (simulate Architect mode)

    // Step 5: Mark plan as reviewed (simulate Plan Reviewer mode)
    const reviewResult = planningService.setPlanReviewed('integration-test-plan', 'Plan looks comprehensive and well-structured');
    assert.ok(reviewResult.success, 'Plan review should succeed');

    // Step 6: Evaluate - should need architecture creation
    evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Vytvoř webový server s REST API');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.isDone, false);
    assert.strictEqual(evaluationResult.result?.failedStep, 'architecture_creation');
    assert.strictEqual(evaluationResult.result?.recommendedMode, 'Architect');

        // Step 4: Add architecture (simulate Architect mode)
    const architectureResult = planningService.setArchitecture(
      'integration-test-plan',
      `## Web Server Architecture
      
### Technology Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js 4.x
- **Authentication**: JWT-based authentication system
- **Database**: PostgreSQL with TypeORM
- **Validation**: Joi or express-validator
- **Error Handling**: Centralized error middleware

### System Components
1. **HTTP Server Layer**: Express.js routing and middleware
2. **Authentication Layer**: JWT token validation
3. **Business Logic Layer**: Service classes for business rules
4. **Data Access Layer**: Repository pattern with TypeORM
5. **Database Layer**: PostgreSQL database

### API Endpoint Structure
- POST /api/auth/login - User authentication
- GET /api/users - List users (authenticated)
- POST /api/users - Create user
- GET /api/users/:id - Get specific user
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user

### Security Considerations
- JWT token expiration and refresh mechanism
- Input validation and sanitization
- SQL injection prevention through ORM
- Rate limiting for API endpoints`
    );
    assert.ok(architectureResult.success, 'Architecture addition should succeed');

    // Step 8: Evaluate - should need architecture review
    evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Vytvoř webový server s REST API');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.isDone, false);
    assert.strictEqual(evaluationResult.result?.failedStep, 'architecture_review');
    assert.strictEqual(evaluationResult.result?.recommendedMode, 'Plan Reviewer');

    // Step 9: Mark architecture as reviewed (simulate callback)
    if (evaluationResult.result?.doneCallback) {
      evaluationResult.result.doneCallback(true, 'Architecture approved - good separation of concerns');
    }

    // Step 10: Evaluate - should need plan points
    evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Vytvoř webový server s REST API');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.isDone, false);
    assert.strictEqual(evaluationResult.result?.failedStep, 'plan_points_creation');
    assert.strictEqual(evaluationResult.result?.recommendedMode, 'Architect');

    // Step 11: Add plan points (simulate Architect mode)
    const addPointsResult = planningService.addPoints('integration-test-plan', null, [
      {
        short_name: 'Setup Server',
        short_description: 'Initialize Express.js server',
        detailed_description: 'Create basic Express.js server with middleware setup and basic configuration',
        review_instructions: 'Verify server starts on configured port and responds to health check',
        testing_instructions: 'Test server startup and basic HTTP response',
        expected_outputs: 'Running server listening on port 3000',
        expected_inputs: 'Node.js environment, package.json dependencies',
        depends_on: ['-1']
      },
      {
        short_name: 'Create API Routes',
        short_description: 'Implement REST API endpoints',
        detailed_description: 'Create comprehensive REST API routes for CRUD operations with proper HTTP methods',
        review_instructions: 'Check all endpoints are properly documented and handle errors correctly',
        testing_instructions: 'Test all API endpoints with various input scenarios',
        expected_outputs: 'Functional REST API with proper response codes',
        expected_inputs: 'Express.js server, request validation middleware',
        depends_on: ['1']
      }
    ]);
    assert.ok(addPointsResult.success, 'Adding plan points should succeed');

        // Step 11: Final evaluation - should be complete
    evaluationResult = planningService.evaluatePlanCreation('integration-test-plan', 'Vytvoř webový server s REST API');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.isDone, true, 'Plan creation workflow should be complete');
    assert.ok(evaluationResult.result?.nextStepPrompt.includes('Plan creation completed successfully'), 'Should show completion message');
  });

  test('should handle plan creation rework cycle', () => {
    // Step 1: Create initial plan
    const createResult = planningService.createPlanWithLanguageInfo(
      'rework-test-plan',
      'Incomplete Plan',
      'This plan will be marked as needing rework',
      'Placeholder description',
      'english',
      'Create incomplete system',
      'Create incomplete system'
    );
    assert.ok(createResult.success);

    // Step 2: Evaluate - should need description update
    let evaluationResult = planningService.evaluatePlanCreation('rework-test-plan', 'Create incomplete system');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.failedStep, 'plan_description_update');

    // Step 3: Update descriptions
    const updateResult = planningService.updatePlanDetails(
      'rework-test-plan',
      undefined,
      'Create incomplete system with issues',
      'This system has problems and needs rework'
    );
    assert.ok(updateResult.success, 'Plan update should succeed');

    // Step 4: Complete description review
    let reviewResult = planningService.setPlanReviewed('rework-test-plan', 'Descriptions approved');
    assert.ok(reviewResult.success);

    // Step 5: Add architecture
    const architectureResult = planningService.setArchitecture(
      'rework-test-plan',
      JSON.stringify({
        components: [{ id: 'broken-component', name: 'Broken Component', type: 'service' }]
      })
    );
    assert.ok(architectureResult.success, 'Architecture addition should succeed');

    // Step 6: Mark architecture as reviewed
    evaluationResult = planningService.evaluatePlanCreation('rework-test-plan', 'Create incomplete system');
    if (evaluationResult.result?.doneCallback) {
      evaluationResult.result.doneCallback(true, 'Architecture approved');
    }

    // Step 7: Add minimal plan points
    const addPointsResult = planningService.addPoints('rework-test-plan', null, [
      {
        short_name: 'Incomplete Task',
        short_description: 'Do something incomplete',
        detailed_description: 'This task is not well defined',
        review_instructions: 'Review this incomplete task',
        testing_instructions: 'Test this somehow',
        expected_outputs: 'Something',
        expected_inputs: 'Something else',
        depends_on: ['-1']
      }
    ]);
    assert.ok(addPointsResult.success);

    // Step 8: Mark plan as needing rework
    const reworkResult = planningService.setPlanNeedsWork('rework-test-plan', [
      'This plan is incomplete and needs significant rework.',
      'The architecture is too simple and the plan points are not detailed enough.'
    ]);
    assert.ok(reworkResult.success, 'Setting plan as needing rework should succeed');

    // Step 9: Evaluate - should detect rework needed
    evaluationResult = planningService.evaluatePlanCreation('rework-test-plan', 'Create incomplete system');
    assert.ok(evaluationResult.success);
    assert.strictEqual(evaluationResult.result?.failedStep, 'plan_rework');
    assert.ok(evaluationResult.result?.nextStepPrompt.includes('rework'), 'Should mention rework in prompt');
    assert.strictEqual(evaluationResult.result?.recommendedMode, 'Architect', 'Should recommend Architect mode for rework');
  });
});
