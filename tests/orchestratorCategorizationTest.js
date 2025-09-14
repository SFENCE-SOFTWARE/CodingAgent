// tests/orchestratorCategorizationTest.js - Manual test for orchestrator categorization

console.log('Testing orchestrator categorization logic...');

// Mock planning service with some test plans
const mockPlanningService = {
    listPlans: () => ({
        success: true,
        plans: [
            { id: 'user-authentication', name: 'User Authentication System', shortDescription: 'Login and registration system' },
            { id: 'database-migration', name: 'Database Migration', shortDescription: 'Migrate from MySQL to PostgreSQL' },
            { id: 'api-refactoring', name: 'API Refactoring', shortDescription: 'Refactor REST API endpoints' }
        ]
    })
};

// Mock LLM that returns categorization
const mockLLM = (prompt) => {
    console.log('\n=== LLM PROMPT ===');
    console.log(prompt);
    console.log('=== END PROMPT ===\n');
    
    // Simulate LLM responses based on content
    if (prompt.includes('login system')) {
        return 'OPEN user-authentication';
    } else if (prompt.includes('new todo app')) {
        return 'NEW todo-app-project';
    } else if (prompt.includes('weather today')) {
        return 'QUESTION';
    }
    
    return 'QUESTION';
};

// Test different requests
const testRequests = [
    { message: 'I want to work on the login system', expected: 'OPEN user-authentication' },
    { message: 'Create a new todo app', expected: 'NEW todo-app-project' }, 
    { message: 'What is the weather today?', expected: 'QUESTION' }
];

// Generate existing plans context
let existingPlansContext = '';
const plansResult = mockPlanningService.listPlans();
if (plansResult.success && plansResult.plans && plansResult.plans.length > 0) {
    existingPlansContext = `\n\nExisting plans in the system:\n${plansResult.plans.map(p => `- ${p.id}: ${p.name}${p.shortDescription ? ' - ' + p.shortDescription : ''}`).join('\n')}`;
} else {
    existingPlansContext = '\n\nNo existing plans in the system.';
}

console.log('Existing plans context:');
console.log(existingPlansContext);

for (const test of testRequests) {
    console.log(`\n--- Testing: "${test.message}" ---`);
    
    const categorizationPrompt = `Analyze this user request and categorize it. You must respond with exactly one of these formats:

**OPEN <existing_plan_id>** — Use this if the request can be fulfilled by opening and continuing work on an existing plan. Replace <existing_plan_id> with the actual ID of an existing plan that matches the request. Only use plan IDs that exist in the system.

**NEW <new_plan_id>** — Use this if the user's request requires creating a new plan. Replace <new_plan_id> with a short, descriptive plan ID (lowercase, use dashes, max 30 chars, must NOT conflict with existing plan IDs). Generate the ID based on the request content.

**QUESTION** — Use this for any other type of request, such as questions, general help, or anything unrelated to creating or opening a plan.

Rules:
- For OPEN: The plan_id MUST be from the existing plans list below
- For NEW: The plan_id MUST be unique (not in the existing plans list) and descriptive
- If both OPEN and NEW are possible, prefer OPEN for existing plans
- Plan IDs should be descriptive but concise (e.g., "user-authentication", "data-migration", "api-refactoring")
${existingPlansContext}

User request: "${test.message}"`;

    const result = mockLLM(categorizationPrompt);
    console.log(`Expected: ${test.expected}`);
    console.log(`Got: ${result}`);
    console.log(`Match: ${result === test.expected ? '✅' : '❌'}`);
}

console.log('\nTest completed!');
