/**
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
    
    // First step: Detect language of the user request
    const languageDetectionPrompt = `User send a message. Read it and answer only with language name, he used.\n\nUser message: \n${message}`;
    
    context.sendToLLM(languageDetectionPrompt, function(llmResponse) {
        const detectedLanguage = llmResponse.trim();
        context.console.info(`Detected language: ${detectedLanguage}`);
        
        // Create comprehensive response showing both prompt and result
        const fullResponse = `**Orchestrator Analysis**

**Sent to LLM (using orchestrationMessage):**
\`\`\`
${languageDetectionPrompt}
\`\`\`

**LLM Response:**
${detectedLanguage}

**Result:** Detected language is **${detectedLanguage}**`;
        
        // Send comprehensive response back to chat
        context.sendResponse(fullResponse);
        
        // Store the detected language for future use
        context.setVariable('last_detected_language', detectedLanguage);
        context.setVariable('last_user_message', message);
    });
    
    // Don't return anything when using sendResponse to avoid duplication
    return;
}
