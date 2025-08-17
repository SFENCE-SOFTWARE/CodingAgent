// src/test/modifyLines.test.ts

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ModifyLinesTool } from '../tools/modifyLines';
import { ChangeTrackingService } from '../changeTrackingService';

suite('ModifyLinesTool Tests', () => {
  let tempDir: string;
  let tool: ModifyLinesTool;
  let changeTrackingService: ChangeTrackingService;

  setup(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'modify-lines-test-'));
    changeTrackingService = new ChangeTrackingService(tempDir);
    tool = new ModifyLinesTool(changeTrackingService);
  });

  teardown(async () => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.promises.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  suite('Insert Operation', () => {
    test('should insert single line at specific position', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2\nline3');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        line_number: 2,
        content: 'inserted line'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'inserted line');
      assert.strictEqual(lines.length, 4);
    });

    test('should insert multiple lines', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline3');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        line_number: 2,
        content: 'line2a\nline2b'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'line2a');
      assert.strictEqual(lines[2], 'line2b');
      assert.strictEqual(lines.length, 4);
    });

    test('should insert at beginning with line_number 0', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        line_number: 0,
        content: 'first line'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[0], 'first line');
      assert.strictEqual(lines.length, 3);
    });

    test('should append at end with line_number -1', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        line_number: -1,
        content: 'last line'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[lines.length - 1], 'last line');
      assert.strictEqual(lines.length, 3);
    });

    test('should insert after text', async () => {
      const filePath = await createTestFile('test.txt', 'function test() {\nlet x = 1;\nreturn x;\n}');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        after_text: 'let x = 1;',
        content: 'let y = 2;'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[2], 'let y = 2;');
    });

    test('should insert before text', async () => {
      const filePath = await createTestFile('test.txt', 'function test() {\nreturn x;\n}');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        before_text: 'return x;',
        content: 'let x = 1;'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'let x = 1;');
      assert.strictEqual(lines[2], 'return x;');
    });

    test('should fail when content is missing', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'insert',
        line_number: 1
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Content is required for insert operation');
    });
  });

  suite('Delete Operation', () => {
    test('should delete single line by number', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2\nline3');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'delete',
        line_number: 2
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], 'line1');
      assert.strictEqual(lines[1], 'line3');
    });

    test('should delete multiple lines by numbers', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2\nline3\nline4');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'delete',
        line_numbers: [2, 4]
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], 'line1');
      assert.strictEqual(lines[1], 'line3');
    });

    test('should delete range of lines', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2\nline3\nline4\nline5');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'delete',
        start_line: 2,
        end_line: 4
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], 'line1');
      assert.strictEqual(lines[1], 'line5');
    });

    test('should delete lines containing text', async () => {
      const filePath = await createTestFile('test.txt', 'function test() {\nlet x = 1; // temp\nlet y = 2;\nreturn x + y;\n}');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'delete',
        containing_text: '// temp'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      assert.strictEqual(fileContent.includes('// temp'), false);
    });

    test('should delete lines matching exact text', async () => {
      const filePath = await createTestFile('test.txt', 'line1\n  exact match  \nline3');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'delete',
        exact_text: 'exact match'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], 'line1');
      assert.strictEqual(lines[1], 'line3');
    });

    test('should fail when no deletion criteria provided', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'delete'
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Must specify at least one deletion criteria: line_number, line_numbers, start_line/end_line, containing_text, or exact_text');
    });
  });

  suite('Replace Operation', () => {
    test('should replace single line by number', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nold line\nline3');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        line_number: 2,
        content: 'new line'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'new line');
      assert.strictEqual(lines.length, 3);
    });

    test('should replace multiple lines with multi-line content', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nold2\nold3\nline4');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        line_numbers: [2, 3],
        content: 'new2\nnew3\nextra'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'new2');
      assert.strictEqual(lines[2], 'new3');
      assert.strictEqual(lines[3], 'extra');
      assert.strictEqual(lines[4], 'line4');
    });

    test('should replace range of lines', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nold2\nold3\nold4\nline5');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        start_line: 2,
        end_line: 4,
        content: 'replacement'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'replacement');
      assert.strictEqual(lines[2], 'line5');
      assert.strictEqual(lines.length, 3);
    });

    test('should replace lines containing text', async () => {
      const filePath = await createTestFile('test.txt', 'function test() {\nlet x = OLD_VALUE;\nreturn x;\n}');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        containing_text: 'OLD_VALUE',
        content: 'let x = NEW_VALUE;'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      assert.strictEqual(fileContent.includes('NEW_VALUE'), true);
      assert.strictEqual(fileContent.includes('OLD_VALUE'), false);
    });

    test('should replace lines matching exact text', async () => {
      const filePath = await createTestFile('test.txt', 'line1\n  exact match  \nline3');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        exact_text: 'exact match',
        content: 'replacement line'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const lines = fileContent.split('\n');
      assert.strictEqual(lines[1], 'replacement line');
    });

    test('should fail when content is missing', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        line_number: 1
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Content is required for replace operation');
    });

    test('should fail when no target criteria provided', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        content: 'new content'
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Must specify target lines: line_number, line_numbers, start_line/end_line, exact_text, or containing_text');
    });

    test('should fail when both line_number and line_numbers provided', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'replace',
        line_number: 1,
        line_numbers: [1],
        content: 'new content'
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Cannot use both line_number and line_numbers. Choose one approach');
    });
  });

  suite('General Tests', () => {
    test('should fail for non-existent file', async () => {
      const result = await tool.execute({
        path: 'non-existent.txt',
        operation: 'insert',
        content: 'test'
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error?.includes('File not found'), true);
    });

    test('should fail for unknown operation', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: filePath,
        operation: 'unknown',
        content: 'test'
      }, tempDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Unknown operation: unknown. Use \'insert\', \'delete\', or \'replace\'');
    });

    test('should work with relative paths', async () => {
      const filePath = await createTestFile('test.txt', 'line1');
      
      const result = await tool.execute({
        path: 'test.txt',
        operation: 'insert',
        line_number: -1,
        content: 'appended'
      }, tempDir);

      assert.strictEqual(result.success, true);
      
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      assert.strictEqual(fileContent.includes('appended'), true);
    });
  });

  suite('Change Tracking Integration', () => {
    test('should track changes for modify operations', async () => {
      const filePath = await createTestFile('test.txt', 'line1\nline2\nline3');
      
      await tool.execute({
        path: filePath,
        operation: 'insert',
        line_number: 2,
        content: 'inserted'
      }, tempDir);

      const changes = await changeTrackingService.getAllPendingChanges();
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].filePath, filePath);
    });
  });
});
