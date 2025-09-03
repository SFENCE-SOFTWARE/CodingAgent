// src/algorithmEngine.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChatService } from './chatService';

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
  sendToLLM: (message: string) => Promise<string>; // Change to Promise-based
  getConfig: (key: string) => any;
  setConfig: (key: string, value: any) => void;
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
  private logs: string[] = [];
  private currentChatCallback?: (update: any) => void;
  private configData: { [algorithm: string]: { [key: string]: any } } = {};
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
    const extensionPath = vscode.extensions.getExtension('codding-agent')?.extensionPath;
    
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
   * Get algorithm variables for the given mode
   */
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
      const context = await this.createSandboxContext(mode, userMessage);
      
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
  private async createSandboxContext(mode: string, userMessage: string): Promise<AlgorithmContext> {
    const context: AlgorithmContext = {
      mode,
      userMessage,
      
      console: {
        log: (...args: any[]) => this.log('log', ...args),
        error: (...args: any[]) => this.log('error', ...args),
        warn: (...args: any[]) => this.log('warn', ...args),
        info: (...args: any[]) => this.log('info', ...args)
      },

      sendResponse: (message: string) => {
        // Store final response for the algorithm
        this.algorithmResponses[mode] = message;
      },

      sendToLLM: async (message: string): Promise<string> => {
        if (!this.chatService) {
          throw new Error('Chat service not available');
        }

        return new Promise((resolve, reject) => {
          this.chatService!.sendOrchestrationRequest(message, (response: string) => {
            resolve(response);
          }, this.currentChatCallback);
        });
      },

      getConfig: (key: string) => {
        if (!this.configData[mode]) {
          this.configData[mode] = {};
        }
        return this.configData[mode][key];
      },

      setConfig: (key: string, value: any) => {
        if (!this.configData[mode]) {
          this.configData[mode] = {};
        }
        this.configData[mode][key] = value;
        this.log('info', `Config set for ${mode}: ${key} = ${value}`);
      }
    } as any;

    return context;
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
 * - context.sendToLLM(message, callback) - send to LLM and get response
 * - context.getVariable(key) - get stored variable
 * - context.setVariable(key, value) - set variable (persists)
 */

function handleUserMessage(message, context) {
    context.console.log('Orchestrator algorithm processing message:', message);
    
    // Example orchestration logic
    const steps = [
        'Analyze user request',
        'Determine required actions',
        'Coordinate with appropriate agents',
        'Execute plan',
        'Provide summary'
    ];
    
    let response = 'Orchestrator Algorithm Processing:\\n\\n';
    
    steps.forEach((step, index) => {
        response += \`\${index + 1}. \${step}\\n\`;
        context.console.info(\`Step \${index + 1}: \${step}\`);
    });
    
    // Example: Check for plan-related requests
    if (message.toLowerCase().includes('plan')) {
        response += '\\nDetected plan-related request. Initiating plan workflow...';
        context.setVariable('last_action', 'plan_workflow');
    } else {
        response += '\\nGeneral request processing initiated.';
        context.setVariable('last_action', 'general_processing');
    }
    
    // Send response back to chat
    context.sendResponse(response);
    
    return 'Orchestrator algorithm completed';
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
 * - context.sendToLLM(message, callback) - send to LLM and get response
 * - context.getVariable(key) - get stored variable
 * - context.setVariable(key, value) - set variable (persists)
 */

function handleUserMessage(message, context) {
    context.console.log('${mode} algorithm processing message:', message);
    
    // Default behavior: forward to LLM
    context.sendToLLM(message, function(llmResponse) {
        context.console.info('LLM response received');
        context.sendResponse(llmResponse);
    });
    
    return '${mode} algorithm delegated to LLM';
}`;
  }
}
