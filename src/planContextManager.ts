// src/planContextManager.ts

// Global instance to survive module reloads
declare global {
  var __codingAgentPlanContextManagerInstance: PlanContextManager | undefined;
}

/**
 * Singleton manager for tracking the current active plan context
 * This is used to maintain plan_id consistency across the application
 */
export class PlanContextManager {
  // Use global storage that survives module reloads
  private static get instance(): PlanContextManager | undefined {
    return global.__codingAgentPlanContextManagerInstance;
  }
  
  private static set instance(value: PlanContextManager | undefined) {
    global.__codingAgentPlanContextManagerInstance = value;
  }

  private currentPlanId: string | null = null;
  private updateCallback: ((planId: string | null) => void) | null = null;

  private constructor() {}

  public static getInstance(): PlanContextManager {
    if (!PlanContextManager.instance) {
      PlanContextManager.instance = new PlanContextManager();
    }
    return PlanContextManager.instance;
  }

  /**
   * Set the current active plan ID
   */
  public setCurrentPlanId(planId: string | null): void {
    this.currentPlanId = planId;
    
    // Notify subscribers about the change
    if (this.updateCallback) {
      this.updateCallback(planId);
    }
  }

  /**
   * Get the current active plan ID
   */
  public getCurrentPlanId(): string | null {
    return this.currentPlanId;
  }

  /**
   * Set a callback that will be called when the plan ID changes
   * This allows ChatService to be notified of changes
   */
  public setUpdateCallback(callback: (planId: string | null) => void): void {
    this.updateCallback = callback;
  }

  /**
   * Clear the update callback
   */
  public clearUpdateCallback(): void {
    this.updateCallback = null;
  }

  /**
   * Reset the manager state (useful for testing)
   */
  public static resetInstance(): void {
    PlanContextManager.instance = undefined;
  }
}
