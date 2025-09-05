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
        const categorizationPrompt = `Analyze this user request and categorize it. Respond with exactly one of these options:
- NEW (if user wants to create a new plan)
- OPEN <plan_id> (if user wants to open/work with an existing plan, replace <plan_id> with the actual plan ID mentioned)
- TOOL (if user wants to execute a specific tool or action that can be handled by available tools)
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

            const architectResponse = await context.sendToLLM(architectPrompt, 'Architect');
            
            // Send notice about switching back
            context.sendNotice('🔄 **Switching back to Orchestrator mode...**');
            
            context.sendResponse(architectResponse);
            
            // After creating plan, continue with plan execution cycle
            // Note: The Architect mode should have created a plan and set it as current
            await executePlanCycle(context);
            
            return 'Plan created and execution cycle initiated';
            
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
            
        } else if (categoryTrimmed === 'TOOL') {
            context.console.info('Tool request detected - analyzing for direct tool execution');
            
            // Try to handle with tools directly
            const toolResult = await handleToolRequest(workingMessage, context);
            if (toolResult.handled) {
                return toolResult.result;
            }
            
            // If tool handling didn't work, fall back to current mode
            context.console.info('Tool request not handled directly, forwarding to current mode');
            const response = await context.sendToLLM(message);
            context.sendResponse(response);
            return 'Tool request handled by current mode';
            
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
 * Attempts to handle tool requests directly without LLM delegation
 * @param {string} message - User message
 * @param {object} context - Algorithm context
 * @returns {Promise<{handled: boolean, result?: string}>}
 */
async function handleToolRequest(message, context) {
    if (!context.tools) {
        context.console.warn('Tools service not available');
        return { handled: false };
    }
    
    try {
        // Get available tools
        const availableTools = context.tools.getAvailableTools();
        context.console.info(`Available tools: ${availableTools.join(', ')}`);
        
        // Simple pattern matching for common tool requests
        const lowerMessage = message.toLowerCase();
        
        // File listing
        if (lowerMessage.includes('list') && (lowerMessage.includes('file') || lowerMessage.includes('directory'))) {
            context.console.info('Detected file listing request');
            context.sendNotice('📂 **Listing files...**');
            
            const result = await context.tools.execute('listFiles', { path: '.' });
            if (result.success) {
                context.sendResponse(`Files in current directory:\n\`\`\`\n${result.content}\n\`\`\``);
                return { handled: true, result: 'File listing completed' };
            } else {
                context.sendResponse(`Failed to list files: ${result.error}`);
                return { handled: true, result: 'File listing failed' };
            }
        }
        
        // File reading
        if (lowerMessage.includes('read') && lowerMessage.includes('file')) {
            // Try to extract filename from message
            const words = message.split(/\s+/);
            let filename = null;
            
            for (let i = 0; i < words.length; i++) {
                if (words[i].toLowerCase() === 'file' && i + 1 < words.length) {
                    filename = words[i + 1];
                    break;
                }
                // Look for file extensions
                if (words[i].includes('.') && (words[i].includes('.js') || words[i].includes('.ts') || words[i].includes('.json') || words[i].includes('.md'))) {
                    filename = words[i];
                    break;
                }
            }
            
            if (filename) {
                context.console.info(`Detected file reading request for: ${filename}`);
                context.sendNotice(`📖 **Reading file: ${filename}...**`);
                
                const result = await context.tools.execute('readFile', { filePath: filename });
                if (result.success) {
                    context.sendResponse(`Content of ${filename}:\n\`\`\`\n${result.content}\n\`\`\``);
                    return { handled: true, result: 'File reading completed' };
                } else {
                    context.sendResponse(`Failed to read file ${filename}: ${result.error}`);
                    return { handled: true, result: 'File reading failed' };
                }
            }
        }
        
        // Terminal commands
        if (lowerMessage.includes('run') || lowerMessage.includes('execute') || lowerMessage.includes('terminal')) {
            // Try to extract command
            let command = null;
            
            // Look for common patterns
            if (lowerMessage.includes('npm ')) {
                const npmMatch = message.match(/npm\s+[^\s]+/i);
                if (npmMatch) command = npmMatch[0];
            } else if (lowerMessage.includes('git ')) {
                const gitMatch = message.match(/git\s+[^\s]+(?:\s+[^\s]+)*/i);
                if (gitMatch) command = gitMatch[0];
            } else if (lowerMessage.includes('ls') || lowerMessage.includes('dir')) {
                command = 'ls -la';
            }
            
            if (command) {
                context.console.info(`Detected terminal command request: ${command}`);
                context.sendNotice(`⚡ **Executing command: ${command}...**`);
                
                const result = await context.tools.execute('executeTerminal', { command: command });
                if (result.success) {
                    context.sendResponse(`Command output:\n\`\`\`\n${result.content}\n\`\`\``);
                    return { handled: true, result: 'Terminal command completed' };
                } else {
                    context.sendResponse(`Failed to execute command: ${result.error}`);
                    return { handled: true, result: 'Terminal command failed' };
                }
            }
        }
        
        // If no pattern matched, not handled
        context.console.info('No tool pattern matched for the request');
        return { handled: false };
        
    } catch (error) {
        context.console.error('Tool request handling failed:', error.message);
        return { handled: false };
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
    const maxIterations = -1; // Increased for testing LLM delegation, use -1 for disable
    
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
        
        const selectedMode = await context.sendToLLM(modeSelectionPrompt);
        const trimmedMode = selectedMode.trim();
        context.console.info(`LLM selected mode: ${trimmedMode}`);
        
        // Step 2: Ask LLM to generate specific prompt for the selected mode
        context.console.info('Step 2: Asking LLM to generate prompt for selected mode...');
        
        const promptGenerationPrompt = `You need to create a specific prompt for the ${trimmedMode} mode to handle this plan action.

Current plan ID: ${currentPlanId}
Action type: ${evaluation.failedStep}
Points to work on: ${evaluation.failedPoints ? evaluation.failedPoints.join(', ') : 'N/A'}
Original action description: ${evaluation.nextStepPrompt}
Reason: ${evaluation.reason}

Create a clear, specific prompt that the ${trimmedMode} mode can use to complete this task. The prompt should include all necessary context and instructions.

Respond with ONLY the prompt text, no additional explanation or formatting.`;
        
        const generatedPrompt = await context.sendToLLM(promptGenerationPrompt);
        const trimmedPrompt = generatedPrompt.trim();
        context.console.info(`Generated prompt for ${trimmedMode}: ${trimmedPrompt.substring(0, 100)}...`);
        
        // Step 3: Send the generated prompt to the selected mode
        context.console.info(`Step 3: Delegating to ${trimmedMode} mode...`);
        context.sendNotice(`🎯 **Delegating to ${trimmedMode} mode**: ${evaluation.failedStep}`);
        
        const delegatedResponse = await context.sendToLLM(trimmedPrompt, trimmedMode);
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
                evaluation.doneCallback();
                context.sendNotice(`✅ **Change confirmed successful, callback executed**`);
            } else {
                context.console.info('LLM confirmed change was not successful, skipping callback');
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
        
        const selectedMode = await context.sendToLLM(modeSelectionPrompt);
        const trimmedMode = selectedMode.trim();
        context.console.info(`LLM selected mode: ${trimmedMode}`);
        
        // Step 2: Ask LLM to generate specific prompt for the selected mode
        context.console.info('Step 2: Asking LLM to generate prompt for selected mode...');
        
        const promptGenerationPrompt = `You need to create a specific prompt for the ${trimmedMode} mode to handle this plan action.

Current plan ID: ${currentPlanId}
Action type: ${evaluation.failedStep}
Points to work on: ${evaluation.failedPoints ? evaluation.failedPoints.join(', ') : 'N/A'}
Original action description: ${evaluation.nextStepPrompt}
Reason: ${evaluation.reason}

Create a clear, specific prompt that the ${trimmedMode} mode can use to complete this task. The prompt should include all necessary context and instructions.

Respond with ONLY the prompt text, no additional explanation or formatting.`;
        
        const generatedPrompt = await context.sendToLLM(promptGenerationPrompt);
        const trimmedPrompt = generatedPrompt.trim();
        context.console.info(`Generated prompt for ${trimmedMode}: ${trimmedPrompt.substring(0, 100)}...`);
        
        // Step 3: Send the generated prompt to the selected mode
        context.console.info(`Step 3: Delegating to ${trimmedMode} mode...`);
        context.sendNotice(`🎯 **Delegating to ${trimmedMode} mode**: ${evaluation.failedStep}`);
        
        const delegatedResponse = await context.sendToLLM(trimmedPrompt, trimmedMode);
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
                evaluation.doneCallback();
                context.sendNotice(`✅ **Change confirmed successful, callback executed**`);
            } else {
                context.console.info('LLM confirmed change was not successful, skipping callback');
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
