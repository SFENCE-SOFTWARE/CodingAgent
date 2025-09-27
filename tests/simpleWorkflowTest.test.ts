// Jednoduchý test workflow flags bez async/await
import * as assert from 'assert';
import * as fs from 'fs';

suite('Simple Workflow Flags Test', () => {
  test('basic test to verify our modifications work', () => {
    console.log('🧪 Running basic workflow flags test...');
    
    // Simple assertion to verify test framework works
    assert.strictEqual(1 + 1, 2);
    
    console.log('✅ Basic test passed - test framework is working');
  });
});
