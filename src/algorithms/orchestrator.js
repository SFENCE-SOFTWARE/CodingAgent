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
 * - context.sendToLLM(message, mode) - send to LLM and get response (Promise-based)
 * - context.getConfig(key) - get stored config (read-only)
 * - context.planningService - planning service integration (if available)
 * - context.planContextManager - plan context management
 * - context.tools - tools execution (if available)
 * - context.getAvailableModes() - get available modes for delegation
 * - context.getVariable(key) - get algorithm variables for current mode
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
        const categorizationPrompt = `Analyze this user request and categorize it. You must respond with exactly one of these formats:

**OPEN <existing_plan_id>** — Use this if the request can be fulfilled by opening and continuing work on an existing plan. Replace <existing_plan_id> with the actual ID of an existing plan that matches the request. Only use plan IDs that exist in the system.

**NEW <new_plan_id>** — Use this if the user's request requires creating a new plan. Replace <new_plan_id> with a short, descriptive plan ID (lowercase, use dashes, max 30 chars, must NOT conflict with existing plan IDs). Generate the ID based on the request content.

**QUESTION** — Use this for any other type of request, such as questions, general help, or anything unrelated to creating or opening a plan.

Rules:
- Always use plan_list tool to show existing plans.
- For OPEN: The existing_plan_id MUST be from the existing plans list below
- For NEW: The new_plan_id MUST be unique (not in the existing plans list) and descriptive
- If both OPEN and NEW are possible, prefer OPEN for existing plans

User request: "${workingMessage}"`;
        
        const category = await context.sendToLLM(categorizationPrompt);
        const categoryTrimmed = category.trim().toUpperCase();
        
        context.console.info(`Request categorized as: ${categoryTrimmed}`);
        
        // Handle different categories
        if (categoryTrimmed.startsWith('NEW ')) {
            // Extract plan ID from the response
            const planId = categoryTrimmed.substring(4).trim().toLowerCase();
            context.console.info(`Plan creation request detected with plan_id: ${planId}`);
            
            // Create the plan using orchestrator algorithm with language information
            if (context.planningService) {
                const createResult = context.planningService.createPlanWithLanguageInfo(
                    planId,
                    'New Plan',  // Will be updated by architect
                    workingMessage,  // Use working message (translated if needed) as short description
                    `Plan created from user request.`, // Clean long description
                    detectedLanguage,
                    message, // Original request
                    workingMessage !== message ? workingMessage : undefined // Translated request (only if different)
                );
                
                if (createResult.success) {
                    // Set the plan as current
                    if (context.planContextManager) {
                        context.planContextManager.setCurrentPlanId(planId);
                    }
                    
                    context.console.info(`Plan ${planId} created successfully`);
                    
                    // Set the plan as current
                    if (context.planContextManager) {
                        context.planContextManager.setCurrentPlanId(planId);
                    }
                    
                    context.sendNotice(`🏗️ **Plan '${planId}' created successfully**`);
                    context.sendResponse(`Plan '${planId}' created and ready for development. Starting execution cycle...`);
                    
                    // Start plan execution cycle - this will handle all workflow steps automatically
                    await executePlanCycle(context, workingMessage);
                    
                    return 'Plan created and execution cycle initiated';
                } else {
                    context.sendResponse(`Failed to create plan: ${createResult.error}`);
                    return `Plan creation failed: ${createResult.error}`;
                }
            } else {
                context.sendResponse('Plan creation requested but planning service is not available.');
                return 'Planning service not available';
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
                    await executePlanCycle(context, workingMessage);
                    
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
            // QUESTION or anything else - forward to current mode instead of LLM
            context.console.info('General question detected, forwarding to current mode');
            const response = await context.sendToLLM(message);
            context.sendResponse(response);
            return 'General question handled by current mode';
        }
        
    } catch (error) {
        context.console.error('Request categorization failed:', error.message);
        // Rethrow error to allow proper interruption handling
        throw error;
    }
}

/**
 * Executes plan evaluation cycle until plan is complete or interrupted
 * @param {object} context - Algorithm context
 * @param {string} workingMessage - The processed user message (translated if needed)
 */
