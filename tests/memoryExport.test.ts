// Simple test to verify memory_export tool functionality
import * as assert from 'assert';
import { MemoryExportTool } from '../../src/tools/memoryExport';
import { MemoryService } from '../../src/memoryService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MemoryExportTool Tests', () => {
  let memoryService: MemoryService;
  let exportTool: MemoryExportTool;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary workspace
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-export-test-'));
    memoryService = new MemoryService(tempDir);
    exportTool = new MemoryExportTool(memoryService);
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should provide correct tool info', () => {
    const info = exportTool.getToolInfo();
    assert.strictEqual(info.name, 'memory_export');
    assert.strictEqual(info.displayName, 'Export Memory to File');
    assert.strictEqual(info.category, 'other');
    assert(info.description.includes('Export memory entries to files'));
  });

  it('should export single memory entry to file', async () => {
    // Store test data
    await memoryService.store('test-key', 'Test content for export', 'temporary', {
      description: 'Test entry for export',
      category: 'test',
      tags: ['export', 'test']
    });

    // Export to file
    const result = await exportTool.execute({
      memory_key: 'test-key',
      file_path: 'exported_content.txt',
      format: 'raw'
    }, tempDir);

    assert.strictEqual(result.success, true);
    assert(result.content.includes('Successfully exported 1 memory entries'));

    // Verify file was created with correct content
    const filePath = path.join(tempDir, 'exported_content.txt');
    assert(fs.existsSync(filePath));
    const fileContent = fs.readFileSync(filePath, 'utf8');
    assert.strictEqual(fileContent, 'Test content for export');
  });

  it('should export memory entry as markdown with metadata', async () => {
    // Store test data
    await memoryService.store('markdown-test', 'Content for markdown export', 'temporary', {
      description: 'Test markdown export',
      category: 'documentation',
      tags: ['markdown', 'export']
    });

    // Export as markdown
    const result = await exportTool.execute({
      memory_key: 'markdown-test',
      file_path: 'exported.md',
      format: 'markdown',
      include_metadata: true
    }, tempDir);

    assert.strictEqual(result.success, true);

    // Verify markdown file
    const filePath = path.join(tempDir, 'exported.md');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    assert(fileContent.includes('# markdown-test'));
    assert(fileContent.includes('## Metadata'));
    assert(fileContent.includes('**Description:** Test markdown export'));
    assert(fileContent.includes('**Category:** documentation'));
    assert(fileContent.includes('Content for markdown export'));
  });

  it('should export multiple entries using search pattern', async () => {
    // Store multiple test entries
    await memoryService.store('webpage_part_1', 'Part 1 content', 'temporary');
    await memoryService.store('webpage_part_2', 'Part 2 content', 'temporary');
    await memoryService.store('webpage_part_3', 'Part 3 content', 'temporary');
    await memoryService.store('other_entry', 'Other content', 'temporary');

    // Export using pattern
    const result = await exportTool.execute({
      search_pattern: 'webpage_part_*',
      file_path: 'exports/{key}.txt',
      format: 'raw',
      combine_entries: false
    }, tempDir);

    assert.strictEqual(result.success, true);
    assert(result.content.includes('Successfully exported 3 memory entries to separate files'));

    // Verify individual files were created
    const exportsDir = path.join(tempDir, 'exports');
    assert(fs.existsSync(path.join(exportsDir, 'webpage_part_1.txt')));
    assert(fs.existsSync(path.join(exportsDir, 'webpage_part_2.txt')));
    assert(fs.existsSync(path.join(exportsDir, 'webpage_part_3.txt')));
    assert(!fs.existsSync(path.join(exportsDir, 'other_entry.txt')));

    // Verify content
    const part1Content = fs.readFileSync(path.join(exportsDir, 'webpage_part_1.txt'), 'utf8');
    assert.strictEqual(part1Content, 'Part 1 content');
  });

  it('should handle non-existent memory key gracefully', async () => {
    const result = await exportTool.execute({
      memory_key: 'non-existent-key',
      file_path: 'output.txt',
      format: 'raw'
    }, tempDir);

    assert.strictEqual(result.success, false);
    assert(result.error?.includes('No valid memory entries found'));
  });

  it('should prevent file overwrite when overwrite is false', async () => {
    // Store test data
    await memoryService.store('test-overwrite', 'Test content', 'temporary');
    
    // Create existing file
    const filePath = path.join(tempDir, 'existing.txt');
    fs.writeFileSync(filePath, 'Existing content');

    // Try to export without overwrite
    const result = await exportTool.execute({
      memory_key: 'test-overwrite',
      file_path: 'existing.txt',
      format: 'raw',
      overwrite: false
    }, tempDir);

    assert.strictEqual(result.success, false);
    assert(result.error?.includes('File already exists and overwrite is false'));

    // Verify original content preserved
    const content = fs.readFileSync(filePath, 'utf8');
    assert.strictEqual(content, 'Existing content');
  });
});
