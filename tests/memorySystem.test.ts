// tests/memorySystem.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MemoryService, MemoryType, MemorySearchOptions } from '../src/memoryService';
import { MemoryStoreTool } from '../src/tools/memoryStore';
import { MemoryRetrieveTool } from '../src/tools/memoryRetrieve';
import { MemoryDeleteTool } from '../src/tools/memoryDelete';
import { MemorySearchTool } from '../src/tools/memorySearch';
import { MemoryListTool } from '../src/tools/memoryList';

suite('Memory System Tests', () => {
  let tempDir: string;
  let memoryService: MemoryService;
  let memoryStoreTool: MemoryStoreTool;
  let memoryRetrieveTool: MemoryRetrieveTool;
  let memoryDeleteTool: MemoryDeleteTool;
  let memorySearchTool: MemorySearchTool;
  let memoryListTool: MemoryListTool;

  setup(() => {
    // Create temporary directory for testing
    tempDir = path.join(os.tmpdir(), 'memory-test-' + Math.random().toString(36).substring(7));
    fs.mkdirSync(tempDir, { recursive: true });
    memoryService = new MemoryService(tempDir);
    
    // Mock project memory as enabled for testing
    (memoryService as any).isProjectMemoryEnabled = () => true;
    
    // Create tool instances
    memoryStoreTool = new MemoryStoreTool(memoryService);
    memoryRetrieveTool = new MemoryRetrieveTool(memoryService);
    memoryDeleteTool = new MemoryDeleteTool(memoryService);
    memorySearchTool = new MemorySearchTool(memoryService);
    memoryListTool = new MemoryListTool(memoryService);
  });

  teardown(async () => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  suite('MemoryService', () => {
    test('should store and retrieve temporary memory', async () => {
      await memoryService.store('test-key', 'test-value', MemoryType.TEMPORARY);
      const entry = await memoryService.retrieve('test-key');
      
      assert.strictEqual(entry?.key, 'test-key');
      assert.strictEqual(entry?.value, 'test-value');
      assert.strictEqual(entry?.type, MemoryType.TEMPORARY);
    });

    test('should store and retrieve project memory', async () => {
      await memoryService.store('project-key', 'project-value', MemoryType.PROJECT);
      const entry = await memoryService.retrieve('project-key');
      
      assert.strictEqual(entry?.key, 'project-key');
      assert.strictEqual(entry?.value, 'project-value');
      assert.strictEqual(entry?.type, MemoryType.PROJECT);
    });

    test('should prevent duplicate keys across memory types', async () => {
      await memoryService.store('duplicate-key', 'temp-value', MemoryType.TEMPORARY);
      
      try {
        await memoryService.store('duplicate-key', 'project-value', MemoryType.PROJECT);
        assert.fail('Should have thrown error for duplicate key');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('already exists'));
      }
    });

    test('should delete from specific memory type', async () => {
      await memoryService.store('delete-key', 'delete-value', MemoryType.TEMPORARY);
      const deleted = await memoryService.delete('delete-key', MemoryType.TEMPORARY);
      
      assert.strictEqual(deleted, true);
      
      const entry = await memoryService.retrieve('delete-key');
      assert.strictEqual(entry, null);
    });

    test('should search memory entries', async () => {
      await memoryService.store('search-key-1', 'search-value-alpha', MemoryType.TEMPORARY);
      await memoryService.store('search-key-2', 'search-value-beta', MemoryType.TEMPORARY);
      
      const options: MemorySearchOptions = {
        valuePattern: 'alpha',
        caseSensitive: false
      };
      
      const results = await memoryService.search(options);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].key, 'search-key-1');
    });

    test('should list all keys', async () => {
      await memoryService.store('list-key-1', 'value1', MemoryType.TEMPORARY);
      await memoryService.store('list-key-2', 'value2', MemoryType.TEMPORARY);
      
      const keys = await memoryService.listKeys();
      assert.ok(keys.includes('list-key-1'));
      assert.ok(keys.includes('list-key-2'));
    });
  });

  suite('Memory Tools', () => {
    test('MemoryStoreTool should store memory entry', async () => {
      const result = await memoryStoreTool.execute({
        key: 'tool-test-key',
        value: 'tool-test-value',
        type: 'temporary'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('Successfully stored'));
      
      // Verify storage
      const entry = await memoryService.retrieve('tool-test-key');
      assert.strictEqual(entry?.value, 'tool-test-value');
    });

    test('MemoryStoreTool should require explicit type', async () => {
      const result = await memoryStoreTool.execute({
        key: 'tool-test-key',
        value: 'tool-test-value'
        // Missing type
      }, tempDir);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('explicitly specified'));
    });

    test('MemoryRetrieveTool should retrieve memory entry', async () => {
      await memoryService.store('retrieve-key', 'retrieve-value', MemoryType.TEMPORARY);
      
      const result = await memoryRetrieveTool.execute({
        key: 'retrieve-key'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('retrieve-value'));
    });

    test('MemoryDeleteTool should delete memory entry', async () => {
      await memoryService.store('delete-tool-key', 'delete-tool-value', MemoryType.TEMPORARY);
      
      const result = await memoryDeleteTool.execute({
        key: 'delete-tool-key'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('Successfully deleted'));
      
      // Verify deletion
      const entry = await memoryService.retrieve('delete-tool-key');
      assert.strictEqual(entry, null);
    });

    test('MemorySearchTool should search memory entries', async () => {
      await memoryService.store('search-tool-key', 'unique-search-value', MemoryType.TEMPORARY);
      
      const result = await memorySearchTool.execute({
        value_pattern: 'unique-search'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('Found 1 memory'));
    });

    test('MemoryListTool should list memory keys', async () => {
      await memoryService.store('list-tool-key-1', 'value1', MemoryType.TEMPORARY);
      await memoryService.store('list-tool-key-2', 'value2', MemoryType.TEMPORARY);
      
      const result = await memoryListTool.execute({}, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('list-tool-key-1'));
      assert.ok(result.content.includes('list-tool-key-2'));
    });
  });

  suite('Tool Info and Definitions', () => {
    test('should provide valid tool info for all memory tools', () => {
      const tools = [
        memoryStoreTool,
        memoryRetrieveTool,
        memoryDeleteTool,
        memorySearchTool,
        memoryListTool
      ];
      
      tools.forEach(tool => {
        const info = tool.getToolInfo();
        assert.ok(info.name);
        assert.ok(info.displayName);
        assert.ok(info.description);
        assert.ok(info.category);
      });
    });

    test('should provide valid tool definitions for all memory tools', () => {
      const tools = [
        memoryStoreTool,
        memoryRetrieveTool,
        memoryDeleteTool,
        memorySearchTool,
        memoryListTool
      ];
      
      tools.forEach(tool => {
        const definition = tool.getToolDefinition();
        assert.strictEqual(definition.type, 'function');
        assert.ok(definition.function.name);
        assert.ok(definition.function.description);
        assert.ok(definition.function.parameters);
        assert.strictEqual(definition.function.parameters.type, 'object');
        assert.ok(definition.function.parameters.properties);
        assert.ok(Array.isArray(definition.function.parameters.required));
      });
    });
  });
});
