// tests/algorithmEngine.test.ts

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AlgorithmEngine, AlgorithmContext, AlgorithmResult } from '../src/algorithmEngine';

suite('AlgorithmEngine Tests', () => {
  let algorithmEngine: AlgorithmEngine;
  const testMode = 'TestMode';
  const testWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

  setup(() => {
    algorithmEngine = AlgorithmEngine.getInstance();
  });

  teardown(async () => {
    // Clean up test configuration
    const config = vscode.workspace.getConfiguration('codingagent.algorithm');
    await config.update('enabled', {}, vscode.ConfigurationTarget.Global);
    await config.update('scriptPath', {}, vscode.ConfigurationTarget.Global);
    await config.update('variables', {}, vscode.ConfigurationTarget.Global);
  });

  test('AlgorithmEngine singleton', () => {
    const engine1 = AlgorithmEngine.getInstance();
    const engine2 = AlgorithmEngine.getInstance();
    assert.strictEqual(engine1, engine2, 'AlgorithmEngine should be a singleton');
  });

  test('isAlgorithmEnabled - disabled by default', () => {
    const enabled = algorithmEngine.isAlgorithmEnabled(testMode);
    assert.strictEqual(enabled, false, 'Algorithm should be disabled by default');
  });

  test('isAlgorithmEnabled - enabled when configured', async () => {
    const config = vscode.workspace.getConfiguration('codingagent.algorithm');
    await config.update('enabled', { [testMode]: true }, vscode.ConfigurationTarget.Global);
    
    const enabled = algorithmEngine.isAlgorithmEnabled(testMode);
    assert.strictEqual(enabled, true, 'Algorithm should be enabled when configured');
  });

  test('getAlgorithmVariables - empty by default', () => {
    const variables = algorithmEngine.getAlgorithmVariables(testMode);
    assert.deepStrictEqual(variables, {}, 'Variables should be empty by default');
  });

  test('setAlgorithmVariable - stores variable', async () => {
    await algorithmEngine.setAlgorithmVariable(testMode, 'testKey', 'testValue');
    
    const variables = algorithmEngine.getAlgorithmVariables(testMode);
    assert.strictEqual(variables.testKey, 'testValue', 'Variable should be stored');
  });

  test('getAlgorithmScriptPath - returns built-in path', () => {
    const scriptPath = algorithmEngine.getAlgorithmScriptPath(testMode);
    
    if (testWorkspace) {
      const expectedPath = path.join(testWorkspace, 'src', 'algorithms', 'testmode.js');
      assert.strictEqual(scriptPath, expectedPath, 'Should return built-in script path');
    } else {
      assert.strictEqual(scriptPath, null, 'Should return null when no workspace');
    }
  });

  test('getAlgorithmScriptPath - returns custom path when configured', async () => {
    const customPath = '/custom/path/script.js';
    const config = vscode.workspace.getConfiguration('codingagent.algorithm');
    await config.update('scriptPath', { [testMode]: customPath }, vscode.ConfigurationTarget.Global);
    
    const scriptPath = algorithmEngine.getAlgorithmScriptPath(testMode);
    assert.strictEqual(scriptPath, customPath, 'Should return custom script path');
  });

  test('executeAlgorithm - returns not handled when disabled', async () => {
    const result = await algorithmEngine.executeAlgorithm(testMode, 'test message');
    assert.strictEqual(result.handled, false, 'Should not handle when disabled');
  });

  test('executeAlgorithm - returns error when script not found', async () => {
    const config = vscode.workspace.getConfiguration('codingagent.algorithm');
    await config.update('enabled', { [testMode]: true }, vscode.ConfigurationTarget.Global);
    
    const result = await algorithmEngine.executeAlgorithm(testMode, 'test message');
    assert.strictEqual(result.handled, false, 'Should not handle when script not found');
    assert.ok(result.error?.includes('not found'), 'Should return error about script not found');
  });

  test('executeAlgorithm - executes valid script', async () => {
    // Create a simple test script
    const testScriptPath = path.join(testWorkspace, 'test-algorithm.js');
    const testScript = `
      function handleUserMessage(message, context) {
        context.sendResponse('Test response for: ' + message);
        return 'Script executed';
      }
    `;
    fs.writeFileSync(testScriptPath, testScript);

    try {
      const config = vscode.workspace.getConfiguration('codingagent.algorithm');
      await config.update('enabled', { [testMode]: true }, vscode.ConfigurationTarget.Global);
      await config.update('scriptPath', { [testMode]: testScriptPath }, vscode.ConfigurationTarget.Global);
      
      const result = await algorithmEngine.executeAlgorithm(testMode, 'hello world');
      assert.strictEqual(result.handled, true, 'Should handle the message');
      assert.strictEqual(result.response, 'Test response for: hello world', 'Should return correct response');
    } finally {
      // Clean up test script
      if (fs.existsSync(testScriptPath)) {
        fs.unlinkSync(testScriptPath);
      }
    }
  });

  test('executeAlgorithm - handles script error gracefully', async () => {
    // Create a script with syntax error
    const testScriptPath = path.join(testWorkspace, 'test-error-script.js');
    const testScript = `
      function handleUserMessage(message, context) {
        throw new Error('Test error');
      }
    `;
    fs.writeFileSync(testScriptPath, testScript);

    try {
      const config = vscode.workspace.getConfiguration('codingagent.algorithm');
      await config.update('enabled', { [testMode]: true }, vscode.ConfigurationTarget.Global);
      await config.update('scriptPath', { [testMode]: testScriptPath }, vscode.ConfigurationTarget.Global);
      
      const result = await algorithmEngine.executeAlgorithm(testMode, 'test message');
      assert.strictEqual(result.handled, false, 'Should not handle when script throws error');
      assert.ok(result.error?.includes('Test error'), 'Should return the script error');
    } finally {
      // Clean up test script
      if (fs.existsSync(testScriptPath)) {
        fs.unlinkSync(testScriptPath);
      }
    }
  });

  test('logs are collected and can be retrieved', () => {
    const initialLogCount = algorithmEngine.getLogs().length;
    
    // Simulate some logging
    const engine = algorithmEngine as any;
    engine.log('info', 'Test log message');
    
    const logs = algorithmEngine.getLogs();
    assert.ok(logs.length > initialLogCount, 'Logs should be collected');
    assert.ok(logs[logs.length - 1].includes('Test log message'), 'Latest log should contain test message');
  });

  test('clearLogs removes all logs', () => {
    const engine = algorithmEngine as any;
    engine.log('info', 'Test log message');
    
    algorithmEngine.clearLogs();
    const logs = algorithmEngine.getLogs();
    assert.strictEqual(logs.length, 0, 'All logs should be cleared');
  });
});
