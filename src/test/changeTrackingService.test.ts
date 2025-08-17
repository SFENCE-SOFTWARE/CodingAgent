// src/test/changeTrackingService.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ChangeTrackingService, BackupManager, FileChange } from '../changeTrackingService';

suite('ChangeTrackingService', () => {
  let tempDir: string;
  let changeTracker: ChangeTrackingService;

  setup(async () => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'change-tracking-test-'));
    changeTracker = new ChangeTrackingService(tempDir);
  });

  teardown(async () => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  suite('trackFileOperation', () => {
    test('should track file creation correctly', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, World!';

      const changeId = await changeTracker.trackFileOperation(filePath, {
        type: 'create',
        beforeContent: null,
        afterContent: content,
        toolName: 'write_file'
      });

      assert.ok(changeId);
      assert.ok(changeId.startsWith('change_'));

      const changes = await changeTracker.getChangesForFile(filePath);
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].changeType, 'create');
      assert.strictEqual(changes[0].beforeContent, '');
      assert.strictEqual(changes[0].afterContent, content);
      assert.strictEqual(changes[0].status, 'pending');
      assert.strictEqual(changes[0].toolName, 'write_file');
    });

    test('should track file modification correctly', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const beforeContent = 'Hello, World!';
      const afterContent = 'Hello, Universe!';

      const changeId = await changeTracker.trackFileOperation(filePath, {
        type: 'modify',
        beforeContent,
        afterContent,
        toolName: 'patch_file'
      });

      assert.ok(changeId);

      const changes = await changeTracker.getChangesForFile(filePath);
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].changeType, 'modify');
      assert.strictEqual(changes[0].beforeContent, beforeContent);
      assert.strictEqual(changes[0].afterContent, afterContent);
      assert.strictEqual(changes[0].status, 'pending');
    });

    test('should track file deletion correctly', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const beforeContent = 'Hello, World!';

      const changeId = await changeTracker.trackFileOperation(filePath, {
        type: 'delete',
        beforeContent,
        afterContent: null,
        toolName: 'delete_file'
      });

      assert.ok(changeId);

      const changes = await changeTracker.getChangesForFile(filePath);
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].changeType, 'delete');
      assert.strictEqual(changes[0].beforeContent, beforeContent);
      assert.strictEqual(changes[0].afterContent, '');
    });
  });

  suite('calculateLineDiff', () => {
    test('should generate accurate line diffs for additions', async () => {
      const before = 'line1\nline2';
      const after = 'line1\nline2\nline3';

      const lineChanges = await changeTracker.calculateLineDiff(before, after);
      
      assert.strictEqual(lineChanges.length, 1);
      assert.strictEqual(lineChanges[0].type, 'add');
      assert.strictEqual(lineChanges[0].lineNumber, 3);
      assert.strictEqual(lineChanges[0].newContent, 'line3');
    });

    test('should generate accurate line diffs for deletions', async () => {
      const before = 'line1\nline2\nline3';
      const after = 'line1\nline3';

      const lineChanges = await changeTracker.calculateLineDiff(before, after);
      
      assert.strictEqual(lineChanges.length, 1);
      assert.strictEqual(lineChanges[0].type, 'delete');
      assert.strictEqual(lineChanges[0].lineNumber, 2);
      assert.strictEqual(lineChanges[0].oldContent, 'line2');
    });

    test('should generate accurate line diffs for modifications', async () => {
      const before = 'line1\nline2\nline3';
      const after = 'line1\nmodified line2\nline3';

      const lineChanges = await changeTracker.calculateLineDiff(before, after);
      
      // LCS algorithm generates delete + add for modifications, not a single modify
      assert.strictEqual(lineChanges.length, 2);
      assert.ok(lineChanges.some(c => c.type === 'delete' && c.oldContent === 'line2'));
      assert.ok(lineChanges.some(c => c.type === 'add' && c.newContent === 'modified line2'));
    });

    test('should handle complex multi-line changes', async () => {
      const before = 'line1\nline2\nline3\nline4';
      const after = 'line1\nmodified line2\nline3\nnew line\nline4';

      const lineChanges = await changeTracker.calculateLineDiff(before, after);
      
      assert.ok(lineChanges.length > 0);
      // Should detect modification and addition
      const hasModify = lineChanges.some(c => c.type === 'modify');
      const hasAdd = lineChanges.some(c => c.type === 'add');
      assert.ok(hasModify || hasAdd);
    });
  });

  suite('change management', () => {
    let changeId: string;
    let filePath: string;

    setup(async () => {
      filePath = path.join(tempDir, 'test.txt');
      changeId = await changeTracker.trackFileOperation(filePath, {
        type: 'create',
        beforeContent: null,
        afterContent: 'test content',
        toolName: 'write_file'
      });
    });

    test('should accept change correctly', async () => {
      await changeTracker.acceptChange(changeId);

      // After accepting, the change should be removed from pending changes
      const changes = await changeTracker.getChangesForFile(filePath);
      assert.strictEqual(changes.length, 0, 'Accepted changes should be removed from pending list');
    });

    test('should reject change correctly', async () => {
      await changeTracker.rejectChange(changeId);

      // After rejecting, the change should be removed from pending changes
      const changes = await changeTracker.getChangesForFile(filePath);
      assert.strictEqual(changes.length, 0, 'Rejected changes should be removed from pending list');
    });

    test('should accept all changes correctly', async () => {
      // Add another change
      const changeId2 = await changeTracker.trackFileOperation(path.join(tempDir, 'test2.txt'), {
        type: 'create',
        beforeContent: null,
        afterContent: 'test content 2',
        toolName: 'write_file'
      });

      await changeTracker.acceptAllChanges();

      const allChanges = await changeTracker.getAllChanges();
      assert.ok(allChanges.every(change => change.status === 'accepted'));
    });

    test('should reject all changes correctly', async () => {
      // Add another change
      const changeId2 = await changeTracker.trackFileOperation(path.join(tempDir, 'test2.txt'), {
        type: 'create',
        beforeContent: null,
        afterContent: 'test content 2',
        toolName: 'write_file'
      });

      await changeTracker.rejectAllChanges();

      const allChanges = await changeTracker.getAllChanges();
      assert.ok(allChanges.every(change => change.status === 'rejected'));
    });
  });

  suite('persistence', () => {
    test('should persist and restore changes across sessions', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      
      // Track a change
      const changeId = await changeTracker.trackFileOperation(filePath, {
        type: 'create',
        beforeContent: null,
        afterContent: 'test content',
        toolName: 'write_file'
      });

      // Create new instance (simulating restart)
      const newTracker = new ChangeTrackingService(tempDir);
      
      // Wait for async loading to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should load persisted changes
      const changes = await newTracker.getChangesForFile(filePath);
      assert.strictEqual(changes.length, 1);
      assert.strictEqual(changes[0].id, changeId);
      assert.strictEqual(changes[0].status, 'pending');
    });
  });

  suite('getPendingChanges', () => {
    test('should return only pending changes', async () => {
      const filePath1 = path.join(tempDir, 'test1.txt');
      const filePath2 = path.join(tempDir, 'test2.txt');
      const filePath3 = path.join(tempDir, 'test3.txt');

      // Create three changes
      const changeId1 = await changeTracker.trackFileOperation(filePath1, {
        type: 'create',
        beforeContent: null,
        afterContent: 'content1',
        toolName: 'write_file'
      });

      const changeId2 = await changeTracker.trackFileOperation(filePath2, {
        type: 'create',
        beforeContent: null,
        afterContent: 'content2',
        toolName: 'write_file'
      });

      const changeId3 = await changeTracker.trackFileOperation(filePath3, {
        type: 'create',
        beforeContent: null,
        afterContent: 'content3',
        toolName: 'write_file'
      });

      // Accept one, reject one, leave one pending
      await changeTracker.acceptChange(changeId1);
      await changeTracker.rejectChange(changeId2);

      const pendingChanges = await changeTracker.getAllPendingChanges();
      assert.strictEqual(pendingChanges.length, 1);
      assert.strictEqual(pendingChanges[0].id, changeId3);
      assert.strictEqual(pendingChanges[0].status, 'pending');
    });
  });
});

