# CodingAgent - VS Code Extension

A powerful AI coding assistant extension for Visual Studio Code that integrates with OpenAI-compatible backends to provide GitHub Copilot Chat-like functionality with advanced tool capabilities.

## Introduction

This extension was created with the assistance of Claude Sonnet 4 via GitHub Copilot Chat (free premium account) and tested with a locally hosted `gpt-oss:20b` model. I asked Claude Sonnet 4 to develop it because I could not find any LLM coding agent that supports native tool calls via JSON, meaning none were able to work with `gpt-oss:20b` in a truly useful way.

## Features

🤖 **AI-Powered Assistance**: Chat with AI models through OpenAI-compatible backends for coding help, questions, and architecture guidance

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
- Configurable backend host and port
- Multiple agent modes with custom tools
- Model selection from available models
- Custom system messages per mode

## Requirements

- Visual Studio Code 1.103.0 or higher
- OpenAI-compatible AI backend (Ollama, llama.cpp, vLLM, LocalAI, Tabby, or custom)
- At least one language model available on your backend

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

1. **Set up your AI backend**: Choose and configure one of the supported backends:
   - **Ollama**: Download from [ollama.ai](https://ollama.ai/), pull a model (`ollama pull llama3`), and start (`ollama serve`)
   - **llama.cpp**: Use with `--api-key-required false` and `--host 0.0.0.0 --port 8080`
   - **vLLM**: Start with `--api-key-required false` and OpenAI-compatible endpoint
   - **LocalAI**: Configure with OpenAI-compatible settings
   - **Tabby**: Use coding-focused models
   - **Custom**: Any OpenAI API-compatible service

2. **Configure the extension**:
   - Open VS Code settings
   - Search for "CodingAgent"  
   - Set the backend host and port (default: localhost:11434)
   - Optionally set an API key for authenticated servers (leave empty for local models)

## Usage

### Opening the Chat

- **Activity Bar**: Click the CodingAgent icon in the left activity bar (similar to Explorer, Extensions, etc.)
- **Command Palette**: Use "CodingAgent: Open Chat" command
- **Status Bar**: Click the status bar item showing current mode and model

### Agent Modes

**🛠️ Coder Mode**: Best for programming tasks
- Available tools: read_file, write_file, modify_lines, patch_file, list_files, get_file_size, execute_terminal, create_folder, rename_file
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
Assistant: [Uses execute_terminal tool - commands run in VS Code terminal where you can see output and interact]

You: Start the development server
Assistant: [Uses execute_terminal tool - opens VS Code terminal and runs "npm run dev"]

You: Show me the git status
Assistant: [Uses execute_terminal tool - runs "git status" in VS Code terminal]
```

## Configuration

Access settings via VS Code Settings (Ctrl/Cmd + ,) and search for "CodingAgent":

### Basic Settings

- **Host**: AI backend server host (default: localhost)
- **Port**: AI backend server port (default: 11434)
- **API Key**: OpenAI API key (optional, leave empty for local models)
- **Current Mode**: Active agent mode (Coder, Ask, Architect)
- **Current Model**: Active model name
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
| `modify_lines` | Universal line modification: insert, delete, or replace lines | `path`, `operation`, `content`, `line_number`, `line_numbers`, `start_line`, `end_line`, `containing_text`, `exact_text`, `after_text`, `before_text` |
| `patch_file` | Apply text patches to files | `path`, `old_text`, `new_text` |
| `get_file_size` | Get file size in lines and bytes | `path` |
| `create_folder` | Create directories recursively | `path` |
| `rename_file` | Rename or move files and folders | `old_path`, `new_path` |
| `execute_terminal` | Run terminal commands in VS Code terminal (visible to user, interactive) | `command`, `cwd`, `newTerminal` |
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
- Ensure your AI backend is running
- Check host/port configuration
- Verify network connectivity

**❌ "No response from model"**
- Try a different model
- Check backend logs for errors
- Restart backend service

**❌ "Tool execution failed"**
- Check file permissions
- Verify file paths are correct
- Review terminal command syntax

### Debug Information

Enable debug mode by expanding the "Debug Info" section in error messages to see:
- Full request payload sent to the AI backend
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
