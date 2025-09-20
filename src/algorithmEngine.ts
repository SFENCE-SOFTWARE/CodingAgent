//// src/algorithmEngine.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChatService } from './chatService';
import { PlanningService } from './planningService';
import { PlanContextManager } from './planContextManager';
import { ToolsService } from './tools';

/**
 * Interface for algorithm execution context
 */
export interface AlgorithmContext {
  mode: string;
  userMessage: string;
  console: {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
  };
  sendResponse: (message: string) => void;
  sendNotice: (content: string) => void;
  sendToLLM: (message: string) => Promise<string>; // Promise-based
  getConfig: (key: string) => any; // Read-only config access
  getVariable: (variableKey: string) => string | undefined; // Get algorithm variables
  isInterrupted: () => boolean; // Check if algorithm should stop
  tools?: {
    execute: (toolName: string, args: any) => Promise<{success: boolean; content?: string; error?: string}>;
    getAvailableTools: () => string[]; // List available tool names
  };
  planningService?: {
    showPlan: (planId: string) => { success: boolean; plan?: any; error?: string };
    listPlans: () => { success: boolean; plans?: Array<{id: string, name: string, shortDescription?: string}>; error?: string };
    createPlan: (id: string, name: string, shortDescription: string, longDescription: string) => { success: boolean; error?: string };
    createPlanWithLanguageInfo: (id: string, name: string, shortDescription: string, longDescription: string, detectedLanguage: string, originalRequest: string, translatedRequest?: string) => { success: boolean; error?: string };
    evaluatePlanCompletion: (planId: string) => { success: boolean; result?: any; error?: string };
    evaluateNewPlanCreation: (planId: string, originalRequest?: string) => { success: boolean; result?: any; error?: string };
    planEvaluate: (planId: string, originalRequest?: string) => { success: boolean; result?: any; error?: string };
  };
  planContextManager?: {
    getCurrentPlanId: () => string | null;
    setCurrentPlanId: (planId: string | null) => void;
  };
  getAvailableModes: () => string; // Returns formatted list of available modes
}

/**
 * Algorithm execution result
 */
export interface AlgorithmResult {
  handled: boolean;
  response?: string;
  error?: string;
}

/**
 * Engine for executing JavaScript algorithms in a sandbox environment
 */
export class AlgorithmEngine {
  private static instance: AlgorithmEngine;
  private chatService?: ChatService;
  private planningService?: PlanningService;
  private toolsService?: ToolsService;
  private logs: string[] = [];
  private currentChatCallback?: (update: any) => void;
  private configStore: Map<string, any> = new Map(); // Config management in RAM
  private algorithmResponses: { [algorithm: string]: string } = {}; // Store final responses

  private constructor() {}

  public static getInstance(): AlgorithmEngine {
    if (!AlgorithmEngine.instance) {
      AlgorithmEngine.instance = new AlgorithmEngine();
    }
    return AlgorithmEngine.instance;
  }

  public setChatService(chatService: ChatService): void {
    this.chatService = chatService;
  }

  public setPlanningService(planningService: PlanningService): void {
    this.planningService = planningService;
  }

  public setToolsService(toolsService: ToolsService): void {
    this.toolsService = toolsService;
  }

  /**
   * Check if algorithm is enabled for the given mode
   */
  public isAlgorithmEnabled(mode: string): boolean {
    const config = vscode.workspace.getConfiguration('codingagent.algorithm');
    const enabled = config.get('enabled', {}) as { [key: string]: boolean };
    return enabled[mode] === true;
  }

  /**
   * Get algorithm script path for the given mode
   */
  public getAlgorithmScriptPath(mode: string): string | null {
    const config = vscode.workspace.getConfiguration('codingagent.algorithm');
    const scriptPaths = config.get('scriptPath', {}) as { [key: string]: string };
    
    const customPath = scriptPaths[mode];
    if (customPath && customPath.trim()) {
      return customPath;
    }

    // Return built-in script path
    return this.getBuiltInScriptPath(mode);
  }

