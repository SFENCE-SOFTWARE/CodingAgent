// src/mockLLMService.ts

export interface MockLLMScenario {
  stepType: string;
  iteration?: number; // Optional iteration number for repeated scenarios
  action: 'NEED_WORK' | 'REVIEWED' | 'ARCHITECTURE_SET' | 'POINTS_CREATED' | 'ERROR' | 'CUSTOM';
  customResponse?: string;
  toolCalls?: string[];
}

export interface MockLLMConfig {
  scenarios: MockLLMScenario[];
  defaultAction: 'NEED_WORK' | 'REVIEWED' | 'ARCHITECTURE_SET' | 'POINTS_CREATED';
  verbose: boolean;
  enableIterationTracking?: boolean; // Track iterations for each step type
  simulateCallbacks?: boolean; // Simulate completion callbacks
  detectCycles?: boolean; // Enable cycle detection
}

/**
 * Mock LLM service that simulates different responses based on step types
 */
export class MockLLMService {
  private scenarios: Map<string, MockLLMScenario[]> = new Map();
  private callHistory: Array<{ step: string; prompt: string; response: string; toolCalls: string[]; iteration: number }> = [];
  private config: MockLLMConfig;
  private stepIterations: Map<string, number> = new Map(); // Track iterations per step type
  private cycleDetector: Map<string, number> = new Map(); // Detect cycles
  
  constructor(config: MockLLMConfig) {
    this.config = config;
    
    // Build scenarios map - group by stepType
    for (const scenario of config.scenarios) {
      if (!this.scenarios.has(scenario.stepType)) {
        this.scenarios.set(scenario.stepType, []);
      }
      this.scenarios.get(scenario.stepType)!.push(scenario);
    }
  }

  /**
   * Simulate LLM response based on step type and prompt
   */
  async sendToLLM(prompt: string, stepType?: string): Promise<string> {
    const detectedStep = this.detectStepType(prompt, stepType);
    
    // Track iterations for this step type
    const currentIteration = (this.stepIterations.get(detectedStep) || 0) + 1;
    this.stepIterations.set(detectedStep, currentIteration);
    
    // Cycle detection
    if (this.config.detectCycles) {
      const cycleCount = this.cycleDetector.get(detectedStep) || 0;
      this.cycleDetector.set(detectedStep, cycleCount + 1);
      
      if (cycleCount > 5) { // Allow max 5 iterations before considering it a cycle
        throw new Error(`Detected infinite cycle for step: ${detectedStep} (${cycleCount} iterations)`);
      }
    }
    
    // Find appropriate scenario for this step and iteration
    const scenarioList = this.scenarios.get(detectedStep);
    let scenario: MockLLMScenario | undefined;
    
    if (scenarioList && scenarioList.length > 0) {
      // Find scenario matching current iteration, or use the last available
      scenario = scenarioList.find(s => s.iteration === currentIteration) || 
                scenarioList.find(s => !s.iteration) || 
                scenarioList[scenarioList.length - 1];
    }
    
    let response: string;
    let toolCalls: string[] = [];
    
    if (scenario) {
      switch (scenario.action) {
        case 'NEED_WORK':
          response = this.generateNeedWorkResponse();
          toolCalls = ['plan_need_works'];
          break;
        case 'REVIEWED':
          response = this.generateReviewedResponse();
          toolCalls = ['plan_reviewed'];
          break;
        case 'ARCHITECTURE_SET':
          response = this.generateArchitectureResponse();
          toolCalls = ['plan_set_architecture'];
          break;
        case 'POINTS_CREATED':
          response = this.generatePointsResponse();
          toolCalls = ['plan_add_points'];
          break;
        case 'ERROR':
          throw new Error('Simulated LLM error');
        case 'CUSTOM':
          response = scenario.customResponse || 'Custom response';
          toolCalls = scenario.toolCalls || [];
          break;
        default:
          response = this.generateDefaultResponse();
      }
    } else {
      // Handle special orchestrator steps
      if (detectedStep === 'categorization') {
        response = 'CREATE test-plan';
      } else if (detectedStep === 'language_detection') {
        response = 'English';
      } else if (detectedStep === 'translation') {
        response = prompt; // No translation needed
      } else {
        // Use default action from config
        switch (this.config.defaultAction) {
          case 'NEED_WORK':
            response = this.generateNeedWorkResponse();
            toolCalls = ['plan_need_works'];
            break;
          case 'REVIEWED':
            response = this.generateReviewedResponse();
            toolCalls = ['plan_reviewed'];
            break;
          default:
            response = this.generateDefaultResponse();
        }
      }
    }
    
    // Log the interaction
    this.callHistory.push({
      step: detectedStep,
      prompt: prompt.substring(0, 200) + '...',
      response,
      toolCalls,
      iteration: currentIteration
    });
    
    if (this.config.verbose) {
      console.log(`[MockLLM] Step: ${detectedStep} (iteration ${currentIteration}), Response: ${response}, Tools: ${toolCalls.join(', ')}`);
    }
    
    // Simulate tool execution side effects
    this.simulateToolExecution(toolCalls);
    
    return response;
  }

