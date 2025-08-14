# Fix for Missing Tool Call Responses in Raw JSON Logging

## Problem Identified
The raw JSON logging was incomplete for conversations involving tool calls. When the AI made tool calls:

1. ✅ **Initial request/response** was logged (AI decides to call tools)
2. ❌ **Follow-up request/response** was NOT logged (AI processes tool results and provides final answer)

This meant the logs showed the AI making tool calls but never showed the follow-up communication where the AI received tool results and provided the final response.

## Root Cause
In the `ChatService.handleToolCalls()` method, there was a follow-up request made to Ollama after tool execution (lines 202-208), but this follow-up communication was not being logged by either the standard logging or the raw JSON logging system.

## Fix Applied

### 1. Added Follow-up Request Logging
Updated `ChatService.handleToolCalls()` to include logging for the follow-up request:

```typescript
// Log the follow-up communication (standard logging)
this.logging.logAiCommunication(followUpRequest, followUpResponse, {
  model: this.ollama.getCurrentModel(),
  mode: this.ollama.getCurrentMode(),
  timestamp: followUpStartTime,
  duration: followUpEndTime - followUpStartTime,
  context: 'tool-follow-up'
});

// Log raw JSON for follow-up if log mode is enabled
this.logging.logRawJsonCommunication(followUpRequest, followUpResponse, {
  model: this.ollama.getCurrentModel(),
  mode: this.ollama.getCurrentMode(),
  timestamp: followUpStartTime,
  duration: followUpEndTime - followUpStartTime,
  context: 'tool-follow-up'
});
```

### 2. Added Context Information
Enhanced both logging methods to include a `context` parameter that identifies the type of request:
- `'initial'` - The first request where AI may decide to call tools
- `'tool-follow-up'` - The follow-up request after tools are executed

### 3. Error Logging for Follow-ups
Also added logging for errors that occur during follow-up requests.

## Expected Result
Now when tool calls occur, the raw JSON log will contain:

1. **Initial Request/Response**: Shows the original user message and AI's decision to call tools
2. **Follow-up Request/Response**: Shows the conversation with tool results and AI's final response

Each entry will be clearly marked with its context (INITIAL or TOOL-FOLLOW-UP) for easy identification.

## Example Log Structure
```
CONTEXT: INITIAL
REQUEST: Original user message
RESPONSE: AI decides to call list_files tool

CONTEXT: TOOL-FOLLOW-UP  
REQUEST: Previous conversation + tool results
RESPONSE: AI's final answer based on tool results
```

This provides complete visibility into the entire conversation flow when tools are involved.
