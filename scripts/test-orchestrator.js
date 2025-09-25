#!/usr/bin/env node
// scripts/test-orchestrator.js

const path = require('path');
const fs = require('fs');

// Mock vscode module before any imports
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === 'vscode') {
    return {
      workspace: {
        getConfiguration: (section) => ({
          get: (key, defaultValue) => {
            const mockConfig = {
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
          has: (key) => true,
          inspect: (key) => ({ defaultValue: undefined }),
          update: (key, value) => Promise.resolve()
        }),
        onDidChangeConfiguration: (callback) => ({ dispose: () => {} }),
        workspaceFolders: [{ uri: { fsPath: '/tmp/orchestrator-test' } }]
      },
      Uri: {
        file: (path) => ({ fsPath: path }),
        parse: (uri) => ({ fsPath: uri })
      },
      window: {
        showErrorMessage: (message) => Promise.resolve(),
        showInformationMessage: (message) => Promise.resolve(),
        showWarningMessage: (message) => Promise.resolve()
      },
      extensions: {
        getExtension: (id) => ({
          extensionPath: path.join(__dirname, '..')
        })
      },
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Add src to module resolution
require('ts-node').register({
  project: path.join(__dirname, '..', 'tsconfig.json')
});

const { runOrchestratorTest } = require('../src/orchestratorTestRunner');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node scripts/test-orchestrator.js <config-file> [output-file]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/test-orchestrator.js test-configs/basic-workflow.json');
    process.exit(1);
  }

  const configPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : undefined;

  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    await runOrchestratorTest(configPath, outputPath);
  } catch (error) {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
