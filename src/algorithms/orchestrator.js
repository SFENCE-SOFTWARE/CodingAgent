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
    
    // Step 1: Get LLM languages from algorithm variables or use default
    const llmLanguagesConfig = context.getVariable('llmLanguages');
    const llmLanguages = llmLanguagesConfig ? llmLanguagesConfig.split(',').map(lang => lang.trim()) : ['English'];
    const targetLanguage = llmLanguages[0]; // Default to first supported language
    
    let workingMessage = message;
    let detectedLanguage = 'unknown';
    
    try {
        // Ask LLM to detect language
        const languagePrompt = `Detect the language of user message and respond with just english language name (English, Czech, etc.).\nUser message:\n"${message}"`;
        detectedLanguage = await context.sendToLLM(languagePrompt);
        detectedLanguage = detectedLanguage.trim().toLowerCase();
        
        context.console.info(`Detected language: ${detectedLanguage}`);
        
        // If detected language is not in supported LLM languages, translate
        if (!llmLanguages.includes(detectedLanguage)) {
            context.console.info(`Language ${detectedLanguage} not in LLM languages, translating to ${targetLanguage}`);
            const translatePrompt = `Translate user request to ${targetLanguage}, keep the same meaning and intent. Respond only with translated text, do not add aditional information.\nUser request:\n"${message}"`;
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
            context.console.info('Plan creation request detected - calling Architect mode');
            
            // Send notice about mode switch
            context.sendNotice('🏗️ **Switching to Architect mode for plan creation...**');
            
            // Create plan using Architect mode
            const architectPrompt = `Create a plan for the user's request and summarize the output in two sentences, explaining what you did and how, without listing individual points.\n\nUser's request: "${workingMessage}"`;

            try {
                const architectResponse = await context.sendToLLM(architectPrompt, 'Architect');
                
                // Send notice about switching back
                context.sendNotice('🔄 **Switching back to Orchestrator mode...**');
                
                context.sendResponse(architectResponse);
                
                // After creating plan, continue with plan execution cycle
                // Note: The Architect mode should have created a plan and set it as current
                await executePlanCycle(context);
                
                return 'Plan created and execution cycle initiated';
            } catch (error) {
                context.console.error('Plan creation failed:', error.message);
                context.sendResponse('Plan creation failed. Please try again.');
                return 'Plan creation failed';
            }
            
        } else if (categoryTrimmed.startsWith('OPEN ')) {
            // Extract plan ID from original category (preserving case)
            const originalCategoryTrimmed = category.trim();
            const planId = originalCategoryTrimmed.substring(5).trim();
            context.console.info(`Plan opening request detected for plan: ${planId}`);
            
            if (context.planningService && context.planContextManager) {
                const planResult = context.planningService.showPlan(planId);
                if (planResult.success && planResult.plan) {
                    // Set the plan as current in context manager
                    context.planContextManager.setCurrentPlanId(planId);
                    
                    context.sendResponse(`Successfully loaded plan "${planId}": ${planResult.plan.name}\n\nDescription: ${planResult.plan.shortDescription}\n\nPlan is now active.`);
                    
                    // After opening plan, continue with plan execution cycle
                    await executePlanCycle(context);
                    
                    return `Plan "${planId}" loaded and execution cycle initiated`;
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

/**
 * Executes plan evaluation cycle until plan is complete or interrupted
 * @param {object} context - Algorithm context
 */
async function executePlanCycle(context) {
    context.console.info('Starting plan execution cycle...');
    
    // Debug counter to limit iterations during development
    let iterationCount = 0;
    const maxIterations = 2; // Limit for debugging purposes
    
    context.sendNotice('🔄 **Starting plan execution cycle...**');
    
    try {
        while (iterationCount < maxIterations) {
            iterationCount++;
            context.console.info(`Plan cycle iteration ${iterationCount}/${maxIterations}`);
            
            // Get current plan ID from context manager
            if (!context.planContextManager) {
                context.console.error('Plan context manager not available');
                context.sendNotice('❌ **Plan context manager not available - stopping cycle**');
                break;
            }
            
            const currentPlanId = context.planContextManager.getCurrentPlanId();
            if (!currentPlanId) {
                context.console.error('No current plan set in context manager');
                context.sendNotice('❌ **No active plan found - stopping cycle**');
                break;
            }
            
            context.console.info(`Working with plan: ${currentPlanId}`);
            
            if (!context.planningService) {
                context.console.error('Planning service not available in plan cycle');
                context.sendNotice('❌ **Planning service not available - stopping cycle**');
                break;
            }
            
            // Evaluate current plan state
            const evaluationResult = context.planningService.evaluatePlanCompletion(currentPlanId);
            
            if (!evaluationResult.success) {
                context.console.error(`Plan evaluation failed: ${evaluationResult.error}`);
                context.sendNotice(`❌ **Plan evaluation failed: ${evaluationResult.error}**`);
                break;
            }
            
            const evaluation = evaluationResult.result;
            
            context.console.info(`Plan evaluation - isDone: ${evaluation.isDone}, failedStep: ${evaluation.failedStep || 'none'}`);
            
            if (evaluation.isDone) {
                context.console.info('Plan is complete!');
                context.sendNotice('✅ **Plan execution completed successfully!**');
                context.sendResponse(`Plan execution completed. All tasks have been finished and the plan is ready.`);
                break;
            }
            
            // Plan is not done, we have a next action to take
            context.console.info(`Next action needed: ${evaluation.failedStep}`);
            context.console.info(`Action description: ${evaluation.nextStepPrompt}`);
            context.console.info(`Reason: ${evaluation.reason}`);
            
            // For debugging, just log what we would do without calling LLM
            const actionMessage = `**Iteration ${iterationCount}**: ${evaluation.failedStep} needed\n` +
                                `**Plan**: ${currentPlanId}\n` +
                                `**Points**: ${evaluation.failedPoints ? evaluation.failedPoints.join(', ') : 'N/A'}\n` +
                                `**Action**: ${evaluation.nextStepPrompt}\n` +
                                `**Reason**: ${evaluation.reason}`;
            
            context.sendNotice(`🔧 ${actionMessage}`);
            
            // TODO: In next iteration, here we would call appropriate LLM mode based on failedStep
            // For now, just simulate some work with a short delay
            context.console.info('Simulating work... (LLM calls not implemented yet)');
            
            // Add a small delay to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (iterationCount >= maxIterations) {
            context.console.warn(`Plan cycle stopped after ${maxIterations} iterations (debug limit)`);
            context.sendNotice(`⏹️ **Plan cycle stopped after ${maxIterations} iterations (debug limit reached)**`);
        }
        
    } catch (error) {
        context.console.error('Plan execution cycle failed:', error.message);
        context.sendNotice(`❌ **Plan execution cycle failed: ${error.message}**`);
    }
    
    context.console.info('Plan execution cycle ended');
}
