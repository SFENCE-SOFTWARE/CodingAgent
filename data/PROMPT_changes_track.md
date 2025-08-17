# **IMPLEMENTATION PROMPT: Advanced File Change Tracking & Management System**

## **Mission**
Implement a sophisticated file change tracking and management system for the CodingAgent VS Code extension, based on the architecture from `vscode-copilot-chat`. The system must provide comprehensive change tracking, diff visualization, and granular change management capabilities.

Remember to prefer typescript, and use src/test folder for test implementation.

## **Core Architecture Requirements**

### **1. Change Tracking Service (`src/changeTrackingService.ts`)**

Implement a centralized service that:

```typescript
interface FileChange {
  id: string;
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  beforeContent: string;
  afterContent: string;
  timestamp: number;
  toolName: string;
  status: 'pending' | 'accepted' | 'rejected';
  lineChanges: LineChange[];
}

interface LineChange {
  type: 'add' | 'delete' | 'modify';
  lineNumber: number;
  oldContent?: string;
  newContent?: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

class ChangeTrackingService {
  private changes: Map<string, FileChange[]> = new Map();
  private backupManager: BackupManager;
  
  // Core tracking methods
  async trackFileOperation(filePath: string, operation: FileOperation): Promise<string>;
  async getChangesForFile(filePath: string): Promise<FileChange[]>;
  async getAllPendingChanges(): Promise<FileChange[]>;
  
  // Change management
  async acceptChange(changeId: string): Promise<void>;
  async rejectChange(changeId: string): Promise<void>;
  async acceptAllChanges(): Promise<void>;
  async rejectAllChanges(): Promise<void>;
  
  // Diff and analysis
  async calculateLineDiff(before: string, after: string): Promise<LineChange[]>;
  async generateHtmlDiff(change: FileChange): Promise<string>;
  
  // Persistence and cleanup
  async persistChanges(): Promise<void>;
  async loadPersistedChanges(): Promise<void>;
  async clearOldChanges(maxAge: number): Promise<void>;
}
```

### **2. Tool Integration & Interception**

**Enhance existing tools to capture changes automatically:**

```typescript
// Abstract base class for change-aware tools
abstract class ChangeAwareBaseTool implements BaseTool {
  constructor(protected changeTracker: ChangeTrackingService) {}
  
  protected async captureFileChange(
    filePath: string, 
    operation: () => Promise<void>
  ): Promise<string> {
    const beforeContent = await this.readFileIfExists(filePath);
    await operation();
    const afterContent = await this.readFileIfExists(filePath);
    
    return this.changeTracker.trackFileOperation(filePath, {
      type: this.determineChangeType(beforeContent, afterContent),
      beforeContent,
      afterContent,
      toolName: this.getToolInfo().name
    });
  }
}

// Update existing tools to extend ChangeAwareBaseTool
class WriteFileTool extends ChangeAwareBaseTool {
  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const changeId = await this.captureFileChange(args.path, async () => {
      // Original write file logic
    });
    
    return {
      success: true,
      content: `File written. Change ID: ${changeId}`,
      changeId
    };
  }
}
```

### **3. UI Components - Modified Files Bar**

**Implement a horizontal scrollable bar above chat input:**

```html
<!-- In ChatViewProvider HTML template -->
<div id="modified-files-container" class="modified-files-container hidden">
  <div class="modified-files-header">
    <span class="modified-files-title">Modified Files</span>
    <div class="bulk-actions">
      <button id="accept-all-btn" class="action-btn accept">Accept All</button>
      <button id="reject-all-btn" class="action-btn reject">Reject All</button>
      <button id="clear-changes-btn" class="action-btn clear">Clear</button>
      <button id="toggle-changes-btn" class="action-btn toggle">▼</button>
    </div>
  </div>
  
  <div class="modified-files-list" id="modified-files-list">
    <!-- Dynamic file change items -->
  </div>
</div>

<div id="change-viewer-modal" class="change-viewer-modal hidden">
  <div class="change-viewer-content">
    <div class="change-viewer-header">
      <h3 id="change-viewer-title">File Changes</h3>
      <button id="close-change-viewer" class="close-btn">×</button>
    </div>
    <div class="change-viewer-body">
      <div class="change-navigation">
        <button id="prev-change">← Previous</button>
        <span id="change-counter">1 of 3</span>
        <button id="next-change">Next →</button>
      </div>
      <div id="diff-container" class="diff-container">
        <!-- Diff content rendered here -->
      </div>
      <div class="change-actions">
        <button id="accept-change" class="action-btn accept">Accept Change</button>
        <button id="reject-change" class="action-btn reject">Reject Change</button>
      </div>
    </div>
  </div>
</div>
```

### **4. CSS Styling System**

