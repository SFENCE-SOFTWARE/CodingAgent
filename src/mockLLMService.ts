// src/mockLLMService.ts

export interface MockLLMScenario {
  stepType: string;
  action: 'NEED_WORK' | 'REVIEWED' | 'ARCHITECTURE_SET' | 'POINTS_CREATED' | 'ERROR' | 'CUSTOM';
  customResponse?: string;
  toolCalls?: string[];
}

export interface MockLLMConfig {
  scenarios: MockLLMScenario[];
  defaultAction: 'NEED_WORK' | 'REVIEWED' | 'ARCHITECTURE_SET' | 'POINTS_CREATED';
  verbose: boolean;
}

/**
 * Mock LLM service that simulates different responses based on step types
 */
export class MockLLMService {
  private scenarios: Map<string, MockLLMScenario> = new Map();
  private callHistory: Array<{ step: string; prompt: string; response: string; toolCalls: string[] }> = [];
  private config: MockLLMConfig;
  
  constructor(config: MockLLMConfig) {
    this.config = config;
    
    // Build scenarios map
    for (const scenario of config.scenarios) {
      this.scenarios.set(scenario.stepType, scenario);
    }
  }

  /**
   * Simulate LLM response based on step type and prompt
   */
  async sendToLLM(prompt: string, stepType?: string): Promise<string> {
    const detectedStep = this.detectStepType(prompt, stepType);
    const scenario = this.scenarios.get(detectedStep);
    
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
          toolCalls = ['plan_architecture'];
          break;
        case 'POINTS_CREATED':
          response = this.generatePointsResponse();
          toolCalls = ['plan_point_create'];
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
        response = 'OPEN test-callback-review';
      } else if (detectedStep === 'language_detection') {
        response = 'English';
      } else if (detectedStep === 'translation') {
        response = 'OPEN test-callback-review';
      } else {
        response = this.generateDefaultResponse();
      }
    }
    
    // Log the interaction
    this.callHistory.push({
      step: detectedStep,
      prompt: prompt.substring(0, 200) + '...',
      response,
      toolCalls
    });
    
    if (this.config.verbose) {
      console.log(`[MockLLM] Step: ${detectedStep}, Response: ${response}, Tools: ${toolCalls.join(', ')}`);
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
  getCallHistory(): Array<{ step: string; prompt: string; response: string; toolCalls: string[] }> {
    return [...this.callHistory];
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
    return 'Coder, Reviewer, Architect';
  }
}
