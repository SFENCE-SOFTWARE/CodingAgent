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
    
    // Example orchestration logic
    const steps = [
        'Analyze user request',
        'Determine required actions',
        'Coordinate with appropriate agents',
        'Execute plan',
        'Provide summary'
    ];
    
    let response = 'Orchestrator Algorithm Processing:\n\n';
    
    steps.forEach((step, index) => {
        response += `${index + 1}. ${step}\n`;
        context.console.info(`Step ${index + 1}: ${step}`);
    });
    
    // Example: Check for plan-related requests
    if (message.toLowerCase().includes('plan')) {
        response += '\nDetected plan-related request. Initiating plan workflow...';
        context.setVariable('last_action', 'plan_workflow');
    } else {
        response += '\nGeneral request processing initiated.';
        context.setVariable('last_action', 'general_processing');
    }
    
    // Send response back to chat
    context.sendResponse(response);
    
    // Don't return anything when using sendResponse to avoid duplication
    return;
}
