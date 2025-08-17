import * as vscode from 'vscode';
import { ChangeTrackingService, FileChange, LineChange } from './changeTrackingService';

export class ChangeCodeLensProvider implements vscode.CodeLensProvider {
  private changeTracker: ChangeTrackingService;
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(changeTracker: ChangeTrackingService) {
    this.changeTracker = changeTracker;
  }

  async provideCodeLenses(
    document: vscode.TextDocument, 
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    if (document.uri.scheme !== 'file') {
      return [];
    }

    const filePath = document.uri.fsPath;
    const changes = await this.changeTracker.getChangesForFile(filePath);
    const codeLenses: vscode.CodeLens[] = [];

    // Only show CodeLenses for pending changes (accepted/rejected are removed)
    for (const change of changes) {
      // Group consecutive line changes of the same type
      const changeGroups = this.groupConsecutiveChanges(change.lineChanges);
      
      for (const group of changeGroups) {
        // Skip deleted lines (they don't exist in the current file)
        if (group.type === 'delete') {
          continue;
        }

        // Use the first line of the group for CodeLens placement
        const firstLineNum = group.lines[0];
        
        // Ensure line number is valid
        if (firstLineNum < 1 || firstLineNum > document.lineCount) {
          continue;
        }

        const range = new vscode.Range(
          Math.max(0, firstLineNum - 1),
          0,
          Math.max(0, firstLineNum - 1),
          document.lineAt(Math.max(0, firstLineNum - 1)).text.length
        );

        // Accept change CodeLens (for the entire group)
        const acceptLens = new vscode.CodeLens(range, {
          title: `✓ Accept`,
          command: 'codingagent.acceptChange',
          arguments: [change.id]
        });

        // Reject change CodeLens (for the entire group)
        const rejectLens = new vscode.CodeLens(range, {
          title: `✗ Reject`,
          command: 'codingagent.rejectChange',
          arguments: [change.id]
        });

        codeLenses.push(acceptLens, rejectLens);
        break; // Only one CodeLens per change, not per group
      }
    }

    return codeLenses;
  }

  // Group consecutive line changes of the same type
  private groupConsecutiveChanges(lineChanges: any[]): any[] {
    if (lineChanges.length === 0) return [];

    const groups: any[] = [];
    let currentGroup: any = null;

    // Sort by line number first
    const sortedChanges = lineChanges
      .filter(lc => lc.type !== 'delete') // Filter out deletions
      .sort((a, b) => a.lineNumber - b.lineNumber);

    for (const lineChange of sortedChanges) {
      if (!currentGroup || 
          currentGroup.type !== lineChange.type ||
          lineChange.lineNumber !== currentGroup.lastLine + 1) {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          type: lineChange.type,
          lines: [lineChange.lineNumber],
          lastLine: lineChange.lineNumber
        };
      } else {
        // Add to current group
        currentGroup.lines.push(lineChange.lineNumber);
        currentGroup.lastLine = lineChange.lineNumber;
      }
    }

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}
