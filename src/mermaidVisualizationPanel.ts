// src/mermaidVisualizationPanel.ts

import * as vscode from 'vscode';

export class MermaidVisualizationPanel {
  public static currentPanel: MermaidVisualizationPanel | undefined;
  public static readonly viewType = 'codingagent-mermaid-visualization';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, planId: string, mermaidCode: string, architectureData: any) {
    const column = vscode.ViewColumn.Active;

    // If we already have a panel, show it and update content.
    if (MermaidVisualizationPanel.currentPanel) {
      MermaidVisualizationPanel.currentPanel._panel.reveal(column);
      MermaidVisualizationPanel.currentPanel._updateContent(planId, mermaidCode, architectureData);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      MermaidVisualizationPanel.viewType,
      `Architecture Diagram: ${planId}`,
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    MermaidVisualizationPanel.currentPanel = new MermaidVisualizationPanel(panel, extensionUri, planId, mermaidCode, architectureData);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    // For now, just dispose the panel if we can't revive it properly
    panel.dispose();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, planId: string, mermaidCode: string, architectureData: any) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._updateContent(planId, mermaidCode, architectureData);

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Listen for messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'export':
            this._exportDiagram(message.format);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private _updateContent(planId: string, mermaidCode: string, architectureData: any) {
    this._panel.webview.html = this._getHtmlForWebview(planId, mermaidCode, architectureData);
  }

  private _exportDiagram(format: string) {
    // Future implementation for exporting diagrams
    vscode.window.showInformationMessage(`Export as ${format} - Feature coming soon!`);
  }

  public dispose() {
    MermaidVisualizationPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  // Public method for testing HTML generation
  public getHtmlForTesting(planId: string, mermaidCode: string, architectureData: any): string {
    return this._getHtmlForWebview(planId, mermaidCode, architectureData);
  }

  private _getHtmlForWebview(planId: string, mermaidCode: string, architectureData: any): string {
    // Clean mermaid code (remove markdown wrapper)
    const cleanMermaidCode = mermaidCode.replace(/```mermaid\n?|\n?```/g, '').replace(/\\n/g, '\n');
    const escapedMermaidCode = this._escapeHtml(cleanMermaidCode);
    const escapedJsonData = this._escapeHtml(JSON.stringify(architectureData, null, 2));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Architecture Diagram</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .title {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .controls {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .diagram-container {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            overflow: auto;
        }
        
        .mermaid {
            display: inline-block;
            max-width: 100%;
            height: auto;
        }
        
        .details {
            margin-top: 30px;
        }
        
        .section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }
        
        .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            white-space: pre;
        }
        
        .tabs {
            display: flex;
            margin-bottom: 10px;
        }
        
        .tab {
            padding: 8px 16px;
            background-color: var(--vscode-tab-inactiveBackground);
            color: var(--vscode-tab-inactiveForeground);
            border: none;
            cursor: pointer;
            border-radius: 4px 4px 0 0;
            margin-right: 2px;
        }
        
        .tab.active {
            background-color: var(--vscode-tab-activeBackground);
            color: var(--vscode-tab-activeForeground);
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        
        .zoom-controls {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            background-color: var(--vscode-sideBar-background);
            padding: 10px;
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
        }
        
        .zoom-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            min-width: 40px;
        }
        
        .zoom-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">🏗️ Architecture Diagram: ${this._escapeHtml(planId)}</h1>
        <div class="controls">
            <button class="btn secondary" onclick="refreshDiagram()">🔄 Refresh</button>
            <button class="btn secondary" onclick="exportDiagram('png')">📸 Export PNG</button>
            <button class="btn secondary" onclick="exportDiagram('svg')">📄 Export SVG</button>
        </div>
    </div>
    
    <div class="zoom-controls">
        <button class="zoom-btn" onclick="zoomIn()">🔍+</button>
        <button class="zoom-btn" onclick="zoomOut()">🔍−</button>
        <button class="zoom-btn" onclick="resetZoom()">⚖️</button>
        <button class="zoom-btn" onclick="fitToScreen()">📏</button>
    </div>
    
    <div class="diagram-container" id="diagramContainer">
        <div id="mermaidDiagram" class="mermaid">
${escapedMermaidCode}
        </div>
    </div>
    
    <div class="details">
        <div class="tabs">
            <button class="tab active" onclick="showTab('mermaid')">Mermaid Code</button>
            <button class="tab" onclick="showTab('json')">JSON Architecture</button>
        </div>
        
        <div id="mermaid-tab" class="tab-content active">
            <div class="section">
                <div class="section-title">Mermaid Diagram Code</div>
                <div class="code-block">${escapedMermaidCode}</div>
            </div>
        </div>
        
        <div id="json-tab" class="tab-content">
            <div class="section">
                <div class="section-title">Original JSON Architecture</div>
                <div class="code-block">${escapedJsonData}</div>
            </div>
        </div>
    </div>
    
    <script>
        let currentZoom = 1;
        
        // Initialize Mermaid
        mermaid.initialize({ 
            startOnLoad: true,
            theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            themeVariables: {
                primaryColor: '#0078d4',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#ffffff',
                lineColor: '#ffffff',
                secondaryColor: '#3c3c3c',
                tertiaryColor: '#1e1e1e',
                background: '#1e1e1e',
                mainBkg: '#3c3c3c',
                secondBkg: '#2d2d2d',
                tertiaryBkg: '#252526'
            }
        });
        
        // Render the diagram after initialization
        mermaid.contentLoaded();
        
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Show selected tab
            document.querySelector(\`[onclick="showTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(\`\${tabName}-tab\`).classList.add('active');
        }
        
        function refreshDiagram() {
            // Re-render mermaid diagrams
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
        }
        
        function exportDiagram(format) {
            if (typeof acquireVsCodeApi !== 'undefined') {
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ command: 'export', format: format });
            } else {
                console.log(\`Export as \${format} requested\`);
            }
        }
        
        function zoomIn() {
            currentZoom = Math.min(currentZoom * 1.2, 3);
            applyZoom();
        }
        
        function zoomOut() {
            currentZoom = Math.max(currentZoom / 1.2, 0.3);
            applyZoom();
        }
        
        function resetZoom() {
            currentZoom = 1;
            applyZoom();
        }
        
        function fitToScreen() {
            const container = document.getElementById('diagramContainer');
            const diagram = document.getElementById('mermaidDiagram');
            
            if (diagram && container) {
                const containerWidth = container.offsetWidth - 40; // Account for padding
                const diagramWidth = diagram.scrollWidth;
                
                if (diagramWidth > 0) {
                    currentZoom = containerWidth / diagramWidth;
                    currentZoom = Math.max(0.3, Math.min(currentZoom, 3));
                    applyZoom();
                }
            }
        }
        
        function applyZoom() {
            const diagram = document.getElementById('mermaidDiagram');
            if (diagram) {
                diagram.style.transform = \`scale(\${currentZoom})\`;
                diagram.style.transformOrigin = 'center top';
            }
        }
        
        // Auto-fit and render on load
        window.addEventListener('load', () => {
            setTimeout(() => {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                fitToScreen();
            }, 500);
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(fitToScreen, 100);
        });
    </script>
</body>
</html>`;
  }

  private _escapeHtml(text: string): string {
    if (!text) {
      return '';
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
