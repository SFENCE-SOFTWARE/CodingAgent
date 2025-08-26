// tests/planContextManager.test.ts

import * as assert from 'assert';
import { PlanContextManager } from '../src/planContextManager';

suite('Plan Context Manager Test Suite', () => {
  let planContextManager: PlanContextManager;
  
  setup(() => {
    // Reset singleton before each test
    PlanContextManager.resetInstance();
    planContextManager = PlanContextManager.getInstance();
  });

  teardown(() => {
    // Clean up after each test
    PlanContextManager.resetInstance();
  });

  test('Should be a singleton', () => {
    const instance1 = PlanContextManager.getInstance();
    const instance2 = PlanContextManager.getInstance();
    
    assert.strictEqual(instance1, instance2, 'Should return the same instance');
  });

  test('Should track current plan ID', () => {
    assert.strictEqual(planContextManager.getCurrentPlanId(), null, 'Should start with null');
    
    planContextManager.setCurrentPlanId('test-plan-123');
    assert.strictEqual(planContextManager.getCurrentPlanId(), 'test-plan-123', 'Should return set plan ID');
    
    planContextManager.setCurrentPlanId(null);
    assert.strictEqual(planContextManager.getCurrentPlanId(), null, 'Should allow setting back to null');
  });

  test('Should notify callback when plan ID changes', () => {
    let callbackPlanId: string | null = 'not-called';
    
    planContextManager.setUpdateCallback((planId: string | null) => {
      callbackPlanId = planId;
    });
    
    planContextManager.setCurrentPlanId('test-plan-456');
    assert.strictEqual(callbackPlanId, 'test-plan-456', 'Callback should be called with new plan ID');
    
    planContextManager.setCurrentPlanId(null);
    assert.strictEqual(callbackPlanId, null, 'Callback should be called with null');
  });

  test('Should clear callback', () => {
    let callbackCalled = false;
    
    planContextManager.setUpdateCallback(() => {
      callbackCalled = true;
    });
    
    planContextManager.clearUpdateCallback();
    planContextManager.setCurrentPlanId('test-plan-789');
    
    assert.strictEqual(callbackCalled, false, 'Callback should not be called after clearing');
  });
});
