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
 * - context.sendToLLM(message) - send to LLM and get response (returns Promise)
 * - context.getConfig(key) - get configuration value
 * - context.setConfig(key, value) - set configuration value (RAM only)
 */

async function handleUserMessage(message, context) {
    context.console.log('Orchestrator algorithm processing message:', message);
    
    // Initialize default configuration if not set
    let llmLanguages = context.getConfig('llm_languages');
    if (!llmLanguages) {
        llmLanguages = ['English']; // Default to English
        context.setConfig('llm_languages', llmLanguages);
        context.console.info('Initialized LLM languages:', llmLanguages);
    }
    
    try {
        // First step: Detect language of the user request
        const languageDetectionPrompt = `User send a message. Read it and answer only with language name, he used.\n\nUser message: \n${message}`;
        
        const llmResponse = await context.sendToLLM(languageDetectionPrompt);
        const detectedLanguage = llmResponse.trim();
        context.console.info(`Detected language: ${detectedLanguage}`);
        
        // Check if detected language is in LLM languages list
        if (llmLanguages.includes(detectedLanguage)) {
            // Language is supported, no translation needed
            context.console.info(`Language ${detectedLanguage} is supported, proceeding without translation`);
            context.sendResponse(`Language detected: **${detectedLanguage}** (supported)`);
        } else {
            // Language not supported, translate to first LLM language
            const targetLanguage = llmLanguages[0];
            context.console.info(`Language ${detectedLanguage} not supported, translating to ${targetLanguage}`);
            
            const translationPrompt = `Translate the following message from ${detectedLanguage} to ${targetLanguage}. Provide only the translation, no additional text.\n\nMessage to translate:\n${message}`;
            
            const translatedMessage = await context.sendToLLM(translationPrompt);
            const translation = translatedMessage.trim();
            context.console.info(`Translation completed: ${message.substring(0, 50)}... -> ${translation.substring(0, 50)}...`);
            
            context.sendResponse(`Language detected: **${detectedLanguage}** -> translated to **${targetLanguage}**\n\nTranslated message: ${translation}`);
        }
    } catch (error) {
        context.console.error('Error in orchestrator algorithm:', error);
        context.sendResponse(`Error: ${error.message || error}`);
    }
}
