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
 * - context.sendToLLM(message) - send to LLM and get response (Promise-based)
 * - context.getConfig(key) - get stored config (read-only)
 * - context.planningService - planning service integration (if available)
 */

async function handleUserMessage(message, context) {
    context.console.log('Orchestrator algorithm processing message:', message);
    
    // Step 1: Detect language and translate if needed
    const llmLanguages = ['en', 'cs', 'sk'];
    const targetLanguage = llmLanguages[0]; // Default to first supported language
    
    let workingMessage = message;
    let detectedLanguage = 'unknown';
    
    try {
        // Ask LLM to detect language
        const languagePrompt = `Detect the language of this message and respond with just the two-letter language code (en, cs, sk, de, fr, etc.): "${message}"`;
        detectedLanguage = await context.sendToLLM(languagePrompt);
        detectedLanguage = detectedLanguage.trim().toLowerCase();
        
        context.console.info(`Detected language: ${detectedLanguage}`);
        
        // If detected language is not in supported LLM languages, translate
        if (!llmLanguages.includes(detectedLanguage)) {
            context.console.info(`Language ${detectedLanguage} not in LLM languages, translating to ${targetLanguage}`);
            const translatePrompt = `Translate this message to ${targetLanguage}, keep the same meaning and intent: "${message}"`;
            workingMessage = await context.sendToLLM(translatePrompt);
            context.console.info(`Translated message: ${workingMessage}`);
        }
        
    } catch (error) {
        context.console.error('Language detection/translation failed:', error.message);
        // Continue with original message
    }
    
    // Step 2: Categorize the request
    try {
        const categorizationPrompt = `Analyze this user request and categorize it. Respond with exactly one of these options:
- NEW (if user wants to create a new plan)
- OPEN <plan_id> (if user wants to open/work with an existing plan, replace <plan_id> with the actual plan ID mentioned)
- QUESTION (for any other type of request - questions, general help, etc.)

User request: "${workingMessage}"`;
        
        const category = await context.sendToLLM(categorizationPrompt);
        const categoryTrimmed = category.trim().toUpperCase();
        
        context.console.info(`Request categorized as: ${categoryTrimmed}`);
        
        // Handle different categories
        if (categoryTrimmed === 'NEW') {
            context.console.info('Plan creation request detected - logic will be added later');
            context.sendResponse('Plan creation request detected. Implementation pending.');
            return 'Plan creation workflow initiated';
            
        } else if (categoryTrimmed.startsWith('OPEN ')) {
            const planId = categoryTrimmed.substring(5).trim();
            context.console.info(`Plan opening request detected for plan: ${planId}`);
            
            if (context.planningService) {
                const planResult = context.planningService.showPlan(planId);
                if (planResult.success && planResult.plan) {
                    context.sendResponse(`Successfully loaded plan "${planId}": ${planResult.plan.name}\n\nDescription: ${planResult.plan.shortDescription}\n\nPlan is now active.`);
                    return `Plan "${planId}" loaded successfully`;
                } else {
                    context.sendResponse(`Failed to load plan "${planId}": ${planResult.error || 'Plan not found'}`);
                    return `Plan loading failed: ${planResult.error}`;
                }
            } else {
                context.sendResponse(`Plan opening requested for "${planId}" but planning service is not available.`);
                return 'Planning service not available';
            }
            
        } else {
            // QUESTION or anything else - forward to LLM directly
            context.console.info('General question detected, forwarding to LLM');
            const llmResponse = await context.sendToLLM(message); // Use working message
            context.sendResponse(llmResponse);
            return 'General question handled by LLM';
        }
        
    } catch (error) {
        context.console.error('Request categorization failed:', error.message);
        // Fallback to direct LLM
        const llmResponse = await context.sendToLLM(message);
        context.sendResponse(llmResponse);
        return 'Fallback to direct LLM due to categorization error';
    }
}
