// tests/memorySystem.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MemoryService, MemoryType, MemorySearchOptions } from '../src/memoryService';
import { MemoryStoreTool } from '../src/tools/memoryStore';
import { MemoryRetrieveByLinesTool } from '../src/tools/memoryRetrieveByLines';
import { MemoryRetrieveDataTool } from '../src/tools/memoryRetrieveData';
import { MemoryDeleteTool } from '../src/tools/memoryDelete';
import { MemorySearchTool } from '../src/tools/memorySearch';
import { MemoryListTool } from '../src/tools/memoryList';

suite('Memory System Tests', () => {
  let tempDir: string;
  let memoryService: MemoryService;
  let memoryStoreTool: MemoryStoreTool;
  let memoryRetrieveByLinesTool: MemoryRetrieveByLinesTool;
  let memoryRetrieveDataTool: MemoryRetrieveDataTool;
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
    memoryRetrieveByLinesTool = new MemoryRetrieveByLinesTool(memoryService);
    memoryRetrieveDataTool = new MemoryRetrieveDataTool(memoryService);
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
      
      const result = await memoryRetrieveDataTool.execute({
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

    test('MemoryDeleteTool should remove key from memory_list after successful deletion', async () => {
      // Store a memory entry
      await memoryService.store('delete-consistency-key', 'test-value', MemoryType.TEMPORARY);
      
      // Verify it's in the list
      const listResultBefore = await memoryListTool.execute({}, tempDir);
      assert.strictEqual(listResultBefore.success, true);
      assert.ok(listResultBefore.content.includes('delete-consistency-key'));
      
      // Delete the entry
      const deleteResult = await memoryDeleteTool.execute({
        key: 'delete-consistency-key'
      }, tempDir);
      
      assert.strictEqual(deleteResult.success, true);
      assert.ok(deleteResult.content.includes('Successfully deleted'));
      
      // Verify it's no longer in the list
      const listResultAfter = await memoryListTool.execute({}, tempDir);
      assert.strictEqual(listResultAfter.success, true);
      assert.ok(!listResultAfter.content.includes('delete-consistency-key'));
      
      // Double-check with direct service call
      const keys = await memoryService.listKeys();
      assert.ok(!keys.includes('delete-consistency-key'));
    });

    test('MemoryDeleteTool should handle project memory deletion consistency', async () => {
      // Store a project memory entry
      await memoryService.store('project-delete-key', 'project-value', MemoryType.PROJECT);
      
      // Verify it's in the list
      const listResultBefore = await memoryListTool.execute({}, tempDir);
      assert.strictEqual(listResultBefore.success, true);
      assert.ok(listResultBefore.content.includes('project-delete-key'));
      
      // Delete the entry with explicit type
      const deleteResult = await memoryDeleteTool.execute({
        key: 'project-delete-key',
        type: 'project'
      }, tempDir);
      
      assert.strictEqual(deleteResult.success, true);
      assert.ok(deleteResult.content.includes('Successfully deleted'));
      
      // Verify it's no longer in the list
      const listResultAfter = await memoryListTool.execute({}, tempDir);
      assert.strictEqual(listResultAfter.success, true);
      assert.ok(!listResultAfter.content.includes('project-delete-key'));
      
      // Verify it's not retrievable
      const retrieveResult = await memoryRetrieveDataTool.execute({
        key: 'project-delete-key'
      }, tempDir);
      
      assert.strictEqual(retrieveResult.success, false);
      assert.ok(retrieveResult.error?.includes('No memory entry found'));
    });

    test('MemoryDeleteTool should handle deletion of non-existent key gracefully', async () => {
      // Try to delete a key that doesn't exist
      const deleteResult = await memoryDeleteTool.execute({
        key: 'non-existent-key'
      }, tempDir);
      
      assert.strictEqual(deleteResult.success, false);
      assert.ok(deleteResult.error?.includes('No memory entry found'));
      
      // Verify list remains consistent
      const listResult = await memoryListTool.execute({}, tempDir);
      assert.strictEqual(listResult.success, true);
      assert.ok(!listResult.content.includes('non-existent-key'));
    });

    test('MemoryDeleteTool should maintain consistency across memory types', async () => {
      // Store keys in both memory types
      await memoryService.store('consistency-temp', 'temp-value', MemoryType.TEMPORARY);
      await memoryService.store('consistency-proj', 'proj-value', MemoryType.PROJECT);
      
      // Verify both are listed
      const listBefore = await memoryListTool.execute({}, tempDir);
      assert.ok(listBefore.content.includes('consistency-temp'));
      assert.ok(listBefore.content.includes('consistency-proj'));
      
      // Delete temporary memory
      const deleteTempResult = await memoryDeleteTool.execute({
        key: 'consistency-temp',
        type: 'temporary'
      }, tempDir);
      assert.strictEqual(deleteTempResult.success, true);
      
      // Verify only project memory remains
      const listAfterTemp = await memoryListTool.execute({}, tempDir);
      assert.ok(!listAfterTemp.content.includes('consistency-temp'));
      assert.ok(listAfterTemp.content.includes('consistency-proj'));
      
      // Delete project memory
      const deleteProjResult = await memoryDeleteTool.execute({
        key: 'consistency-proj',
        type: 'project'
      }, tempDir);
      assert.strictEqual(deleteProjResult.success, true);
      
      // Verify neither remains
      const listFinal = await memoryListTool.execute({}, tempDir);
      assert.ok(!listFinal.content.includes('consistency-temp'));
      assert.ok(!listFinal.content.includes('consistency-proj'));
    });

    test('MemoryListTool should support pagination with offset and limit', async () => {
      // Store multiple entries for pagination testing
      for (let i = 1; i <= 10; i++) {
        await memoryService.store(`page-key-${i}`, `value-${i}`, MemoryType.TEMPORARY);
      }
      
      // Test first page
      const page1 = await memoryListTool.execute({
        limit: 3,
        offset: 0
      }, tempDir);
      
      assert.strictEqual(page1.success, true);
      assert.ok(page1.content.includes('showing 1-3 of'));
      assert.ok(page1.content.includes('use offset=3 for next page'));
      
      // Test second page
      const page2 = await memoryListTool.execute({
        limit: 3,
        offset: 3
      }, tempDir);
      
      assert.strictEqual(page2.success, true);
      assert.ok(page2.content.includes('showing 4-6 of'));
      
      // Test last page (should have fewer items)
      const lastPage = await memoryListTool.execute({
        limit: 3,
        offset: 9
      }, tempDir);
      
      assert.strictEqual(lastPage.success, true);
      assert.ok(lastPage.content.includes('showing 10-10 of'));
      assert.ok(!lastPage.content.includes('use offset='));
    });

    test('MemorySearchTool should support pagination with offset and limit', async () => {
      // Store multiple searchable entries
      for (let i = 1; i <= 8; i++) {
        await memoryService.store(`search-pagination-${i}`, `unique-searchable-value-${i}`, MemoryType.TEMPORARY);
      }
      
      // Test first page of search results
      const page1 = await memorySearchTool.execute({
        value_pattern: 'unique-searchable',
        max_results: 3,
        offset: 0
      }, tempDir);
      
      assert.strictEqual(page1.success, true);
      assert.ok(page1.content.includes('showing 1-3 of') && page1.content.includes('memory entries'));
      assert.ok(page1.content.includes('use offset=3 for next page'));
      
      // Test second page
      const page2 = await memorySearchTool.execute({
        value_pattern: 'unique-searchable',
        max_results: 3,
        offset: 3
      }, tempDir);
      
      assert.strictEqual(page2.success, true);
      assert.ok(page2.content.includes('memory entries'));
    });

    test('MemoryListTool should validate pagination parameters', async () => {
      // Test negative offset
      const negativeOffset = await memoryListTool.execute({
        offset: -1
      }, tempDir);
      
      assert.strictEqual(negativeOffset.success, false);
      assert.ok(negativeOffset.error?.includes('Offset must be non-negative'));
      
      // Test invalid limit
      const invalidLimit = await memoryListTool.execute({
        limit: 0
      }, tempDir);
      
      assert.strictEqual(invalidLimit.success, false);
      assert.ok(invalidLimit.error?.includes('Limit must be between 1 and 1000'));
      
      // Test too high limit
      const tooHighLimit = await memoryListTool.execute({
        limit: 1001
      }, tempDir);
      
      assert.strictEqual(tooHighLimit.success, false);
      assert.ok(tooHighLimit.error?.includes('Limit must be between 1 and 1000'));
    });

    test('MemoryRetrieveTool should support partial reading with offset and length', async () => {
      // Store a large value for partial reading
      const largeValue = 'This is a very long text that will be used for testing partial reading functionality. '.repeat(10);
      await memoryService.store('large-content', largeValue, MemoryType.TEMPORARY);
      
      // Test full content retrieval
      const fullResult = await memoryRetrieveDataTool.execute({
        key: 'large-content'
      }, tempDir);
      
      assert.strictEqual(fullResult.success, true);
      assert.ok(fullResult.content.includes(largeValue));
      assert.ok(!fullResult.content.includes('isPartial'));
      
      // Test partial reading from beginning
      const partialResult1 = await memoryRetrieveDataTool.execute({
        key: 'large-content',
        offset: 0,
        length: 50
      }, tempDir);
      
      assert.strictEqual(partialResult1.success, true);
      assert.ok(partialResult1.content.includes('isPartial'));
      assert.ok(partialResult1.content.includes('Showing characters 1-50'));
      assert.ok(partialResult1.content.includes('nextOffset'));
      
      // Test partial reading from middle
      const partialResult2 = await memoryRetrieveDataTool.execute({
        key: 'large-content',
        offset: 50,
        length: 30
      }, tempDir);
      
      assert.strictEqual(partialResult2.success, true);
      assert.ok(partialResult2.content.includes('Showing characters 51-80'));
      
      // Test reading to end
      const endResult = await memoryRetrieveDataTool.execute({
        key: 'large-content',
        offset: largeValue.length - 20
      }, tempDir);
      
      assert.strictEqual(endResult.success, true);
      assert.ok(endResult.content.includes('isPartial'));
      assert.ok(!endResult.content.includes('nextOffset')); // No more content
    });

    test('MemoryRetrieveTool should support metadata-only mode', async () => {
      // Store a value with metadata
      const testValue = 'Some test content that is moderately long for metadata testing and should not appear in full when metadata_only is true.';
      await memoryService.store('metadata-test', testValue, MemoryType.TEMPORARY);
      
      const metadataResult = await memoryRetrieveDataTool.execute({
        key: 'metadata-test',
        metadata_only: true
      }, tempDir);
      
      assert.strictEqual(metadataResult.success, true);
      assert.ok(metadataResult.content.includes('metadata only'));
      assert.ok(metadataResult.content.includes('valueLength'));
      assert.ok(metadataResult.content.includes('valuePreview'));
      // The full value should not be included, but preview (first 100 chars) might be
      assert.ok(!metadataResult.content.includes('"value":'));
    });

    test('MemoryRetrieveTool should validate partial reading parameters', async () => {
      await memoryService.store('validation-test', 'test content', MemoryType.TEMPORARY);
      
      // Test negative offset
      const negativeOffset = await memoryRetrieveDataTool.execute({
        key: 'validation-test',
        offset: -1
      }, tempDir);
      
      assert.strictEqual(negativeOffset.success, false);
      assert.ok(negativeOffset.error?.includes('Offset must be non-negative'));
      
      // Test invalid length
      const invalidLength = await memoryRetrieveDataTool.execute({
        key: 'validation-test',
        length: 0
      }, tempDir);
      
      assert.strictEqual(invalidLength.success, false);
      assert.ok(invalidLength.error?.includes('Length must be between 1 and 100000'));
      
      // Test too large length
      const tooLargeLength = await memoryRetrieveDataTool.execute({
        key: 'validation-test',
        length: 100001
      }, tempDir);
      
      assert.strictEqual(tooLargeLength.success, false);
      assert.ok(tooLargeLength.error?.includes('Length must be between 1 and 100000'));
    });

    test('MemorySearchTool should search memory entries', async () => {
      await memoryService.store('search-tool-key', 'unique-search-value', MemoryType.TEMPORARY);
      
      const result = await memorySearchTool.execute({
        value_pattern: 'unique-search'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('Found 1 memory'));
    });

    test('MemorySearchTool should return metadata without full content', async () => {
      const longContent = 'This is a very long content that should not be returned in full from search results. It contains important information that can be found via search.';
      await memoryService.store('test_large_content', longContent, MemoryType.TEMPORARY, {
        dataType: 'text',
        category: 'test_data',
        description: 'Test content for search without full return'
      });
      
      const result = await memorySearchTool.execute({
        value_pattern: 'important information',
        type: 'temporary'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.content.includes('Found 1 memory entries'));
      
      const resultData = JSON.parse(result.content!.split(':\n')[1]);
      assert.strictEqual(Array.isArray(resultData), true);
      assert.strictEqual(resultData.length, 1);
      
      const entry = resultData[0];
      assert.strictEqual(entry.key, 'test_large_content');
      assert.strictEqual(entry.value, undefined); // Should not contain full value
      assert.strictEqual(entry.valueLength, longContent.length); // Should contain length info
      assert.ok(entry.valuePreview.includes('This is a very long content')); // Should contain preview
      assert.ok(entry.patternMatches); // Should contain pattern matches
      assert.ok(entry.patternMatches[0].position > 0);
      assert.strictEqual(entry.patternMatches[0].text, 'important information');
      assert.strictEqual(entry.dataType, 'text');
    });

    test('MemorySearchTool should include pattern match positions and context', async () => {
      const testContent = 'First occurrence of test pattern. Some other text. Second occurrence of test pattern at the end.';
      await memoryService.store('pattern_test', testContent, MemoryType.TEMPORARY);
      
      const result = await memorySearchTool.execute({
        value_pattern: 'test pattern',
        type: 'temporary'
      }, tempDir);
      
      assert.strictEqual(result.success, true);
      const resultData = JSON.parse(result.content!.split(':\n')[1]);
      const entry = resultData[0];
      
      assert.ok(entry.patternMatches);
      assert.strictEqual(entry.patternMatches.length, 2); // Two occurrences
      
      // Check first match
      assert.strictEqual(entry.patternMatches[0].position, 20); // Position of first "test pattern"
      assert.strictEqual(entry.patternMatches[0].text, 'test pattern');
      assert.ok(entry.patternMatches[0].context.includes('occurrence of test pattern. Some'));
      
      // Check second match
      assert.strictEqual(entry.patternMatches[1].position, 72); // Position of second "test pattern"
      assert.strictEqual(entry.patternMatches[1].text, 'test pattern');
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
        memoryRetrieveDataTool,
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
        memoryRetrieveDataTool,
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