async function executePlanCycle(context, workingMessage) {
    context.console.info('Starting plan execution cycle...');
    
    // Debug counter to limit iterations during development
    let iterationCount = 0;
    const maxIterations = -1; // Increased for testing LLM delegation, use -1 to disable

    context.sendNotice('🔄 **Starting plan execution cycle...**');
    
    while (iterationCount < maxIterations || maxIterations === -1) {
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
        
        // Evaluate current plan state using centralized planEvaluate method
        context.console.info('Evaluating plan using centralized planEvaluate method');
        const evaluationResult = context.planningService.planEvaluate(currentPlanId, workingMessage);
        
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
        
        // Step 1: Check if we have a recommended mode from plan evaluation
        let selectedMode = evaluation.recommendedMode && evaluation.recommendedMode.trim();
        let trimmedMode = selectedMode;
        
        if (selectedMode) {
            context.console.info(`Using recommended mode from plan evaluation: ${selectedMode}`);
        } else {
            // Step 1: Ask LLM to select appropriate mode for this action
            context.console.info('No recommended mode provided, asking LLM to select mode for action...');
            
            const availableModes = context.getAvailableModes();
            if (!availableModes || availableModes.trim().length === 0) {
                context.console.warn('No available modes found, skipping LLM delegation');
                context.sendNotice(`⚠️ **No available modes found for delegation**`);
                break;
            }
            
            const modeSelectionPrompt = `You need to select the most appropriate mode to handle this plan action.

Available modes:
${availableModes}

Action to handle: ${evaluation.failedStep}
Action description: ${evaluation.nextStepPrompt}
Reason: ${evaluation.reason}

Respond with ONLY the mode name (e.g., "Coder" or "Reviewer"), nothing else.`;
            
            selectedMode = await context.sendToLLM(modeSelectionPrompt);
            trimmedMode = selectedMode.trim();
            context.console.info(`LLM selected mode: ${trimmedMode}`);
        }
        
        // Step 2: Use prompt directly from planEvaluate method
        context.console.info('Step 2: Using prompt directly from planEvaluate method...');
        const promptFromPlanEvaluate = evaluation.nextStepPrompt;
        context.console.info(`Using planEvaluate prompt for ${trimmedMode}: ${promptFromPlanEvaluate.substring(0, 100)}...`);
        
        // Step 3: Send the planEvaluate prompt directly to the selected mode
        context.console.info(`Step 3: Delegating to ${trimmedMode} mode with planEvaluate prompt...`);
        context.sendNotice(`🎯 **Delegating to ${trimmedMode} mode**: ${evaluation.failedStep}`);
        
        const delegatedResponse = await context.sendToLLM(promptFromPlanEvaluate, trimmedMode);
        context.console.info(`${trimmedMode} mode completed task`);
        context.sendNotice(`✅ **${trimmedMode} mode completed**: ${delegatedResponse.substring(0, 200)}...`);
        
        // Step 4: If there's a done callback, check with LLM if the change was successful
        if (evaluation.doneCallback && typeof evaluation.doneCallback === 'function') {
            context.console.info('Step 4: Checking if change was successful for callback execution...');
            
            const successCheckPrompt = `Based on the response from ${trimmedMode} mode, was the requested change successful? 
            
Original task: ${evaluation.failedStep}
Task description: ${evaluation.nextStepPrompt}
Reason: ${evaluation.reason}
Mode response: ${delegatedResponse}

Respond with ONLY "YES" if the change was successful and complete, or "NO" if it failed or was not completed.`;
            
            const successResponse = await context.sendToLLM(successCheckPrompt);
            const wasSuccessful = successResponse.trim().toUpperCase() === 'YES';
            
            if (wasSuccessful) {
                context.console.info('LLM confirmed change was successful, executing done callback...');
                // Provide feedback to the callback: success flag and the mode response for context
                try {
                    evaluation.doneCallback(true, delegatedResponse);
                    context.sendNotice(`✅ **Change confirmed successful, callback executed**`);
                } catch (cbError) {
                    context.console.error('Error executing doneCallback:', cbError && cbError.message ? cbError.message : cbError);
                    context.sendNotice(`⚠️ **Callback execution failed: ${cbError && cbError.message ? cbError.message : String(cbError)}**`);
                }
            } else {
                context.console.info('LLM confirmed change was not successful, skipping callback');
                // Inform callback that change did not succeed (callback implementations may decide what to do)
                try {
                    evaluation.doneCallback(false, delegatedResponse);
                } catch (cbError) {
                    context.console.error('Error executing doneCallback (failure path):', cbError && cbError.message ? cbError.message : cbError);
                }
                context.sendNotice(`⚠️ **Change not confirmed successful, callback not executed**`);
            }
        }
        
        // Add a delay before next iteration
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (iterationCount >= maxIterations) {
        context.console.warn(`Plan cycle stopped after ${maxIterations} iterations (debug limit)`);
        context.sendNotice(`⏹️ **Plan cycle stopped after ${maxIterations} iterations (debug limit reached)**`);
    }
    
    context.console.info('Plan execution cycle ended');
}
