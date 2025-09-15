// tests/planLanguageInfo.test.ts

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PlanningService } from '../src/planningService';

suite('Plan Language Information Test Suite', () => {
  let planningService: PlanningService;
  let tempDir: string;

  setup(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-language-test-'));
    planningService = PlanningService.getInstance(tempDir);
  });

  teardown(() => {
    // Clean up
    PlanningService.resetInstance();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  suite('Plan Creation with Language Info', () => {
    test('should create plan with language information using createPlanWithLanguageInfo', () => {
      const planId = `test-plan-language-${Date.now()}-${Math.random()}`;
      const originalRequest = "Vytvořte plan pro nový projekt";
      const translatedRequest = "Create a plan for a new project";
      const detectedLanguage = "czech";

      const result = planningService.createPlanWithLanguageInfo(
        planId,
        'Test Plan',
        translatedRequest,
        'Clean long description',
        detectedLanguage,
        originalRequest,
        translatedRequest
      );

      assert.strictEqual(result.success, true);

      // Get the created plan
      const showResult = planningService.showPlan(planId);
      assert.strictEqual(showResult.success, true);
      assert.ok(showResult.plan);

      const plan = showResult.plan;
      assert.strictEqual(plan.detectedLanguage, detectedLanguage);
      assert.strictEqual(plan.originalRequest, originalRequest);
      assert.strictEqual(plan.translatedRequest, translatedRequest);
      assert.strictEqual(plan.longDescription, 'Clean long description');
    });

    test('should create plan without translation when not needed', () => {
      const planId = `test-plan-no-translation-${Date.now()}-${Math.random()}`;
      const originalRequest = "Create a plan for a new project";
      const detectedLanguage = "english";

      const result = planningService.createPlanWithLanguageInfo(
        planId,
        'Test Plan',
        originalRequest,
        'Clean long description',
        detectedLanguage,
        originalRequest,
        undefined // No translation needed
      );

      assert.strictEqual(result.success, true);

      // Get the created plan
      const showResult = planningService.showPlan(planId);
      assert.strictEqual(showResult.success, true);
      assert.ok(showResult.plan);

      const plan = showResult.plan;
      assert.strictEqual(plan.detectedLanguage, detectedLanguage);
      assert.strictEqual(plan.originalRequest, originalRequest);
      assert.strictEqual(plan.translatedRequest, undefined);
      assert.strictEqual(plan.longDescription, 'Clean long description');
    });

    test('should preserve backward compatibility with regular createPlan', () => {
      const planId = `test-plan-backward-compat-${Date.now()}-${Math.random()}`;
      const longDescription = 'Original request: "Test request"\nTranslated request: "Test request"\nLanguage: english';

      const result = planningService.createPlan(
        planId,
        'Test Plan',
        'Short description',
        longDescription
      );

      assert.strictEqual(result.success, true);

      // Get the created plan
      const showResult = planningService.showPlan(planId);
      assert.strictEqual(showResult.success, true);
      assert.ok(showResult.plan);

      const plan = showResult.plan;
      // Language fields should be undefined for backward compatibility
      assert.strictEqual(plan.detectedLanguage, undefined);
      assert.strictEqual(plan.originalRequest, undefined);
      assert.strictEqual(plan.translatedRequest, undefined);
      assert.strictEqual(plan.longDescription, longDescription);
    });
  });

  suite('Plan Storage and Loading', () => {
    test('should persist and load language information correctly', () => {
      const planId = `test-plan-persistence-${Date.now()}-${Math.random()}`;
      const originalRequest = "Помогите создать план проекта";
      const translatedRequest = "Help create a project plan";
      const detectedLanguage = "russian";

      // Create plan with language info
      const result = planningService.createPlanWithLanguageInfo(
        planId,
        'Test Plan',
        translatedRequest,
        'Clean long description',
        detectedLanguage,
        originalRequest,
        translatedRequest
      );

      assert.strictEqual(result.success, true);

      // Reset the planning service to simulate restart
      PlanningService.resetInstance();
      const newPlanningService = PlanningService.getInstance(tempDir);

      // Load the plan
      const showResult = newPlanningService.showPlan(planId);
      assert.strictEqual(showResult.success, true);
      assert.ok(showResult.plan);

      const plan = showResult.plan;
      assert.strictEqual(plan.detectedLanguage, detectedLanguage);
      assert.strictEqual(plan.originalRequest, originalRequest);
      assert.strictEqual(plan.translatedRequest, translatedRequest);
      assert.strictEqual(plan.longDescription, 'Clean long description');

      // Update planning service reference for teardown
      planningService = newPlanningService;
    });
  });
});
