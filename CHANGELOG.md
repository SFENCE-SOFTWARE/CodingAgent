# Change Log

All notable changes to the "CodingAgent" extension will be documented in this file.

## [0.0.1] - 2025-08-13

### Added
- Initial release of CodingAgent VS Code extension
- Integration with Ollama backend for AI chat functionality
- Three built-in agent modes: Coder, Ask, and Architect
- Comprehensive tool system with 7 available tools:
  - `list_files`: Browse directory structures
  - `read_file`: Read file content with line range support
  - `write_file`: Create and modify files
  - `get_file_size`: Get file statistics
  - `execute_terminal`: Run terminal commands safely
  - `read_webpage`: Fetch web content
  - `read_pdf`: PDF text extraction (placeholder implementation)
- Modern GitHub Copilot Chat-inspired UI with:
  - Real-time markdown rendering
  - Model thinking/reasoning display
  - Expandable debug information
  - Tool call visualization
  - Loading states and error handling
- Configurable settings:
  - Ollama host and port configuration
  - Agent mode selection
  - Model selection from available Ollama models
  - Custom mode configuration support
  - Show/hide model thinking toggle
- Status bar integration showing current mode and model
- Command palette integration
- Welcome experience for first-time users
- Comprehensive error handling and user feedback

### Features
- **Multi-Modal AI Assistance**: Switch between specialized agent modes for different tasks
- **Tool-Enhanced Conversations**: AI can perform actions like reading files, running commands
- **Flexible Configuration**: Adapt the assistant to your workflow and preferences
- **Professional UI**: Clean, accessible interface matching VS Code design language
- **Security-Focused**: Safe execution of terminal commands with proper error handling

### Technical Details
- TypeScript implementation with modern async/await patterns
- Minimal external dependencies (native Node.js and VS Code APIs)
- Comprehensive type safety with custom interfaces
- Modular architecture for easy extension and maintenance
- WebView-based chat interface with CSP compliance
- Configuration-driven agent behavior

### Requirements
- VS Code 1.103.0 or higher
- Ollama installed and running
- At least one compatible language model (e.g., llama3, mistral, codellama)

## [Unreleased]

### Planned Features
- PDF reading implementation with actual PDF parsing library
- File watching and real-time updates
- Conversation export/import functionality
- Custom tool development API
- Multi-workspace support
- Enhanced code syntax highlighting in chat
- Voice input support
- Integration with VS Code themes
- Performance optimizations for large file operations
- Advanced search within conversation historyLog

All notable changes to the "CoddingAgent" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release