// src/orchestratorTestRunner.ts

import * as fs from 'fs';
import * as path from 'path';
import { PlanningService } from './planningService';
import { PlanContextManager } from './planContextManager';
import { MockLLMService, MockLLMConfig } from './mockLLMService';
import { AlgorithmEngine } from './algorithmEngine';

export interface OrchestratorTestConfig {
  planName: string;
  planDescription: string;
  mockLLM: MockLLMConfig;
  maxIterations: number;
  workspaceRoot: string;
}

export interface OrchestratorTestResult {
  success: boolean;
  iterations: number;
  workflow: Array<{
    iteration: number;
    step: string;
    action: string;
    result: string;
    notices: string[];
  }>;
  error?: string;
  planFinalState?: any;
}

/**
 * Test runner for orchestrator algorithm with mock LLM
 */
export class OrchestratorTestRunner {
  private planningService: PlanningService;
  private planContextManager: PlanContextManager;
  private mockLLM: MockLLMService;
  private algorithmEngine: AlgorithmEngine;
  private config: OrchestratorTestConfig;
  private notices: string[] = [];

  constructor(config: OrchestratorTestConfig) {
    this.config = config;
    this.planningService = PlanningService.getInstance(config.workspaceRoot);
    this.planContextManager = PlanContextManager.getInstance();
    this.mockLLM = new MockLLMService(config.mockLLM);
    this.algorithmEngine = AlgorithmEngine.getInstance();
  }

