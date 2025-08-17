// Quick test of inline change tracking functionality

import * as vscode from 'vscode';
import { ChangeTrackingService } from './changeTrackingService';
import { InlineChangeDecorationService } from './inlineChangeDecorationService';

export async function testInlineChangeTracking(): Promise<void> {
  console.log('Testing inline change tracking...');
  
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    console.log('No workspace found');
    return;
  }

  const changeTracker = new ChangeTrackingService(workspaceRoot);
  const decorationService = new InlineChangeDecorationService(changeTracker);

  // Test file
  const testFilePath = workspaceRoot + '/test-changes.js';
  
  // Create a test change
  const changeId = await changeTracker.trackFileOperation(testFilePath, {
    type: 'modify',
    beforeContent: 'let result = add(2, 3);',
    afterContent: 'let result = add(5, 7);',
    toolName: 'test_tool'
  });

  console.log('Created change:', changeId);

  // Update decorations
  await decorationService.refreshFileDecorations(testFilePath);
  
  console.log('Decorations updated');

  // Test accepting change
  await changeTracker.acceptChange(changeId);
  await decorationService.refreshFileDecorations(testFilePath);
  
  console.log('Change accepted');

  decorationService.dispose();
}
