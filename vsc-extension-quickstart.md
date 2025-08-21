# CodingAgent VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for the CodingAgent extension.
* `package.json` - the manifest file declaring the extension, commands, and configuration settings.
  * Registers chat view provider, settings panel, and change tracking commands
  * Defines configuration schema for Ollama connection, modes, logging, and change tracking
* `src/extension.ts` - the main entry point that activates the extension.
  * Registers the chat view provider, settings panel, and change tracking services
  * Sets up command handlers and initializes the extension components
* `src/chatViewProvider.ts` - implements the main chat UI and conversation handling
* `src/chatService.ts` - handles communication with OpenAI-compatible backend and tool execution
* `src/changeTrackingService.ts` - manages file change tracking, diff generation, and accept/reject operations
* `src/settingsPanel.ts` - provides the settings configuration interface
* `src/loggingService.ts` - handles AI communication logging with multiple verbosity levels
* `src/tools/` - directory containing all AI-callable tools (file operations, terminal execution, etc.)
* `media/` - UI assets including CSS, JavaScript, and icons for the chat and settings interfacesto your VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your extension and command.
  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.
* `src/extension.ts` - this is the main file where you will provide the implementation of your command.
  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.
  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

## Get up and running

* Press `F5` to open a new window with the CodingAgent extension loaded.
* Configure your OpenAI-compatible backend connection in VS Code settings (`Ctrl+,` and search for "codingagent").
* Open the CodingAgent chat by clicking the chat icon in the Activity Bar or using `Ctrl+Shift+P` and typing "CodingAgent: Open Chat".
* Use the settings panel (gear icon in chat header) to configure modes, tools, and logging options.
* Start chatting with the AI - it can read files, execute commands, and modify your workspace with change tracking.
* Review and accept/reject AI changes using the inline change tracking system.

## Key Features

* **AI Chat Interface**: GitHub Copilot-like chat interface powered by OpenAI-compatible backends
* **Configurable Modes**: Built-in modes (Coder, Ask, Architect) plus custom mode creation
* **Comprehensive Tools**: File operations, terminal execution, web scraping, PDF reading
* **Change Tracking**: Visual diff viewer with accept/reject capabilities for all AI modifications
* **Logging System**: Configurable AI communication logging with multiple verbosity levels
* **Settings Management**: Full settings panel with reset capabilities and mode management

## Development and Testing

* The "watch" task (`npm run watch`) automatically compiles TypeScript changes
* Use `npm test` to run the comprehensive test suite including tool tests and change tracking scenarios
* Set breakpoints in TypeScript files for debugging
* Find extension output in the debug console and CodingAgent-specific logs in `.codingagent/logs/`

## Architecture Overview

The CodingAgent extension follows a modular architecture:

1. **Chat Interface** (`chatViewProvider.ts`) - Main user interface with webview
2. **AI Communication** (`chatService.ts`) - Handles OpenAI-compatible backend communication and tool orchestration
3. **Tool System** (`tools/`) - Modular AI-callable tools with change tracking integration
4. **Change Management** (`changeTrackingService.ts`) - Tracks, visualizes, and manages all AI modifications
5. **Settings & Configuration** (`settingsPanel.ts`) - User configuration interface
6. **Logging & Debugging** (`loggingService.ts`) - Comprehensive logging system

## Tool Development

* All tools inherit from `ChangeAwareBaseTool` for automatic change tracking
* Tools are automatically registered and made available to AI models
* New tools can be added in the `src/tools/` directory following the established pattern
* Tools support both file operations and system interactions (terminal, web, PDF)

## Change Tracking System

* **Automatic Detection**: All AI file modifications are automatically tracked
* **Visual Diff**: Side-by-side and inline diff viewers
* **Granular Control**: Accept/reject individual changes or bulk operations
* **Smart Merging**: Adjacent changes are merged, distant changes remain separate
* **Backup System**: Automatic backups enable safe rollback of rejected changes

## Extension Capabilities

* **Multi-tool Conversations**: AI can make sequential tool calls to complete complex tasks
* **Workspace Integration**: Deep integration with VS Code workspace and file system
* **Real-time Updates**: Live change tracking and UI updates during AI operations
* **Error Handling**: Comprehensive error handling with user-friendly messages
* **Performance Optimized**: Efficient handling of large files and many changes
