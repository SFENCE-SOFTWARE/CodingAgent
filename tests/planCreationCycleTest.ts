// tests/planCreationCycleTest.ts

import * as assert from 'assert';
import { OrchestratorTestRunner, OrchestratorTestConfig } from '../src/orchestratorTestRunner';
import * as fs from 'fs';
import * as path from 'path';

describe('Plan Creation Cycle Detection Tests', () => {
  const testWorkspaceRoot = '/tmp/test-plan-creation-cycles';

  beforeEach(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (fs.existsSync(testWorkspaceRoot)) {
        fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Cleanup warning: ${error}`);
    }
  });

  it('should detect and handle infinite cycles in plan description review', async () => {
    const config: OrchestratorTestConfig = {
      planName: 'test-cycle-detection-description',
      planDescription: 'Test plan for cycle detection in description review',
      maxIterations: 15,
      workspaceRoot: testWorkspaceRoot,
      mockLLM: {
        scenarios: [
          {
            stepType: 'categorization',
            action: 'CUSTOM',
            customResponse: 'CREATE test-cycle-detection-description',
            toolCalls: []
          },
          {
            stepType: 'language_detection',
            action: 'CUSTOM',
            customResponse: 'English',
            toolCalls: []
          },
          {
            stepType: 'plan_description_update',
            action: 'CUSTOM',
            customResponse: 'Updated plan descriptions.',
            toolCalls: ['plan_change']
          },
          {
            stepType: 'plan_description_review',
            action: 'NEED_WORK',
            customResponse: 'Description needs more work.',
            toolCalls: ['plan_need_works']
          }
        ],
        defaultAction: 'NEED_WORK',
        verbose: true,
        detectCycles: true
      }
    };

    const testRunner = new OrchestratorTestRunner(config);

    try {
      const result = await testRunner.runTest();
      
      // Should fail due to cycle detection
      assert.strictEqual(result.success, false);
      assert.ok(result.error && result.error.includes('infinite cycle'));
      
      // Should have detected cycles in plan_description_review step
      const mockLLM = (testRunner as any).mockLLM;
      const cycleState = mockLLM.getCycleState();
      assert.strictEqual(cycleState.has('plan_description_review'), true);
      assert.ok(cycleState.get('plan_description_review') > 3);
      
    } catch (error: any) {
      // Cycle detection should throw error
      assert.ok(error.message.includes('infinite cycle'));
    }
  });

  it('should successfully complete plan creation with proper need_work and reviewed cycle', async () => {
    const config: OrchestratorTestConfig = {
      planName: 'test-complete-plan-creation',
      planDescription: 'Test plan for complete creation workflow',
      maxIterations: 25,
      workspaceRoot: testWorkspaceRoot,
      mockLLM: {
        scenarios: [
          {
            stepType: 'categorization',
            action: 'CUSTOM',
            customResponse: 'CREATE test-complete-plan-creation',
            toolCalls: []
          },
          {
            stepType: 'language_detection',
            action: 'CUSTOM',
            customResponse: 'English',
            toolCalls: []
          },
          // Description workflow: update -> need_work -> rework -> reviewed
          {
            stepType: 'plan_description_update',
            iteration: 1,
            action: 'CUSTOM',
            customResponse: 'Updated plan descriptions with basic information.',
            toolCalls: ['plan_change']
          },
          {
            stepType: 'plan_description_review',
            iteration: 1,
            action: 'NEED_WORK',
            customResponse: 'Descriptions need more technical details.',
            toolCalls: ['plan_need_works']
          },
          {
            stepType: 'plan_description_update_rework',
            iteration: 1,
            action: 'CUSTOM',
            customResponse: 'Reworked descriptions with technical details.',
            toolCalls: ['plan_change']
          },
          {
            stepType: 'plan_description_review',
            iteration: 2,
            action: 'REVIEWED',
            customResponse: 'Descriptions now meet requirements.',
            toolCalls: ['plan_reviewed']
          },
          // Architecture workflow: create -> need_work -> rework -> reviewed
          {
            stepType: 'plan_architecture_creation',
            iteration: 1,
            action: 'CUSTOM',
            customResponse: 'Created basic architecture design.',
            toolCalls: ['plan_set_architecture']
          },
          {
            stepType: 'plan_architecture_review',
            iteration: 1,
            action: 'NEED_WORK',
            customResponse: 'Architecture missing key components.',
            toolCalls: ['plan_need_works']
          },
          {
            stepType: 'plan_architecture_creation_rework',
            iteration: 1,
            action: 'CUSTOM',
            customResponse: 'Reworked architecture with all components.',
            toolCalls: ['plan_set_architecture']
          },
          {
            stepType: 'plan_architecture_review',
            iteration: 2,
            action: 'REVIEWED',
            customResponse: 'Architecture now complete.',
            toolCalls: ['plan_reviewed']
          },
          // Points workflow: create -> need_work -> rework -> reviewed
          {
            stepType: 'plan_points_creation',
            iteration: 1,
            action: 'CUSTOM',
            customResponse: 'Created implementation points.',
            toolCalls: ['plan_add_points']
          },
          {
            stepType: 'plan_points_creation_review',
            iteration: 1,
            action: 'NEED_WORK',
            customResponse: 'Points need better dependencies.',
            toolCalls: ['plan_need_works']
          },
          {
            stepType: 'plan_points_creation_rework',
            iteration: 1,
            action: 'CUSTOM',
            customResponse: 'Reworked points with proper dependencies.',
            toolCalls: ['plan_add_points']
          },
          {
            stepType: 'plan_points_creation_review',
            iteration: 2,
            action: 'REVIEWED',
            customResponse: 'Points are now properly structured.',
            toolCalls: ['plan_reviewed']
          }
        ],
        defaultAction: 'REVIEWED',
        verbose: true,
        enableIterationTracking: true,
        simulateCallbacks: true,
        detectCycles: false // Don't detect cycles for this success test
      }
    };

    const testRunner = new OrchestratorTestRunner(config);
    const result = await testRunner.runTest();

    // Should complete successfully
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, undefined);

    // Verify workflow steps
    assert.ok(result.workflow.length > 10);
    
    // Check that we went through both need_work and reviewed cycles
    const mockLLM = (testRunner as any).mockLLM;
    const stepIterations = mockLLM.getStepIterations();
    
    // Should have multiple iterations for review steps
    assert.ok(stepIterations.get('plan_description_review') > 1);
    assert.ok(stepIterations.get('plan_architecture_review') > 1);
    
    // Generate detailed report
    const reportPath = path.join(testWorkspaceRoot, 'test-report.txt');
    testRunner.generateReport(result, reportPath);
    assert.strictEqual(fs.existsSync(reportPath), true);
  });

  it('should detect rework cycles in architecture creation', async () => {
    const config: OrchestratorTestConfig = {
      planName: 'test-architecture-rework-cycle',
      planDescription: 'Test plan for architecture rework cycle detection',
      maxIterations: 12,
      workspaceRoot: testWorkspaceRoot,
      mockLLM: {
        scenarios: [
          {
            stepType: 'categorization',
            action: 'CUSTOM',
            customResponse: 'CREATE test-architecture-rework-cycle',
            toolCalls: []
          },
          {
            stepType: 'language_detection',
            action: 'CUSTOM',
            customResponse: 'English',
            toolCalls: []
          },
          {
            stepType: 'plan_description_update',
            action: 'CUSTOM',
            customResponse: 'Updated descriptions.',
            toolCalls: ['plan_change']
          },
          {
            stepType: 'plan_description_review',
            action: 'REVIEWED',
            customResponse: 'Descriptions approved.',
            toolCalls: ['plan_reviewed']
          },
          {
            stepType: 'plan_architecture_creation',
            action: 'CUSTOM',
            customResponse: 'Created architecture.',
            toolCalls: ['plan_set_architecture']
          },
          {
            stepType: 'plan_architecture_review',
            action: 'NEED_WORK',
            customResponse: 'Architecture needs work.',
            toolCalls: ['plan_need_works']
          }
        ],
        defaultAction: 'NEED_WORK',
        verbose: true,
        detectCycles: true
      }
    };

    const testRunner = new OrchestratorTestRunner(config);

    try {
      const result = await testRunner.runTest();
      
      // Should detect infinite cycle in architecture review
      assert.strictEqual(result.success, false);
      assert.ok(result.error && result.error.includes('infinite cycle'));
      
    } catch (error: any) {
      assert.ok(error.message.includes('infinite cycle'));
      assert.ok(error.message.includes('plan_architecture_review'));
    }
  });
});