  private detectStepType(prompt: string, stepType?: string): string {
    if (stepType) {
      return stepType;
    }
    
    const lowerPrompt = prompt.toLowerCase();
    
    // Handle categorization requests
    if (lowerPrompt.includes('categorize') || lowerPrompt.includes('analyze this user request')) {
      return 'categorization';
    }
    
    // Handle language detection
    if (lowerPrompt.includes('detect the language')) {
      return 'language_detection';
    }
    
    // Handle translation
    if (lowerPrompt.includes('translate')) {
      return 'translation';
    }
    
    if (lowerPrompt.includes('description') && lowerPrompt.includes('update')) {
      return 'plan_description_update';
    } else if (lowerPrompt.includes('description') && lowerPrompt.includes('review')) {
      return 'plan_description_review';
    } else if (lowerPrompt.includes('architecture') && lowerPrompt.includes('creat')) {
      return 'plan_architecture_creation';
    } else if (lowerPrompt.includes('architecture') && lowerPrompt.includes('review')) {
      return 'plan_architecture_review';
    } else if (lowerPrompt.includes('points') || lowerPrompt.includes('task')) {
      return 'plan_points_creation';
    } else if (lowerPrompt.includes('mode')) {
      return 'mode_selection';
    } else if (lowerPrompt.includes('successful') || lowerPrompt.includes('completed')) {
      return 'success_evaluation';
    }
    
    return 'unknown';
  }

  private generateNeedWorkResponse(): string {
    return 'I found several issues that need to be addressed. Using plan_need_works tool to specify the required changes.';
  }

  private generateReviewedResponse(): string {
    return 'The plan looks good and meets all requirements. Using plan_reviewed tool to mark it as approved.';
  }

  private generateArchitectureResponse(): string {
    return 'I have created the architecture design. Using plan_architecture tool to set the architecture.';
  }

  private generatePointsResponse(): string {
    return 'I have created detailed implementation points. Using plan_point_create tool to add them.';
  }

  private generateDefaultResponse(): string {
    switch (this.config.defaultAction) {
      case 'NEED_WORK':
        return this.generateNeedWorkResponse();
      case 'REVIEWED':
        return this.generateReviewedResponse();
      case 'ARCHITECTURE_SET':
        return this.generateArchitectureResponse();
      case 'POINTS_CREATED':
        return this.generatePointsResponse();
      default:
        return 'Task completed successfully.';
    }
  }

  private simulateToolExecution(toolCalls: string[]): void {
    // This would normally trigger the actual tool execution
    // For testing, we just log what tools would be called
    if (toolCalls.length > 0 && this.config.verbose) {
      console.log(`[MockLLM] Would execute tools: ${toolCalls.join(', ')}`);
    }
  }

  /**
   * Get the call history for analysis
   */
  getCallHistory(): Array<{ step: string; prompt: string; response: string; toolCalls: string[]; iteration: number }> {
    return [...this.callHistory];
  }
  
  /**
   * Get step iterations for cycle detection
   */
  getStepIterations(): Map<string, number> {
    return new Map(this.stepIterations);
  }
  
  /**
   * Get cycle detector state
   */
  getCycleState(): Map<string, number> {
    return new Map(this.cycleDetector);
  }
  
  /**
   * Reset mock state for new test
   */
  reset(): void {
    this.callHistory = [];
    this.stepIterations.clear();
    this.cycleDetector.clear();
  }

  /**
   * Clear call history
   */
  clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * Get available modes (mock)
   */
  getAvailableModes(): string {
    return 'Coder, Reviewer, Architect, Plan Reviewer, Tester, Approver';
  }
}