  /**
   * Run orchestrator test with mock LLM
   */
  async runTest(): Promise<OrchestratorTestResult> {
    const workflow: Array<{
      iteration: number;
      step: string;
      action: string;
      result: string;
      notices: string[];
    }> = [];

    try {
      // Cleanup any existing test plan
      try {
        this.planningService.deletePlan(this.config.planName, true);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      // Create test plan
      const planResult = this.planningService.createPlan(
        this.config.planName,
        this.config.planDescription,
        '', // original request (empty for test)
        this.config.workspaceRoot
      );

      if (!planResult.success) {
        throw new Error(`Failed to create plan: ${planResult.error}`);
      }

      // Set active plan
      this.planContextManager.setCurrentPlanId(this.config.planName);

      console.log(`[OrchestratorTest] Created plan: ${this.config.planName}`);
      console.log(`[OrchestratorTest] Starting orchestrator workflow...`);

      // Create mock context for orchestrator
      const context = this.createMockContext();

      // Run orchestrator algorithm
      const orchestratorScript = this.algorithmEngine.getAlgorithmScriptPath('orchestrator');
      
      if (!orchestratorScript || !fs.existsSync(orchestratorScript)) {
        throw new Error(`Orchestrator script not found: ${orchestratorScript}`);
      }

      // Load and execute orchestrator
      const orchestratorCode = fs.readFileSync(orchestratorScript, 'utf8');
      const orchestratorFunction = new Function('context', orchestratorCode + '\n return handleUserMessage;');
      const handleUserMessage = orchestratorFunction(context);

      // Run the workflow
      let iteration = 0;
      const maxIterations = this.config.maxIterations;

      while (iteration < maxIterations) {
        iteration++;
        this.notices = [];

        console.log(`[OrchestratorTest] === Iteration ${iteration} ===`);

        try {
          const result = await handleUserMessage(`OPEN test-callback-review`, context);
          
          const stepInfo = this.extractStepInfo(result);
          const currentNotices = [...this.notices];

          workflow.push({
            iteration,
            step: stepInfo.step,
            action: stepInfo.action,
            result: stepInfo.result,
            notices: currentNotices
          });

          console.log(`[OrchestratorTest] Iteration ${iteration}: ${stepInfo.step} -> ${stepInfo.action}`);

          // Check if workflow is complete
          if (result.includes('completed') || result.includes('finished')) {
            console.log(`[OrchestratorTest] Workflow completed after ${iteration} iterations`);
            break;
          }

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          workflow.push({
            iteration,
            step: 'ERROR',
            action: 'ERROR',
            result: errorMsg,
            notices: [...this.notices]
          });

          if (errorMsg.includes('interrupted') || errorMsg.includes('user requested stop')) {
            console.log(`[OrchestratorTest] Workflow interrupted after ${iteration} iterations`);
            break;
          } else {
            console.error(`[OrchestratorTest] Error in iteration ${iteration}:`, errorMsg);
            // Continue to next iteration for testing purposes
          }
        }

        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Get final plan state
      const finalPlan = this.planningService.getPlanState(this.config.planName);

      return {
        success: true,
        iterations: iteration,
        workflow,
        planFinalState: finalPlan.success ? finalPlan.state : undefined
      };

    } catch (error) {
      return {
        success: false,
        iterations: 0,
        workflow,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createMockContext() {
    const context = {
      // Mock context properties
      console: {
        log: (msg: string) => console.log(`[Context-LOG] ${msg}`),
        info: (msg: string) => console.log(`[Context-INFO] ${msg}`),
        error: (msg: string) => console.error(`[Context-ERROR] ${msg}`),
        warn: (msg: string) => console.warn(`[Context-WARN] ${msg}`)
      },

      sendNotice: (notice: string) => {
        this.notices.push(notice);
        console.log(`[Context-NOTICE] ${notice}`);
      },

      sendResponse: (response: string) => {
        console.log(`[Context-RESPONSE] ${response}`);
      },

      sendStreamingUpdate: (update: any) => {
        console.log(`[Context-STREAMING] ${JSON.stringify(update)}`);
      },

      sendToLLM: async (prompt: string, mode?: string) => {
        console.log(`[Context-LLM] Mode: ${mode || 'default'}, Prompt: ${prompt.substring(0, 100)}...`);
        return await this.mockLLM.sendToLLM(prompt, mode);
      },

      delegateResponse: async (prompt: string, streamCallback?: any) => {
        console.log(`[Context-DELEGATE] Prompt: ${prompt.substring(0, 100)}...`);
        return await this.mockLLM.sendToLLM(prompt);
      },

      getAvailableModes: () => {
        return this.mockLLM.getAvailableModes();
      },

      getVariable: (name: string) => {
        // Mock variables for orchestrator
        const mockVars: Record<string, any> = {
          'lastMessageLanguage': 'en',
          'isFirstMessage': false,
          'userPreferredLanguage': 'en'
        };
        return mockVars[name];
      },

      planningService: this.planningService,
      planContextManager: this.planContextManager,

      isInterrupted: false,
      workspaceRoot: this.config.workspaceRoot
    };

    return context;
  }

  private extractStepInfo(result: string): { step: string; action: string; result: string } {
    // Extract meaningful information from orchestrator result
    if (result.includes('Plan execution completed')) {
      return { step: 'COMPLETE', action: 'FINISHED', result };
    } else if (result.includes('Plan loading failed')) {
      return { step: 'LOAD_ERROR', action: 'ERROR', result };
    } else if (result.includes('General question')) {
      return { step: 'QUESTION', action: 'LLM_RESPONSE', result };
    } else if (result.includes('Plan') && result.includes('loaded')) {
      return { step: 'PLAN_LOADED', action: 'CONTINUE', result };
    } else {
      return { step: 'UNKNOWN', action: 'CONTINUE', result };
    }
  }

  /**
   * Generate workflow report
   */
  generateReport(result: OrchestratorTestResult, outputPath: string): void {
    const report = this.formatWorkflowReport(result);
    fs.writeFileSync(outputPath, report, 'utf8');
    console.log(`[OrchestratorTest] Report saved to: ${outputPath}`);
  }

  private formatWorkflowReport(result: OrchestratorTestResult): string {
    let report = `ORCHESTRATOR WORKFLOW TEST REPORT\n`;
    report += `=====================================\n\n`;
    report += `Plan: ${this.config.planName}\n`;
    report += `Success: ${result.success}\n`;
    report += `Iterations: ${result.iterations}\n`;
    report += `Max Iterations: ${this.config.maxIterations}\n\n`;

    if (result.error) {
      report += `ERROR: ${result.error}\n\n`;
    }

    report += `WORKFLOW TRACE:\n`;
    report += `===============\n`;

    for (const step of result.workflow) {
      report += `ITERATION ${step.iteration}:\n`;
      report += `  ORCHESTRATOR: ${step.step}\n`;
      report += `  ACTION: ${step.action}\n`;
      report += `  RESULT: ${step.result.substring(0, 200)}${step.result.length > 200 ? '...' : ''}\n`;
      
      if (step.notices.length > 0) {
        report += `  NOTICES:\n`;
        for (const notice of step.notices) {
          report += `    - ${notice}\n`;
        }
      }
      report += `\n`;
    }

    // Add LLM call history
    const llmHistory = this.mockLLM.getCallHistory();
    if (llmHistory.length > 0) {
      report += `LLM CALL HISTORY:\n`;
      report += `=================\n`;
      for (let i = 0; i < llmHistory.length; i++) {
        const call = llmHistory[i];
        report += `CALL ${i + 1}:\n`;
        report += `  Step: ${call.step}\n`;
        report += `  Prompt: ${call.prompt}\n`;
        report += `  Response: ${call.response}\n`;
        report += `  Tools: ${call.toolCalls.join(', ') || 'none'}\n\n`;
      }
    }

    // Add final plan state
    if (result.planFinalState) {
      report += `FINAL PLAN STATE:\n`;
      report += `=================\n`;
      report += JSON.stringify(result.planFinalState, null, 2);
      report += `\n\n`;
    }

    return report;
  }
}

/**
 * Load test configuration from JSON file
 */
export function loadTestConfig(configPath: string): OrchestratorTestConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const configData = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(configData) as OrchestratorTestConfig;
}

/**
 * Main test execution function
 */
export async function runOrchestratorTest(configPath: string, outputPath?: string): Promise<void> {
  try {
    const config = loadTestConfig(configPath);
    const runner = new OrchestratorTestRunner(config);
    
    console.log(`Starting orchestrator test with config: ${configPath}`);
    
    const result = await runner.runTest();
    
    const finalOutputPath = outputPath || path.join(path.dirname(configPath), 'orchestrator-test-result.txt');
    runner.generateReport(result, finalOutputPath);
    
    console.log(`Test completed. Success: ${result.success}, Iterations: ${result.iterations}`);
    
    if (result.error) {
      console.error(`Test error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('Failed to run orchestrator test:', error instanceof Error ? error.message : String(error));
  }
}
