// src/planVisualizationPanel.ts

import * as vscode from 'vscode';
import { ToolsService } from './tools';

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

      // Update panel title
      this._panel.title = `Plan Visualization: ${planId}`;

      // Generate and set HTML content
      this._panel.webview.html = this._getPlanVisualizationHtml(planResult.plan!);

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

  private _getPlanVisualizationHtml(plan: any): string {
    const points = plan.points || [];
    
    let pointsHtml = '';
    if (points.length === 0) {
      pointsHtml = '<tr><td colspan="11" style="text-align: center; color: var(--vscode-descriptionForeground);">No points defined</td></tr>';
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
            <td>${this._escapeHtml(point.acceptanceCriteria || 'No criteria')}</td>
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
    </style>
</head>
<body>
    <h1>Plan Visualization: ${this._escapeHtml(plan.id)}</h1>
    
    <button class="refresh-btn" onclick="refreshPlan()">🔄 Refresh</button>
    
    <div class="plan-info">
        <h3>${this._escapeHtml(plan.name)}</h3>
        <p><strong>Short Description:</strong> ${this._escapeHtml(plan.shortDescription)}</p>
        <p><strong>Long Description:</strong> ${this._escapeHtml(plan.longDescription)}</p>
        ${this._renderOriginalRequest(plan.longDescription)}
        <p><strong>Status:</strong> ${this._getePlanStatus(plan)}</p>
        <p><strong>Total Points:</strong> ${points.length}</p>
        <p><strong>Reviewed:</strong> ${plan.reviewed ? '✅ Yes' : '❌ No'}${plan.reviewedComment ? ` - ${this._escapeHtml(plan.reviewedComment)}` : ''}</p>
        <p><strong>Accepted:</strong> ${plan.accepted ? '✅ Yes' : '❌ No'}${plan.acceptedComment ? ` - ${this._escapeHtml(plan.acceptedComment)}` : ''}</p>
        <p><strong>Needs Work:</strong> ${plan.needsWork ? '⚠️ Yes' : '✅ No'}${plan.needsWorkComments ? ` - ${plan.needsWorkComments.join('; ')}` : ''}</p>
    </div>
    
    <h2>Plan Points</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Short Description</th>
                <th>Long Description</th>
                <th>Acceptance Criteria</th>
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

  private _renderOriginalRequest(longDescription: string): string {
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
