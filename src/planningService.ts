// src/planningService.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface PlanPoint {
  id: string;
  shortName: string;
  shortDescription: string;
  detailedDescription: string;
  reviewInstructions: string;  // New: instructions for reviewing this point
  testingInstructions: string; // New: instructions for testing this point
  expectedOutputs: string;
  expectedInputs: string;  // New: expected inputs for the point
  status: string;
  careOn: boolean;
  comment: string;
  careOnComment: string;
  careOnPoints: string[];
  dependsOn: string[];  // Points that this point depends on (use "-1" for no dependencies)
  implemented: boolean;
  reviewed: boolean;
  reviewedComment: string;
  tested: boolean;
  testedComment: string;
  needRework: boolean;
  reworkReason: string;
  comments: string[];
  updatedAt: number;
}

export interface Plan {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  points: PlanPoint[];
  reviewed: boolean;
  reviewedComment?: string;
  needsWork: boolean;
  needsWorkComments?: string[];  // Changed to array
  accepted: boolean;
  acceptedComment?: string;
  reviewChecklist?: string[]; // New: checklist for plan review (populated on first review attempt)
  logs: PlanLogEntry[];  // New: activity logs for the plan
  // Language and translation fields for orchestrator algorithm
  detectedLanguage?: string;  // Language detected by orchestrator (e.g., "czech", "english")
  originalRequest?: string;   // Original user request before translation
  translatedRequest?: string; // Translated request (only if translation was needed)
  architecture?: string;     // New: JSON architectural design for the plan
  // New plan creation workflow states
  creationStep?: string;     // Current step in creation workflow: 'description_update', 'description_review', 'architecture_creation', 'architecture_review', 'points_creation', 'complete'
  descriptionsUpdated?: boolean;  // Whether descriptions have been updated
  descriptionsReviewed?: boolean; // Whether descriptions have been reviewed
  architectureCreated?: boolean;  // Whether architecture has been created
  architectureReviewed?: boolean; // Whether architecture has been reviewed
  pointsCreated?: boolean;       // Whether points have been created
  creationChecklist?: string[];  // Current checklist for creation workflow
  createdAt: number;
  updatedAt: number;
}

export interface PlanState {
  allImplemented: boolean;
  allReviewed: boolean;
  allTested: boolean;
  allAccepted: boolean;
  implementedCount: number;
  reviewedCount: number;
  testedCount: number;
  acceptedCount: number;
  totalCount: number;
  pendingPoints: string[];
}

export interface PlanLogEntry {
  timestamp: number;
  type: 'point' | 'plan';
  action: string; // e.g., 'implemented', 'reviewed', 'tested', 'accepted', 'needs_rework'
  target: string; // point ID or plan ID
  message: string; // formatted log message
  details?: string; // optional additional details (comments, etc.)
}

export interface PlanEvaluationResult {
  isDone: boolean;
  nextStepPrompt: string; // Always required now - even for done plans
  failedStep?: 'plan_rework' | 'plan_review' | 'rework' | 'implementation' | 'code_review' | 'testing' | 'acceptance' | 
               'plan_description_update' | 'plan_description_review' | 'plan_architecture_creation' | 'plan_architecture_rework' | 'plan_architecture_review' | 'plan_points_creation' | 'plan_points_rework' |
               'plan_description_update_rework' | 'plan_description_review_rework' | 'plan_architecture_creation_rework' | 'plan_architecture_review_rework' | 'plan_points_creation_rework' | '';
  failedPoints?: string[];
  reason?: string;
  recommendedMode?: string; // New: recommended mode for this step from configuration
  // New: callback to call when task is completed. Receives optional feedback:
  // (success?: boolean, info?: string) => void
  doneCallback?: (success?: boolean, info?: string) => void;
  // New: callback to evaluate if step is done without asking LLM:
  // () => boolean
  completionCallback?: () => boolean;
}

export class PlanningService {
  private static instance: PlanningService;
  private plans: Map<string, Plan> = new Map();
  private plansDirectory: string;
  private lastLogTimestamp: number = 0;