```css
/* Modified files bar styling */
.modified-files-container {
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editor-background);
  margin-bottom: 8px;
  max-height: 200px;
  transition: all 0.3s ease;
}

.modified-files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--vscode-editorGroupHeader-tabsBackground);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.modified-files-list {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  max-height: 150px;
}

.file-change-item {
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 8px;
  background: var(--vscode-editor-selectionBackground);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-change-item:hover {
  background: var(--vscode-list-hoverBackground);
}

.file-change-item.pending {
  border-left: 3px solid var(--vscode-editorInfo-foreground);
}

.file-change-item.accepted {
  border-left: 3px solid var(--vscode-testing-iconPassed);
}

.file-change-item.rejected {
  border-left: 3px solid var(--vscode-testing-iconFailed);
}

/* Diff viewer modal */
.change-viewer-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.change-viewer-content {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  width: 90%;
  height: 80%;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
}

.diff-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

/* Line-level diff styling */
.diff-line {
  display: flex;
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  line-height: 1.4;
  padding: 2px 8px;
  white-space: pre-wrap;
}

.diff-line.added {
  background-color: var(--vscode-diffEditor-insertedTextBackground);
  border-left: 3px solid var(--vscode-diffEditor-insertedLineBackground);
}

.diff-line.removed {
  background-color: var(--vscode-diffEditor-removedTextBackground);
  border-left: 3px solid var(--vscode-diffEditor-removedLineBackground);
}

.diff-line.modified {
  background-color: var(--vscode-diffEditor-modifiedTextBackground);
  border-left: 3px solid var(--vscode-diffEditor-modifiedLineBackground);
}

.diff-line-number {
  width: 60px;
  text-align: right;
  padding-right: 8px;
  color: var(--vscode-editorLineNumber-foreground);
  border-right: 1px solid var(--vscode-panel-border);
  user-select: none;
}
```

### **5. Frontend JavaScript Implementation**

```javascript
// Change tracking state management
class ChangeTracker {
  constructor() {
    this.changes = new Map();
    this.currentViewingChange = null;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Modified files bar interactions
    document.getElementById('accept-all-btn').addEventListener('click', () => {
      this.acceptAllChanges();
    });
    
    document.getElementById('reject-all-btn').addEventListener('click', () => {
      this.rejectAllChanges();
    });
    
    document.getElementById('toggle-changes-btn').addEventListener('click', () => {
      this.toggleChangesVisibility();
    });
    
    // Modal interactions
    document.getElementById('close-change-viewer').addEventListener('click', () => {
      this.closeChangeViewer();
    });
    
    document.getElementById('accept-change').addEventListener('click', () => {
      this.acceptCurrentChange();
    });
    
    document.getElementById('reject-change').addEventListener('click', () => {
      this.rejectCurrentChange();
    });
  }
  
  updateModifiedFilesBar(changes) {
    const container = document.getElementById('modified-files-container');
    const list = document.getElementById('modified-files-list');
    
    if (changes.length === 0) {
      container.classList.add('hidden');
      return;
    }
    
    container.classList.remove('hidden');
    list.innerHTML = '';
    
    changes.forEach(change => {
      const item = this.createFileChangeItem(change);
      list.appendChild(item);
    });
  }
  
  createFileChangeItem(change) {
    const item = document.createElement('div');
    item.className = `file-change-item ${change.status}`;
    item.innerHTML = `
      <div class="file-path">${this.getRelativePath(change.filePath)}</div>
      <div class="change-summary">
        <span class="change-type">${change.changeType}</span>
        <span class="change-count">${change.lineChanges.length} lines</span>
      </div>
      <div class="change-timestamp">${this.formatTimestamp(change.timestamp)}</div>
    `;
    
    item.addEventListener('click', () => {
      this.openChangeViewer(change);
    });
    
    return item;
  }
  
  openChangeViewer(change) {
    this.currentViewingChange = change;
    document.getElementById('change-viewer-modal').classList.remove('hidden');
    this.renderDiff(change);
  }
  
  renderDiff(change) {
    const container = document.getElementById('diff-container');
    container.innerHTML = this.generateDiffHtml(change);
  }
  
  generateDiffHtml(change) {
    const beforeLines = change.beforeContent.split('\n');
    const afterLines = change.afterContent.split('\n');
    
    let html = '<div class="diff-viewer">';
    
    // Implement unified diff view
    const diffLines = this.calculateUnifiedDiff(beforeLines, afterLines);
    
    diffLines.forEach((line, index) => {
      html += `
        <div class="diff-line ${line.type}">
          <span class="diff-line-number">${line.lineNumber || ''}</span>
          <span class="diff-content">${this.escapeHtml(line.content)}</span>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }
  
  calculateUnifiedDiff(beforeLines, afterLines) {
    // Implement diff algorithm (can use existing libraries or custom implementation)
    // Return array of { type: 'added'|'removed'|'unchanged', content: string, lineNumber: number }
  }
  
  acceptAllChanges() {
    vscode.postMessage({
      type: 'acceptAllChanges'
    });
  }
  
  rejectAllChanges() {
    vscode.postMessage({
      type: 'rejectAllChanges'
    });
  }
  
  acceptCurrentChange() {
    if (this.currentViewingChange) {
      vscode.postMessage({
        type: 'acceptChange',
        changeId: this.currentViewingChange.id
      });
      this.closeChangeViewer();
    }
  }
  
  rejectCurrentChange() {
    if (this.currentViewingChange) {
      vscode.postMessage({
        type: 'rejectChange',
        changeId: this.currentViewingChange.id
      });
      this.closeChangeViewer();
    }
  }
}