  /**
   * Get built-in algorithm script path
   */
  private getBuiltInScriptPath(mode: string): string | null {
    // First try to get extension path
    const extension = vscode.extensions.getExtension('codding-agent');
    const extensionPath = extension?.extensionPath;
    
    if (extensionPath) {
      const builtInPath = path.join(extensionPath, 'src', 'algorithms', `${mode.toLowerCase()}.js`);
      if (fs.existsSync(builtInPath)) {
        return builtInPath;
      }
    }

    // Fallback to workspace-based paths (for development mode)
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      // Try workspace src/algorithms first
      const workspacePath = path.join(workspaceRoot, 'src', 'algorithms', `${mode.toLowerCase()}.js`);
      if (fs.existsSync(workspacePath)) {
        return workspacePath;
      }
      
      // Try compiled output directory
      const outPath = path.join(workspaceRoot, 'out', 'src', 'algorithms', `${mode.toLowerCase()}.js`);
      if (fs.existsSync(outPath)) {
        return outPath;
      }
    }

    // Last resort: try relative to current file location (for development/test mode)
    const currentDir = path.dirname(__filename);
    // In development, __filename might be in out/src/, so go up to find src/
    const developmentPath = path.join(currentDir, '..', '..', 'src', 'algorithms', `${mode.toLowerCase()}.js`);
    if (fs.existsSync(developmentPath)) {
      return developmentPath;
    }
    
    // Try relative to current compiled location
    const relativePath = path.join(currentDir, '..', 'algorithms', `${mode.toLowerCase()}.js`);
    if (fs.existsSync(relativePath)) {
      return relativePath;
    }

