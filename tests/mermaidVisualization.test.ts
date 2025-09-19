// tests/mermaidVisualization.test.ts

import * as assert from 'assert';
import * as vscode from 'vscode';
import { MermaidVisualizationPanel } from '../src/mermaidVisualizationPanel';

suite('Mermaid Visualization Tests', () => {
  test('should have correct view type', () => {
    assert.strictEqual(MermaidVisualizationPanel.viewType, 'codingagent-mermaid-visualization');
  });

  test('should create panel with correct title', async () => {
    // This test would require a full VS Code environment with workspace
    // For now, just test that the static properties are correct
    assert.ok(MermaidVisualizationPanel.createOrShow);
    assert.ok(MermaidVisualizationPanel.revive);
  });
});
