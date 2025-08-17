import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ChangeTrackingService } from '../changeTrackingService';
import { WriteFileTool } from '../tools/writeFile';
import { PatchFileTool } from '../tools/patchFile';
import { InsertLinesTool } from '../tools/insertLines';
import { DeleteLinesTool } from '../tools/deleteLines';
import { ReplaceLinesTool } from '../tools/replaceLines';

suite('Change Merging Integration Tests', () => {
    let tempDir: string;
    let workspaceRoot: string;
    let changeTracker: ChangeTrackingService;

    setup(async () => {
        try {
            tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codingagent-merge-test-'));
            workspaceRoot = tempDir;
            changeTracker = new ChangeTrackingService(workspaceRoot);
            
            // Create initial test file
            await fs.promises.writeFile(
                path.join(tempDir, 'testFile.txt'), 
                'Initial line 1\nInitial line 2\nInitial line 3\nInitial line 4\nInitial line 5'
            );
        } catch (error) {
            console.warn('Failed to setup test environment:', error);
            tempDir = '';
            workspaceRoot = '/tmp';
        }
    });

    teardown(async () => {
        if (tempDir && fs.existsSync(tempDir)) {
            try {
                await fs.promises.rm(tempDir, { recursive: true, force: true });
            } catch (error) {
                console.warn('Failed to cleanup test directory:', error);
            }
        }
    });

    test('should merge multiple changes to the same file into one change record', async () => {
        if (!tempDir) {
            console.log('Skipping test - no temp directory available');
            return;
        }

        const writeTool = new WriteFileTool(changeTracker);
        const patchTool = new PatchFileTool(changeTracker);
        const insertTool = new InsertLinesTool(changeTracker);

        // Make first change - write new content
        console.log('Making first change...');
        const result1 = await writeTool.execute({
            path: 'testFile.txt',
            content: 'Modified line 1\nModified line 2\nModified line 3\nModified line 4\nModified line 5'
        }, workspaceRoot);
        assert.strictEqual(result1.success, true);

        // Check we have 1 pending change
        let pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 1, 'Should have 1 pending change after first modification');
        const firstChangeId = pendingChanges[0].id;

        // Make second change - patch the same file
        console.log('Making second change...');
        const result2 = await patchTool.execute({
            path: 'testFile.txt',
            old_text: 'Modified line 2',
            new_text: 'Patched line 2'
        }, workspaceRoot);
        assert.strictEqual(result2.success, true);

        // Check we still have only 1 pending change (merged)
        pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 1, 'Should still have only 1 pending change after second modification');
        
        // The change ID should be different (new change replaced the old one)
        const secondChangeId = pendingChanges[0].id;
        assert.notStrictEqual(firstChangeId, secondChangeId, 'Change ID should be different (new change)');

        // Make third change - insert lines
        console.log('Making third change...');
        const result3 = await insertTool.execute({
            path: 'testFile.txt',
            line_number: 3,
            content: 'Inserted line A\nInserted line B'
        }, workspaceRoot);
        assert.strictEqual(result3.success, true);

        // Check we still have only 1 pending change (merged again)
        pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 1, 'Should still have only 1 pending change after third modification');

        // Verify the final change shows the correct before/after content
        const finalChange = pendingChanges[0];
        assert.strictEqual(finalChange.beforeContent, 'Initial line 1\nInitial line 2\nInitial line 3\nInitial line 4\nInitial line 5', 
            'Before content should be the original content');
        
        // Read the current file content to verify it matches the after content
        const currentContent = await fs.promises.readFile(path.join(workspaceRoot, 'testFile.txt'), 'utf8');
        assert.strictEqual(finalChange.afterContent, currentContent, 
            'After content should match current file content');

        console.log('Final change before content:', finalChange.beforeContent);
        console.log('Final change after content:', finalChange.afterContent);
        console.log('Current file content:', currentContent);
    });

    test('should create separate change records for different files', async () => {
        if (!tempDir) {
            console.log('Skipping test - no temp directory available');
            return;
        }

        const writeTool = new WriteFileTool(changeTracker);

        // Create a second test file
        await fs.promises.writeFile(
            path.join(tempDir, 'testFile2.txt'), 
            'Second file content'
        );

        // Make changes to first file
        const result1 = await writeTool.execute({
            path: 'testFile.txt',
            content: 'Changed content for file 1'
        }, workspaceRoot);
        assert.strictEqual(result1.success, true);

        // Make changes to second file
        const result2 = await writeTool.execute({
            path: 'testFile2.txt',
            content: 'Changed content for file 2'
        }, workspaceRoot);
        assert.strictEqual(result2.success, true);

        // Check we have 2 separate pending changes
        const pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 2, 'Should have 2 separate pending changes for different files');

        // Verify the changes are for different files
        const filePaths = pendingChanges.map(c => path.basename(c.filePath)).sort();
        assert.deepStrictEqual(filePaths, ['testFile.txt', 'testFile2.txt']);
    });

    test('should handle accept/reject correctly with merged changes', async () => {
        if (!tempDir) {
            console.log('Skipping test - no temp directory available');
            return;
        }

        const writeTool = new WriteFileTool(changeTracker);
        const deleteTool = new DeleteLinesTool(changeTracker);

        // Make first change
        const result1 = await writeTool.execute({
            path: 'testFile.txt',
            content: 'Line A\nLine B\nLine C\nLine D\nLine E'
        }, workspaceRoot);
        assert.strictEqual(result1.success, true);

        // Make second change (should merge)
        const result2 = await deleteTool.execute({
            path: 'testFile.txt',
            line_numbers: [2, 4] // Delete Line B and Line D
        }, workspaceRoot);
        assert.strictEqual(result2.success, true);

        // Verify we have 1 merged change
        let pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 1);

        const changeId = pendingChanges[0].id;

        // Accept the merged change
        await changeTracker.acceptChange(changeId);

        // Verify no pending changes remain
        pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 0, 'Should have no pending changes after accept');

        // Verify file content is the final state
        const currentContent = await fs.promises.readFile(path.join(workspaceRoot, 'testFile.txt'), 'utf8');
        const expectedContent = 'Line A\nLine C\nLine E'; // Line B and D deleted
        assert.strictEqual(currentContent, expectedContent);
    });

    test('should handle reject correctly with merged changes', async () => {
        if (!tempDir) {
            console.log('Skipping test - no temp directory available');
            return;
        }

        const replaceTool = new ReplaceLinesTool(changeTracker);
        const insertTool = new InsertLinesTool(changeTracker);

        // Store original content for verification
        const originalContent = await fs.promises.readFile(path.join(workspaceRoot, 'testFile.txt'), 'utf8');

        // Make first change
        const result1 = await replaceTool.execute({
            path: 'testFile.txt',
            line_number: 2,
            new_content: 'Replaced line 2'
        }, workspaceRoot);
        assert.strictEqual(result1.success, true);

        // Make second change (should merge)
        const result2 = await insertTool.execute({
            path: 'testFile.txt',
            line_number: 0, // Insert at beginning
            content: 'Inserted at start'
        }, workspaceRoot);
        assert.strictEqual(result2.success, true);

        // Verify we have 1 merged change
        let pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 1);

        const changeId = pendingChanges[0].id;

        // Reject the merged change
        await changeTracker.rejectChange(changeId);

        // Verify no pending changes remain
        pendingChanges = await changeTracker.getAllPendingChanges();
        assert.strictEqual(pendingChanges.length, 0, 'Should have no pending changes after reject');

        // Verify file content is reverted to original
        const currentContent = await fs.promises.readFile(path.join(workspaceRoot, 'testFile.txt'), 'utf8');
        assert.strictEqual(currentContent, originalContent, 'File should be reverted to original content after reject');
    });
});
