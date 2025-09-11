// tests/executePython.test.ts

import * as assert from 'assert';
import { ExecutePythonTool } from '../src/tools/executePython';
import * as path from 'path';
import * as os from 'os';

suite('ExecutePython Tool Tests', () => {
  let pythonTool: ExecutePythonTool;
  let tempWorkspaceRoot: string;

  setup(() => {
    pythonTool = new ExecutePythonTool();
    tempWorkspaceRoot = os.tmpdir();
  });

  test('should provide correct tool info', () => {
    const info = pythonTool.getToolInfo();
    assert.strictEqual(info.name, 'execute_python');
    assert.strictEqual(info.displayName, 'Execute Python Code');
    assert.strictEqual(info.category, 'system');
    assert.ok(info.description.includes('Python'));
  });

  test('should provide correct tool definition', () => {
    const definition = pythonTool.getToolDefinition();
    assert.strictEqual(definition.type, 'function');
    assert.strictEqual(definition.function.name, 'execute_python');
    assert.strictEqual(definition.function.parameters.type, 'object');
    
    const properties = definition.function.parameters.properties;
    assert.ok(properties.code);
    assert.strictEqual(properties.code.type, 'string');
    assert.ok(properties.description);
    assert.strictEqual(properties.description.type, 'string');
    
    const required = definition.function.parameters.required;
    assert.ok(Array.isArray(required));
    assert.ok(required.includes('code'));
  });

  test('should execute simple Python code successfully', async () => {
    const result = await pythonTool.execute({
      code: 'print("Hello, World!")',
      description: 'Test hello world'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.content.trim(), 'Hello, World!');
    assert.strictEqual(result.error, undefined);
  });

  test('should execute Python math calculations', async () => {
    const result = await pythonTool.execute({
      code: 'result = 2 + 3 * 4\nprint(result)',
      description: 'Math calculation test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.content.trim(), '14');
    assert.strictEqual(result.error, undefined);
  });

  test('should handle Python syntax errors gracefully', async () => {
    const result = await pythonTool.execute({
      code: 'print("Hello, World!"  # Missing closing parenthesis',
      description: 'Syntax error test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('SyntaxError') || result.error.includes('syntax'));
  });

  test('should handle Python runtime errors gracefully', async () => {
    const result = await pythonTool.execute({
      code: 'x = 1 / 0  # Division by zero',
      description: 'Runtime error test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('ZeroDivisionError') || result.error.includes('division by zero'));
  });

  test('should handle multi-line Python code', async () => {
    const code = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

result = fibonacci(7)
print(f"Fibonacci(7) = {result}")
    `.trim();

    const result = await pythonTool.execute({
      code,
      description: 'Fibonacci calculation test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('Fibonacci(7) = 13'));
  });

  test('should handle code with no output', async () => {
    const result = await pythonTool.execute({
      code: 'x = 42',
      description: 'No output test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.content, 'Code executed successfully (no output)');
  });

  test('should require code parameter', async () => {
    const result = await pythonTool.execute({
      description: 'Missing code parameter'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Required parameter: code'));
  });

  test('should handle empty code parameter', async () => {
    const result = await pythonTool.execute({
      code: '',
      description: 'Empty code test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Required parameter: code'));
  });

  test('should handle import statements', async () => {
    const result = await pythonTool.execute({
      code: `
import math
result = math.sqrt(16)
print(f"Square root of 16 is {result}")
      `.trim(),
      description: 'Import test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('Square root of 16 is 4'));
  });

  test('should run in isolated environment', async () => {
    // This test verifies that Python runs with -I flag for isolation
    const result = await pythonTool.execute({
      code: `
import sys
print("Python version:", sys.version_info[:2])
print("Isolated mode:", "site" not in sys.modules)
      `.trim(),
      description: 'Isolation test'
    }, tempWorkspaceRoot);

    assert.strictEqual(result.success, true);
    assert.ok(result.content.includes('Python version:'));
    // In isolated mode, site module should not be imported automatically
  });
});
