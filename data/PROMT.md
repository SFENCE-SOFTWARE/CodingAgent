# VS Code Extension Prompt (LLM‑Friendly)

## Role & Goal
You are an expert TypeScript developer specializing in building **Visual Studio Code extensions**.  
Your task is to design and generate the **full project structure and code** for a VS Code extension similar to GitHub Copilot Chat, but using **Ollama** as the backend.

---

## Core Requirements

### 1. Communication Backend
- Connect to Ollama via **configurable IP and port** (VS Code settings).
- All requests must include a `tools` field in JSON when using agent mode.
- Automatically send the list of **enabled tools** for the current mode with every request.

### 2. Modes
- Built‑in modes: `Coder`, `Ask`, `Architect`.
- Ability to **add new modes** via settings.
- Mode settings should include:  
  - system message  
  - allowed tools  
  - fallback message  

### 3. Tools
- Show files in folder.
- Read file within a selected **range of lines**.
- Get file size in lines.
- Write file tool (file editing).
- Terminal command execution.
- Read webpage content.
- Read PDF file (datasheet) if possible (e.g., using pdf‑to‑text).
- All above tools should be callable by the model in **function‑call/JSON tools** format.

### 4. User Configuration in VS Code
- Set backend **IP** and **port**.
- Select current mode.
- Configure system message per mode.
- Add custom modes.
- Manage fallback message per mode
- Choose allowed tools per mode
- Select available Ollama model from the backend.

### 5. UI & Assets
- Icon path: `media/chat-icon.svg`
- UI similar to GitHub Copilot Chat inside VS Code.
- Model and role selection should be part of UI.
- Show model thinking if enabled in setting
- in the cause of problem show expandable line with request in json format with everything, including tools (typical problem is bad call of tool, call of non existing tool)
- show AI model answer ai markup formated text

---

## Output Specification
- Provide the **full directory structure** of the extension.
- Include all required files (`package.json`, `extension.ts`, supporting scripts, `media/` folder).
- Each source file should be presented in a **separate code block**.
- Code should follow best practices for VS Code extensions (TypeScript, async/await patterns).
- Assume compatibility with the latest stable VS Code API.
- keep `extension.ts` as minimalstic as it takes sence.
- Feel free to edit, rewrite and remove existing files as needed.

---

## Constraints
- Keep external dependencies minimal — prefer native Node.js and VS Code APIs where possible.
- Ensure the extension works offline, except for the Ollama communication.
- Follow standard security practices for executing terminal commands.

---

## Example Tool Call Structure
- Check `json_ollama_log.txt` file to see example of communication if needed

## Deliverable

Return the entire extension in a production‑ready form that can be compiled and run directly in VS Code.