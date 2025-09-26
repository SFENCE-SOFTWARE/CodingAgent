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
          'codingagent.plan.creation.promptDescriptionUpdate': 'Use the plan_change tool to update both descriptions. Do not provide only text responses.\n\n**User\'s Original Request:** <plan_translated_request>\n\n**Required Steps:**\n1. Create a clear, concise short description that summarizes what the plan will accomplish\n2. Create a comprehensive long description that includes all user requirements and technical details\n3. **IMMEDIATELY call plan_change tool** with both new descriptions\n4. After tool execution, provide a two-sentence summary of what you did\n\n**Important:** Your response will be considered FAILED if you do not call the plan_change tool. Only text responses without tool calls will be rejected.\n\n**Expected Output:** plan_change tool execution followed by a brief summary.',
          'codingagent.plan.creation.recommendedModeDescriptionUpdate': 'Architect',
          'codingagent.plan.creation.promptArchitectureCreation': 'Create the comprehensive plan architecture for this project. Use the plan_set_architecture tool to specify the technical architecture.\n\n**User\'s Original Request:** <plan_translated_request>\n\n**Current Plan Context:**\n- **Short Description:** <plan_short_description>\n- **Long Description:** <plan_long_description>\n\n**Required Steps:**\n1. Analyze the requirements and determine the technical architecture\n2. **IMMEDIATELY call plan_set_architecture tool** with the architecture details\n3. After tool execution, provide a brief summary of the architecture\n\n**Important:** Your response will be considered FAILED if you do not call the plan_set_architecture tool. Only text responses without tool calls will be rejected.',
          'codingagent.plan.creation.recommendedModeArchitectureCreation': 'Architect',
          'codingagent.plan.creation.promptArchitectureReview': '<checklist>\n\nIf you find any problem or problems, use plan_need_works tool to specify found problems. If everything looks fine and no additional work is needed, use tool plan_reviewed to set it.',
          'codingagent.plan.creation.recommendedModeArchitectureReview': 'Reviewer',
          'codingagent.plan.creation.promptPlanPointsCreation': 'Create plan points for this project. Use the plan_create_points tool to add all necessary plan points.\n\n**User\'s Original Request:** <plan_translated_request>\n\n**Current Plan Context:**\n- **Short Description:** <plan_short_description>\n- **Long Description:** <plan_long_description>\n- **Architecture:** <plan_architecture>\n\n**Required Steps:**\n1. Break down the project into manageable plan points\n2. **IMMEDIATELY call plan_create_points tool** with all plan points\n3. After tool execution, provide a brief summary of the plan points\n\n**Important:** Your response will be considered FAILED if you do not call the plan_create_points tool.',
          'codingagent.plan.creation.recommendedModePlanPointsCreation': 'Architect',
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
