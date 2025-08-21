# Change Log

All notable changes to the "CodingAgent" extension will be documented in this file.

## [0.0.3] - 2025-08-17

### Changed
- **Tool Consolidation**: Merged `insert_lines`, `delete_lines`, and `replace_lines` into unified `modify_lines` tool
  - Single tool with `operation` parameter: "insert", "delete", or "replace"
  - Simplified API with all line modification capabilities
  - Reduced tool count and improved consistency
  - Comprehensive test coverage for all operations

## [0.0.2] - 2025-08-17

### Added
- **Advanced Change Tracking System**: Real-time tracking of file modifications with Accept/Reject functionality
  - Visual inline decorations showing added, modified, and deleted lines
  - Code lens integration for quick change acceptance/rejection
  - Intelligent change merging for overlapping modifications
  - Non-adjacent changes maintained as separate trackable changes
  - Backup system with automatic restoration on rejection
  - Persistence across VS Code sessions
- **New File Manipulation Tools**:
  - `modify_lines`: Universal line modification tool (insert/delete/replace operations)
  - `patch_file`: Apply text patches to files
- **Enhanced Tool System**:
  - All file modification tools now integrate with change tracking
  - Smart detection of overlapping vs. non-adjacent changes
  - Improved error handling and validation
- **UI Improvements**:
  - Status bar indicators for pending changes
  - Enhanced debugging and logging capabilities
  - Better tool call visualization

### Changed
- **Tool Architecture**: All file modification tools now inherit from `ChangeAwareBaseTool`
- **Change Management**: Overlapping/adjacent changes merge automatically, distant changes remain separate
- **User Experience**: File modifications now provide immediate visual feedback

### Fixed
- Various stability improvements in tool execution
- Better handling of edge cases in file operations
- Improved error messages and user feedback

### Technical Details
- Implemented LCS (Longest Common Subsequence) algorithm for accurate diff generation
- BackupManager for safe file operation rollbacks
- Comprehensive test suite with 124+ passing tests
- TypeScript interfaces for all change tracking components

## [0.0.1] - 2025-08-13

### Added
- Initial release of CodingAgent VS Code extension
- Integration with OpenAI-compatible backends for AI chat functionality
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
- Advanced search within conversation history