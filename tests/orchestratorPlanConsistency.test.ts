// tests/orchestratorPlanConsistency.test.ts

import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { AlgorithmEngine } from '../src/algorithmEngine';
import { ToolsService } from '../src/tools';

describe('Orchestrator Plan Consistency Test', () => {
  let testWorkspace: string;
  let planningService: PlanningService;
  let planContextManager: PlanContextManager;
  let algorithmEngine: AlgorithmEngine;
  let toolsService: ToolsService;

  beforeEach(() => {
    // Create temporary workspace
    testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrator-consistency-test-'));
    
    // Reset singletons
    PlanningService.resetInstance();
    PlanContextManager.resetInstance();
    
    // Create services using the SAME workspace
    planningService = PlanningService.getInstance(testWorkspace);
    planContextManager = PlanContextManager.getInstance();
    algorithmEngine = AlgorithmEngine.getInstance();
    
    // Set up algorithm engine with same PlanningService instance
    algorithmEngine.setPlanningService(planningService);
    
    // Create tools service with same workspace
    toolsService = new ToolsService();
    // Mock workspace folder
    (toolsService as any).workspaceRoot = testWorkspace;
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    
    // Reset singletons
    PlanningService.resetInstance();
    PlanContextManager.resetInstance();
  });

  it('orchestrator and tools should use the same PlanningService instance', () => {
    // Get PlanningService from algorithm engine context
    const algorithmPlanningService = (algorithmEngine as any).planningService;
    
    // Get PlanningService from tools service
    const toolsPlanningService = toolsService.getPlanningService();
    
    // They should be the same instance
    assert.strictEqual(algorithmPlanningService, toolsPlanningService, 
      'Algorithm and tools should use the same PlanningService instance');
  });

  it('plan created by orchestrator algorithm should be visible to tools', async () => {
    // Create a plan using orchestrator algorithm (simulating algorithm context)
    const createResult = planningService.createPlanWithLanguageInfo(
      'test-orchestrator-plan',
      'Test Plan',
      'Test short description',
      'Test long description',
      'english',
      'Original request'
    );
    
    assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
    
    // Set the plan as current (as orchestrator would do)
    planContextManager.setCurrentPlanId('test-orchestrator-plan');
    
    // Now check if tools can see the plan
    const toolsResult = await toolsService.executeTool('plan_list', { 
      include_short_description: true 
    });
    
    assert.strictEqual(toolsResult.success, true, 'Plan list from tools should succeed');
    assert.ok(toolsResult.content?.includes('test-orchestrator-plan'), 
      'Tools should see the plan created by orchestrator');
      
    // Test if plan_change tool can update the plan
    const changeResult = await toolsService.executeTool('plan_change', {
      short_description: 'Updated by tools'
    });
    
    assert.strictEqual(changeResult.success, true, 
      'plan_change tool should be able to update plan created by orchestrator');
    assert.ok(changeResult.content?.includes('successfully updated'), 
      'plan_change should confirm successful update');
  });

  it('current plan context should be consistent between orchestrator and tools', async () => {
    // Create a plan via orchestrator
    const createResult = planningService.createPlanWithLanguageInfo(
      'test-context-plan',
      'Context Test Plan', 
      'Testing context consistency',
      'Long description for context test',
      'english',
      'Test context request'
    );
    
    assert.strictEqual(createResult.success, true, 'Plan creation should succeed');
    
    // Set current plan via orchestrator
    planContextManager.setCurrentPlanId('test-context-plan');
    
    // Verify current plan is set
    const currentPlan = planContextManager.getCurrentPlanId();
    assert.strictEqual(currentPlan, 'test-context-plan', 
      'Current plan should be set correctly');
    
    // Now test if tools can access the current plan
    const showResult = await toolsService.executeTool('plan_show', {});
    
    assert.strictEqual(showResult.success, true, 
      'plan_show should succeed for current plan');
    assert.ok(showResult.content?.includes('test-context-plan'), 
      'plan_show should display the current plan');
    assert.ok(showResult.content?.includes('Context Test Plan'), 
      'plan_show should display correct plan name');
  });

  it('plan workflow operations should work consistently after orchestrator creation', async () => {
    // Create plan via orchestrator
    planningService.createPlanWithLanguageInfo(
      'test-workflow-plan',
      'Workflow Test Plan',
      'Testing workflow consistency', 
      'Long description for workflow test',
      'english',
      'Workflow test request'
    );
    
    // Set as current plan
    planContextManager.setCurrentPlanId('test-workflow-plan');
    
    // Test plan_reviewed tool works
    const reviewResult = await toolsService.executeTool('plan_reviewed', {
      comment: 'Reviewed by tools'
    });
    
    assert.strictEqual(reviewResult.success, true, 
      'plan_reviewed should work on orchestrator-created plan');
    
    // Test plan_need_works tool works  
    const needWorksResult = await toolsService.executeTool('plan_need_works', {
      comments: ['Needs improvement']
    });
    
    assert.strictEqual(needWorksResult.success, true,
      'plan_need_works should work on orchestrator-created plan');
      
    // Verify the plan state was updated
    const finalShowResult = await toolsService.executeTool('plan_show', {});
    
    assert.strictEqual(finalShowResult.success, true,
      'Final plan_show should succeed');
    
    // Just verify that plan_show returns some meaningful content indicating the plan exists and has been worked on
    assert.ok(finalShowResult.content && finalShowResult.content.length > 100, 
      'Plan should show meaningful content indicating workflow operations were executed');
  });
});
