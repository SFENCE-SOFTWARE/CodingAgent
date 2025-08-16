// src/loggingService.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LoggingService {
  private static instance: LoggingService;
  private isEnabled: boolean = false;
  private logFilePath: string = '';
  private verbosity: 'Minimal' | 'Standard' | 'Verbose' = 'Standard';
  private logMode: boolean = false;
  private logModeFilePath: string = '';

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private constructor() {
    this.updateConfiguration();
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codingagent.logging')) {
        this.updateConfiguration();
      }
    });
  }

  private updateConfiguration() {
    const config = vscode.workspace.getConfiguration('codingagent.logging');
    this.isEnabled = config.get('enabled', false);
    this.logFilePath = config.get('filePath', '');
    this.verbosity = config.get('verbosity', 'Standard') as 'Minimal' | 'Standard' | 'Verbose';
    this.logMode = config.get('logMode', false);
    this.logModeFilePath = config.get('logModeFilePath', '');

    // If no log file path specified, use default
    if (this.isEnabled && !this.logFilePath) {
      this.logFilePath = this.getDefaultLogPath();
    }

    // If log mode is enabled but no specific path provided, use default
    if (this.logMode && !this.logModeFilePath) {
      this.logModeFilePath = this.getDefaultLogModePath();
    }
  }

  private getDefaultLogPath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const logsDir = path.join(workspaceFolder.uri.fsPath, '.codingagent', 'logs');
      this.ensureDirectoryExists(logsDir);
      return path.join(logsDir, 'ai-communication.log');
    }
    
    // Fallback to extension's global storage
    const globalStoragePath = vscode.extensions.getExtension('codingagent')?.extensionPath;
    if (globalStoragePath) {
      const logsDir = path.join(globalStoragePath, 'logs');
      this.ensureDirectoryExists(logsDir);
      return path.join(logsDir, 'ai-communication.log');
    }
    
    return '';
  }

  private getDefaultLogModePath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const logsDir = path.join(workspaceFolder.uri.fsPath, '.codingagent', 'logs');
      this.ensureDirectoryExists(logsDir);
      return path.join(logsDir, 'openai-raw-json.log');
    }
    
    // Fallback to extension's global storage
    const globalStoragePath = vscode.extensions.getExtension('codingagent')?.extensionPath;
    if (globalStoragePath) {
      const logsDir = path.join(globalStoragePath, 'logs');
      this.ensureDirectoryExists(logsDir);
      return path.join(logsDir, 'openai-raw-json.log');
    }
    
    return '';
  }

  private ensureDirectoryExists(dirPath: string) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  public async logAiCommunication(
    request: any,
    response: any,
    metadata: {
      model?: string;
      mode?: string;
      timestamp?: number;
      duration?: number;
      error?: string;
      context?: string;
    } = {}
  ) {
    if (!this.isEnabled || !this.logFilePath) {
      return;
    }

    try {
      const timestamp = metadata.timestamp || Date.now();
      const logEntry = this.formatLogEntry(request, response, {
        ...metadata,
        timestamp
      });

      await this.appendToLog(logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
      // Show non-intrusive error notification
      vscode.window.showWarningMessage(
        'Failed to write to AI communication log. Check log file path and permissions.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('codingagent.openSettingsPanel');
        }
      });
    }
  }

  public async logRawJsonCommunication(
    request: any,
    response: any,
    metadata: {
      model?: string;
      mode?: string;
      timestamp?: number;
      duration?: number;
      error?: string;
      context?: string; // Additional context like "initial" or "follow-up"
    } = {}
  ) {
    if (!this.logMode || !this.logModeFilePath) {
      return;
    }

    try {
      const timestamp = metadata.timestamp || Date.now();
      const logEntry = this.formatRawJsonLogEntry(request, response, {
        ...metadata,
        timestamp
      });

      await this.appendToLogModeFile(logEntry);
    } catch (error) {
      console.error('Failed to write to log mode file:', error);
      // Show non-intrusive error notification
      vscode.window.showWarningMessage(
        'Failed to write to raw JSON log. Check log file path and permissions.',
        'Open Settings'
      ).then(selection => {
        if (selection === 'Open Settings') {
          vscode.commands.executeCommand('codingagent.openSettingsPanel');
        }
      });
    }
  }

  private formatLogEntry(
    request: any,
    response: any,
    metadata: {
      model?: string;
      mode?: string;
      timestamp: number;
      duration?: number;
      error?: string;
      context?: string;
    }
  ): string {
    const date = new Date(metadata.timestamp);
    const dateStr = date.toISOString();
    
    let entry = `\n${'='.repeat(80)}\n`;
    entry += `Timestamp: ${dateStr}\n`;
    
    if (metadata.model) {
      entry += `Model: ${metadata.model}\n`;
    }
    
    if (metadata.mode) {
      entry += `Mode: ${metadata.mode}\n`;
    }
    
    if (metadata.context) {
      entry += `Context: ${metadata.context}\n`;
    }
    
    if (metadata.duration) {
      entry += `Duration: ${metadata.duration}ms\n`;
    }
    
    entry += `${'='.repeat(80)}\n\n`;

    // Request section
    entry += `CodingAgent: ${this.formatPayload(request)}\n\n`;

    // Response section
    if (metadata.error) {
      entry += `LLM: ERROR - ${metadata.error}\n\n`;
    } else {
      entry += `LLM: ${this.formatPayload(response)}\n\n`;
    }

    // Metadata section (for verbose logging)
    if (this.verbosity === 'Verbose') {
      const metaInfo = {
        requestSize: JSON.stringify(request).length,
        responseSize: response ? JSON.stringify(response).length : 0,
        verbosity: this.verbosity,
        ...metadata
      };
      
      entry += `Meta: ${JSON.stringify(metaInfo, null, 2)}\n\n`;
    }

    return entry;
  }

  private formatPayload(payload: any): string {
    if (!payload) {
      return 'null';
    }

    try {
      let formatted: any = payload;

      // Sanitize based on verbosity level
      if (this.verbosity === 'Minimal') {
        formatted = this.sanitizeForMinimal(payload);
      } else if (this.verbosity === 'Standard') {
        formatted = this.sanitizeForStandard(payload);
      }
      // Verbose logs everything as-is

      return JSON.stringify(formatted, null, 2);
    } catch (error) {
      return `[Error formatting payload: ${error}]`;
    }
  }

  private sanitizeForMinimal(payload: any): any {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }

    const sanitized: any = {};
    
    // Only log essential fields for minimal logging
    if (payload.model) {
      sanitized.model = payload.model;
    }
    if (payload.messages && Array.isArray(payload.messages)) {
      sanitized.messages = payload.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content ? `[${msg.content.length} chars]` : null
      }));
    }
    if (payload.choices && Array.isArray(payload.choices)) {
      sanitized.choices = payload.choices.map((choice: any) => ({
        message: choice.message ? {
          role: choice.message.role,
          content: choice.message.content ? `[${choice.message.content.length} chars]` : null
        } : null
      }));
    }

    return sanitized;
  }

  private sanitizeForStandard(payload: any): any {
    if (typeof payload !== 'object' || payload === null) {
      return payload;
    }

    // Standard logging includes most fields but may truncate very long content
    const sanitized = { ...payload };
    
    if (sanitized.messages && Array.isArray(sanitized.messages)) {
      sanitized.messages = sanitized.messages.map((msg: any) => {
        const sanitizedMsg = { ...msg };
        if (sanitizedMsg.content && sanitizedMsg.content.length > 1000) {
          sanitizedMsg.content = sanitizedMsg.content.substring(0, 1000) + '... [truncated]';
        }
        return sanitizedMsg;
      });
    }

    if (sanitized.choices && Array.isArray(sanitized.choices)) {
      sanitized.choices = sanitized.choices.map((choice: any) => {
        const sanitizedChoice = { ...choice };
        if (sanitizedChoice.message?.content && sanitizedChoice.message.content.length > 1000) {
          sanitizedChoice.message.content = sanitizedChoice.message.content.substring(0, 1000) + '... [truncated]';
        }
        return sanitizedChoice;
      });
    }

    return sanitized;
  }

  private formatRawJsonLogEntry(
    request: any,
    response: any,
    metadata: {
      model?: string;
      mode?: string;
      timestamp: number;
      duration?: number;
      error?: string;
      context?: string;
    }
  ): string {
    const date = new Date(metadata.timestamp);
    const dateStr = date.toISOString();
    
    let entry = `\n${'='.repeat(120)}\n`;
    entry += `TIMESTAMP: ${dateStr}\n`;
    
    if (metadata.model) {
      entry += `MODEL: ${metadata.model}\n`;
    }
    
    if (metadata.mode) {
      entry += `MODE: ${metadata.mode}\n`;
    }
    
    if (metadata.context) {
      entry += `CONTEXT: ${metadata.context.toUpperCase()}\n`;
    }
    
    if (metadata.duration) {
      entry += `DURATION: ${metadata.duration}ms\n`;
    }
    
    entry += `${'='.repeat(120)}\n\n`;

    // Request section - RAW JSON
    entry += `REQUEST (Raw JSON):\n`;
    entry += `${'-'.repeat(80)}\n`;
    try {
      entry += JSON.stringify(request, null, 2);
    } catch (error) {
      entry += `[Error serializing request: ${error}]`;
    }
    entry += `\n${'-'.repeat(80)}\n\n`;

    // Response section - RAW JSON
    entry += `RESPONSE (Raw JSON):\n`;
    entry += `${'-'.repeat(80)}\n`;
    if (metadata.error) {
      entry += `ERROR: ${metadata.error}`;
    } else {
      try {
        entry += JSON.stringify(response, null, 2);
      } catch (error) {
        entry += `[Error serializing response: ${error}]`;
      }
    }
    entry += `\n${'-'.repeat(80)}\n\n`;

    return entry;
  }

  private async appendToLogModeFile(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.appendFile(this.logModeFilePath, content, 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async appendToLog(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.appendFile(this.logFilePath, content, 'utf8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public getLogModeFilePath(): string {
    return this.logModeFilePath;
  }

  public isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  public isLogModeEnabled(): boolean {
    return this.logMode;
  }

  public getVerbosity(): string {
    return this.verbosity;
  }

  // Debug logging method for thinking/streaming debug info
  public async logDebug(message: string, data?: any): Promise<void> {
    if (!this.isEnabled || !this.logFilePath) {
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      let entry = `[DEBUG ${timestamp}] ${message}`;
      
      if (data !== undefined) {
        try {
          entry += ` | Data: ${JSON.stringify(data, null, 2)}`;
        } catch (error) {
          entry += ` | Data: [Error serializing: ${error}]`;
        }
      }
      
      entry += '\n';
      
      await this.appendToLog(entry);
    } catch (error) {
      console.error('Failed to write debug log:', error);
    }
  }
}
