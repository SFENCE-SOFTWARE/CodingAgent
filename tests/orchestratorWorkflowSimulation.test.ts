import { describe, it, before, after } from 'mocha';
const chai = require('chai');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { PlanChangeTool } from '../src/tools/planChange';

const { expect } = chai;

describe('Orchestrator Workflow Simulation Test', () => {
  let testWorkspaceRoot: string;
  let planningService: PlanningService;
  let planContextManager: PlanContextManager;
  let planChangeTool: PlanChangeTool;
  
  const testPlanId = 'orchestrator-workflow-test';

  before(() => {
    // Create temporary workspace
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-orchestrator-workflow-'));
    console.log(`\n🧪 Testing orchestrator workflow simulation...`);
    console.log(`📁 Test workspace: ${testWorkspaceRoot}`);
    
    // Get service instances
    planningService = PlanningService.getInstance(testWorkspaceRoot);
    planContextManager = PlanContextManager.getInstance();
    planChangeTool = new PlanChangeTool();
  });

  after(() => {
    // Cleanup
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
    PlanningService.resetInstance();
    PlanContextManager.resetInstance();
  });

  it('should simulate complete orchestrator workflow with singletons', async () => {
    console.log('\n📋 Step 1: Creating plan (simulating orchestrator plan creation)...');
    
    // Create plan
    const createResult = planningService.createPlan(
      testPlanId,
      'Orchestrator Test Plan',
      'Initial short description',
      'Initial long description'
    );
    
    expect(createResult.success).to.be.true;
    console.log(`✅ Plan created: ${testPlanId}`);
    
    // Set plan context (this is what orchestrator does)
    planContextManager.setCurrentPlanId(testPlanId);
    const currentPlanId = planContextManager.getCurrentPlanId();
    expect(currentPlanId).to.equal(testPlanId);
    console.log(`✅ Plan context set: ${currentPlanId}`);

    console.log('\n🔄 Step 2: Simulating module reload scenario...');
    
    // Get fresh instances (simulating what happens during mode switching)
    const freshPlanningService = PlanningService.getInstance(testWorkspaceRoot);
    const freshPlanContextManager = PlanContextManager.getInstance();
    
    // Verify singleton instances are preserved
    const planningServiceSame = planningService === freshPlanningService;
    const contextManagerSame = planContextManager === freshPlanContextManager;
    
    console.log(`📊 PlanningService singleton preserved: ${planningServiceSame}`);
    console.log(`📊 PlanContextManager singleton preserved: ${contextManagerSame}`);
    
    expect(planningServiceSame).to.be.true;
    expect(contextManagerSame).to.be.true;

    console.log('\n🛠️ Step 3: Testing plan_change tool (this was failing before)...');
    
    // Verify plan context is preserved
    const preservedPlanId = freshPlanContextManager.getCurrentPlanId();
    console.log(`📊 Preserved plan ID: ${preservedPlanId}`);
    expect(preservedPlanId).to.equal(testPlanId);
    
    // Execute plan_change tool
    const toolResult = await planChangeTool.execute({
      short_description: 'Updated short description by plan_change tool',
      long_description: 'Updated long description by plan_change tool with all requirements and technical details'
    }, testWorkspaceRoot);
    
    console.log(`📊 Tool execution result:`, toolResult);
    
    // This should now succeed (was failing before the fix)
    expect(toolResult.success).to.be.true;
    expect(toolResult.error).to.be.undefined;
    
    console.log('✅ plan_change tool executed successfully!');

    console.log('\n📋 Step 4: Verifying plan updates...');
    
    // Verify the plan was updated
    const updatedPlan = freshPlanningService.showPlan(testPlanId);
    expect(updatedPlan.success).to.be.true;
    
    const plan = updatedPlan.plan!;
    console.log(`📊 Updated short description: "${plan.shortDescription}"`);
    console.log(`📊 Updated long description: "${plan.longDescription}"`);
    
    expect(plan.shortDescription).to.equal('Updated short description by plan_change tool');
    expect(plan.longDescription).to.equal('Updated long description by plan_change tool with all requirements and technical details');
    
    console.log('✅ Plan updates verified!');
    console.log('\n🎉 Complete orchestrator workflow simulation successful!');
  });
});