  private constructor(workspaceRoot?: string) {
    const root = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      throw new Error('No workspace folder found');
    }
    this.plansDirectory = path.join(root, '.codingagent', 'plans');
    this.ensureDirectoryExists();
    this.loadPlans();
  }

  public static getInstance(workspaceRoot?: string): PlanningService {
    if (!PlanningService.instance) {
      PlanningService.instance = new PlanningService(workspaceRoot);
    }
    return PlanningService.instance;
  }

  public static resetInstance(): void {
    PlanningService.instance = undefined as any;
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.plansDirectory)) {
      fs.mkdirSync(this.plansDirectory, { recursive: true });
    }
  }

  private loadPlans(): void {
    try {
      if (!fs.existsSync(this.plansDirectory)) {
        return;
      }

      const files = fs.readdirSync(this.plansDirectory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.plansDirectory, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const plan: Plan = JSON.parse(content);
            
            // Migration: Add logs array if it doesn't exist
            if (!plan.logs) {
              plan.logs = [];
              // Add initial log entry for existing plans
              plan.logs.push({
                timestamp: plan.createdAt || Date.now(),
                type: 'plan',
                action: 'created',
                target: plan.id,
                message: `Plan created`,
                details: plan.name
              });
              this.savePlan(plan); // Save migrated plan
            }
            
            this.plans.set(plan.id, plan);
          } catch (error) {
            console.warn(`Failed to load plan from ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load plans:', error);
    }
  }

  private savePlan(plan: Plan): void {
    try {
      this.ensureDirectoryExists(); // Ensure directory exists before saving
      const filePath = path.join(this.plansDirectory, `${plan.id}.json`);
      const content = JSON.stringify(plan, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[PlanningService] Plan ${plan.id} saved to disk with descriptionsUpdated=${plan.descriptionsUpdated}, step=${plan.creationStep}`);
    } catch (error) {
      console.error(`[PlanningService] Error saving plan ${plan.id}:`, error);
      throw new Error(`Failed to save plan ${plan.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private addLogEntry(plan: Plan, type: 'point' | 'plan', action: string, target: string, message: string, details?: string): void {
    // Ensure unique timestamps by incrementing if necessary
    let timestamp = Date.now();
    if (timestamp <= this.lastLogTimestamp) {
      timestamp = this.lastLogTimestamp + 1;
    }
    this.lastLogTimestamp = timestamp;

    const logEntry: PlanLogEntry = {
      timestamp,
      type,
      action,
      target,
      message,
      details
    };
    
    plan.logs.push(logEntry);
    
    // Keep only last 100 log entries to prevent excessive file sizes
    if (plan.logs.length > 100) {
      plan.logs = plan.logs.slice(-100);
    }
  }

  private deletePlanFile(planId: string): void {
    try {
      const filePath = path.join(this.plansDirectory, `${planId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete plan file ${planId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generatePointId(plan: Plan): string {
    const existingIds = plan.points.map(p => parseInt(p.id)).filter(id => !isNaN(id));
    const nextId = existingIds.length === 0 ? 1 : Math.max(...existingIds) + 1;
    return nextId.toString();
  }

  private validatePointId(plan: Plan, pointId: string): boolean {
    return plan.points.some(p => p.id === pointId);
  }

  private findPointIndex(plan: Plan, pointId: string): number {
    return plan.points.findIndex(p => p.id === pointId);
  }

  // Public API methods

  public createPlan(id: string, name: string, shortDescription: string, longDescription: string): { success: boolean; error?: string } {
    if (this.plans.has(id)) {
      return { success: false, error: `Plan with ID '${id}' already exists` };
    }

    const plan: Plan = {
      id,
      name,
      shortDescription,
      longDescription,
      points: [],
      reviewed: false,
      needsWork: false,
      accepted: false,
      logs: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add initial log entry
    this.addLogEntry(plan, 'plan', 'created', id, `Plan created`, name);

    this.plans.set(id, plan);
    this.savePlan(plan);

    return { success: true };
  }

  /**
   * Create plan with language and translation information (for orchestrator algorithm)
   */
  public createPlanWithLanguageInfo(
    id: string, 
    name: string, 
    shortDescription: string, 
    longDescription: string,
    detectedLanguage: string,
    originalRequest: string,
    translatedRequest?: string
  ): { success: boolean; error?: string } {
    if (this.plans.has(id)) {
      return { success: false, error: `Plan with ID '${id}' already exists` };
    }

    const plan: Plan = {
      id,
      name,
      shortDescription,
      longDescription,
      points: [],
      reviewed: false,
      needsWork: false,
      accepted: false,
      logs: [],
      detectedLanguage,
      originalRequest,
      translatedRequest,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add initial log entry
    this.addLogEntry(plan, 'plan', 'created', id, `Plan created`, name);

    this.plans.set(id, plan);
    this.savePlan(plan);

    return { success: true };
  }

  public listPlans(includeShortDescription: boolean = false): { success: boolean; plans?: Array<{id: string, name: string, shortDescription?: string}>; error?: string } {
    try {
      const plansList = Array.from(this.plans.values()).map(plan => ({
        id: plan.id,
        name: plan.name,
        ...(includeShortDescription && { shortDescription: plan.shortDescription })
      }));

      return { success: true, plans: plansList };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  public addPoint(
    planId: string,
    afterPointId: string | null,
    shortName: string,
    shortDescription: string,
    detailedDescription: string,
    reviewInstructions: string,
    testingInstructions: string,
    expectedOutputs: string = '',
    expectedInputs: string = ''
  ): { success: boolean; pointId?: string; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Validate afterPointId if provided
    if (afterPointId && !this.validatePointId(plan, afterPointId)) {
      return { success: false, error: `Point with ID '${afterPointId}' not found in plan '${planId}'` };
    }

    const newPointId = this.generatePointId(plan);
    const newPoint: PlanPoint = {
      id: newPointId,
      shortName,
      shortDescription,
      detailedDescription,
      reviewInstructions,
      testingInstructions,
      expectedOutputs,
      expectedInputs,
      status: 'pending',
      careOn: false,
      comment: '',
      careOnComment: '',
      careOnPoints: [],
      dependsOn: [],
      implemented: false,
      reviewed: false,
      reviewedComment: '',
      tested: false,
      testedComment: '',
      needRework: false,
      reworkReason: '',
      comments: [],
      updatedAt: Date.now()
    };

    if (afterPointId === null) {
      // Add at beginning
      plan.points.unshift(newPoint);
    } else {
      // Add after specified point
      const afterIndex = this.findPointIndex(plan, afterPointId);
      plan.points.splice(afterIndex + 1, 0, newPoint);
    }

    plan.updatedAt = Date.now();
    
    // Clear needRework flags for all points when a new point is added
    this.clearNeedReworkFlags(planId);
    
    this.savePlan(plan);

    return { success: true, pointId: newPointId };
  }

  public addPoints(
    planId: string,
    afterPointId: string | null,
    points: Array<{
      short_name: string;
      short_description: string;
      detailed_description: string;
      review_instructions: string;
      testing_instructions: string;
      expected_outputs: string;
      expected_inputs?: string;
      depends_on?: string[];
      care_on?: string[];
    }>
  ): { success: boolean; pointIds?: string[]; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Validate afterPointId if provided
    if (afterPointId && !this.validatePointId(plan, afterPointId)) {
      return { success: false, error: `Point with ID '${afterPointId}' not found in plan '${planId}'` };
    }

    const newPointIds: string[] = [];
    const newPoints: PlanPoint[] = [];

    // Get existing IDs to avoid conflicts
    const existingIds = plan.points.map(p => parseInt(p.id)).filter(id => !isNaN(id));
    let nextId = existingIds.length === 0 ? 1 : Math.max(...existingIds) + 1;

    // Create all new points with unique IDs
    for (const pointData of points) {
      const newPointId = nextId.toString();
      const newPoint: PlanPoint = {
        id: newPointId,
        shortName: pointData.short_name,
        shortDescription: pointData.short_description,
        detailedDescription: pointData.detailed_description,
        reviewInstructions: pointData.review_instructions,
        testingInstructions: pointData.testing_instructions,
        expectedOutputs: pointData.expected_outputs,
        expectedInputs: pointData.expected_inputs || '',
        status: 'pending',
        careOn: false,
        comment: '',
        careOnComment: '',
        careOnPoints: pointData.care_on || [],
        dependsOn: pointData.depends_on || [],
        implemented: false,
        reviewed: false,
        reviewedComment: '',
        tested: false,
        testedComment: '',
        needRework: false,
        reworkReason: '',
        comments: [],
        updatedAt: Date.now()
      };
      newPoints.push(newPoint);
      newPointIds.push(newPointId);
      nextId++; // Increment for next point
    }

    // Insert all points at once
    if (afterPointId === null) {
      // Add at beginning
      plan.points.unshift(...newPoints);
    } else {
      // Add after specified point
      const afterIndex = this.findPointIndex(plan, afterPointId);
      plan.points.splice(afterIndex + 1, 0, ...newPoints);
    }

    plan.updatedAt = Date.now();
    
    // Clear needRework flags for all points when new points are added
    this.clearNeedReworkFlags(planId);
    
    this.savePlan(plan);

    return { success: true, pointIds: newPointIds };
  }

  public changePoint(
    planId: string,
    pointId: string,
    updates: Partial<Pick<PlanPoint, 'shortName' | 'shortDescription' | 'detailedDescription' | 'reviewInstructions' | 'testingInstructions' | 'expectedOutputs' | 'expectedInputs' | 'dependsOn' | 'careOnPoints'>>
  ): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    
    // Update only provided fields
    if (updates.shortName !== undefined) {point.shortName = updates.shortName;}
    if (updates.shortDescription !== undefined) {point.shortDescription = updates.shortDescription;}
    if (updates.detailedDescription !== undefined) {point.detailedDescription = updates.detailedDescription;}
    if (updates.reviewInstructions !== undefined) {point.reviewInstructions = updates.reviewInstructions;}
    if (updates.testingInstructions !== undefined) {point.testingInstructions = updates.testingInstructions;}
    if (updates.expectedOutputs !== undefined) {point.expectedOutputs = updates.expectedOutputs;}
    if (updates.expectedInputs !== undefined) {point.expectedInputs = updates.expectedInputs;}
    if (updates.dependsOn !== undefined) {point.dependsOn = updates.dependsOn;}
    if (updates.careOnPoints !== undefined) {point.careOnPoints = updates.careOnPoints;}

    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    
    // Clear needRework flags for all points when plan is modified
    this.clearNeedReworkFlags(planId);
    
    this.savePlan(plan);

    return { success: true };
  }

  public showPlan(planId: string, includePointDescriptions: boolean = false): { success: boolean; plan?: any; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const result = {
      id: plan.id,
      name: plan.name,
      shortDescription: plan.shortDescription,
      longDescription: plan.longDescription,
      reviewed: plan.reviewed,
      needsWork: plan.needsWork,
      accepted: plan.accepted,
      architecture: plan.architecture,
      // New plan creation workflow state
      creationStep: plan.creationStep,
      descriptionsUpdated: plan.descriptionsUpdated,
      descriptionsReviewed: plan.descriptionsReviewed,
      architectureCreated: plan.architectureCreated,
      architectureReviewed: plan.architectureReviewed,
      // Language and translation fields
      detectedLanguage: plan.detectedLanguage,
      originalRequest: plan.originalRequest,
      translatedRequest: plan.translatedRequest,
      points: plan.points.map(point => ({
        id: point.id,
        shortName: point.shortName,
        shortDescription: point.shortDescription,
        detailedDescription: point.detailedDescription,
        dependsOn: point.dependsOn,
        implemented: point.implemented,
        reviewed: point.reviewed,
        tested: point.tested,
        needRework: point.needRework,
        comment: point.comment,
        ...(includePointDescriptions && { 
          reviewInstructions: point.reviewInstructions,
          testingInstructions: point.testingInstructions,
          expectedOutputs: point.expectedOutputs,
          expectedInputs: point.expectedInputs
        })
      }))
    };

    return { success: true, plan: result };
  }

  public setPointDependencies(planId: string, pointId: string, dependsOnPointIds: string[], careOnPointIds: string[]): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    // Validate dependsOn point IDs (allow "-1" as special case)
    for (const dependsOnId of dependsOnPointIds) {
      if (dependsOnId !== '-1' && !this.validatePointId(plan, dependsOnId)) {
        return { success: false, error: `Depends-on point with ID '${dependsOnId}' not found in plan '${planId}'` };
      }
    }

    // Validate careOn point IDs
    for (const careOnId of careOnPointIds) {
      if (!this.validatePointId(plan, careOnId)) {
        return { success: false, error: `Care-on point with ID '${careOnId}' not found in plan '${planId}'` };
      }
    }

    const point = plan.points[pointIndex];
    point.dependsOn = dependsOnPointIds;
    point.careOnPoints = careOnPointIds;
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  // Keep the old method for backward compatibility
  public setCareOnPoints(planId: string, pointId: string, careOnPointIds: string[]): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    // Validate all care-on point IDs exist
    for (const careOnId of careOnPointIds) {
      if (!this.validatePointId(plan, careOnId)) {
        return { success: false, error: `Care-on point with ID '${careOnId}' not found in plan '${planId}'` };
      }
    }

    const point = plan.points[pointIndex];
    point.careOnPoints = careOnPointIds;
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  public setArchitecture(planId: string, architecture: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Validate that architecture is valid JSON
    try {
      JSON.parse(architecture);
    } catch (error) {
      return { success: false, error: `Architecture must be valid JSON: ${error instanceof Error ? error.message : String(error)}` };
    }

    plan.architecture = architecture;
    // If this is part of new plan creation workflow, mark as created
    if (plan.creationStep && !plan.architectureCreated) {
      plan.architectureCreated = true;
    }
    plan.updatedAt = Date.now();
    this.savePlan(plan);

    // Log the architecture setting
    this.addLogEntry(plan, 'plan', 'architecture_set', planId, 'Architecture design has been set for the plan');

    return { success: true };
  }

  public showPoint(planId: string, pointId: string): { success: boolean; point?: any; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    
    // Get previous and next points
    const previousPoints = plan.points.slice(Math.max(0, pointIndex - 2), pointIndex)
      .map(p => ({ id: p.id, shortName: p.shortName, shortDescription: p.shortDescription }));
    
    const nextPoints = plan.points.slice(pointIndex + 1, pointIndex + 3)
      .map(p => ({ id: p.id, shortName: p.shortName, shortDescription: p.shortDescription }));

    // Get care-on points details
    const careOnPointsDetails = point.careOnPoints.map(careOnId => {
      const careOnPoint = plan.points.find(p => p.id === careOnId);
      return careOnPoint ? {
        id: careOnPoint.id,
        shortName: careOnPoint.shortName,
        shortDescription: careOnPoint.shortDescription
      } : null;
    }).filter(p => p !== null);

    const result = {
      id: point.id,
      shortName: point.shortName,
      shortDescription: point.shortDescription,
      detailedDescription: point.detailedDescription,
      reviewInstructions: point.reviewInstructions,
      testingInstructions: point.testingInstructions,
      expectedOutputs: point.expectedOutputs,
      expectedInputs: point.expectedInputs,
      dependsOn: point.dependsOn,
      state: {
        implemented: point.implemented,
        reviewed: point.reviewed,
        reviewedComment: point.reviewedComment,
        tested: point.tested,
        testedComment: point.testedComment,
        needRework: point.needRework,
        reworkReason: point.reworkReason
      },
      comments: point.comments,
      previousPoints,
      nextPoints,
      careOnPoints: careOnPointsDetails
    };

    return { success: true, point: result };
  }

  public addComment(planId: string, pointId: string, comment: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    const timestampedComment = `[${new Date().toISOString()}] ${comment}`;
    point.comments.push(timestampedComment);
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  public setImplemented(planId: string, pointId: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    point.implemented = true;
    point.needRework = false;
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'point', 'implemented', pointId, `Point ${pointId} new state implemented`, point.shortName);
    
    this.savePlan(plan);

    return { success: true };
  }

  public setReviewed(planId: string, pointId: string, comment: string, skipIfNotReviewable: boolean = false): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    
    if (!point.implemented && !skipIfNotReviewable) {
      return { success: false, error: `Point '${pointId}' must be implemented before it can be reviewed` };
    }

    point.reviewed = true;
    point.reviewedComment = comment;
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'point', 'reviewed', pointId, `Point ${pointId} new state reviewed`, comment ? comment : point.shortName);
    
    this.savePlan(plan);

    return { success: true };
  }

  public setTested(planId: string, pointId: string, comment: string, skipIfNotTestable: boolean = false): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    
    if (!point.implemented && !skipIfNotTestable) {
      return { success: false, error: `Point '${pointId}' must be implemented before it can be tested` };
    }

    point.tested = true;
    point.testedComment = comment;
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'point', 'tested', pointId, `Point ${pointId} new state tested`, comment ? comment : point.shortName);
    
    this.savePlan(plan);

    return { success: true };
  }

  public setPlanReviewed(planId: string, comment: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    plan.reviewed = true;
    plan.reviewedComment = comment;
    plan.needsWork = false;
    plan.needsWorkComments = undefined;
    plan.accepted = false;  // Reset acceptance when plan structure is reviewed
    plan.acceptedComment = undefined;
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'plan', 'reviewed', planId, `Plan new state reviewed`, comment ? comment : plan.name);
    
    this.savePlan(plan);

    return { success: true };
  }

  public setPlanNeedsWork(planId: string, comments: string[]): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    plan.needsWork = true;
    plan.needsWorkComments = comments;
    plan.reviewed = false;
    plan.reviewedComment = undefined;
    plan.accepted = false;
    plan.acceptedComment = undefined;
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'plan', 'needs_work', planId, `Plan new state needs work`, comments.join('; '));
    
    this.savePlan(plan);

    return { success: true };
  }

  public setPlanAccepted(planId: string, comment: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Check if all points are reviewed and tested
    const allPointsReviewedAndTested = plan.points.every(point => 
      point.reviewed && point.tested
    );

    if (!allPointsReviewedAndTested) {
      return { success: false, error: 'All plan points must be reviewed and tested before the plan can be accepted' };
    }

    plan.accepted = true;
    plan.acceptedComment = comment;
    plan.needsWork = false;
    plan.needsWorkComments = undefined;
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'plan', 'accepted', planId, `Plan new state accepted`, comment ? comment : plan.name);
    
    this.savePlan(plan);

    return { success: true };
  }

  public setNeedRework(planId: string, pointId: string, reworkReason: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const pointIndex = this.findPointIndex(plan, pointId);
    if (pointIndex === -1) {
      return { success: false, error: `Point with ID '${pointId}' not found in plan '${planId}'` };
    }

    const point = plan.points[pointIndex];
    point.implemented = false;
    point.reviewed = false;
    point.tested = false;
    point.needRework = true;
    point.reworkReason = reworkReason;
    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
    
    // Add log entry
    this.addLogEntry(plan, 'point', 'needs_rework', pointId, `Point ${pointId} new state needs rework`, reworkReason);
    
    this.savePlan(plan);

    return { success: true };
  }

  /**
   * Clear needRework flags for all points in a plan
   */
  public clearNeedReworkFlags(planId: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    let needReworkPointsCleared = 0;
    for (const point of plan.points) {
      if (point.needRework) {
        point.needRework = false;
        point.reworkReason = '';
        needReworkPointsCleared++;
      }
    }

    // Also clear plan need work flags when points are modified
    let planNeedWorkCleared = false;
    if (plan.needsWork) {
      plan.needsWork = false;
      plan.needsWorkComments = undefined;
      planNeedWorkCleared = true;
    }

    if (needReworkPointsCleared > 0 || planNeedWorkCleared) {
      plan.updatedAt = Date.now();
      this.savePlan(plan);
    }

    return { success: true };
  }

  public getPlanState(planId: string): { success: boolean; state?: PlanState; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const totalCount = plan.points.length;
    const implementedCount = plan.points.filter(p => p.implemented).length;
    const reviewedCount = plan.points.filter(p => p.reviewed).length;
    const testedCount = plan.points.filter(p => p.tested).length;

    const allImplemented = totalCount > 0 && implementedCount === totalCount;
    const allReviewed = totalCount > 0 && reviewedCount === totalCount;
    const allTested = totalCount > 0 && testedCount === totalCount;
    const planAccepted = plan.accepted || false;

    // Pending points are those that are not yet reviewed and tested
    const pendingPoints = plan.points
      .filter(p => !p.reviewed || !p.tested)
      .map(p => p.id);

    const state: PlanState = {
      allImplemented,
      allReviewed,
      allTested,
      allAccepted: planAccepted, // Plan-level acceptance instead of point-level
      implementedCount,
      reviewedCount,
      testedCount,
      acceptedCount: planAccepted ? 1 : 0, // 1 if plan is accepted, 0 otherwise
      totalCount,
      pendingPoints
    };

    return { success: true, state };
  }

  public isPlanDone(planId: string): { success: boolean; done?: boolean; pendingPoints?: string[]; error?: string } {
    const stateResult = this.getPlanState(planId);
    if (!stateResult.success) {
      return stateResult;
    }

    const done = stateResult.state!.allAccepted;
    return {
      success: true,
      done,
      pendingPoints: done ? [] : stateResult.state!.pendingPoints
    };
  }

  public deletePlan(planId: string, forceDelete: boolean = false): { success: boolean; needsConfirmation?: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    const doneResult = this.isPlanDone(planId);
    if (!doneResult.success) {
      return doneResult;
    }

    if (!doneResult.done && !forceDelete) {
      return { success: false, needsConfirmation: true, error: `Plan '${planId}' is not complete. Use force delete with user confirmation to delete incomplete plan.` };
    }

    this.plans.delete(planId);
    this.deletePlanFile(planId);

    return { success: true };
  }

  public removePoints(planId: string, pointIds: string[]): { success: boolean; removedPoints?: PlanPoint[]; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    if (!Array.isArray(pointIds) || pointIds.length === 0) {
      return { success: false, error: 'point_ids must be a non-empty array of point IDs' };
    }

    // Check which points exist
    const existingPoints = pointIds.filter(id => plan.points.some(p => p.id === id));
    const nonExistentPoints = pointIds.filter(id => !plan.points.some(p => p.id === id));

    if (nonExistentPoints.length > 0) {
      return { success: false, error: `Points not found in plan '${planId}': ${nonExistentPoints.join(', ')}` };
    }

    // Remove the points and collect them
    const removedPoints: PlanPoint[] = [];
    for (const pointId of pointIds) {
      const pointIndex = plan.points.findIndex(p => p.id === pointId);
      if (pointIndex !== -1) {
        const removedPoint = plan.points.splice(pointIndex, 1)[0];
        removedPoints.push(removedPoint);
      }
    }

    // Update plan timestamp and save
    plan.updatedAt = Date.now();
    
    // Clear needRework flags for all points when points are removed
    this.clearNeedReworkFlags(planId);
    
    this.savePlan(plan);

    return { success: true, removedPoints };
  }

  /**
   * Performs procedural validation of plan points checking all required fields and dependencies
   * Returns first validation issue found, or null if plan is valid
   */
  public validatePlanProcedurally(planId: string): { success: boolean; issue?: { type: string; pointId?: string; message: string }; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Check each point for required fields and valid dependencies
    for (const point of plan.points) {
      // Check required fields
      if (!point.shortName || point.shortName.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing short name`
          }
        };
      }

      if (!point.shortDescription || point.shortDescription.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing short description`
          }
        };
      }

      if (!point.detailedDescription || point.detailedDescription.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing detailed description`
          }
        };
      }

      if (!point.reviewInstructions || point.reviewInstructions.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing review instructions`
          }
        };
      }

      if (!point.testingInstructions || point.testingInstructions.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing testing instructions`
          }
        };
      }

      if (!point.expectedOutputs || point.expectedOutputs.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing expected outputs`
          }
        };
      }

      if (!point.expectedInputs || point.expectedInputs.trim() === '') {
        return {
          success: true,
          issue: {
            type: 'missing_field',
            pointId: point.id,
            message: `Point ${point.id} is missing expected inputs`
          }
        };
      }

      // Check dependencies - must have at least one dependency or explicitly marked as "-1"
      if (!point.dependsOn || point.dependsOn.length === 0) {
        return {
          success: true,
          issue: {
            type: 'missing_dependencies',
            pointId: point.id,
            message: `Point ${point.id} has no dependencies set. Use "-1" to mark as independent or specify dependent point IDs`
          }
        };
      }

      // If dependencies are set, validate them (except for "-1")
      for (const depId of point.dependsOn) {
        if (depId !== '-1') {
          // Check if the dependency point exists
          if (!plan.points.some(p => p.id === depId)) {
            return {
              success: true,
              issue: {
                type: 'invalid_dependency',
                pointId: point.id,
                message: `Point ${point.id} depends on non-existent point ${depId}`
              }
            };
          }
        }
      }
    }

    // All checks passed
    return { success: true };
  }

  /**
   * Evaluates plan completion status and generates corrective prompts if needed
   * Focuses only on implementation workflow: points need rework -> points not reviewed -> points not tested -> points not implemented -> plan accepted
   * Rule: Points which are not implemented cannot be marked as not reviewed or not tested
   * Note: plan.needsWork is handled only in evaluatePlanCreation, not here
   */
  public evaluatePlanCompletion(planId: string): { success: boolean; result?: PlanEvaluationResult; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Step 0: Procedural validation for unreviewed plans
    if (!plan.reviewed) {
      const validationResult = this.validatePlanProcedurally(planId);
      if (validationResult.success && validationResult.issue) {
        // Found procedural issue - return plan_review failure
        return {
          success: true,
          result: {
            isDone: false,
            nextStepPrompt: `Plan review failed: ${validationResult.issue.message}`, // Direct message instead of template
            failedStep: 'plan_review',
            reason: `Procedural validation failed: ${validationResult.issue.message}`,
            recommendedMode: this.getRecommendedMode('plan_review')
          }
        };
      }
    }

    // Step 1: Check if any points need rework (first priority)
    const reworkPoints = plan.points.filter(p => p.needRework);
    if (reworkPoints.length > 0) {
      // Return only the first point that needs rework
      const firstPoint = reworkPoints[0];
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('rework', [firstPoint.id], 'Plan point needs rework', planId),
          failedStep: 'rework',
          failedPoints: [firstPoint.id],
          reason: `Plan point ${firstPoint.id} needs rework`,
          recommendedMode: this.getRecommendedMode('rework')
        }
      };
    }

    // Step 2: Check if all implemented points are reviewed (second priority)
    // Note: Only implemented points can be reviewed
    const unreviewedPoints = plan.points.filter(p => p.implemented && !p.reviewed);
    if (unreviewedPoints.length > 0) {
      // Return only the first point that needs review
      const firstPoint = unreviewedPoints[0];
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('code_review', [firstPoint.id], 'Plan point is not reviewed', planId),
          failedStep: 'code_review',
          failedPoints: [firstPoint.id],
          reason: `Plan point ${firstPoint.id} is not reviewed`,
          recommendedMode: this.getRecommendedMode('code_review')
        }
      };
    }

    // Step 3: Check if any implemented point needs testing (third priority)
    // Note: Only implemented points can be tested, return just the first untested point
    const firstUntestedPoint = plan.points.find(p => p.implemented && !p.tested);
    if (firstUntestedPoint) {
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('testing', [firstUntestedPoint.id], `Plan point ${firstUntestedPoint.id} is not tested`, planId),
          failedStep: 'testing',
          failedPoints: [firstUntestedPoint.id],
          reason: `Plan point ${firstUntestedPoint.id} is not tested`,
          recommendedMode: this.getRecommendedMode('testing')
        }
      };
    }

    // Step 4: Check if any point needs implementation (fourth priority)
    // Return just the first unimplemented point
    const firstUnimplementedPoint = plan.points.find(p => !p.implemented);
    if (firstUnimplementedPoint) {
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('implementation', [firstUnimplementedPoint.id], `Plan point ${firstUnimplementedPoint.id} is not implemented`, planId),
          failedStep: 'implementation',
          failedPoints: [firstUnimplementedPoint.id],
          reason: `Plan point ${firstUnimplementedPoint.id} is not implemented`,
          recommendedMode: this.getRecommendedMode('implementation')
        }
      };
    }

    // Step 5: Check if plan needs review (after all points are complete)
    if (!plan.reviewed) {
      // Initialize checklist if needed
      this.initializeReviewChecklist(planId);
      
      // Get current checklist
      const checklistResult = this.getPlanReviewChecklist(planId);
      if (checklistResult.success && checklistResult.checklist && checklistResult.checklist.length > 0) {
        // Return first checklist item
        const firstItem = checklistResult.checklist[0];
        const prompt = this.generateCorrectionPrompt('plan_review', [], 'Plan needs to be reviewed', planId);
        
        // If the prompt contains <checklist>, replace it; otherwise append the checklist item
        let checklistPrompt: string;
        if (prompt.includes('<checklist>')) {
          checklistPrompt = prompt.replace(/<checklist>/g, firstItem);
        } else {
          checklistPrompt = `${prompt}\n\nCurrent checklist item: ${firstItem}`;
        }
        
        return {
          success: true,
          result: {
            isDone: false,
            nextStepPrompt: checklistPrompt,
            failedStep: 'plan_review',
            reason: 'Plan needs to be reviewed',
            recommendedMode: this.getRecommendedMode('plan_review'),
            doneCallback: (success?: boolean, info?: string) => {
              if (success) {
                this.removeFirstChecklistItem(planId);
              }
            }
          }
        };
      } else {
        // No checklist items, mark plan as reviewed
        plan.reviewed = true;
        plan.reviewedComment = 'Plan review completed';
        plan.updatedAt = Date.now();
        this.savePlan(plan);
      }
    }

    // Step 6: Check if plan is accepted (lowest priority)
    if (!plan.accepted) {
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('acceptance', [], 'Plan has not been accepted yet', planId),
          failedStep: 'acceptance',
          reason: 'Plan has not been accepted yet',
          recommendedMode: this.getRecommendedMode('acceptance')
        }
      };
    }

    // All checks passed - plan is complete
    return {
      success: true,
      result: {
        isDone: true,
        nextStepPrompt: this.generateCorrectionPrompt('done', [], '', planId),
        recommendedMode: this.getRecommendedMode('done')
      }
    };
  }

  /**
   * Initialize review checklist for a plan from configuration
   */
  private initializeReviewChecklist(planId: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Skip if checklist is already initialized
    if (plan.reviewChecklist && plan.reviewChecklist.length > 0) {
      return { success: true };
    }

    const config = vscode.workspace.getConfiguration('codingagent.plan');
    const pointChecklistText = config.get('reviewChecklistForPoints', '');
    const planChecklistText = config.get('reviewChecklistForPlan', '');
    
    const checklist: string[] = [];
    
    // Add point-specific checklist items for each plan point
    if (pointChecklistText && plan.points.length > 0) {
      const pointItems = this.parseChecklistText(pointChecklistText);
      for (const point of plan.points) {
        for (const item of pointItems) {
          checklist.push(`Point ${point.id}: ${item}`);
        }
      }
    }
    
    // Add plan-wide checklist items
    if (planChecklistText) {
      const planItems = this.parseChecklistText(planChecklistText);
      for (const item of planItems) {
        checklist.push(`Plan: ${item}`);
      }
    }
    
    plan.reviewChecklist = checklist;
    plan.updatedAt = Date.now();
    this.savePlan(plan);
    
    return { success: true };
  }

  /**
   * Parse checklist text from configuration (format: "* Item 1\n* Item 2")
   */
  private parseChecklistText(text: string): string[] {
    if (!text || text.trim() === '') {
      return [];
    }
    
    const lines = text.split('\n');
    const items: string[] = [];
    let currentItem = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('* ')) {
        // If we have a current item, save it
        if (currentItem) {
          items.push(currentItem.trim());
        }
        // Start new item (remove the '* ' prefix)
        currentItem = trimmedLine.substring(2).trim();
      } else if (currentItem && trimmedLine) {
        // Continue current item if we have one and the line is not empty
        currentItem += '\n' + trimmedLine;
      }
    }
    
    // Don't forget the last item
    if (currentItem) {
      items.push(currentItem.trim());
    }
    
    return items.filter(item => item.length > 0);
  }

  /**
   * Remove the first item from review checklist
   */
  private removeFirstChecklistItem(planId: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    if (!plan.reviewChecklist || plan.reviewChecklist.length === 0) {
      return { success: false, error: 'Plan does not have any checklist items' };
    }

    // Remove the first item
    plan.reviewChecklist.shift();
    
    // If no items remain and plan doesn't need work, mark as reviewed
    if (plan.reviewChecklist.length === 0 && !plan.needsWork) {
      plan.reviewed = true;
      plan.reviewedComment = 'All checklist items completed';
      
      // Add log entry
      this.addLogEntry(plan, 'plan', 'reviewed', planId, 'Plan marked as reviewed after completing all checklist items');
    }

    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  /**
   * Gets the current review checklist for a plan
   */
  public getPlanReviewChecklist(planId: string): { success: boolean; checklist?: string[]; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    return { success: true, checklist: plan.reviewChecklist || [] };
  }
  private generateCorrectionPrompt(step: string, pointIds: string[], reason: string, planId?: string): string {
    const config = vscode.workspace.getConfiguration('codingagent.plan');
    
    const templates = {
      plan_rework: config.get('promptPlanRework', 'Plan needs rework. Please update the plan.'),
      plan_review: config.get('promptPlanReview', 'Plan needs to be reviewed.'),
      rework: config.get('promptPointsRework', 'Please rework the following plan points: <id>'),
      implementation: config.get('promptPointsImplementation', 'Please implement the following plan points: <id>'),
      code_review: config.get('promptPointsReview', 'Please review the following plan points: <id>'),
      testing: config.get('promptPointsTesting', 'Please test the following plan points: <id>'),
      acceptance: config.get('promptPlanAcceptance', 'Please request Approver mode to perform a final acceptance check for the plan.'),
      done: config.get('promptPlanDone', 'Plan is done. Nothing has to be done.')
    };

    let template = templates[step as keyof typeof templates] || `Please address the issue: <reason>`;
    
    // Replace legacy placeholders first
    if (template.indexOf('<id>') !== -1) {
      template = template.replace(/<id>/g, pointIds.join(', '));
    }
    if (template.indexOf('<reason>') !== -1) {
      template = template.replace(/<reason>/g, reason);
    }
    
    // Replace failed point IDs placeholder
    template = template.replace(/<failed_point_ids>/g, pointIds.join(', '));
    
    // Apply comprehensive placeholder replacement
    const firstPointId = pointIds.length > 0 ? pointIds[0] : undefined;
    return this.replacePlaceholders(template, planId, firstPointId);
  }

  /**
   * Gets recommended mode for a plan step from configuration
   */
  private getRecommendedMode(step: string): string {
    const config = vscode.workspace.getConfiguration('codingagent.plan');
    
    const modeMapping = {
      plan_rework: config.get('recommendedModePlanRework', 'Architect'),
      plan_review: config.get('recommendedModePlanReview', 'Plan Reviewer'),
      rework: config.get('recommendedModeRework', 'Coder'),
      implementation: config.get('recommendedModeImplementation', 'Coder'),
      code_review: config.get('recommendedModeCodeReview', 'Reviewer'),
      testing: config.get('recommendedModeTesting', 'Tester'),
      acceptance: config.get('recommendedModeAcceptance', 'Approver'),
      done: ''
    };

    return modeMapping[step as keyof typeof modeMapping] || '';
  }

  /**
   * Remove the first need-work comment from a plan.
   * If no comments remain, clear the needsWork flag.
   */
  public removeFirstNeedWorkComment(planId: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    if (!plan.needsWork || !plan.needsWorkComments || plan.needsWorkComments.length === 0) {
      return { success: false, error: 'Plan does not have any need-work comments' };
    }

    // Remove the first comment
    plan.needsWorkComments.shift();

    // If no comments remain, clear the needsWork flag
    if (plan.needsWorkComments.length === 0) {
      plan.needsWork = false;
      plan.needsWorkComments = undefined;
    }

    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  /**
   * Update plan's name and descriptions
   */
  public updatePlanDetails(planId: string, name?: string, shortDescription?: string, longDescription?: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    if (name !== undefined) {
      plan.name = name;
    }
    if (shortDescription !== undefined) {
      plan.shortDescription = shortDescription;
    }
    if (longDescription !== undefined) {
      plan.longDescription = longDescription;
    }

    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  /**
   * Get activity logs for a plan
   */
  public getPlanLogs(planId: string, limit?: number): { success: boolean; logs?: PlanLogEntry[]; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    let logs = plan.logs || [];
    
    // Sort logs by timestamp (newest first)
    logs = logs.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit if specified
    if (limit && limit > 0) {
      logs = logs.slice(0, limit);
    }

    return { success: true, logs };
  }

  /**
   * Evaluates new plan creation workflow and returns the next step
   */
  public evaluatePlanCreation(planId: string, originalRequest?: string): { success: boolean; result?: PlanEvaluationResult; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    console.log(`[PlanningService] Evaluating plan ${planId}:`);
    console.log(`[PlanningService] - descriptionsUpdated: ${plan.descriptionsUpdated}`);
    console.log(`[PlanningService] - descriptionsReviewed: ${plan.descriptionsReviewed}`);
    console.log(`[PlanningService] - architectureCreated: ${plan.architectureCreated}`);
    console.log(`[PlanningService] - architectureReviewed: ${plan.architectureReviewed}`);
    console.log(`[PlanningService] - pointsCreated: ${plan.pointsCreated}`);
    console.log(`[PlanningService] - creationStep: ${plan.creationStep}`);
    console.log(`[PlanningService] - needsWork: ${plan.needsWork}`);

    // Store original request if provided
    if (originalRequest && !plan.originalRequest) {
      plan.originalRequest = originalRequest;
      plan.updatedAt = Date.now();
      this.savePlan(plan);
    }

    const request = plan.originalRequest || originalRequest || 'No request specified';

    // HIGHEST PRIORITY: Check if plan needs rework (same as in evaluatePlanCompletion)
    if (plan.needsWork) {
      const firstComment = plan.needsWorkComments && plan.needsWorkComments.length > 0 
        ? plan.needsWorkComments[0] 
        : 'Plan needs rework';
      
      // Determine which step-specific rework template to use based on current creation step
      let reworkPromptKey: string;
      let failedStepType: 'plan_rework' | 'plan_description_update_rework' | 'plan_description_review_rework' | 'plan_architecture_creation_rework' | 'plan_architecture_review_rework' | 'plan_points_creation_rework' = 'plan_rework';

      if (plan.creationStep === 'description_update' && !plan.descriptionsUpdated) {
        reworkPromptKey = 'codingagent.plan.creation.promptDescriptionUpdateRework';
        failedStepType = 'plan_description_update_rework';
      } else if (plan.creationStep === 'description_review' && !plan.descriptionsReviewed) {
        reworkPromptKey = 'codingagent.plan.creation.promptDescriptionReviewRework';
        failedStepType = 'plan_description_review_rework';
      } else if (plan.creationStep === 'architecture_creation' && !plan.architectureCreated) {
        reworkPromptKey = 'codingagent.plan.creation.promptArchitectureCreationRework';
        failedStepType = 'plan_architecture_creation_rework';
      } else if (plan.creationStep === 'architecture_review' && !plan.architectureReviewed) {
        reworkPromptKey = 'codingagent.plan.creation.promptArchitectureReviewRework';
        failedStepType = 'plan_architecture_review_rework';
      } else if (plan.creationStep === 'points_creation' && !plan.pointsCreated) {
        reworkPromptKey = 'codingagent.plan.creation.promptPlanPointsCreationRework';
        failedStepType = 'plan_points_creation_rework';
      } else {
        // Generic fallback - use description update rework as the most general one
        reworkPromptKey = 'codingagent.plan.creation.promptDescriptionUpdateRework';
        failedStepType = 'plan_rework';
      }

      // Get the step-specific rework template and apply placeholders
      const reworkTemplate = this.getConfig(reworkPromptKey);
      const reworkPrompt = this.replacePlaceholders(reworkTemplate, planId);
      
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: reworkPrompt,
          failedStep: failedStepType,
          reason: firstComment,
          recommendedMode: this.getRecommendedMode('plan_rework'),
          doneCallback: (success?: boolean, info?: string) => {
            // Accept optional feedback from orchestrator/LLM when the change was applied.
            // Currently we ignore feedback content and simply remove the first need-work comment.
            this.removeFirstNeedWorkComment(planId);
          }
        }
      };
    }

    // Step 1: Check if plan needs description update
    if (!plan.descriptionsUpdated) {
      console.log(`[PlanningService] Plan ${planId}: descriptionsUpdated = ${plan.descriptionsUpdated}, entering description_update step`);
      plan.creationStep = 'description_update';
      plan.updatedAt = Date.now();
      this.savePlan(plan);

      const prompt = this.replacePlaceholders(
        this.getConfig('codingagent.plan.creation.promptDescriptionUpdate'),
        planId
      );

      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: prompt,
          failedStep: 'plan_description_update',
          reason: 'Plan descriptions need to be updated',
          recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModeDescriptionUpdate'),
          doneCallback: (success?: boolean, info?: string) => {
            console.log(`[PlanningService] DoneCallback called for plan ${planId} - descriptionsUpdated step, success: ${success}, info: ${info}`);
            if (success) {
              const currentPlan = this.plans.get(planId);
              if (currentPlan) {
                console.log(`[PlanningService] Before update - Plan ${planId}: descriptionsUpdated = ${currentPlan.descriptionsUpdated}`);
                currentPlan.descriptionsUpdated = true;
                currentPlan.updatedAt = Date.now();
                this.savePlan(currentPlan);
                console.log(`[PlanningService] After update - Plan ${planId}: descriptionsUpdated = ${currentPlan.descriptionsUpdated}, saved to disk`);
              } else {
                console.error(`[PlanningService] ERROR: Plan ${planId} not found in memory during doneCallback!`);
              }
            }
          }
        }
      };
    }

    // Step 2: Check if plan descriptions need review
    if (!plan.descriptionsReviewed) {
      plan.creationStep = 'description_review';
      
      // Reset plan.reviewed flag for this review step
      plan.reviewed = false;
      plan.reviewedComment = undefined;
      
      // Initialize checklist if not done already
      if (!plan.creationChecklist) {
        const checklistText = this.getConfig('codingagent.plan.creation.checklistDescriptionReview');
        plan.creationChecklist = this.parseChecklistText(checklistText);
      }

      plan.updatedAt = Date.now();
      this.savePlan(plan);

      // Get completion callback configuration
      const callbackConfig = this.getConfig('codingagent.plan.creation.callbackDescriptionReview');
      
      // If we have checklist items, return the first one
      if (plan.creationChecklist && plan.creationChecklist.length > 0) {
        const firstItem = plan.creationChecklist[0];
        
        // Get the prompt template and replace <checklist> placeholder
        const promptTemplate = this.getConfig('codingagent.plan.creation.promptDescriptionReview');
        const checklistPrompt = this.replacePlaceholders(
          promptTemplate.replace('<checklist>', firstItem),
          planId
        );
        
        return {
          success: true,
          result: {
            isDone: false,
            nextStepPrompt: checklistPrompt,
            failedStep: 'plan_description_review',
            reason: 'Plan descriptions need review',
            recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModeDescriptionReview'),
            doneCallback: (success?: boolean, info?: string) => {
              if (success) {
                const currentPlan = this.plans.get(planId);
                if (currentPlan && currentPlan.creationChecklist) {
                  currentPlan.creationChecklist.shift(); // Remove first item
                  if (currentPlan.creationChecklist.length === 0) {
                    currentPlan.descriptionsReviewed = true;
                  }
                  currentPlan.updatedAt = Date.now();
                  this.savePlan(currentPlan);
                }
              }
            },
            completionCallback: callbackConfig ? () => this.evaluateCompletionCallback(callbackConfig, planId) : undefined
          }
        };
      } else {
        // Fallback if no checklist
        plan.descriptionsReviewed = true;
        plan.updatedAt = Date.now();
        this.savePlan(plan);
      }
    }

    // Step 3: Check if architecture needs to be created
    if (!plan.architectureCreated || !plan.architecture) {
      plan.creationStep = 'architecture_creation';
      plan.updatedAt = Date.now();
      this.savePlan(plan);

      const prompt = this.replacePlaceholders(
        this.getConfig('codingagent.plan.creation.promptArchitectureCreation'),
        planId
      );

      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: prompt,
          failedStep: 'plan_architecture_creation',
          reason: 'Plan architecture needs to be created',
          recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModeArchitectureCreation'),
          doneCallback: (success?: boolean, info?: string) => {
            if (success) {
              const currentPlan = this.plans.get(planId);
              if (currentPlan) {
                currentPlan.architectureCreated = true;
                currentPlan.updatedAt = Date.now();
                this.savePlan(currentPlan);
              }
            }
          }
        }
      };
    }

    // Step 4: Procedural validation of architecture
    if (plan.architecture && plan.architectureCreated && !plan.architectureReviewed) {
      const validationResult = this.validateArchitectureJson(plan.architecture);
      if (!validationResult.success) {
        // Use step-specific rework template for architecture creation
        const reworkTemplate = this.getConfig('codingagent.plan.creation.promptArchitectureCreationRework');
        const reworkPrompt = this.replacePlaceholders(reworkTemplate, planId);
        
        return {
          success: true,
          result: {
            isDone: false,
            nextStepPrompt: reworkPrompt,
            failedStep: 'plan_architecture_creation_rework',
            reason: `Architecture validation failed: ${validationResult.error}`,
            recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModeArchitectureCreation'),
            doneCallback: (success?: boolean, info?: string) => {
              // Architecture will be validated again on next evaluation
            }
          }
        };
      }
      
      // Architecture passed validation, now proceed to review
    }

    // Step 5: Check if architecture needs review (only if architecture is valid and created)
    if (plan.architectureCreated && plan.architecture && !plan.architectureReviewed) {
      plan.creationStep = 'architecture_review';
      
      // Reset plan.reviewed flag for this review step
      plan.reviewed = false;
      plan.reviewedComment = undefined;
      
      // Initialize checklist if not done already
      if (!plan.creationChecklist || plan.creationChecklist.length === 0) {
        const checklistText = this.getConfig('codingagent.plan.creation.checklistArchitectureReview');
        plan.creationChecklist = this.parseChecklistText(checklistText);
      }

      plan.updatedAt = Date.now();
      this.savePlan(plan);

      // Get completion callback configuration
      const callbackConfig = this.getConfig('codingagent.plan.creation.callbackArchitectureReview');

      // If we have checklist items, return the first one
      if (plan.creationChecklist && plan.creationChecklist.length > 0) {
        const firstItem = plan.creationChecklist[0];
        
        // Get the prompt template and replace <checklist> placeholder
        const promptTemplate = this.getConfig('codingagent.plan.creation.promptArchitectureReview');
        const checklistPrompt = this.replacePlaceholders(
          promptTemplate.replace('<checklist>', firstItem),
          planId
        );
        
        return {
          success: true,
          result: {
            isDone: false,
            nextStepPrompt: checklistPrompt,
            failedStep: 'plan_architecture_review',
            reason: 'Plan architecture needs review',
            recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModeArchitectureReview'),
            doneCallback: (success?: boolean, info?: string) => {
              if (success) {
                const currentPlan = this.plans.get(planId);
                if (currentPlan && currentPlan.creationChecklist) {
                  currentPlan.creationChecklist.shift(); // Remove first item
                  if (currentPlan.creationChecklist.length === 0) {
                    currentPlan.architectureReviewed = true;
                  }
                  currentPlan.updatedAt = Date.now();
                  this.savePlan(currentPlan);
                }
              }
            },
            completionCallback: callbackConfig ? () => this.evaluateCompletionCallback(callbackConfig, planId) : undefined
          }
        };
      } else {
        // Fallback if no checklist
        plan.architectureReviewed = true;
        plan.updatedAt = Date.now();
        this.savePlan(plan);
      }
    }

    // Step 6: Check if points need to be created
    if (!plan.pointsCreated || plan.points.length === 0) {
      plan.creationStep = 'points_creation';
      plan.updatedAt = Date.now();
      this.savePlan(plan);

      const prompt = this.replacePlaceholders(
        this.getConfig('codingagent.plan.creation.promptPlanPointsCreation'),
        planId
      );

      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: prompt,
          failedStep: 'plan_points_creation',
          reason: 'Plan implementation points need to be created',
          recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModePlanPointsCreation'),
          doneCallback: (success?: boolean, info?: string) => {
            if (success) {
              const currentPlan = this.plans.get(planId);
              if (currentPlan) {
                currentPlan.pointsCreated = true;
                currentPlan.updatedAt = Date.now();
                this.savePlan(currentPlan);
              }
            }
          }
        }
      };
    }

    // Step 7: Procedural validation of points
    if (plan.points.length > 0) {
      const validationResult = this.validatePlanProcedurally(planId);
      if (!validationResult.success) {
        return { success: false, error: validationResult.error };
      }
      
      if (validationResult.issue) {
        // Use step-specific rework template for plan points creation
        const reworkTemplate = this.getConfig('codingagent.plan.creation.promptPlanPointsCreationRework');
        const reworkPrompt = this.replacePlaceholders(reworkTemplate, planId);
        
        return {
          success: true,
          result: {
            isDone: false,
            nextStepPrompt: reworkPrompt,
            failedStep: 'plan_points_creation_rework',
            failedPoints: validationResult.issue.pointId ? [validationResult.issue.pointId] : undefined,
            reason: validationResult.issue.message,
            recommendedMode: this.getConfig('codingagent.plan.creation.recommendedModePlanPointsCreation')
          }
        };
      }
    }

    // Step 8: Plan creation is complete!
    plan.creationStep = 'complete';
    plan.updatedAt = Date.now();
    this.savePlan(plan);

    const completionPrompt = this.replacePlaceholders(
      this.getConfig('codingagent.plan.creation.promptCreationComplete'),
      planId
    );

    return {
      success: true,
      result: {
        isDone: true,
        nextStepPrompt: completionPrompt,
        failedStep: '',
        reason: 'Plan creation completed successfully'
      }
    };
  }

  /**
   * Validates architecture JSON format and Mermaid compatibility
   */
  private validateArchitectureJson(architectureJson: string): { success: boolean; error?: string } {
    try {
      const architecture = JSON.parse(architectureJson);
      
      // Check required structure
      if (!architecture.components || !Array.isArray(architecture.components)) {
        return { success: false, error: 'Missing or invalid "components" array' };
      }
      
      if (!architecture.connections || !Array.isArray(architecture.connections)) {
        return { success: false, error: 'Missing or invalid "connections" array' };
      }
      
      // Validate components
      for (const component of architecture.components) {
        if (!component.id || !component.name) {
          return { success: false, error: 'Each component must have "id" and "name" properties' };
        }
      }
      
      // Validate connections
      for (const connection of architecture.connections) {
        if (!connection.from || !connection.to) {
          return { success: false, error: 'Each connection must have "from" and "to" properties' };
        }
        
        // Check that referenced components exist
        const componentIds = architecture.components.map((c: any) => c.id);
        if (!componentIds.includes(connection.from)) {
          return { success: false, error: `Connection references non-existent component: ${connection.from}` };
        }
        if (!componentIds.includes(connection.to)) {
          return { success: false, error: `Connection references non-existent component: ${connection.to}` };
        }
      }
      
      // Check that we have some content
      if (architecture.components.length === 0) {
        return { success: false, error: 'Architecture must contain at least one component' };
      }
      
      return { success: true };
      
    } catch (error) {
      return { success: false, error: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Helper to get configuration value
   */
  private getConfig(key: string): string {
    let result = vscode.workspace.getConfiguration().get(key) as string || '';
    
    // Fallback configuration for testing environment
    if (!result) {
      const fallbackConfig: Record<string, string> = {
        'codingagent.plan.creation.promptDescriptionUpdate': 'Use the plan_change tool to update both descriptions. Do not provide only text responses.\n\n**User\'s Original Request:** <plan_translated_request>\n\n**Required Steps:**\n1. Create a clear, concise short description that summarizes what the plan will accomplish\n2. Create a comprehensive long description that includes all user requirements and technical details\n3. **IMMEDIATELY call plan_change tool** with both new descriptions\n4. After tool execution, provide a two-sentence summary of what you did\n\n**Important:** Your response will be considered FAILED if you do not call the plan_change tool. Only text responses without tool calls will be rejected.\n\n**Expected Output:** plan_change tool execution followed by a brief summary.',
        'codingagent.plan.creation.recommendedModeDescriptionUpdate': 'Architect',
        'codingagent.plan.creation.promptDescriptionUpdateRework': 'The descriptions need rework due to validation issues. Please fix and use the plan_change tool again.\n\n**Problems Found:** <rework_reason>\n\n**Required Steps:**\n1. Review the validation errors\n2. Fix the short and long descriptions\n3. **IMMEDIATELY call plan_change tool** with the corrected descriptions\n4. After tool execution, provide a brief summary of what was fixed',
        'codingagent.plan.creation.promptDescriptionReview': '<checklist>\n\nIf you find any problem or problems, use plan_need_works tool to specify found problems. If everything looks fine and no additional work is needed, use tool plan_reviewed to set it.',
        'codingagent.plan.creation.recommendedModeDescriptionReview': 'Reviewer',
        'codingagent.plan.creation.promptDescriptionReviewRework': 'The description review needs rework. Please address the issues and complete the review.\n\n**Problems Found:** <rework_reason>\n\n**Required Steps:**\n1. Review the validation errors\n2. Address the description issues\n3. Use appropriate review tools (plan_reviewed or plan_need_works)\n4. Complete the review process',
        'codingagent.plan.creation.checklistDescriptionReview': 'Are the short and long descriptions clear and comprehensive?\nDo the descriptions match the user requirements?\nIs the technical scope well defined?',
        'codingagent.plan.creation.promptArchitectureCreation': 'Create the comprehensive plan architecture for this project. Use the plan_set_architecture tool to specify the technical architecture.\n\n**User\'s Original Request:** <plan_translated_request>\n\n**Current Plan Context:**\n- **Short Description:** <plan_short_description>\n- **Long Description:** <plan_long_description>\n\n**Required Steps:**\n1. Analyze the requirements and determine the technical architecture\n2. **IMMEDIATELY call plan_set_architecture tool** with the architecture details\n3. After tool execution, provide a brief summary of the architecture\n\n**Important:** Your response will be considered FAILED if you do not call the plan_set_architecture tool. Only text responses without tool calls will be rejected.',
        'codingagent.plan.creation.recommendedModeArchitectureCreation': 'Architect',
        'codingagent.plan.creation.promptArchitectureCreationRework': 'The architecture needs rework due to validation issues. Please fix and use the plan_set_architecture tool again.\n\n**Problems Found:** <rework_reason>\n\n**Required Steps:**\n1. Review the validation errors\n2. Fix the architecture JSON format and content\n3. **IMMEDIATELY call plan_set_architecture tool** with the corrected architecture\n4. After tool execution, provide a brief summary of what was fixed',
        'codingagent.plan.creation.promptArchitectureReview': '<checklist>\n\nIf you find any problem or problems, use plan_need_works tool to specify found problems. If everything looks fine and no additional work is needed, use tool plan_reviewed to set it.',
        'codingagent.plan.creation.recommendedModeArchitectureReview': 'Reviewer',
        'codingagent.plan.creation.promptArchitectureReviewRework': 'The architecture review needs rework. Please address the issues and complete the review.\n\n**Problems Found:** <rework_reason>\n\n**Required Steps:**\n1. Review the validation errors\n2. Address the architecture issues\n3. Use appropriate review tools (plan_reviewed or plan_need_works)\n4. Complete the review process',
        'codingagent.plan.creation.promptPlanPointsCreation': 'Create plan points for this project. Use the plan_create_points tool to add all necessary plan points.\n\n**User\'s Original Request:** <plan_translated_request>\n\n**Current Plan Context:**\n- **Short Description:** <plan_short_description>\n- **Long Description:** <plan_long_description>\n- **Architecture:** <plan_architecture>\n\n**Required Steps:**\n1. Break down the project into manageable plan points\n2. **IMMEDIATELY call plan_create_points tool** with all plan points\n3. After tool execution, provide a brief summary of the plan points\n\n**Important:** Your response will be considered FAILED if you do not call the plan_create_points tool.',
        'codingagent.plan.creation.recommendedModePlanPointsCreation': 'Architect',
        'codingagent.plan.creation.promptPlanPointsCreationRework': 'The plan points need rework due to validation issues. Please fix and use the plan_create_points tool again.\n\n**Problems Found:** <rework_reason>\n\n**Required Steps:**\n1. Review the validation errors\n2. Fix the plan points format and content\n3. **IMMEDIATELY call plan_create_points tool** with the corrected plan points\n4. After tool execution, provide a brief summary of what was fixed',
        'codingagent.plan.creation.promptCreationComplete': 'PLAN CREATION COMPLETED SUCCESSFULLY! The plan now includes comprehensive descriptions, architecture, and detailed implementation points.\n\n**Plan Summary:**\n- **Name:** <plan_name>\n- **Description:** <plan_short_description>\n- **Points:** <plan_points_count> implementation points\n- **Status:** Ready for implementation\n\nThe plan is now ready to be executed. You can proceed with implementing the plan points in the recommended order.'
      };
      
      result = fallbackConfig[key] || '';
    }
    
    return result;
  }

  /**
   * Evaluates completion callback to determine if step is done
   */
  private evaluateCompletionCallback(callbackConfig: string, planId: string): boolean {
    console.log(`[PlanningService] evaluateCompletionCallback called with config: ${callbackConfig}, planId: ${planId}`);
    
    if (!callbackConfig) {
      console.log(`[PlanningService] evaluateCompletionCallback: No callback config provided`);
      return false;
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      console.log(`[PlanningService] evaluateCompletionCallback: Plan ${planId} not found`);
      return false;
    }

    // Parse callback configuration
    const callback = callbackConfig.trim();
    console.log(`[PlanningService] evaluateCompletionCallback: Evaluating callback '${callback}' for plan ${planId}`);
    console.log(`[PlanningService] evaluateCompletionCallback: Plan state - reviewed: ${plan.reviewed}, descriptionsReviewed: ${plan.descriptionsReviewed}, architectureReviewed: ${plan.architectureReviewed}, pointsCreated: ${plan.pointsCreated}, needsWork: ${plan.needsWork}`);
    
    // Handle different callback types
    switch (callback) {
      case 'plan.reviewed':
        const reviewedResult = plan.reviewed === true;
        console.log(`[PlanningService] evaluateCompletionCallback: plan.reviewed check result: ${reviewedResult}`);
        return reviewedResult;
      case 'plan.descriptionsReviewed':  
        const descriptionsResult = plan.descriptionsReviewed === true;
        console.log(`[PlanningService] evaluateCompletionCallback: plan.descriptionsReviewed check result: ${descriptionsResult}`);
        return descriptionsResult;
      case 'plan.architectureReviewed':
        const architectureResult = plan.architectureReviewed === true;
        console.log(`[PlanningService] evaluateCompletionCallback: plan.architectureReviewed check result: ${architectureResult}`);
        return architectureResult;
      case 'plan.pointsCreated':
        const pointsResult = plan.pointsCreated === true;
        console.log(`[PlanningService] evaluateCompletionCallback: plan.pointsCreated check result: ${pointsResult}`);
        return pointsResult;
      case '!plan.needsWork':
        const needsWorkResult = !plan.needsWork;
        console.log(`[PlanningService] evaluateCompletionCallback: !plan.needsWork check result: ${needsWorkResult}`);
        return needsWorkResult;
      default:
        // For more complex callbacks, could add support for JavaScript evaluation
        // For now, return false for unknown callbacks
        console.warn(`[PlanningService] Unknown callback configuration: ${callback}`);
        return false;
    }
  }

  /**
   * Replace placeholders in prompt templates with actual values
   * Supports placeholders using <key> syntax
   */
  public replacePlaceholders(promptTemplate: string, planId?: string, pointId?: string): string {
    let result = promptTemplate;
    
    if (planId) {
      const plan = this.plans.get(planId);
      if (plan) {
        // Plan-related placeholders
        result = result.replace(/<plan_id>/g, plan.id);
        result = result.replace(/<plan_name>/g, plan.name || '');
        result = result.replace(/<plan_short_description>/g, plan.shortDescription || '');
        result = result.replace(/<plan_long_description>/g, plan.longDescription || '');
        result = result.replace(/<plan_architecture>/g, plan.architecture || 'No architecture defined');
        result = result.replace(/<plan_original_request>/g, plan.originalRequest || '');
        result = result.replace(/<plan_translated_request>/g, plan.translatedRequest || '');
        result = result.replace(/<plan_detected_language>/g, plan.detectedLanguage || '');
        
        // Point count information
        result = result.replace(/<plan_points_count>/g, plan.points.length.toString());
        result = result.replace(/<plan_implemented_count>/g, plan.points.filter(p => p.implemented).length.toString());
        result = result.replace(/<plan_reviewed_count>/g, plan.points.filter(p => p.reviewed).length.toString());
        result = result.replace(/<plan_tested_count>/g, plan.points.filter(p => p.tested).length.toString());
        
        // Plan needs work - only the first comment (current one being processed)
        const needsWorkText = plan.needsWorkComments && plan.needsWorkComments.length > 0 
          ? plan.needsWorkComments[0]
          : 'No specific feedback provided';
        result = result.replace(/<plan_needwork>/g, needsWorkText);
        
        if (pointId) {
          const point = plan.points.find(p => p.id === pointId);
          if (point) {
            // Point-related placeholders
            result = result.replace(/<point_id>/g, point.id);
            result = result.replace(/<point_short_name>/g, point.shortName || '');
            result = result.replace(/<point_short_description>/g, point.shortDescription || '');
            result = result.replace(/<point_detailed_description>/g, point.detailedDescription || '');
            result = result.replace(/<point_review_instructions>/g, point.reviewInstructions || '');
            result = result.replace(/<point_testing_instructions>/g, point.testingInstructions || '');
            result = result.replace(/<point_expected_outputs>/g, point.expectedOutputs || '');
            result = result.replace(/<point_expected_inputs>/g, point.expectedInputs || '');
            result = result.replace(/<point_rework_reason>/g, point.reworkReason || '');
            result = result.replace(/<point_reviewed_comment>/g, point.reviewedComment || '');
            result = result.replace(/<point_tested_comment>/g, point.testedComment || '');
          }
        }
        
        // Multiple point IDs for batch operations
        if (promptTemplate.includes('<failed_point_ids>')) {
          // This will be replaced by the calling function with actual failed point IDs
          result = result.replace(/<failed_point_ids>/g, pointId || '');
        }
      }
    }
    
    return result;
  }

  /**
   * Main plan evaluation method that orchestrates all evaluation logic
   * This replaces the distributed logic and centralizes everything here
   */
  public planEvaluate(planId: string, context?: any): { success: boolean; result?: PlanEvaluationResult; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    console.log(`[PlanningService] planEvaluate called for plan ${planId}`);
    
    // Determine if this is plan creation workflow or plan implementation workflow
    const isInCreationPhase = this.isPlanInCreationPhase(plan);
    
    console.log(`[PlanningService] Plan ${planId} classification: ${isInCreationPhase ? 'CREATION PHASE' : 'IMPLEMENTATION PHASE'}`);
    console.log(`[PlanningService] Plan state: descriptionsUpdated=${plan.descriptionsUpdated}, descriptionsReviewed=${plan.descriptionsReviewed}, architectureCreated=${plan.architectureCreated}, architectureReviewed=${plan.architectureReviewed}, pointsCreated=${plan.pointsCreated}, points=${plan.points?.length || 0}`);

    if (isInCreationPhase) {
      console.log(`[PlanningService] Calling evaluatePlanCreation for plan ${planId}`);
      return this.evaluatePlanCreation(planId, plan.originalRequest);
    } else {
      console.log(`[PlanningService] Calling evaluatePlanCompletion for plan ${planId}`);
      //return this.evaluatePlanCompletion(planId);
      return { success: false, error: `Plan completion disabled for testing purposes.` };
    }
  }

  /**
   * Determines if a plan is in the creation phase or implementation phase
   */
  private isPlanInCreationPhase(plan: Plan): boolean {
    // Plan is in creation phase if any of the creation steps are not completed
    // OR if plan needs work during creation (which resets us back to creation workflow)
    
    // If plan needs work, we stay in whichever phase we were in
    // But if we haven't completed basic creation steps, we're definitely in creation phase
    if (!plan.descriptionsUpdated || 
        !plan.descriptionsReviewed || 
        !plan.architectureCreated || 
        !plan.architectureReviewed || 
        !plan.pointsCreated) {
      return true;
    }
    
    // If all creation steps are done but we have no points, we're still in creation
    if (plan.pointsCreated && (!plan.points || plan.points.length === 0)) {
      return true;
    }
    
    // If we have points but they fail procedural validation, we might be in creation rework
    // However, we need to distinguish between creation rework and implementation rework
    // If the plan has been through the full creation cycle before, it's implementation phase
    if (plan.points && plan.points.length > 0 && 
        plan.descriptionsUpdated && plan.descriptionsReviewed && 
        plan.architectureCreated && plan.architectureReviewed && 
        plan.pointsCreated) {
      // All creation steps completed and we have points = implementation phase
      return false;
    }
    
    // Default to creation phase if unclear
    return true;
  }

}