// Initialize change tracker
const changeTracker = new ChangeTracker();
```

### **6. Backend Message Handling**

```typescript
// In ChatViewProvider.ts - extend message handling
private async handleMessage(message: any): Promise<void> {
  switch (message.type) {
    case 'acceptAllChanges':
      await this.changeTrackingService.acceptAllChanges();
      await this.sendChangesUpdate();
      break;
      
    case 'rejectAllChanges':
      await this.changeTrackingService.rejectAllChanges();
      await this.sendChangesUpdate();
      break;
      
    case 'acceptChange':
      await this.changeTrackingService.acceptChange(message.changeId);
      await this.sendChangesUpdate();
      break;
      
    case 'rejectChange':
      await this.changeTrackingService.rejectChange(message.changeId);
      await this.sendChangesUpdate();
      break;
      
    case 'getChanges':
      await this.sendChangesUpdate();
      break;
  }
}

private async sendChangesUpdate(): Promise<void> {
  const pendingChanges = await this.changeTrackingService.getAllPendingChanges();
  this.sendMessage({
    type: 'changesUpdate',
    changes: pendingChanges
  });
}
```

### **7. Backup and Recovery System**

```typescript
class BackupManager {
  private backupDir: string;
  
  constructor(workspaceRoot: string) {
    this.backupDir = path.join(workspaceRoot, '.codingagent', 'backups');
  }
  
  async createBackup(filePath: string, content: string): Promise<string> {
    const backupId = this.generateBackupId();
    const backupPath = path.join(this.backupDir, backupId);
    
    await fs.ensureDir(path.dirname(backupPath));
    await fs.writeFile(backupPath, content);
    
    return backupId;
  }
  
  async restoreFromBackup(backupId: string, targetPath: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    const content = await fs.readFile(backupPath, 'utf8');
    await fs.writeFile(targetPath, content);
  }
  
  async cleanupOldBackups(maxAge: number): Promise<void> {
    // Cleanup logic for old backup files
  }
}
```

### **8. Configuration Integration**

```json
// Add to package.json configuration
"codingagent.changeTracking.enabled": {
  "type": "boolean",
  "default": true,
  "description": "Enable file change tracking and management"
},
"codingagent.changeTracking.autoBackup": {
  "type": "boolean", 
  "default": true,
  "description": "Automatically create backups before file modifications"
},
"codingagent.changeTracking.maxChanges": {
  "type": "number",
  "default": 100,
  "description": "Maximum number of changes to track per session"
},
"codingagent.changeTracking.showInActivityBar": {
  "type": "boolean",
  "default": true,
  "description": "Show change tracking status in activity bar"
}
```

### **9. Commands and Keyboard Shortcuts**

```typescript
// Register commands in extension.ts
vscode.commands.registerCommand('codingagent.showChanges', () => {
  chatViewProvider.showChanges();
});

vscode.commands.registerCommand('codingagent.acceptAllChanges', () => {
  chatViewProvider.acceptAllChanges();
});

vscode.commands.registerCommand('codingagent.rejectAllChanges', () => {
  chatViewProvider.rejectAllChanges();
});
```

### **10. Testing Strategy**

```typescript
// Test file: changeTrackingService.test.ts
describe('ChangeTrackingService', () => {
  it('should track file modifications correctly', async () => {
    // Test change tracking functionality
  });
  
  it('should generate accurate line diffs', async () => {
    // Test diff calculation
  });
  
  it('should handle accept/reject operations', async () => {
    // Test change management
  });
  
  it('should persist and restore changes across sessions', async () => {
    // Test persistence
  });
});
```

## **Implementation Phases**

### **Phase 1: Core Infrastructure**
- Implement `ChangeTrackingService` with basic tracking
- Add change interception to existing tools
- Create basic data structures and persistence

### **Phase 2: UI Foundation**
- Implement modified files bar component
- Add basic change viewer modal
- Implement message passing between frontend/backend

### **Phase 3: Diff System**
- Implement line-level diff calculation
- Add syntax highlighting support
- Create visual diff rendering

### **Phase 4: Change Management**
- Implement accept/reject functionality
- Add bulk operations
- Implement backup and recovery system

### **Phase 5: Advanced Features**
- Add change navigation within files
- Implement search and filtering
- Add keyboard shortcuts and commands

### **Phase 6: Polish and Optimization**
- Performance optimization for large files
- Improve accessibility
- Add comprehensive error handling

## **Success Criteria**

1. **Comprehensive Tracking**: All file operations are automatically tracked
2. **Intuitive UI**: Users can easily review and manage changes
3. **Granular Control**: Individual line-level accept/reject capabilities
4. **Performance**: Handles large files and many changes efficiently
5. **Reliability**: Robust backup and recovery system
6. **Integration**: Seamless integration with existing tool system

**This implementation will provide users with complete visibility and control over all AI-generated file changes, making the CodingAgent extension significantly more professional and user-friendly.**
