# Log Mode Feature Implementation

## Overview
Added a new log mode feature that logs raw JSON objects sent and received in communication with Ollama, separate from the existing structured logging system.

## Changes Made

### 1. LoggingService (`src/loggingService.ts`)
- Added `logMode` and `logModeFilePath` properties
- Added `logRawJsonCommunication()` method for raw JSON logging
- Added `formatRawJsonLogEntry()` method for raw JSON format
- Added `appendToLogModeFile()` method for writing to log mode file
- Added `getDefaultLogModePath()` method for default log mode file path
- Added getter methods: `getLogModeFilePath()` and `isLogModeEnabled()`

### 2. ChatService (`src/chatService.ts`)
- Updated `processMessage()` to call both standard and raw JSON logging
- Raw JSON logging captures the complete request/response objects
- Error cases also logged to raw JSON log when log mode is enabled

### 3. Settings Panel Backend (`src/settingsPanel.ts`)
- Added log mode configuration handling in `_sendConfiguration()`
- Added log mode settings in reset functionality
- Added `_selectLogModeFile()` method for file browser
- Updated configuration message handling

### 4. Settings Panel Frontend (`media/settings.js`)
- Added DOM elements for log mode controls
- Added event handlers for log mode controls
- Updated configuration save/load to include log mode settings
- Added `selectLogModeFile()` function and message handling

### 5. Settings Panel HTML (`src/settingsPanel.ts` - HTML template)
- Added log mode checkbox with description
- Added log mode file path input with browse button
- Added form hint styling

### 6. Settings Panel CSS (`media/settings.css`)
- Added `.form-hint` class for styling hint text

### 7. Extension Configuration (`package.json`)
- Added `codingagent.logging.logMode` boolean setting
- Added `codingagent.logging.logModeFilePath` string setting

## Configuration Options

### New Settings
- **Log Mode**: `codingagent.logging.logMode` (boolean, default: false)
  - Enables raw JSON logging mode for Ollama communication
  
- **Log Mode File Path**: `codingagent.logging.logModeFilePath` (string, default: "")
  - Path to raw JSON log file (empty = workspace/.codingagent/logs/ollama-raw-json.log)

## Default File Locations
- **Standard logs**: `workspace/.codingagent/logs/ai-communication.log`
- **Raw JSON logs**: `workspace/.codingagent/logs/ollama-raw-json.log`

## Log Format
The raw JSON log mode creates entries with:
- Timestamp and metadata (model, mode, duration)
- Complete raw JSON request object
- Complete raw JSON response object
- Error information if applicable

## Usage
1. Open CodingAgent Settings Panel
2. Navigate to the Logging section
3. Enable "Enable raw JSON logging mode"
4. Optionally specify a custom file path, or leave empty for default
5. Save settings

The raw JSON logs will capture all communication with Ollama in pure JSON format, making it useful for debugging, analysis, and understanding the exact data exchange between the extension and Ollama.

## Privacy Note
Both standard and raw JSON logging can include sensitive information from prompts and responses. Users should be aware of this when enabling logging features.
