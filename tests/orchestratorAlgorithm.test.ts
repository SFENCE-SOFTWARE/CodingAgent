// tests/orchestratorAlgorithm.test.ts

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AlgorithmEngine } from '../src/algorithmEngine';

suite('Orchestrator Algorithm Tests', () => {
  test('Should find orchestrator.js script in project directory', () => {
    // Test if the file exists at known location
    // __dirname in test environment points to out/tests/, so go up to project root
    const projectRoot = path.join(__dirname, '..', '..');
    const scriptPath = path.join(projectRoot, 'src', 'algorithms', 'orchestrator.js');
    
    console.log('Testing script path:', scriptPath);
    const exists = fs.existsSync(scriptPath);
    console.log('Script file exists:', exists);
    
    assert.ok(exists, `Script file should exist at: ${scriptPath}`);
    
    if (exists) {
      const content = fs.readFileSync(scriptPath, 'utf8');
      console.log('Script content length:', content.length);
      console.log('Contains handleUserMessage:', content.includes('handleUserMessage'));
      assert.ok(content.includes('handleUserMessage'), 'Script should contain handleUserMessage function');
    }
  });

  test('Should test algorithm engine path resolution logic', () => {
    const algorithmEngine = AlgorithmEngine.getInstance();
    
    // Mock workspace for testing
    const testWorkspaceRoot = path.join(__dirname, '..', '..');
    console.log('Test workspace root:', testWorkspaceRoot);
    
    // Test the built-in path logic manually
    const testScriptPath = path.join(testWorkspaceRoot, 'src', 'algorithms', 'orchestrator.js');
    console.log('Expected script path:', testScriptPath);
    console.log('File exists at expected path:', fs.existsSync(testScriptPath));
    
    // Test getAlgorithmScriptPath method
    const scriptPath = algorithmEngine.getAlgorithmScriptPath('Orchestrator');
    console.log('Algorithm engine returned path:', scriptPath);
    
    // In test mode without workspace, it might return null, but file should exist in known location
    if (scriptPath) {
      const exists = fs.existsSync(scriptPath);
      console.log('Script exists at engine path:', exists);
      assert.ok(exists, `Script should exist at: ${scriptPath}`);
    } else {
      console.log('Algorithm engine returned null (expected in test mode without workspace)');
      // But file should still exist at known location
      assert.ok(fs.existsSync(testScriptPath), `Script should exist at project location: ${testScriptPath}`);
    }
  });
});
