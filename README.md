# CodingAgent - VS Code Extension

A powerful AI coding assistant extension for Visual Studio Code that integrates with Ollama to provide GitHub Copilot Chat-like functionality with advanced tool capabilities.

## Features

🤖 **AI-Powered Assistance**: Chat with AI models through Ollama for coding help, questions, and architecture guidance

🛠️ **Multiple Agent Modes**:
- **Coder**: Expert programming assistant with file manipulation and terminal access
- **Ask**: General Q&A assistant with web content reading capabilities  
- **Architect**: Software architecture consultant with system design focus

⚡ **Powerful Tools**:
- Read and write files with line range selection
- Advanced file manipulation (insert, delete, replace lines)
- List directory contents recursively
- Execute terminal commands safely
- Read webpage content
- Get file size information
- PDF reading capabilities (extensible)

🔄 **Change Tracking**:
- Real-time tracking of file modifications
- Visual inline decorations for changes
- Accept/Reject individual changes
- Smart merging of overlapping changes
- Non-adjacent changes maintained separately
- Automatic backup and restoration
- Persistence across sessions

🎨 **Modern UI**: 
- GitHub Copilot Chat-inspired interface
- Model thinking/reasoning display
- Expandable debug information
- Real-time markdown rendering

⚙️ **Flexible Configuration**:
- Configurable Ollama host and port
- Multiple agent modes with custom tools
- Model selection from available Ollama models
- Custom system messages per mode

## Requirements

- Visual Studio Code 1.103.0 or higher
- [Ollama](https://ollama.ai/) installed and running
- At least one language model pulled in Ollama (e.g., `ollama pull llama3`)

## Installation

1. Install the extension from the VS Code marketplace (when published)
2. Or build from source:
   ```bash
   git clone <repository>
   cd CoddingAgent
   npm install
   npm run compile
   # Install the .vsix file in VS Code
   ```

## Setup

1. **Install Ollama**: Download and install from [ollama.ai](https://ollama.ai/)

2. **Pull a model**: 
   ```bash
   ollama pull llama3
   # or any other compatible model
   ```

3. **Start Ollama**: 
   ```bash
   ollama serve
   ```

4. **Configure the extension** (if needed):
   - Open VS Code settings
   - Search for "CodingAgent"
   - Set the Ollama host and port (default: localhost:11434)

## Usage

### Opening the Chat

- **Activity Bar**: Click the CodingAgent icon in the left activity bar (similar to Explorer, Extensions, etc.)
- **Command Palette**: Use "CodingAgent: Open Chat" command
- **Status Bar**: Click the status bar item showing current mode and model

### Agent Modes

**🛠️ Coder Mode**: Best for programming tasks
- Available tools: read_file, write_file, insert_lines, delete_lines, replace_lines, patch_file, list_files, get_file_size, execute_terminal, create_folder, rename_file
- Use for: Code generation, debugging, file manipulation, project exploration, refactoring

**❓ Ask Mode**: Best for questions and research
- Available tools: read_file, read_webpage
- Use for: Documentation lookup, general questions, web research

**🏗️ Architect Mode**: Best for system design
- Available tools: read_file, list_files, read_webpage, read_pdf
- Use for: Architecture review, system design, technical documentation

### Example Conversations

**File Operations**:
```
You: Can you read the package.json file and tell me what dependencies we have?
Assistant: [Uses read_file tool to read package.json and provides analysis]
```

**Code Generation**:
```
You: Create a TypeScript interface for a user profile with name, email, and avatar
Assistant: [Generates interface and optionally writes to a file using write_file tool]
```

**Project Exploration**:
```
You: Show me the structure of the src directory
Assistant: [Uses list_files tool to show directory structure]
```

**Terminal Commands**:
```
You: Run the tests for this project
Assistant: [Uses execute_terminal tool to run npm test or similar]
```

## Configuration

Access settings via VS Code Settings (Ctrl/Cmd + ,) and search for "CodingAgent":

### Basic Settings

- **Host**: Ollama server host (default: localhost)
- **Port**: Ollama server port (default: 11434)
- **Current Mode**: Active agent mode (Coder, Ask, Architect)
- **Current Model**: Active Ollama model
- **Show Thinking**: Display model reasoning process

### Advanced Configuration

Custom modes can be added via the `codingagent.modes` setting:

```json
{
  "codingagent.modes": {
    "CustomMode": {
      "systemMessage": "Your custom system prompt here",
      "allowedTools": ["read_file", "write_file"],
      "fallbackMessage": "Custom fallback message"
    }
  }
}
```

## Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_files` | List files and directories | `path`, `recursive` |
| `read_file` | Read file content with line ranges | `path`, `start_line`, `end_line`, `max_bytes` |
| `write_file` | Write or append to files | `path`, `content`, `append` |
| `insert_lines` | Insert new lines at specific positions | `path`, `line_number`, `content`, `after_text`, `before_text` |
| `delete_lines` | Delete lines by number, range, or content | `path`, `line_numbers`, `start_line`, `end_line`, `containing_text` |
| `replace_lines` | Replace lines by number, range, or content | `path`, `line_number`, `new_content`, `line_numbers`, `start_line`, `end_line` |
| `patch_file` | Apply text patches to files | `path`, `old_text`, `new_text` |
| `get_file_size` | Get file size in lines and bytes | `path` |
| `create_folder` | Create directories recursively | `path` |
| `rename_file` | Rename or move files and folders | `old_path`, `new_path` |
| `execute_terminal` | Run terminal commands | `command`, `cwd`, `timeout` |
| `read_webpage` | Fetch and read webpage content | `url`, `max_length` |
| `read_pdf` | Extract text from PDF files | `path`, `max_pages` |

## Change Tracking

The extension includes a powerful change tracking system that monitors file modifications:

### Features
- **Visual Indicators**: See added, modified, and deleted lines with color-coded decorations
- **Accept/Reject Changes**: Review and selectively apply or discard modifications
- **Smart Merging**: Overlapping changes are merged automatically
- **Independent Changes**: Non-adjacent changes can be accepted/rejected separately
- **Backup System**: Automatic backups enable safe rollback of rejected changes
- **Persistence**: Changes are preserved across VS Code sessions

### Usage
When the AI modifies files, you'll see:
1. **Inline decorations** highlighting changes in the editor
2. **Code lens actions** for "Accept Change" and "Reject Change"
3. **Status bar indicators** showing pending changes count

### Change Types
- **Adjacent changes** (within 2 lines): Automatically merged into single change
- **Non-adjacent changes**: Maintained as separate, independently manageable changes
- **Overlapping changes**: Intelligently merged while preserving original content

## Troubleshooting

### Common Issues

**❌ "Failed to fetch models"**
- Ensure Ollama is running (`ollama serve`)
- Check host/port configuration
- Verify network connectivity

**❌ "No response from model"**
- Try a different model
- Check Ollama logs for errors
- Restart Ollama service

**❌ "Tool execution failed"**
- Check file permissions
- Verify file paths are correct
- Review terminal command syntax

### Debug Information

Enable debug mode by expanding the "Debug Info" section in error messages to see:
- Full request payload sent to Ollama
- Tool call details and responses
- Model reasoning process

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Source Code License

This project source code is licensed under the MIT License. See [LICENSE.md](./LICENSE.md) for details.

### Media Files License

All media files (icons, images, etc.) in this extension are licensed under the Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0). See [LICENSE.md](./LICENSE.md) for details.

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Check the wiki for detailed guides
- Community: Join discussions in GitHub Discussions

---

**Made with ❤️ for the VS Code community**
