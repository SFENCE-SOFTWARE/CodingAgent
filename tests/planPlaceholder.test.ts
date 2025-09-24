import * as assert from 'assert';
import * as vscode from 'vscode';
import { PlanningService } from '../src/planningService';
import { PlanReplacePlaceholdersTool } from '../src/tools/planReplacePlaceholders';

suite('Plan Placeholder Tool Tests', () => {
  let planningService: PlanningService;
  let placeholderTool: PlanReplacePlaceholdersTool;
  const workspaceRoot = '/tmp/test-plan-placeholder';

  setup(() => {
    // Reset planning service instance before each test
    PlanningService.resetInstance();
    
    // Mock vscode configuration for tests
    const mockConfig = {
      get: (key: string, defaultValue?: any) => {
        const configMap: Record<string, any> = {
          'codingagent.plan.promptPlanRework': 'Please rework the plan: <plan_name>',
          'codingagent.plan.promptPlanReview': 'Please review plan <plan_id> with description: <plan_long_description>',
          'codingagent.plan.promptPointsImplementation': 'Implement points <failed_point_ids> in plan <plan_name>',
          'codingagent.plan.recommendedModePlanRework': 'Architect',
          'codingagent.plan.recommendedModePlanReview': 'Plan Reviewer',
          'codingagent.plan.recommendedModeImplementation': 'Coder',
          'codingagent.plan.creation.promptDescriptionUpdate': 'Update descriptions for plan <plan_id>: <plan_original_request>',
        };
        return configMap[key] || defaultValue;
      }
    };

    const getConfiguration = (section?: string) => mockConfig;

    // Mock vscode.workspace.getConfiguration
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    (vscode.workspace as any).getConfiguration = getConfiguration;

    planningService = PlanningService.getInstance(workspaceRoot);
    placeholderTool = new PlanReplacePlaceholdersTool();

    // Restore after setup
    (vscode.workspace as any).getConfiguration = originalGetConfiguration;
  });

  teardown(() => {
    PlanningService.resetInstance();
  });

  test('should provide correct tool definitions for placeholder tool', () => {
    const placeholderInfo = placeholderTool.getToolInfo();
    assert.strictEqual(placeholderInfo.name, 'plan_replace_placeholders');
    assert.ok(placeholderInfo.description.includes('placeholders'));

    const placeholderDef = placeholderTool.getToolDefinition();
    assert.strictEqual(placeholderDef.function.name, 'plan_replace_placeholders');
    assert.ok(placeholderDef.function.parameters?.properties?.template);
    assert.ok(placeholderDef.function.parameters?.properties?.plan_id);
  });

  test('should replace plan placeholders in templates', async () => {
    // Create a test plan first
    const planId = `test-plan-${Date.now()}`;
    
    const createResult = await planningService.createPlan(
      planId,
      'Test Plan',
      'Short test description',
      'Long test description with details'
    );
    
    assert.ok(createResult.success, `Plan creation failed: ${createResult.error}`);

    // Set original request for the plan 
    planningService.evaluatePlanCreation(planId, 'Create a test plan');

    // Test placeholder replacement
    const template = 'Plan <plan_name> (<plan_id>) has description: <plan_long_description>. Original request: <plan_original_request>.';
    
    const result = await placeholderTool.execute({ 
      template,
      plan_id: planId 
    }, workspaceRoot);

    assert.ok(result.success, `Placeholder replacement failed: ${result.error}`);
    assert.ok(result.content.includes('Test Plan'));
    assert.ok(result.content.includes(planId));
    assert.ok(result.content.includes('Long test description with details'));
    assert.ok(result.content.includes('Create a test plan'));
  });

  test('should handle point placeholders in templates', async () => {
    // Create a test plan with points
    const planId = `test-plan-points-${Date.now()}`;
    
    const createResult = await planningService.createPlan(
      planId,
      'Test Plan With Points',
      'Plan with test points',
      'Long description for plan with test points'
    );
    assert.ok(createResult.success, `Plan creation failed: ${createResult.error}`);

    // Set original request for the plan 
    planningService.evaluatePlanCreation(planId, 'Create a test plan with points');

    // Add a point to the plan
    const pointResult = await planningService.addPoint(
      planId,
      null, // afterPointId
      'Test Point One',
      'First test point', 
      'Detailed description of first test point',
      'Review this point carefully',
      'Test this point thoroughly',
      'Test outputs',
      'Test inputs'
    );
    assert.ok(pointResult.success, `Point addition failed: ${pointResult.error}`);
    const pointId = pointResult.pointId!;

    // Test point placeholder replacement
    const template = 'Plan <plan_name> has point <point_id> named <point_short_name> with details: <point_detailed_description>';
    
    const result = await placeholderTool.execute({ 
      template,
      plan_id: planId,
      point_id: pointId
    }, workspaceRoot);

    assert.ok(result.success, `Point placeholder replacement failed: ${result.error}`);
    assert.ok(result.content.includes('Test Plan With Points'));
    assert.ok(result.content.includes(pointId));
    assert.ok(result.content.includes('Test Point One'));
    assert.ok(result.content.includes('Detailed description of first test point'));
  });

  test('should handle non-existent plan gracefully', async () => {
    const template = 'Plan <plan_name> (<plan_id>) description: <plan_long_description>';
    
    const result = await placeholderTool.execute({ 
      template,
      plan_id: 'non-existent-plan'
    }, workspaceRoot);

    // Should succeed but with empty placeholder values
    assert.ok(result.success, `Should succeed even for non-existent plan: ${result.error}`);
    assert.ok(result.content.includes('non-existent-plan'));
    // Should have empty values for non-existent plan fields
    assert.ok(!result.content.includes('undefined'));
  });

  test('should handle templates with no placeholders', async () => {
    const template = 'This is a template with no placeholders at all.';
    
    const result = await placeholderTool.execute({ 
      template,
      plan_id: 'any-plan-id'  // This won't matter since no placeholders
    }, workspaceRoot);

    // Should succeed and return JSON result
    assert.ok(result.success, `Template without placeholders failed: ${result.error}`);
    
    // Parse the JSON response
    const parsedResult = JSON.parse(result.content);
    assert.strictEqual(parsedResult.processedTemplate, template);
    assert.strictEqual(parsedResult.replacementsFound, false);
  });
});
