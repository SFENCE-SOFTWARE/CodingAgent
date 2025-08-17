import * as vscode from 'vscode';
import { FileChange, LineChange, ChangeTrackingService } from './changeTrackingService';

interface DecorationMap {
  [filePath: string]: {
    pending: vscode.TextEditorDecorationType[];
    accepted: vscode.TextEditorDecorationType[];
    rejected: vscode.TextEditorDecorationType[];
  };
}

export class InlineChangeDecorationService {
  private decorations: DecorationMap = {};
  private changeTracker: ChangeTrackingService;
  private disposables: vscode.Disposable[] = [];

  // Decoration types for different states
  private pendingAddedDecoration!: vscode.TextEditorDecorationType;
  private pendingModifiedDecoration!: vscode.TextEditorDecorationType;
  private pendingDeletedDecoration!: vscode.TextEditorDecorationType;

  constructor(changeTracker: ChangeTrackingService) {
    this.changeTracker = changeTracker;
    this.initializeDecorationTypes();
    this.setupEventListeners();
    this.setupChangeTrackingCallback();
  }

  private setupChangeTrackingCallback(): void {
    // Set up real-time updates when changes occur
    this.changeTracker.setChangeUpdateCallback(async (filePath: string, changeType: 'created' | 'accepted' | 'rejected') => {
      console.log(`Change ${changeType} for file: ${filePath}`);
      await this.updateFileDecorations(filePath);
      
      // Also refresh CodeLens if available
      // We'll need to add CodeLens refresh notification to extension.ts
    });
  }

  private initializeDecorationTypes(): void {
    this.pendingAddedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(0, 255, 0, 0.15)',
      border: '1px solid rgba(0, 255, 0, 0.5)',
      borderWidth: '0 0 0 3px',
      isWholeLine: true,
      after: {
        contentText: ' ✓ Accept | ✗ Reject',
        color: '#888',
        margin: '0 0 0 1em'
      }
    });

    this.pendingModifiedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 165, 0, 0.15)',
      border: '1px solid rgba(255, 165, 0, 0.5)',
      borderWidth: '0 0 0 3px',
      isWholeLine: true,
      after: {
        contentText: ' ✓ Accept | ✗ Reject',
        color: '#888',
        margin: '0 0 0 1em'
      }
    });

    this.pendingDeletedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 0, 0, 0.15)',
      border: '1px solid rgba(255, 0, 0, 0.5)',
      borderWidth: '0 0 0 3px',
      isWholeLine: true,
      textDecoration: 'line-through',
      after: {
        contentText: ' ✓ Accept | ✗ Reject',
        color: '#888',
        margin: '0 0 0 1em'
      }
    });
  }

  private setupEventListeners(): void {
    // Listen for text editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateActiveEditorDecorations();
      })
    );

    // Listen for text document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.updateDocumentDecorations(event.document);
      })
    );

    // Listen for text editor visibility changes
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(() => {
        this.updateAllVisibleDecorations();
      })
    );
  }

  async updateFileDecorations(filePath: string): Promise<void> {
    const changes = await this.changeTracker.getChangesForFile(filePath);
    const editors = vscode.window.visibleTextEditors.filter(
      editor => editor.document.uri.fsPath === filePath
    );

    for (const editor of editors) {
      await this.applyDecorationsToEditor(editor, changes);
    }
  }

  private async applyDecorationsToEditor(
    editor: vscode.TextEditor, 
    changes: FileChange[]
  ): Promise<void> {
    // Clear existing decorations
    this.clearEditorDecorations(editor);

    // Group line changes by type (only pending changes are returned)
    const pendingAdded: vscode.Range[] = [];
    const pendingModified: vscode.Range[] = [];
    const pendingDeleted: vscode.Range[] = [];

    for (const change of changes) {
      // All changes are pending since getChangesForFile only returns pending
      for (const lineChange of change.lineChanges) {
        const range = this.createRangeFromLineChange(lineChange);
        
        switch (lineChange.type) {
          case 'add':
            pendingAdded.push(range);
            break;
          case 'modify':
            pendingModified.push(range);
            break;
          case 'delete':
            pendingDeleted.push(range);
            break;
        }
      }
    }

    // Apply decorations (only pending ones)
    editor.setDecorations(this.pendingAddedDecoration, pendingAdded);
    editor.setDecorations(this.pendingModifiedDecoration, pendingModified);
    editor.setDecorations(this.pendingDeletedDecoration, pendingDeleted);
  }

  private createRangeFromLineChange(lineChange: LineChange): vscode.Range {
    const lineNumber = Math.max(0, lineChange.lineNumber - 1); // VS Code uses 0-based line numbers
    return new vscode.Range(
      new vscode.Position(lineNumber, 0),
      new vscode.Position(lineNumber, Number.MAX_SAFE_INTEGER)
    );
  }

  private clearEditorDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.pendingAddedDecoration, []);
    editor.setDecorations(this.pendingModifiedDecoration, []);
    editor.setDecorations(this.pendingDeletedDecoration, []);
  }

  private async updateActiveEditorDecorations(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const filePath = editor.document.uri.fsPath;
    await this.updateFileDecorations(filePath);
  }

  private async updateDocumentDecorations(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') return;
    
    const filePath = document.uri.fsPath;
    await this.updateFileDecorations(filePath);
  }

  private async updateAllVisibleDecorations(): Promise<void> {
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.scheme === 'file') {
        const filePath = editor.document.uri.fsPath;
        await this.updateFileDecorations(filePath);
      }
    }
  }

  // Public methods for manual refresh
  async refreshAllDecorations(): Promise<void> {
    await this.updateAllVisibleDecorations();
  }

  async refreshFileDecorations(filePath: string): Promise<void> {
    await this.updateFileDecorations(filePath);
  }

  // Cleanup method
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.pendingAddedDecoration.dispose();
    this.pendingModifiedDecoration.dispose();
    this.pendingDeletedDecoration.dispose();
  }

  // Context menu and command support
  async handleAcceptChangeAtPosition(position: vscode.Position): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const filePath = editor.document.uri.fsPath;
    const lineNumber = position.line + 1; // Convert to 1-based

    const changes = await this.changeTracker.getChangesForFile(filePath);
    for (const change of changes) {
      if (change.status === 'pending') {
        for (const lineChange of change.lineChanges) {
          if (lineChange.lineNumber === lineNumber) {
            await this.changeTracker.acceptChange(change.id);
            await this.refreshFileDecorations(filePath);
            return;
          }
        }
      }
    }
  }

  async handleRejectChangeAtPosition(position: vscode.Position): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const filePath = editor.document.uri.fsPath;
    const lineNumber = position.line + 1; // Convert to 1-based

    const changes = await this.changeTracker.getChangesForFile(filePath);
    for (const change of changes) {
      if (change.status === 'pending') {
        for (const lineChange of change.lineChanges) {
          if (lineChange.lineNumber === lineNumber) {
            await this.changeTracker.rejectChange(change.id);
            await this.refreshFileDecorations(filePath);
            return;
          }
        }
      }
    }
  }
}