    // If still not found, check if we're in development and try parent directories
    if (workspaceRoot) {
      const possiblePaths = [
        path.join(workspaceRoot, 'algorithms', `${mode.toLowerCase()}.js`),
        path.join(path.dirname(workspaceRoot), 'CodingAgent', 'src', 'algorithms', `${mode.toLowerCase()}.js`),
        path.join(path.dirname(workspaceRoot), 'src', 'algorithms', `${mode.toLowerCase()}.js`)
      ];
      
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          return testPath;
        }
      }
    }

    return null;
  }

  /**
   * Execute algorithm for the given mode and user message
   */
  public async executeAlgorithm(mode: string, userMessage: string, chatCallback?: (update: any) => void): Promise<AlgorithmResult> {
    if (!this.isAlgorithmEnabled(mode)) {
      return { handled: false };
    }

    // Store chat callback for use in LLM calls
    this.currentChatCallback = chatCallback;

    const scriptPath = this.getAlgorithmScriptPath(mode);
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      return { 
        handled: false, 
        error: `Algorithm script not found for mode '${mode}' at path: ${scriptPath}` 
      };
    }

    try {
      // Read the script
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Create sandbox context
      const context = this.createSandboxContext(mode, userMessage);
      
      // Execute the script in sandbox
      const result = await this.executeSandbox(scriptContent, context);
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('error', `Algorithm execution failed: ${errorMsg}`);
      return { 
        handled: false, 
        error: `Algorithm execution failed: ${errorMsg}` 
      };
    }
  }

  /**
   * Create sandbox context for algorithm execution
   */
  private createSandboxContext(mode: string, userMessage: string): AlgorithmContext {
    return {
      mode,
      userMessage,
      console: {
        log: (...args: any[]) => this.log('info', ...args),
        error: (...args: any[]) => this.log('error', ...args),
        warn: (...args: any[]) => this.log('warn', ...args),
        info: (...args: any[]) => this.log('info', ...args)
      },
      sendResponse: (message: string) => {
        // Store the final response for retrieval - no interrupt check needed
        this.algorithmResponses[mode] = message;
      },
      // Send notice message to chat
      sendNotice: (content: string) => {
        // Send notice without interrupt check - notices are informational
        if (this.chatService && this.chatService.sendNoticeMessage) {
          this.chatService.sendNoticeMessage(content);
        }
      },
      // Config management in RAM (read-only)
      getConfig: (key: string) => {
        return this.configStore.get(key);
      },
      // Get algorithm variables for current mode
      getVariable: (variableKey: string) => {
        const config = vscode.workspace.getConfiguration('codingagent.algorithm.variables');
        const variables = config.get(mode) as Record<string, string> || {};
        return variables[variableKey];
      },
      
      // Check if algorithm should stop due to interrupt
      isInterrupted: () => {
        return this.chatService ? this.chatService.getIsInterrupted() : false;
      },
      
      // LLM communication - now Promise-based with optional mode
      sendToLLM: async (prompt: string, mode?: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          try {
            // Check for interruption before making LLM call
            if (this.chatService && this.chatService.getIsInterrupted()) {
              reject(new Error('Algorithm execution was interrupted'));
              return;
            }
            
            if (!this.chatService) {
              reject(new Error('ChatService not available'));
              return;
            }
            
            this.chatService.sendOrchestrationRequest(
              prompt, 
              (response: string) => {
                // Check for interruption again after LLM response
                if (this.chatService && this.chatService.getIsInterrupted()) {
                  reject(new Error('Algorithm execution was interrupted'));
                  return;
                }
                resolve(response);
              }, 
              this.currentChatCallback,
              mode // Pass the optional mode parameter
            );
          } catch (error) {
            reject(new Error(`LLM request failed: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      },
      
      // Planning service integration (if available)
      planningService: this.planningService ? {
        showPlan: (planId: string) => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.showPlan(planId, true); // Include point descriptions
        },
        listPlans: () => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.listPlans(true); // Include short descriptions
        },
        createPlan: (id: string, name: string, shortDescription: string, longDescription: string) => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.createPlan(id, name, shortDescription, longDescription);
        },
        createPlanWithLanguageInfo: (id: string, name: string, shortDescription: string, longDescription: string, detectedLanguage: string, originalRequest: string, translatedRequest?: string) => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.createPlanWithLanguageInfo(id, name, shortDescription, longDescription, detectedLanguage, originalRequest, translatedRequest);
        },
        evaluatePlanCompletion: (planId: string) => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.evaluatePlanCompletion(planId);
        },
        evaluateNewPlanCreation: (planId: string, originalRequest?: string) => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.evaluateNewPlanCreation(planId, originalRequest);
        },
        planEvaluate: (planId: string, originalRequest?: string) => {
          // Check for interruption before planning operation
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.planningService) {
            return { success: false, error: 'Planning service not available' };
          }
          return this.planningService.planEvaluate(planId, originalRequest);
        }
      } : undefined,
      
      // Plan context manager integration
      planContextManager: {
        getCurrentPlanId: () => {
          const manager = PlanContextManager.getInstance();
          return manager.getCurrentPlanId();
        },
        setCurrentPlanId: (planId: string | null) => {
          const manager = PlanContextManager.getInstance();
          manager.setCurrentPlanId(planId);
        }
      },
      
      // Tools service integration (if available)
      tools: this.toolsService ? {
        execute: async (toolName: string, args: any) => {
          // Check for interruption before tool execution
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.toolsService) {
            return { success: false, error: 'Tools service not available' };
          }
          
          try {
            const result = await this.toolsService.executeTool(toolName, args);
            return result;
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        },
        getAvailableTools: () => {
          // Check for interruption before tool list access
          if (this.chatService && this.chatService.getIsInterrupted()) {
            throw new Error('Algorithm execution was interrupted');
          }
          
          if (!this.toolsService) {
            return [];
          }
          
          const definitions = this.toolsService.getToolDefinitions();
          return Object.keys(definitions);
        }
      } : undefined,
      
      // Available modes (excluding current mode)
      getAvailableModes: () => {
        const config = vscode.workspace.getConfiguration('codingagent');
        const currentMode = config.get<string>('currentMode', 'Coder');
        const allModes = config.get<Record<string, any>>('modes', {});
        
        const availableModes: string[] = [];
        for (const [modeName, modeConfig] of Object.entries(allModes)) {
          if (modeName !== currentMode && modeConfig.llmDescription) {
            availableModes.push(`${modeName} - ${modeConfig.llmDescription}`);
          }
        }
        
        return availableModes.join('\n');
      }
    };
  }

  /**
   * Execute script in sandbox environment
   */
  private async executeSandbox(scriptContent: string, context: AlgorithmContext): Promise<AlgorithmResult> {
    // Create safe sandbox environment
    const sandbox = {
      context,
      console: context.console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Promise,
      JSON,
      Math,
      Date,
      RegExp,
      String,
      Number,
      Boolean,
      Array,
      Object
    };

    try {
      // Create unique execution context for each script run
      const executionId = Math.random().toString(36).substr(2, 9);
      const wrappedScript = `
        (function(sandbox) {
          const context = sandbox.context;
          const console = sandbox.console;
          
          // Create isolated scope for script execution with unique identifier
          return (function scriptExecution_${executionId}() {
            ${scriptContent}
            
            // Execute the main function if it exists
            if (typeof handleUserMessage === 'function') {
              return handleUserMessage(context.userMessage, context);
            } else {
              throw new Error('Algorithm script must define handleUserMessage function');
            }
          })();
        })
      `;

      // Execute the wrapped script using eval to ensure proper context
      const func = eval(wrappedScript);
      const result = await func(sandbox);

      // Get final response from algorithm (set via sendResponse)
      const finalResponse = this.algorithmResponses[context.mode];
      
      if (finalResponse) {
        // Clear stored response
        delete this.algorithmResponses[context.mode];
        
        return {
          handled: true,
          response: finalResponse
        };
      }

      // Fallback to direct result if sendResponse wasn't called
      return {
        handled: true,
        response: result || 'Algorithm executed successfully'
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('error', 'Sandbox execution error:', errorMsg);
      return {
        handled: false,
        error: `Algorithm execution error: ${errorMsg}`
      };
    }
  }

  /**
   * Log message with timestamp
   */
  private log(level: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] [Algorithm-${level.toUpperCase()}] ${args.join(' ')}`;
    this.logs.push(message);
    
    // Keep only last 1000 log entries
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Also log to VS Code output channel for debugging
    console.log(message);
  }

  /**
   * Get recent log entries
   */
  public getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Open algorithm script in VS Code editor
   */
  public async openAlgorithmScript(mode: string): Promise<void> {
    const scriptPath = this.getAlgorithmScriptPath(mode);
    if (!scriptPath) {
      vscode.window.showErrorMessage(`No algorithm script configured for mode '${mode}'`);
      return;
    }

    try {
      // Check if it's a built-in script
      const builtInPath = this.getBuiltInScriptPath(mode);
      const isBuiltIn = scriptPath === builtInPath;

      if (!fs.existsSync(scriptPath) && isBuiltIn) {
        // Create built-in script if it doesn't exist
        await this.createBuiltInScript(mode, scriptPath);
      }

      // Open the script file
      const document = await vscode.workspace.openTextDocument(scriptPath);
      const editor = await vscode.window.showTextDocument(document);

      if (isBuiltIn) {
        // Make built-in scripts read-only
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to open algorithm script: ${errorMsg}`);
    }
  }

  /**
   * Create built-in algorithm script
   */
  private async createBuiltInScript(mode: string, scriptPath: string): Promise<void> {
    const builtInScript = this.getBuiltInScriptContent(mode);
    const dir = path.dirname(scriptPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the built-in script
    fs.writeFileSync(scriptPath, builtInScript, 'utf8');
  }

  /**
   * Get built-in script content for the mode
   */
  private getBuiltInScriptContent(mode: string): string {
    switch (mode) {
      case 'Orchestrator':
        return this.getOrchestratorScript();
      default:
        return this.getDefaultScript(mode);
    }
  }

  /**
   * Get default Orchestrator algorithm script
   */
  private getOrchestratorScript(): string {
    return `/**
 * Built-in Orchestrator Algorithm
 * 
 * This script replaces LLM-based orchestration with algorithmic logic.
 * The script receives user messages and coordinates task execution.
 * 
 * Required function: handleUserMessage(message, context)
 * 
 * Available context methods:
 * - context.console.log/error/warn/info() - for logging
 * - context.sendResponse(message) - send response to chat
 * - context.sendToLLM(message) - send to LLM and get response (Promise-based)
 * - context.getConfig(key) - get stored config (read-only)
 */

async function handleUserMessage(message, context) {
    context.console.log('Orchestrator algorithm processing message:', message);
    
    // Step 1: Detect language and translate if needed
    const llmLanguages = ['en', 'cs', 'sk'];
    const targetLanguage = llmLanguages[0]; // Default to first supported language
    
    let workingMessage = message;
    let detectedLanguage = 'unknown';
    
    try {
        // Ask LLM to detect language
        const languagePrompt = \`Detect the language of this message and respond with just the two-letter language code (en, cs, sk, de, fr, etc.): "\${message}"\`;
        detectedLanguage = await context.sendToLLM(languagePrompt);
        detectedLanguage = detectedLanguage.trim().toLowerCase();
        
        context.console.info(\`Detected language: \${detectedLanguage}\`);
        
        // If detected language is not in supported LLM languages, translate
        if (!llmLanguages.includes(detectedLanguage)) {
            context.console.info(\`Language \${detectedLanguage} not in LLM languages, translating to \${targetLanguage}\`);
            const translatePrompt = \`Translate this message to \${targetLanguage}, keep the same meaning and intent: "\${message}"\`;
            workingMessage = await context.sendToLLM(translatePrompt);
            context.console.info(\`Translated message: \${workingMessage}\`);
        }
        
        // Use translated message for further processing
        message = workingMessage;
        
    } catch (error) {
        context.console.error('Language detection/translation failed:', error.message);
        // Continue with original message
    }
    
    // Step 2: Categorize the request
    try {
        const categorizationPrompt = \`Analyze this user request and categorize it. Respond with exactly one of these options:
- NEW (if user wants to create a new plan)
- OPEN <plan_id> (if user wants to open/work with an existing plan, replace <plan_id> with the actual plan ID mentioned)
- QUESTION (for any other type of request - questions, general help, etc.)

User request: "\${message}"\`;
        
        const category = await context.sendToLLM(categorizationPrompt);
        const categoryTrimmed = category.trim().toUpperCase();
        
        context.console.info(\`Request categorized as: \${categoryTrimmed}\`);
        
        // Handle different categories
        if (categoryTrimmed === 'NEW') {
            context.console.info('Plan creation request detected - logic will be added later');
            context.sendResponse('Plan creation request detected. Implementation pending.');
            return 'Plan creation workflow initiated';
            
        } else if (categoryTrimmed.startsWith('OPEN ')) {
            const planId = categoryTrimmed.substring(5).trim();
            context.console.info(\`Plan opening request detected for plan: \${planId}\`);
            
            if (context.planningService) {
                const planResult = context.planningService.showPlan(planId);
                if (planResult.success && planResult.plan) {
                    context.sendResponse(\`Successfully loaded plan "\${planId}": \${planResult.plan.name}\\n\\nDescription: \${planResult.plan.shortDescription}\\n\\nPlan is now active.\`);
                    return \`Plan "\${planId}" loaded successfully\`;
                } else {
                    context.sendResponse(\`Failed to load plan "\${planId}": \${planResult.error || 'Plan not found'}\`);
                    return \`Plan loading failed: \${planResult.error}\`;
                }
            } else {
                context.sendResponse(\`Plan opening requested for "\${planId}" but planning service is not available.\`);
                return 'Planning service not available';
            }
            
        } else {
            // QUESTION or anything else - forward to LLM directly
            context.console.info('General question detected, forwarding to LLM');
            const llmResponse = await context.sendToLLM(message); // Use working message
            context.sendResponse(llmResponse);
            return 'General question handled by LLM';
        }
        
    } catch (error) {
        context.console.error('Request categorization failed:', error.message);
        // Fallback to direct LLM
        const llmResponse = await context.sendToLLM(message);
        context.sendResponse(llmResponse);
        return 'Fallback to direct LLM due to categorization error';
    }
}`;
  }

  /**
   * Get default script template for other modes
   */
  private getDefaultScript(mode: string): string {
    return `/**
 * ${mode} Algorithm Script
 * 
 * This script handles messages for ${mode} mode.
 * 
 * Required function: handleUserMessage(message, context)
 * 
 * Available context methods:
 * - context.console.log/error/warn/info() - for logging
 * - context.sendResponse(message) - send response to chat
 * - context.sendToLLM(message) - send to LLM and get response (Promise-based)
 * - context.getConfig(key) - get stored config (read-only)
 */

async function handleUserMessage(message, context) {
    context.console.log('${mode} algorithm processing message:', message);
    
    // Default behavior: forward to LLM
    try {
        const llmResponse = await context.sendToLLM(message);
        context.console.info('LLM response received');
        context.sendResponse(llmResponse);
        return '${mode} algorithm delegated to LLM';
    } catch (error) {
        context.console.error('LLM request failed:', error.message);
        context.sendResponse('Sorry, I encountered an error processing your request.');
        return '${mode} algorithm failed';
    }
}`;
  }
}
