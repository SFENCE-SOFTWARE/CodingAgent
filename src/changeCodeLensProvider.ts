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
    const processedLines = new Set<number>(); // Prevent duplicates

    // Only show CodeLenses for pending changes (accepted/rejected are removed)
    for (const change of changes) {
      // Group by line number to avoid duplicates
      const lineGroups = new Map<number, any[]>();
      
      for (const lineChange of change.lineChanges) {
        const lineNum = lineChange.lineNumber;
        if (!lineGroups.has(lineNum)) {
          lineGroups.set(lineNum, []);
        }
        lineGroups.get(lineNum)!.push(lineChange);
      }

      // Create CodeLens for each unique line
      for (const [lineNum, lineChanges] of lineGroups) {
        if (processedLines.has(lineNum)) {
          continue; // Skip if already processed
        }
        processedLines.add(lineNum);

        const range = new vscode.Range(
          Math.max(0, lineNum - 1),
          0,
          Math.max(0, lineNum - 1),
          Number.MAX_SAFE_INTEGER
        );

        // Determine change type (prefer modify > add > delete)
        const changeTypes = lineChanges.map(lc => lc.type);
        const changeType = changeTypes.includes('modify') ? 'modify' : 
                          changeTypes.includes('add') ? 'add' : 'delete';

        // Accept change CodeLens
        const acceptLens = new vscode.CodeLens(range, {
          title: `✓ Accept ${changeType}`,
          command: 'codingagent.acceptSpecificChange',
          arguments: [change.id, lineNum]
        });

        // Reject change CodeLens  
        const rejectLens = new vscode.CodeLens(range, {
          title: `✗ Reject ${changeType}`,
          command: 'codingagent.rejectSpecificChange',
          arguments: [change.id, lineNum]
        });

        // Show diff CodeLens
        const diffLens = new vscode.CodeLens(range, {
          title: `📋 Diff`,
          command: 'codingagent.showChangeDiff',
          arguments: [change.id]
        });

        codeLenses.push(acceptLens, rejectLens, diffLens);
      }
    }

    return codeLenses;
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}
