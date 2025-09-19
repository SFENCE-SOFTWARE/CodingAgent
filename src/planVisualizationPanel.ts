// src/planVisualizationPanel.ts

import * as vscode from 'vscode';
import { ToolsService } from './tools';
import { MermaidVisualizationPanel } from './mermaidVisualizationPanel';

export class PlanVisualizationPanel {
  public static currentPanel: PlanVisualizationPanel | undefined;
  public static readonly viewType = 'codingagent-plan-visualization';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentPlanId: string = '';
  private _toolsService: ToolsService | null = null;

  public static createOrShow(extensionUri: vscode.Uri, planId: string, toolsService: ToolsService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it and update content.
    if (PlanVisualizationPanel.currentPanel) {
      PlanVisualizationPanel.currentPanel._panel.reveal(column);
      // Update the stored planId and toolsService
      PlanVisualizationPanel.currentPanel._currentPlanId = planId;
      PlanVisualizationPanel.currentPanel._toolsService = toolsService;
      PlanVisualizationPanel.currentPanel._updateContent(planId, toolsService);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      PlanVisualizationPanel.viewType,
      `Plan Visualization: ${planId}`,
      column || vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    PlanVisualizationPanel.currentPanel = new PlanVisualizationPanel(panel, extensionUri, planId, toolsService);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    // For now, just dispose the panel if we can't revive it properly
    panel.dispose();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, planId: string, toolsService: ToolsService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._currentPlanId = planId;
    this._toolsService = toolsService;

    // Set the webview's initial html content
    this._updateContent(planId, toolsService);

    // Listen for messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refresh':
            // Use stored planId and toolsService for refresh
            if (this._toolsService) {
              await this._updateContent(this._currentPlanId, this._toolsService);
            }
            break;
          case 'showMermaidArchitecture':
            await this._showMermaidArchitecture();
            break;
        }
      },
      null,
      this._disposables
    );

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  private async _updateContent(planId: string, toolsService: ToolsService) {
    try {
      const planningService = toolsService.getPlanningService();
      if (!planningService) {
        this._panel.webview.html = this._getErrorHtml('Planning service not available');
        return;
      }

      // Get plan data
      const planResult = planningService.showPlan(planId, true); // Include point descriptions
      if (!planResult.success) {
        this._panel.webview.html = this._getErrorHtml(`Failed to get plan: ${planResult.error}`);
        return;
      }

      // Get plan logs (limit to last 50)
      const logsResult = planningService.getPlanLogs(planId, 50);
      const logs = logsResult.success ? logsResult.logs! : [];

      // Update panel title
      this._panel.title = `Plan Visualization: ${planId}`;

      // Generate and set HTML content
      this._panel.webview.html = this._getPlanVisualizationHtml(planResult.plan!, logs);

    } catch (error) {
      console.error('Failed to update plan visualization content:', error);
      this._panel.webview.html = this._getErrorHtml(`Error: ${error}`);
    }
  }

  private _getErrorHtml(errorMessage: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan Visualization Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>Plan Visualization Error</h1>
    <div class="error">${errorMessage}</div>
</body>
</html>`;
  }

  private async _showMermaidArchitecture(): Promise<void> {
    try {
      if (!this._toolsService) {
        vscode.window.showErrorMessage('Planning service not available');
        return;
      }

      const planningService = this._toolsService.getPlanningService();
      if (!planningService) {
        vscode.window.showErrorMessage('Planning service not available');
        return;
      }

      const planResult = planningService.showPlan(this._currentPlanId, false);
      if (!planResult.success || !planResult.plan) {
        vscode.window.showErrorMessage('Failed to get plan data');
        return;
      }

      const plan = planResult.plan;
      if (!plan.architecture) {
        vscode.window.showErrorMessage('No architecture defined for this plan');
        return;
      }

      // Parse the JSON architecture
      let architectureData;
      try {
        architectureData = JSON.parse(plan.architecture);
      } catch (error) {
        vscode.window.showErrorMessage('Invalid JSON architecture format');
        return;
      }

      // Convert JSON architecture to Mermaid format
      const mermaidCode = this._jsonToMermaid(architectureData);
      
      // Create graphical Mermaid visualization panel
      MermaidVisualizationPanel.createOrShow(this._extensionUri, this._currentPlanId, mermaidCode, architectureData);
      
    } catch (error) {
      console.error('Error showing Mermaid architecture:', error);
      vscode.window.showErrorMessage(`Error showing Mermaid architecture: ${error}`);
    }
  }

  private _jsonToMermaid(architectureData: any): string {
    let mermaid = 'graph TD\n';
    
    try {
      if (architectureData.nodes && Array.isArray(architectureData.nodes)) {
        // Add nodes with proper styling
        architectureData.nodes.forEach((node: any, index: number) => {
          const nodeId = node.id || `node${index}`;
          const nodeLabel = node.label || node.name || nodeId;
          const nodeShape = this._getMermaidShape(node.type || 'default');
          mermaid += `    ${nodeId}${nodeShape.start}"${nodeLabel}"${nodeShape.end}\n`;
          
          // Add styling for different node types
          const nodeType = (node.type || 'default').toLowerCase();
          if (nodeType === 'database' || nodeType === 'db') {
            mermaid += `    ${nodeId}:::database\n`;
          } else if (nodeType === 'service' || nodeType === 'api') {
            mermaid += `    ${nodeId}:::service\n`;
          } else if (nodeType === 'component' || nodeType === 'module') {
            mermaid += `    ${nodeId}:::component\n`;
          } else if (nodeType === 'decision') {
            mermaid += `    ${nodeId}:::decision\n`;
          }
        });
        
        mermaid += '\n';
        
        // Add edges/connections
        if (architectureData.edges && Array.isArray(architectureData.edges)) {
          architectureData.edges.forEach((edge: any) => {
            const fromId = edge.from || edge.source;
            const toId = edge.to || edge.target;
            const label = edge.label ? ` -->|"${edge.label}"| ` : ' --> ';
            if (fromId && toId) {
              mermaid += `    ${fromId}${label}${toId}\n`;
            }
          });
        }
        
        // Add CSS styling classes
        mermaid += '\n    classDef database fill:#e1f5fe,stroke:#0277bd,stroke-width:2px,color:#000\n';
        mermaid += '    classDef service fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000\n';
        mermaid += '    classDef component fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px,color:#000\n';
        mermaid += '    classDef decision fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000\n';
        
      } else {
        // If no structured data, try to extract from object keys
        const keys = Object.keys(architectureData);
        if (keys.length > 0) {
          keys.forEach((key, index) => {
            const value = architectureData[key];
            let label = key;
            
            // If value is a string, use it as description
            if (typeof value === 'string') {
              label = `${key}\\n${value}`;
            }
            
            mermaid += `    ${key}["${label}"]\n`;
            if (index > 0) {
              mermaid += `    ${keys[index - 1]} --> ${key}\n`;
            }
          });
        } else {
          // Fallback for empty or invalid data
          mermaid += '    A["No Architecture Data"]\n';
          mermaid += '    A:::error\n';
          mermaid += '    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000\n';
        }
      }
    } catch (error) {
      mermaid += `    error["Error parsing architecture: ${error}"]\n`;
      mermaid += '    error:::error\n';
      mermaid += '    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000\n';
    }
    
    return mermaid;
  }

  private _getMermaidShape(nodeType: string): { start: string; end: string } {
    switch (nodeType.toLowerCase()) {
      case 'database':
      case 'db':
        return { start: '[(', end: ')]' };
      case 'service':
      case 'api':
        return { start: '(', end: ')' };
      case 'component':
      case 'module':
        return { start: '[', end: ']' };
      case 'decision':
        return { start: '{', end: '}' };
      case 'process':
        return { start: '[[', end: ']]' };
      default:
        return { start: '[', end: ']' };
    }
  }

  private _getPlanVisualizationHtml(plan: any, logs: any[] = []): string {
    const points = plan.points || [];
    
    let pointsHtml = '';
    if (points.length === 0) {
      pointsHtml = '<tr><td colspan="12" style="text-align: center; color: var(--vscode-descriptionForeground);">No points defined</td></tr>';
    } else {
      pointsHtml = points.map((point: any) => {
        const status = this._getPointStatus(point);
        const statusColor = this._getStatusColor(status);
        
        const dependsOn = point.dependsOn && point.dependsOn.length > 0 
          ? point.dependsOn.map((dep: string) => dep === '-1' ? 'Independent' : dep).join(', ') 
          : 'Not set';
          
        const careOn = point.careOnPoints && point.careOnPoints.length > 0
          ? point.careOnPoints.join(', ')
          : 'None';
          
        const comments = point.comments && point.comments.length > 0
          ? point.comments.join('; ')
          : '';
        
        return `
          <tr>
            <td>${point.id}</td>
            <td><strong>${this._escapeHtml(point.shortName)}</strong></td>
            <td>${this._escapeHtml(point.shortDescription)}</td>
            <td>${this._escapeHtml(point.detailedDescription || 'No detailed description')}</td>
            <td>${this._escapeHtml(point.reviewInstructions || 'No review instructions')}</td>
            <td>${this._escapeHtml(point.testingInstructions || 'No testing instructions')}</td>
            <td>${this._escapeHtml(point.expectedInputs || 'Not specified')}</td>
            <td>${this._escapeHtml(point.expectedOutputs || 'Not specified')}</td>
            <td>${this._escapeHtml(dependsOn)}</td>
            <td>${this._escapeHtml(careOn)}</td>
            <td><span class="status-badge" style="background-color: ${statusColor}">${status}</span></td>
            <td>${this._escapeHtml(comments)}</td>
          </tr>
        `;
      }).join('');
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plan Visualization</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
        }
        
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 10px;
        }
        
        h2 {
            color: var(--vscode-foreground);
            margin-top: 30px;
        }
        
        .plan-info {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border: 1px solid var(--vscode-widget-border);
        }
        
        .plan-info h3 {
            margin: 0 0 10px 0;
            color: var(--vscode-foreground);
        }
        
        .plan-info p {
            margin: 5px 0;
            color: var(--vscode-descriptionForeground);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background-color: var(--vscode-editor-background);
            font-size: 12px;
            overflow-x: auto;
        }
        
        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-widget-border);
            vertical-align: top;
            word-wrap: break-word;
            max-width: 200px;
        }
        
        th:first-child, td:first-child {
            min-width: 40px;
            max-width: 40px;
        }
        
        th:nth-child(2), td:nth-child(2) {
            min-width: 120px;
            max-width: 150px;
        }
        
        th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
            color: var(--vscode-foreground);
            border-bottom: 2px solid var(--vscode-widget-border);
        }
        
        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            color: white;
            text-align: center;
            display: inline-block;
            min-width: 80px;
        }
        
        .refresh-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        
        .refresh-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .activity-logs {
            margin-top: 20px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
        }
        
        .log-entry {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
            background-color: var(--vscode-editor-background);
        }
        
        .log-entry:last-child {
            border-bottom: none;
        }
        
        .log-entry:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .log-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
        }
        
        .log-icon {
            font-size: 16px;
            flex-shrink: 0;
        }
        
        .log-message {
            flex-grow: 1;
            color: var(--vscode-foreground);
            font-weight: 500;
        }
        
        .log-timestamp {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            flex-shrink: 0;
        }
        
        .log-details {
            margin-top: 6px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding-left: 24px;
        }
        
        .architecture-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 8px;
        }
        
        .architecture-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h1>Plan Visualization: ${this._escapeHtml(plan.id)}</h1>
    
    <button class="refresh-btn" onclick="refreshPlan()">🔄 Refresh</button>
    
    <div class="plan-info">
        <h3>${this._escapeHtml(plan.name)}</h3>
        <p><strong>Short Description:</strong> ${this._escapeHtml(plan.shortDescription)}</p>
        <p><strong>Long Description:</strong> ${this._escapeHtml(plan.longDescription)}</p>
        ${this._renderLanguageInfo(plan)}
        <p><strong>Status:</strong> ${this._getePlanStatus(plan)}</p>
        <p><strong>Total Points:</strong> ${points.length}</p>
        <p><strong>Reviewed:</strong> ${plan.reviewed ? '✅ Yes' : '❌ No'}${plan.reviewedComment ? ` - ${this._escapeHtml(plan.reviewedComment)}` : ''}</p>
        <p><strong>Accepted:</strong> ${plan.accepted ? '✅ Yes' : '❌ No'}${plan.acceptedComment ? ` - ${this._escapeHtml(plan.acceptedComment)}` : ''}</p>
        <p><strong>Needs Work:</strong> ${plan.needsWork ? '⚠️ Yes' : '✅ No'}${plan.needsWorkComments ? ` - ${plan.needsWorkComments.join('; ')}` : ''}</p>
        ${this._renderArchitectureSection(plan)}
    </div>
    
    <h2>Plan Points</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Short Description</th>
                <th>Long Description</th>
                <th>Review Instructions</th>
                <th>Testing Instructions</th>
                <th>Expected Inputs</th>
                <th>Expected Outputs</th>
                <th>Depends On</th>
                <th>Care On</th>
                <th>Status</th>
                <th>Comments</th>
            </tr>
        </thead>
        <tbody>
            ${pointsHtml}
        </tbody>
    </table>
    
    ${this._renderActivityLogs(logs)}
    
    <script>
        function refreshPlan() {
            // Send message to extension to refresh the plan data
            if (typeof acquireVsCodeApi !== 'undefined') {
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ command: 'refresh' });
            } else {
                // Fallback for development/testing
                console.log('Refresh requested');
                window.location.reload();
            }
        }
        
        function showMermaidArchitecture() {
            // Send message to extension to show Mermaid architecture diagram
            if (typeof acquireVsCodeApi !== 'undefined') {
                const vscode = acquireVsCodeApi();
                vscode.postMessage({ command: 'showMermaidArchitecture' });
            } else {
                console.log('Show Mermaid Architecture requested');
            }
        }
    </script>
</body>
</html>`;
  }

  private _getPointStatus(point: any): string {
    // Access status data from the correct structure
    const implemented = point.implemented;
    const reviewed = point.reviewed;
    const tested = point.tested;
    const needRework = point.needRework;
    
    // Debug logging
    console.log(`[PlanVisualization] Point ${point.id}: implemented=${implemented}, reviewed=${reviewed}, tested=${tested}, needRework=${needRework}`);
    
    if (implemented && reviewed && tested) {
      return 'Complete';
    } else if (needRework) {
      return 'Needs Rework';
    } else if (implemented && reviewed) {
      return 'Ready for Testing';
    } else if (implemented) {
      return 'Ready for Review';
    } else {
      return 'Pending';
    }
  }

  private _getStatusColor(status: string): string {
    switch (status) {
      case 'Complete': return '#4CAF50';
      case 'Ready for Testing': return '#2196F3';
      case 'Ready for Review': return '#FF9800';
      case 'Needs Rework': return '#F44336';
      case 'Pending': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  }

  private _getePlanStatus(plan: any): string {
    if (plan.accepted) {
      return '✅ Accepted';
    } else if (plan.reviewed) {
      return '👀 Reviewed';
    } else if (plan.needsWork) {
      return '⚠️ Needs Work';
    } else {
      return '📝 In Progress';
    }
  }

  private _escapeHtml(text: string): string {
    if (!text) {return '';}
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private _renderLanguageInfo(plan: any): string {
    // Use dedicated fields if available, otherwise fall back to parsing longDescription
    if (plan.detectedLanguage || plan.originalRequest || plan.translatedRequest) {
      let html = `<div style="background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 10px; margin: 10px 0;">`;
      
      if (plan.originalRequest) {
        html += `<p><strong>🎯 Original Request:</strong> ${this._escapeHtml(plan.originalRequest)}</p>`;
      }

      if (plan.translatedRequest && plan.translatedRequest !== plan.originalRequest) {
        html += `<p><strong>🌐 Translated:</strong> ${this._escapeHtml(plan.translatedRequest)}</p>`;
      }

      if (plan.detectedLanguage) {
        html += `<p><strong>🗣️ Language:</strong> ${this._escapeHtml(plan.detectedLanguage)}</p>`;
      }

      html += `</div>`;
      return html;
    }

    // Fallback: parse from longDescription for backward compatibility
    return this._renderOriginalRequestFallback(plan.longDescription);
  }

  private _renderOriginalRequestFallback(longDescription: string): string {
    if (!longDescription) {
      return '';
    }

    // Extract original request from long description
    const originalMatch = longDescription.match(/Original request: "(.*?)"/);
    const translatedMatch = longDescription.match(/Translated request: "(.*?)"/);
    const languageMatch = longDescription.match(/Language: (.+?)(?:\n|$)/);

    if (!originalMatch) {
      return ''; // No original request found
    }

    const originalRequest = originalMatch[1];
    const translatedRequest = translatedMatch ? translatedMatch[1] : '';
    const language = languageMatch ? languageMatch[1] : '';

    let html = `<div style="background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 10px; margin: 10px 0;">
      <p><strong>🎯 Original Request:</strong> ${this._escapeHtml(originalRequest)}</p>`;

    if (translatedRequest && translatedRequest !== originalRequest) {
      html += `<p><strong>🌐 Translated:</strong> ${this._escapeHtml(translatedRequest)}</p>`;
    }

    if (language) {
      html += `<p><strong>🗣️ Language:</strong> ${this._escapeHtml(language)}</p>`;
    }

    html += `</div>`;

    return html;
  }

  private _renderArchitectureSection(plan: any): string {
    if (!plan.architecture) {
      return '';
    }

    return `
      <div style="background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 10px; margin: 10px 0;">
        <p><strong>🏗️ Architecture:</strong> <button class="architecture-btn" onclick="showMermaidArchitecture()">🎨 View Interactive Diagram</button></p>
        <details>
          <summary style="cursor: pointer; font-weight: bold;">📋 View JSON Architecture</summary>
          <pre style="background-color: var(--vscode-editor-background); padding: 10px; overflow-x: auto; margin-top: 5px;"><code>${this._escapeHtml(JSON.stringify(JSON.parse(plan.architecture), null, 2))}</code></pre>
        </details>
      </div>`;
  }

  private _renderActivityLogs(logs: any[]): string {
    if (!logs || logs.length === 0) {
      return `
        <h2>📋 Activity Log</h2>
        <div class="plan-info">
          <p><em>No activity logged yet.</em></p>
        </div>
      `;
    }

    const logsHtml = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const icon = this._getLogIcon(log.type, log.action);
      const actionText = this._formatLogAction(log.action);
      
      return `
        <div class="log-entry">
          <div class="log-header">
            <span class="log-icon">${icon}</span>
            <span class="log-message">${this._escapeHtml(log.message)}</span>
            <span class="log-timestamp">${timestamp}</span>
          </div>
          ${log.details ? `<div class="log-details">${this._escapeHtml(log.details)}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <h2>📋 Activity Log</h2>
      <div class="activity-logs">
        ${logsHtml}
      </div>
    `;
  }

  private _getLogIcon(type: string, action: string): string {
    if (type === 'plan') {
      switch (action) {
        case 'created': return '🆕';
        case 'reviewed': return '👀';
        case 'accepted': return '✅';
        case 'needs_work': return '⚠️';
        default: return '📝';
      }
    } else { // point
      switch (action) {
        case 'implemented': return '🔨';
        case 'reviewed': return '👁️';
        case 'tested': return '🧪';
        case 'needs_rework': return '🔄';
        default: return '📋';
      }
    }
  }

  private _formatLogAction(action: string): string {
    switch (action) {
      case 'implemented': return 'Implemented';
      case 'reviewed': return 'Reviewed';
      case 'tested': return 'Tested';
      case 'needs_work': return 'Needs Work';
      case 'needs_rework': return 'Needs Rework';
      case 'accepted': return 'Accepted';
      case 'created': return 'Created';
      default: return action.charAt(0).toUpperCase() + action.slice(1);
    }
  }

  public dispose() {
    PlanVisualizationPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
