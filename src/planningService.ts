// src/planningService.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface PlanPoint {
  id: string;
  shortName: string;
  shortDescription: string;
  detailedDescription: string;
  acceptanceCriteria: string;
  expectedOutputs: string;
  status: string;
  careOn: boolean;
  comment: string;
  careOnComment: string;
  careOnPoints: string[];
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
  needsWorkComment?: string;
  accepted: boolean;
  acceptedComment?: string;
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

export interface PlanEvaluationResult {
  isDone: boolean;
  nextStepPrompt: string; // Always required now - even for done plans
  failedStep?: 'plan_rework' | 'plan_review' | 'rework' | 'implementation' | 'code_review' | 'testing' | 'acceptance';
  failedPoints?: string[];
  reason?: string;
}

export class PlanningService {
  private static instance: PlanningService;
  private plans: Map<string, Plan> = new Map();
  private plansDirectory: string;

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
      const filePath = path.join(this.plansDirectory, `${plan.id}.json`);
      const content = JSON.stringify(plan, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save plan ${plan.id}: ${error instanceof Error ? error.message : String(error)}`);
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
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

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
    acceptanceCriteria: string,
    expectedOutputs: string = ''
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
      acceptanceCriteria,
      expectedOutputs,
      status: 'pending',
      careOn: false,
      comment: '',
      careOnComment: '',
      careOnPoints: [],
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
      acceptance_criteria: string;
      expected_outputs: string;
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
        acceptanceCriteria: pointData.acceptance_criteria,
        expectedOutputs: pointData.expected_outputs,
        status: 'pending',
        careOn: false,
        comment: '',
        careOnComment: '',
        careOnPoints: [],
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
    this.savePlan(plan);

    return { success: true, pointIds: newPointIds };
  }

  public changePoint(
    planId: string,
    pointId: string,
    updates: Partial<Pick<PlanPoint, 'shortName' | 'shortDescription' | 'detailedDescription' | 'acceptanceCriteria' | 'expectedOutputs'>>
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
    if (updates.shortName !== undefined) point.shortName = updates.shortName;
    if (updates.shortDescription !== undefined) point.shortDescription = updates.shortDescription;
    if (updates.detailedDescription !== undefined) point.detailedDescription = updates.detailedDescription;
    if (updates.acceptanceCriteria !== undefined) point.acceptanceCriteria = updates.acceptanceCriteria;
    if (updates.expectedOutputs !== undefined) point.expectedOutputs = updates.expectedOutputs;

    point.updatedAt = Date.now();
    plan.updatedAt = Date.now();
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
      longDescription: plan.longDescription,
      points: plan.points.map(point => ({
        id: point.id,
        shortName: point.shortName,
        ...(includePointDescriptions && { shortDescription: point.shortDescription })
      }))
    };

    return { success: true, plan: result };
  }

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
      acceptanceCriteria: point.acceptanceCriteria,
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
    plan.needsWorkComment = undefined;
    plan.accepted = false;  // Reset acceptance when plan structure is reviewed
    plan.acceptedComment = undefined;
    plan.updatedAt = Date.now();
    this.savePlan(plan);

    return { success: true };
  }

  public setPlanNeedsWork(planId: string, comment: string): { success: boolean; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    plan.needsWork = true;
    plan.needsWorkComment = comment;
    plan.reviewed = false;
    plan.reviewedComment = undefined;
    plan.accepted = false;
    plan.acceptedComment = undefined;
    plan.updatedAt = Date.now();
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
    plan.needsWorkComment = undefined;
    plan.updatedAt = Date.now();
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
    this.savePlan(plan);

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
    this.savePlan(plan);

    return { success: true, removedPoints };
  }

  /**
   * Evaluates plan completion status and generates corrective prompts if needed
   * New priority order: plan not reviewed -> points need rework -> points not reviewed -> points not tested -> points not implemented -> plan accepted
   * Rule: Points which are not implemented cannot be marked as not reviewed or not tested
   */
  public evaluatePlanCompletion(planId: string): { success: boolean; result?: PlanEvaluationResult; error?: string } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: `Plan with ID '${planId}' not found` };
    }

    // Step 1: Check if plan needs rework (highest priority)
    if (plan.needsWork) {
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('plan_rework', [], 'Plan needs rework', planId),
          failedStep: 'plan_rework',
          reason: plan.needsWorkComment || 'Plan needs rework'
        }
      };
    }

    // Step 2: Check if plan is reviewed (second priority)
    if (!plan.reviewed) {
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('plan_review', [], 'Plan has not been reviewed yet', planId),
          failedStep: 'plan_review',
          reason: 'Plan has not been reviewed yet'
        }
      };
    }

    // Step 3: Check if any points need rework (third priority)
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
          reason: `Plan point ${firstPoint.id} needs rework`
        }
      };
    }

    // Step 4: Check if all implemented points are reviewed (fourth priority)
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
          reason: `Plan point ${firstPoint.id} is not reviewed`
        }
      };
    }

    // Step 5: Check if any implemented point needs testing (fifth priority)
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
          reason: `Plan point ${firstUntestedPoint.id} is not tested`
        }
      };
    }

    // Step 6: Check if any point needs implementation (sixth priority)
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
          reason: `Plan point ${firstUnimplementedPoint.id} is not implemented`
        }
      };
    }

    // Step 7: Check if plan is accepted (lowest priority)
    if (!plan.accepted) {
      return {
        success: true,
        result: {
          isDone: false,
          nextStepPrompt: this.generateCorrectionPrompt('acceptance', [], 'Plan has not been accepted yet', planId),
          failedStep: 'acceptance',
          reason: 'Plan has not been accepted yet'
        }
      };
    }

    // All checks passed - plan is complete
    return {
      success: true,
      result: {
        isDone: true,
        nextStepPrompt: this.generateCorrectionPrompt('done', [], '', planId)
      }
    };
  }

  /**
   * Generates corrective prompts with configurable templates
   */
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
    
    // Replace placeholders where present
    if (template.indexOf('<id>') !== -1) {
      template = template.replace(/<id>/g, pointIds.join(', '));
    }
    if (template.indexOf('<reason>') !== -1) {
      template = template.replace(/<reason>/g, reason);
    }
    
    // For implementation, also replace <role> placeholder
    if (step === 'implementation' && pointIds.length > 0 && planId) {
      const plan = this.plans.get(planId);
      if (plan) {
        const point = plan.points.find(p => p.id === pointIds[0]);
        if (point) {
          // No role replacement needed since implementerRole was removed
          // template = template.replace(/<role>/g, 'implementer');
        }
      }
    }
    
    return template;
  }
}
