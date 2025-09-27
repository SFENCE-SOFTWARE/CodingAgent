import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PlanningService } from '../src/planningService';
import { PlanContextManager } from '../src/planContextManager';
import { PlanNewTool } from '../src/tools/planNew';
import { PlanChangeTool } from '../src/tools/planChange';

describe('Real Orchestrator Plan Flow Test', () => {
  let testWorkspaceRoot: string;
  
  const testPlanId = 'real-orchestrator-test-plan';

  before(() => {
    // Create temporary workspace
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-real-orchestrator-'));
    console.log(`\n🧪 Testing real orchestrator plan flow...`);
    console.log(`📁 Test workspace: ${testWorkspaceRoot}`);
  });

  after(() => {
    // Cleanup
    if (fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }
    PlanningService.resetInstance();
    PlanContextManager.resetInstance();
  });

  it('should exactly replicate orchestrator workflow plan creation and update', async () => {
    console.log('\n📋 Step 1: Create plan using plan_new tool (orchestrator does this)...');
    
    // Create plan using plan_new tool (exactly like orchestrator)
    const planNewTool = new PlanNewTool();
    const createResult = await planNewTool.execute({
      id: testPlanId,
      name: 'Real Orchestrator Test Plan',
      short_description: 'Original short description',
      long_description: 'Original long description'
    }, testWorkspaceRoot);
    
    console.log(`📊 Plan creation result:`, createResult);
    assert.strictEqual(createResult.success, true);
    
    // Check that context was set
    const planContextManager = PlanContextManager.getInstance();
    const currentPlanId = planContextManager.getCurrentPlanId();
    console.log(`📊 Current plan ID after creation: ${currentPlanId}`);
    assert.strictEqual(currentPlanId, testPlanId);

    console.log('\n🔍 Step 2: Verify plan exists in PlanningService...');
    
    // Check that plan exists in PlanningService
    const planningService = PlanningService.getInstance(testWorkspaceRoot);
    const showResult = planningService.showPlan(testPlanId);
    console.log(`📊 Plan exists in PlanningService:`, showResult.success);
    assert.strictEqual(showResult.success, true);
    assert.strictEqual(showResult.plan?.id, testPlanId);

    console.log('\n🛠️ Step 3: Use plan_change tool (architect does this)...');
    
    // Now use plan_change tool (exactly like architect mode)
    const planChangeTool = new PlanChangeTool();
    const changeResult = await planChangeTool.execute({
      short_description: 'Updated by plan_change tool',
      long_description: 'Long description updated by plan_change tool with requirements'
    }, testWorkspaceRoot);
    
    console.log(`📊 Plan change result:`, changeResult);
    
    // This should now succeed (was failing before the fix)
    assert.strictEqual(changeResult.success, true);
    assert.strictEqual(changeResult.error, undefined);
    
    console.log('\n📋 Step 4: Verify changes were applied...');
    
    // Verify the changes were applied
    const updatedShowResult = planningService.showPlan(testPlanId);
    assert.strictEqual(updatedShowResult.success, true);
    
    const updatedPlan = updatedShowResult.plan!;
    console.log(`📊 Updated short description: "${updatedPlan.shortDescription}"`);
    console.log(`📊 Updated long description: "${updatedPlan.longDescription}"`);
    
    assert.strictEqual(updatedPlan.shortDescription, 'Updated by plan_change tool');
    assert.strictEqual(updatedPlan.longDescription, 'Long description updated by plan_change tool with requirements');
    
    console.log('\n🎉 Real orchestrator workflow test successful! Plan creation and update both work.');
  });
});
