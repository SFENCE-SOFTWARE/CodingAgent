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
    const maxIterations = 2; // Increased for testing LLM delegation
    
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
            
            // Step 1: Ask LLM to select appropriate mode for this action
            context.console.info('Step 1: Asking LLM to select mode for action...');
            
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
            
            let selectedMode;
            try {
                selectedMode = await context.sendToLLM(modeSelectionPrompt);
                selectedMode = selectedMode.trim();
                context.console.info(`LLM selected mode: ${selectedMode}`);
            } catch (error) {
                context.console.error('Mode selection failed:', error.message);
                context.sendNotice(`❌ **Mode selection failed: ${error.message}**`);
                break;
            }
            
            // Step 2: Ask LLM to generate specific prompt for the selected mode
            context.console.info('Step 2: Asking LLM to generate prompt for selected mode...');
            
            const promptGenerationPrompt = `You need to create a specific prompt for the ${selectedMode} mode to handle this plan action.

Current plan ID: ${currentPlanId}
Action type: ${evaluation.failedStep}
Points to work on: ${evaluation.failedPoints ? evaluation.failedPoints.join(', ') : 'N/A'}
Original action description: ${evaluation.nextStepPrompt}
Reason: ${evaluation.reason}

Create a clear, specific prompt that the ${selectedMode} mode can use to complete this task. The prompt should include all necessary context and instructions.

Respond with ONLY the prompt text, no additional explanation or formatting.`;
            
            let generatedPrompt;
            try {
                generatedPrompt = await context.sendToLLM(promptGenerationPrompt);
                generatedPrompt = generatedPrompt.trim();
                context.console.info(`Generated prompt for ${selectedMode}: ${generatedPrompt.substring(0, 100)}...`);
            } catch (error) {
                context.console.error('Prompt generation failed:', error.message);
                context.sendNotice(`❌ **Prompt generation failed: ${error.message}**`);
                break;
            }
            
            // Step 3: Send the generated prompt to the selected mode
            context.console.info(`Step 3: Delegating to ${selectedMode} mode...`);
            context.sendNotice(`🎯 **Delegating to ${selectedMode} mode**: ${evaluation.failedStep}`);
            
            try {
                const delegatedResponse = await context.sendToLLM(generatedPrompt, selectedMode);
                context.console.info(`${selectedMode} mode completed task`);
                context.sendNotice(`✅ **${selectedMode} mode completed**: ${delegatedResponse.substring(0, 200)}...`);
                
                // Step 4: If there's a done callback, check with LLM if the change was successful
                if (evaluation.doneCallback && typeof evaluation.doneCallback === 'function') {
                    context.console.info('Step 4: Checking if change was successful for callback execution...');
                    
                    const successCheckPrompt = `Based on the response from ${selectedMode} mode, was the requested change successful? 
                    
Original task: ${evaluation.failedStep}
Task description: ${evaluation.nextStepPrompt}
Reason: ${evaluation.reason}
Mode response: ${delegatedResponse}

Respond with ONLY "YES" if the change was successful and complete, or "NO" if it failed or was not completed.`;
                    
                    try {
                        const successResponse = await context.sendToLLM(successCheckPrompt);
                        const wasSuccessful = successResponse.trim().toUpperCase() === 'YES';
                        
                        if (wasSuccessful) {
                            context.console.info('LLM confirmed change was successful, executing done callback...');
                            evaluation.doneCallback();
                            context.sendNotice(`✅ **Change confirmed successful, callback executed**`);
                        } else {
                            context.console.info('LLM confirmed change was not successful, skipping callback');
                            context.sendNotice(`⚠️ **Change not confirmed successful, callback not executed**`);
                        }
                    } catch (error) {
                        context.console.error('Success check failed:', error.message);
                        context.sendNotice(`❌ **Success check failed: ${error.message}**`);
                    }
                }
                
            } catch (error) {
                context.console.error(`${selectedMode} mode delegation failed:`, error.message);
                context.sendNotice(`❌ **${selectedMode} mode failed: ${error.message}**`);
                // Continue cycle even if delegation fails
            }
            
            // Add a delay before next iteration
            await new Promise(resolve => setTimeout(resolve, 2000));
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
