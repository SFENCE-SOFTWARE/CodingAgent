// src/changeTrackingService.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface LineChange {
  type: 'add' | 'delete' | 'modify';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface FileChange {
  id: string;
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  beforeContent: string;
  afterContent: string;
  timestamp: number;
  toolName: string;
  status: 'pending' | 'accepted' | 'rejected';
  lineChanges: LineChange[];
  backupId?: string;
}

export interface FileOperation {
  type: 'create' | 'modify' | 'delete' | 'rename';
  beforeContent: string | null;
  afterContent: string | null;
  toolName: string;
}

export class BackupManager {
  private backupDir: string;

  constructor(workspaceRoot: string) {
    this.backupDir = path.join(workspaceRoot, '.codingagent', 'backups');
  }

  async createBackup(filePath: string, content: string): Promise<string> {
    const backupId = this.generateBackupId();
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.promises.writeFile(backupPath, content, 'utf8');
      
      // Store metadata
      const metadataPath = backupPath + '.meta';
      const metadata = {
        originalPath: filePath,
        timestamp: Date.now(),
        backupId
      };
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      return backupId;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async restoreFromBackup(backupId: string, targetPath: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      const content = await fs.promises.readFile(backupPath, 'utf8');
      await fs.promises.writeFile(targetPath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cleanupOldBackups(maxAge: number): Promise<void> {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return;
      }

      const files = await fs.promises.readdir(this.backupDir);
      const cutoffTime = Date.now() - maxAge;

      for (const file of files) {
        if (file.endsWith('.meta')) {
          continue;
        }

        const filePath = path.join(this.backupDir, file);
        const metadataPath = filePath + '.meta';
        
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
          if (metadata.timestamp < cutoffTime) {
            await fs.promises.unlink(filePath);
            await fs.promises.unlink(metadataPath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class ChangeTrackingService {
  private changes: Map<string, FileChange[]> = new Map();
  private backupManager: BackupManager;
  private workspaceRoot: string;
  private persistenceFile: string;
  private changeUpdateCallback?: (filePath: string, changeType: 'created' | 'accepted' | 'rejected') => Promise<void>;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.backupManager = new BackupManager(workspaceRoot);
    this.persistenceFile = path.join(workspaceRoot, '.codingagent', 'changes.json');
    this.loadPersistedChanges();
  }

  // Set callback for real-time updates
  setChangeUpdateCallback(callback: (filePath: string, changeType: 'created' | 'accepted' | 'rejected') => Promise<void>): void {
    console.log('ChangeTrackingService: Setting change update callback');
    this.changeUpdateCallback = callback;
  }

  // Core tracking methods
  async trackFileOperation(filePath: string, operation: FileOperation): Promise<string> {
    const changeId = this.generateChangeId();
    const absolutePath = path.resolve(filePath);
    
    // Create backup if enabled and file exists
    let backupId: string | undefined;
    const config = vscode.workspace.getConfiguration('codingagent');
    const autoBackup = config.get<boolean>('changeTracking.autoBackup', true);
    
    if (autoBackup && operation.beforeContent) {
      try {
        backupId = await this.backupManager.createBackup(absolutePath, operation.beforeContent);
      } catch (error) {
        console.warn('Failed to create backup:', error);
      }
    }

    // Calculate line changes
    const lineChanges = await this.calculateLineDiff(
      operation.beforeContent || '', 
      operation.afterContent || ''
    );

    const change: FileChange = {
      id: changeId,
      filePath: absolutePath,
      changeType: operation.type,
      beforeContent: operation.beforeContent || '',
      afterContent: operation.afterContent || '',
      timestamp: Date.now(),
      toolName: operation.toolName,
      status: 'pending',
      lineChanges,
      backupId
    };

    // Check if there's already a pending change for this file
    if (!this.changes.has(absolutePath)) {
      this.changes.set(absolutePath, []);
    }
    
    const existingChanges = this.changes.get(absolutePath)!;
    const existingPendingIndex = existingChanges.findIndex(c => c.status === 'pending');
    
    if (existingPendingIndex !== -1) {
      // Replace existing pending change with new one, but keep the original beforeContent
      const existingChange = existingChanges[existingPendingIndex];
      console.log(`ChangeTrackingService: Replacing existing pending change for ${absolutePath}`);
      
      // Use the original beforeContent from the first change, but new afterContent
      change.beforeContent = existingChange.beforeContent;
      change.backupId = existingChange.backupId; // Keep original backup
      
      // Check if the new afterContent is the same as the original beforeContent
      if (change.afterContent === change.beforeContent) {
        // Content is back to original - remove the change entirely
        console.log(`ChangeTrackingService: Content reverted to original for ${absolutePath}, removing change`);
        existingChanges.splice(existingPendingIndex, 1);
        
        // Clean up backup if it exists
        if (change.backupId) {
          try {
            await this.backupManager.cleanupOldBackups(0); // Remove this backup
          } catch (error) {
            console.warn('Failed to cleanup backup after reverting change:', error);
          }
        }
      } else {
        // Replace the existing change
        existingChanges[existingPendingIndex] = change;
      }
    } else {
      // Check if this is a no-op change (content unchanged)
      if (change.afterContent === change.beforeContent) {
        console.log(`ChangeTrackingService: No-op change detected for ${absolutePath}, skipping`);
        return changeId; // Return ID but don't track the change
      }
      
      // Add new change
      existingChanges.push(change);
    }

    // Persist changes
    await this.persistChanges();

    // Notify about new change (async)
    console.log(`ChangeTrackingService: About to call callback for ${absolutePath}, has callback: ${!!this.changeUpdateCallback}`);
    if (this.changeUpdateCallback) {
      try {
        console.log(`ChangeTrackingService: Calling callback for change created: ${absolutePath}`);
        await this.changeUpdateCallback(absolutePath, 'created');
        console.log(`ChangeTrackingService: Callback completed successfully for ${absolutePath}`);
      } catch (error) {
        console.warn('Change callback failed:', error);
      }
    } else {
      console.warn('ChangeTrackingService: No callback set!');
    }

    return changeId;
  }

  async getChangesForFile(filePath: string): Promise<FileChange[]> {
    const absolutePath = path.resolve(filePath);
    const allChanges = this.changes.get(absolutePath) || [];
    // Return only pending changes - accepted/rejected are removed completely
    return allChanges.filter(change => change.status === 'pending');
  }

  async getAllPendingChanges(): Promise<FileChange[]> {
    const allChanges: FileChange[] = [];
    for (const changes of Array.from(this.changes.values())) {
      allChanges.push(...changes.filter(change => change.status === 'pending'));
    }
    return allChanges.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAllChanges(): Promise<FileChange[]> {
    const allChanges: FileChange[] = [];
    for (const changes of Array.from(this.changes.values())) {
      allChanges.push(...changes);
    }
    return allChanges.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Change management
  async acceptChange(changeId: string): Promise<void> {
    const change = this.findChangeById(changeId);
    if (!change) {
      throw new Error(`Change with ID ${changeId} not found`);
    }

    const filePath = change.filePath;

    // Remove the change completely (don't keep accepted changes)
    this.removeChangeById(changeId);
    await this.persistChanges();

    // Notify about acceptance
    if (this.changeUpdateCallback) {
      try {
        await this.changeUpdateCallback(filePath, 'accepted');
      } catch (error) {
        console.warn('Accept callback failed:', error);
      }
    }
  }

  async rejectChange(changeId: string): Promise<void> {
    const change = this.findChangeById(changeId);
    if (!change) {
      throw new Error(`Change with ID ${changeId} not found`);
    }

    const filePath = change.filePath;

    // Revert the file to original content
    if (change.beforeContent !== null) {
      try {
        if (change.backupId) {
          await this.backupManager.restoreFromBackup(change.backupId, change.filePath);
        } else {
          // Fallback: write the before content directly
          await fs.promises.writeFile(change.filePath, change.beforeContent, 'utf8');
        }
      } catch (error) {
        console.warn('Failed to restore file content:', error);
        // Still try to write before content
        try {
          await fs.promises.writeFile(change.filePath, change.beforeContent, 'utf8');
        } catch (writeError) {
          console.error('Failed to restore file content:', writeError);
        }
      }
    }

    // Remove the change completely
    this.removeChangeById(changeId);
    await this.persistChanges();

    // Notify about rejection
    if (this.changeUpdateCallback) {
      try {
        await this.changeUpdateCallback(filePath, 'rejected');
      } catch (error) {
        console.warn('Reject callback failed:', error);
      }
    }
  }

  async acceptAllChanges(): Promise<void> {
    const pendingChanges = await this.getAllPendingChanges();
    for (const change of pendingChanges) {
      change.status = 'accepted';
    }
    await this.persistChanges();
  }

  async rejectAllChanges(): Promise<void> {
    const pendingChanges = await this.getAllPendingChanges();
    for (const change of pendingChanges) {
      change.status = 'rejected';
      
      // Restore from backup if available
      if (change.backupId && change.beforeContent) {
        try {
          await this.backupManager.restoreFromBackup(change.backupId, change.filePath);
        } catch (error) {
          console.warn('Failed to restore from backup:', error);
          // Fallback: write the before content directly
          try {
            await fs.promises.writeFile(change.filePath, change.beforeContent, 'utf8');
          } catch (writeError) {
            console.error('Failed to restore file content:', writeError);
          }
        }
      }
    }
    await this.persistChanges();
  }

  // Diff and analysis
  async calculateLineDiff(before: string, after: string): Promise<LineChange[]> {
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    const changes: LineChange[] = [];

    // Use a more sophisticated diff algorithm similar to git diff
    const lcsMatrix = this.calculateLCS(beforeLines, afterLines);
    const diffResult = this.backtrackLCS(beforeLines, afterLines, lcsMatrix);
    
    let afterLineNum = 1;
    
    for (const operation of diffResult) {
      if (operation.type === 'add') {
        changes.push({
          type: 'add',
          lineNumber: afterLineNum,
          newContent: operation.line,
          contextBefore: this.getContext(afterLines, afterLineNum - 1, true),
          contextAfter: this.getContext(afterLines, afterLineNum - 1, false)
        });
        afterLineNum++;
      } else if (operation.type === 'delete') {
        changes.push({
          type: 'delete',
          lineNumber: afterLineNum,
          oldContent: operation.line,
          contextBefore: this.getContext(beforeLines, operation.beforeIndex || 0, true),
          contextAfter: this.getContext(beforeLines, operation.beforeIndex || 0, false)
        });
        // Don't increment afterLineNum for deletions
      } else if (operation.type === 'modify') {
        changes.push({
          type: 'modify',
          lineNumber: afterLineNum,
          oldContent: operation.oldLine,
          newContent: operation.line,
          contextBefore: this.getContext(beforeLines, operation.beforeIndex || 0, true),
          contextAfter: this.getContext(afterLines, afterLineNum - 1, false)
        });
        afterLineNum++;
      } else if (operation.type === 'equal') {
        afterLineNum++;
      }
    }

    return changes;
  }

  // Longest Common Subsequence algorithm for better diff
  private calculateLCS(beforeLines: string[], afterLines: string[]): number[][] {
    const m = beforeLines.length;
    const n = afterLines.length;
    const lcs = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (beforeLines[i - 1] === afterLines[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }

    return lcs;
  }

  // Backtrack LCS to get diff operations
  private backtrackLCS(beforeLines: string[], afterLines: string[], lcs: number[][]): any[] {
    const operations: any[] = [];
    let i = beforeLines.length;
    let j = afterLines.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
        operations.unshift({
          type: 'equal',
          line: beforeLines[i - 1],
          beforeIndex: i - 1,
          afterIndex: j - 1
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        operations.unshift({
          type: 'add',
          line: afterLines[j - 1],
          afterIndex: j - 1
        });
        j--;
      } else if (i > 0) {
        operations.unshift({
          type: 'delete',
          line: beforeLines[i - 1],
          beforeIndex: i - 1
        });
        i--;
      }
    }

    return operations;
  }

  async generateHtmlDiff(change: FileChange): Promise<string> {
    const beforeLines = change.beforeContent.split('\n');
    const afterLines = change.afterContent.split('\n');
    
    let html = '<div class="diff-viewer">';
    
    // Create side-by-side diff
    const maxLines = Math.max(beforeLines.length, afterLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const beforeLine = beforeLines[i] || '';
      const afterLine = afterLines[i] || '';
      
      let lineClass = 'unchanged';
      if (i >= beforeLines.length) {
        lineClass = 'added';
      } else if (i >= afterLines.length) {
        lineClass = 'removed';
      } else if (beforeLine !== afterLine) {
        lineClass = 'modified';
      }
      
      html += `
        <div class="diff-line ${lineClass}">
          <span class="diff-line-number">${i + 1}</span>
          <span class="diff-content-before">${this.escapeHtml(beforeLine)}</span>
          <span class="diff-content-after">${this.escapeHtml(afterLine)}</span>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }

  // Persistence and cleanup
  async persistChanges(): Promise<void> {
    try {
      const persistenceDir = path.dirname(this.persistenceFile);
      await fs.promises.mkdir(persistenceDir, { recursive: true });
      
      const changesObject: Record<string, FileChange[]> = {};
      for (const [filePath, changes] of Array.from(this.changes.entries())) {
        changesObject[filePath] = changes;
      }
      
      await fs.promises.writeFile(this.persistenceFile, JSON.stringify(changesObject, null, 2));
    } catch (error) {
      console.error('Failed to persist changes:', error);
    }
  }

  async loadPersistedChanges(): Promise<void> {
    try {
      if (fs.existsSync(this.persistenceFile)) {
        const content = await fs.promises.readFile(this.persistenceFile, 'utf8');
        const changesObject = JSON.parse(content);
        
        this.changes.clear();
        for (const [filePath, changes] of Object.entries(changesObject)) {
          this.changes.set(filePath, changes as FileChange[]);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted changes:', error);
    }
  }

  async clearOldChanges(maxAge: number): Promise<void> {
    const cutoffTime = Date.now() - maxAge;
    
    for (const [filePath, changes] of Array.from(this.changes.entries())) {
      const filteredChanges = changes.filter(change => 
        change.status === 'pending' || change.timestamp > cutoffTime
      );
      
      if (filteredChanges.length === 0) {
        this.changes.delete(filePath);
      } else {
        this.changes.set(filePath, filteredChanges);
      }
    }
    
    await this.persistChanges();
    await this.backupManager.cleanupOldBackups(maxAge);
  }

  async clearAllChanges(): Promise<void> {
    this.changes.clear();
    await this.persistChanges();
  }

  // Helper methods
  private findChangeById(changeId: string): FileChange | null {
    for (const changes of Array.from(this.changes.values())) {
      const change = changes.find(c => c.id === changeId);
      if (change) {
        return change;
      }
    }
    return null;
  }

  private removeChangeById(changeId: string): boolean {
    for (const [filePath, changes] of Array.from(this.changes.entries())) {
      const index = changes.findIndex(c => c.id === changeId);
      if (index !== -1) {
        changes.splice(index, 1);
        if (changes.length === 0) {
          this.changes.delete(filePath);
        }
        return true;
      }
    }
    return false;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getContext(lines: string[], index: number, before: boolean): string[] {
    const contextSize = 3;
    if (before) {
      const start = Math.max(0, index - contextSize);
      return lines.slice(start, index);
    } else {
      const end = Math.min(lines.length, index + contextSize + 1);
      return lines.slice(index + 1, end);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
