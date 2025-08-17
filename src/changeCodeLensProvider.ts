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
      for (const lineChange of change.lineChanges) {
        // Only show CodeLens for added and modified lines, not deleted ones
        if (lineChange.type === 'delete') {
          continue;
        }

        const lineNum = lineChange.lineNumber;
        if (processedLines.has(lineNum)) {
          continue; // Skip if already processed
        }
        processedLines.add(lineNum);

        // Ensure line number is valid
        if (lineNum < 1 || lineNum > document.lineCount) {
          continue;
        }

        const range = new vscode.Range(
          Math.max(0, lineNum - 1),
          0,
          Math.max(0, lineNum - 1),
          document.lineAt(Math.max(0, lineNum - 1)).text.length
        );

        // Accept change CodeLens
        const acceptLens = new vscode.CodeLens(range, {
          title: `✓ Accept`,
          command: 'codingagent.acceptSpecificChange',
          arguments: [change.id, lineNum]
        });

        // Reject change CodeLens  
        const rejectLens = new vscode.CodeLens(range, {
          title: `✗ Reject`,
          command: 'codingagent.rejectSpecificChange',
          arguments: [change.id, lineNum]
        });

        codeLenses.push(acceptLens, rejectLens);
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
