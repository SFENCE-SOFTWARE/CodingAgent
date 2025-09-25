// src/vscode-mock.ts

/**
 * Mock implementation of VS Code API for testing
 */

export const vscode = {
  workspace: {
    getConfiguration: (section?: string) => ({
      get: (key: string, defaultValue?: any) => {
        // Return mock configuration values
        const mockConfig: Record<string, any> = {
          'codingagent.plan.creation.checklistDescriptionReview': '1. Review plan title and description\n2. Check if all requirements are covered',
          'codingagent.plan.creation.callbackDescriptionReview': 'plan.reviewed',
          'codingagent.plan.creation.promptDescriptionReview': '<checklist>\n\nIf you find any problem or problems, use plan_need_works tool to specify found problems. If everything looks fine and no aditional work is needed, use tool plan_reviewed to set it.',
          'codingagent.plan.creation.recommendedModeDescriptionReview': 'Reviewer',
          'codingagent.algorithm.enabled': true,
          'codingagent.algorithm.scriptPath': ''
        };
        
        const fullKey = section ? `${section}.${key}` : key;
        return mockConfig[fullKey] !== undefined ? mockConfig[fullKey] : defaultValue;
      },
      has: (key: string) => true,
      inspect: (key: string) => ({ defaultValue: undefined }),
      update: (key: string, value: any) => Promise.resolve()
    }),
    onDidChangeConfiguration: (callback: any) => ({ dispose: () => {} }),
    workspaceFolders: [{ uri: { fsPath: '/tmp/orchestrator-test' } }]
  },
  
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    parse: (uri: string) => ({ fsPath: uri })
  },
  
  window: {
    showErrorMessage: (message: string) => Promise.resolve(),
    showInformationMessage: (message: string) => Promise.resolve(),
    showWarningMessage: (message: string) => Promise.resolve()
  },
  
  extensions: {
    getExtension: (id: string) => ({
      extensionPath: '/tmp/mock-extension-path'
    })
  },
  
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
};

// Mock the vscode module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = vscode;
}