suite('BackupManager', () => {
  let tempDir: string;
  let backupManager: BackupManager;

  setup(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    backupManager = new BackupManager(tempDir);
  });

  teardown(async () => {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  suite('createBackup', () => {
    test('should create backup correctly', async () => {
      const filePath = path.join(tempDir, 'original.txt');
      const content = 'backup content';

      const backupId = await backupManager.createBackup(filePath, content);
      
      assert.ok(backupId);
      assert.ok(backupId.startsWith('backup_'));

      // Check backup file exists
      const backupPath = path.join(tempDir, '.codingagent', 'backups', backupId);
      assert.ok(fs.existsSync(backupPath));

      // Check backup content
      const restoredContent = await fs.promises.readFile(backupPath, 'utf8');
      assert.strictEqual(restoredContent, content);

      // Check metadata file exists
      const metadataPath = backupPath + '.meta';
      assert.ok(fs.existsSync(metadataPath));
    });
  });

  suite('restoreFromBackup', () => {
    test('should restore from backup correctly', async () => {
      const originalPath = path.join(tempDir, 'original.txt');
      const targetPath = path.join(tempDir, 'restored.txt');
      const content = 'backup content';

      // Create backup
      const backupId = await backupManager.createBackup(originalPath, content);

      // Restore to new location
      await backupManager.restoreFromBackup(backupId, targetPath);

      // Check restored content
      const restoredContent = await fs.promises.readFile(targetPath, 'utf8');
      assert.strictEqual(restoredContent, content);
    });

    test('should handle non-existent backup gracefully', async () => {
      const targetPath = path.join(tempDir, 'restored.txt');
      
      try {
        await backupManager.restoreFromBackup('non-existent-backup', targetPath);
        assert.fail('Should have thrown error for non-existent backup');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Failed to restore from backup'));
      }
    });
  });

  suite('cleanupOldBackups', () => {
    test('should cleanup old backups correctly', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'test content';

      // Create backup
      const backupId = await backupManager.createBackup(filePath, content);
      const backupPath = path.join(tempDir, '.codingagent', 'backups', backupId);
      
      // Verify backup exists
      assert.ok(fs.existsSync(backupPath));

      // Wait a bit to ensure backup is "old"
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cleanup with maxAge = 5ms (should remove the backup created 10ms ago)
      await backupManager.cleanupOldBackups(5);

      // Backup should be gone
      assert.ok(!fs.existsSync(backupPath));
    });
  });
});
