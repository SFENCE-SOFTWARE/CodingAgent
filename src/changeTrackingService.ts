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

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.backupManager = new BackupManager(workspaceRoot);
    this.persistenceFile = path.join(workspaceRoot, '.codingagent', 'changes.json');
    this.loadPersistedChanges();
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

    // Store change
    if (!this.changes.has(absolutePath)) {
      this.changes.set(absolutePath, []);
    }
    this.changes.get(absolutePath)!.push(change);

    // Persist changes
    await this.persistChanges();

    return changeId;
  }

  async getChangesForFile(filePath: string): Promise<FileChange[]> {
    const absolutePath = path.resolve(filePath);
    return this.changes.get(absolutePath) || [];
  }

  async getAllPendingChanges(): Promise<FileChange[]> {
    const allChanges: FileChange[] = [];
    for (const changes of this.changes.values()) {
      allChanges.push(...changes.filter(change => change.status === 'pending'));
    }
    return allChanges.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAllChanges(): Promise<FileChange[]> {
    const allChanges: FileChange[] = [];
    for (const changes of this.changes.values()) {
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

    change.status = 'accepted';
    await this.persistChanges();
  }

  async rejectChange(changeId: string): Promise<void> {
    const change = this.findChangeById(changeId);
    if (!change) {
      throw new Error(`Change with ID ${changeId} not found`);
    }

    change.status = 'rejected';

    // Restore from backup if available
    if (change.backupId && change.beforeContent) {
      try {
        await this.backupManager.restoreFromBackup(change.backupId, change.filePath);
      } catch (error) {
        console.warn('Failed to restore from backup:', error);
        // Fallback: write the before content directly
        await fs.promises.writeFile(change.filePath, change.beforeContent, 'utf8');
      }
    }

    await this.persistChanges();
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

    // Simple line-by-line diff algorithm
    let beforeIndex = 0;
    let afterIndex = 0;

    while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
      const beforeLine = beforeLines[beforeIndex];
      const afterLine = afterLines[afterIndex];

      if (beforeIndex >= beforeLines.length) {
        // Only after lines remaining - additions
        changes.push({
          type: 'add',
          lineNumber: afterIndex + 1,
          newContent: afterLine,
          contextBefore: this.getContext(afterLines, afterIndex, true),
          contextAfter: this.getContext(afterLines, afterIndex, false)
        });
        afterIndex++;
      } else if (afterIndex >= afterLines.length) {
        // Only before lines remaining - deletions
        changes.push({
          type: 'delete',
          lineNumber: beforeIndex + 1,
          oldContent: beforeLine,
          contextBefore: this.getContext(beforeLines, beforeIndex, true),
          contextAfter: this.getContext(beforeLines, beforeIndex, false)
        });
        beforeIndex++;
      } else if (beforeLine === afterLine) {
        // Lines are the same
        beforeIndex++;
        afterIndex++;
      } else {
        // Lines are different - modification
        changes.push({
          type: 'modify',
          lineNumber: beforeIndex + 1,
          oldContent: beforeLine,
          newContent: afterLine,
          contextBefore: this.getContext(beforeLines, beforeIndex, true),
          contextAfter: this.getContext(afterLines, afterIndex, false)
        });
        beforeIndex++;
        afterIndex++;
      }
    }

    return changes;
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
      for (const [filePath, changes] of this.changes.entries()) {
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
    
    for (const [filePath, changes] of this.changes.entries()) {
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
    for (const changes of this.changes.values()) {
      const change = changes.find(c => c.id === changeId);
      if (change) {
        return change;
      }
    }
    return null;
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
