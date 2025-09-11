// src/tools/planPointShow.ts

import { BaseTool, ToolInfo, ToolDefinition, ToolResult } from '../types';
import { PlanningService } from '../planningService';
import { PlanContextManager } from '../planContextManager';

export class PlanPointShowTool implements BaseTool {
  getToolInfo(): ToolInfo {
    return {
      name: 'plan_point_show',
      displayName: 'Show Plan Point Details',
      description: 'Show specific sections of a plan point with selective information display',
      category: 'other'
    };
  }

  getToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: 'plan_point_show',
        description: 'Show specific details of a point in the current active plan. Select which information sections to display.',
        parameters: {
          type: 'object',
          properties: {
            point_id: {
              type: 'string',
              description: 'ID of the point to display'
            },
            sections: {
              type: 'array',
              description: 'Array of section names to display. Use "all" to display all sections. Available sections: "plan_short_description", "plan_long_description", "short_description", "long_description", "expected_inputs", "expected_outputs", "acceptance_criteria", "depends_on_points", "care_on_points", "comments", "state"',
              items: {
                type: 'string',
                enum: [
                  'all',
                  'plan_short_description',
                  'plan_long_description', 
                  'short_description',
                  'long_description',
                  'expected_inputs',
                  'expected_outputs',
                  'acceptance_criteria',
                  'depends_on_points',
                  'care_on_points',
                  'comments',
                  'state'
                ]
              },
              minItems: 1
            }
          },
          required: ['point_id', 'sections'],
          additionalProperties: false
        }
      }
    };
  }

  async execute(args: any, workspaceRoot: string): Promise<ToolResult> {
    const { point_id, sections } = args;

    if (!point_id) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: point_id'
      };
    }

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return {
        success: false,
        content: '',
        error: 'Required parameter: sections (array of section names)'
      };
    }

    try {
      // Get current active plan from context
      const planContextManager = PlanContextManager.getInstance();
      const currentPlanId = planContextManager.getCurrentPlanId();
      
      if (!currentPlanId) {
        return {
          success: false,
          content: '',
          error: 'No active plan. Use plan_open to select a plan or plan_new to create one.'
        };
      }

      const planningService = PlanningService.getInstance(workspaceRoot);
      const pointResult = planningService.showPoint(currentPlanId, point_id);

      if (!pointResult.success || !pointResult.point) {
        return {
          success: false,
          content: '',
          error: pointResult.error || 'Point not found'
        };
      }

      const point = pointResult.point;
      let content = `Plan: ${currentPlanId}\nPoint ID: ${point.id}\n\n`;

      // Handle "all" sections - expand to all available sections
      let sectionsToShow = sections;
      if (sections.includes('all')) {
        sectionsToShow = [
          'plan_short_description',
          'plan_long_description',
          'short_description', 
          'long_description',
          'expected_inputs',
          'expected_outputs',
          'acceptance_criteria',
          'depends_on_points',
          'care_on_points',
          'state',
          'comments'
        ];
      }

      // Get plan info for plan sections
      let planInfo = null;
      if (sectionsToShow.includes('plan_short_description') || sectionsToShow.includes('plan_long_description')) {
        const planResult = planningService.showPlan(currentPlanId, true); // Include point descriptions
        planInfo = planResult.success ? planResult.plan : null;
      }

      // Build selective content based on requested sections
      for (const section of sectionsToShow) {
        switch (section) {
          case 'plan_short_description':
            if (planInfo && planInfo.shortDescription) {
              content += `📋 Plan Short Description:\n${planInfo.shortDescription}\n\n`;
            }
            break;

          case 'plan_long_description':
            if (planInfo && planInfo.longDescription) {
              content += `📄 Plan Long Description:\n${planInfo.longDescription}\n\n`;
            }
            break;

          case 'short_description':
            content += `🏷️ Point Title: ${point.shortName}\n`;
            content += `📝 Short Description: ${point.shortDescription}\n\n`;
            break;

          case 'long_description':
            content += `📖 Detailed Description:\n${point.detailedDescription}\n\n`;
            break;

          case 'expected_inputs':
            if (point.expectedInputs) {
              content += `📥 Expected Inputs:\n${point.expectedInputs}\n\n`;
            } else {
              content += `📥 Expected Inputs: Not specified\n\n`;
            }
            break;

          case 'expected_outputs':
            if (point.expectedOutputs) {
              content += `🎯 Expected Outputs:\n${point.expectedOutputs}\n\n`;
            } else {
              content += `🎯 Expected Outputs: Not specified\n\n`;
            }
            break;

          case 'acceptance_criteria':
            content += `✅ Acceptance Criteria:\n${point.acceptanceCriteria}\n\n`;
            break;

          case 'state':
            content += `📊 Status:\n`;
            content += `  Implemented: ${point.state.implemented ? '✅' : '❌'}\n`;
            content += `  Reviewed: ${point.state.reviewed ? '✅' : '❌'}`;
            if (point.state.reviewed && point.state.reviewedComment) {
              content += ` - ${point.state.reviewedComment}`;
            }
            content += `\n`;
            content += `  Tested: ${point.state.tested ? '✅' : '❌'}`;
            if (point.state.tested && point.state.testedComment) {
              content += ` - ${point.state.testedComment}`;
            }
            content += `\n`;
            content += `  Accepted: ${point.state.accepted ? '✅' : '❌'}\n`;
            content += `  Needs Rework: ${point.state.needRework ? '❌' : '✅'}`;
            if (point.state.needRework && point.state.reworkReason) {
              content += ` - ${point.state.reworkReason}`;
            }
            content += `\n\n`;
            break;

          case 'depends_on_points':
            // Get depends_on information from the point data
            if (point.dependsOn && point.dependsOn.length > 0) {
              content += `🔗 Depends On Points:\n`;
              // Get plan to look up point details
              const planResult = planningService.showPlan(currentPlanId, true);
              if (planResult.success && planResult.plan) {
                point.dependsOn.forEach((depId: string) => {
                  if (depId === '-1') {
                    content += `  - Independent (no dependencies)\n`;
                  } else {
                    const depPoint = planResult.plan.points.find((p: any) => p.id === depId);
                    if (depPoint) {
                      content += `  - [${depPoint.id}] ${depPoint.shortName}\n`;
                    } else {
                      content += `  - [${depId}] Point not found\n`;
                    }
                  }
                });
              } else {
                point.dependsOn.forEach((depId: string) => {
                  content += `  - [${depId}]\n`;
                });
              }
              content += '\n';
            } else {
              content += `🔗 Depends On Points: Not set\n\n`;
            }
            break;

          case 'care_on_points':
            if (point.careOnPoints && point.careOnPoints.length > 0) {
              content += `🔗 Care-On Points (Dependencies):\n`;
              point.careOnPoints.forEach((carePoint: any) => {
                content += `  - [${carePoint.id}] ${carePoint.shortName}\n`;
              });
              content += '\n';
            } else {
              content += `🔗 Care-On Points: None\n\n`;
            }
            break;

          case 'comments':
            if (point.comments && point.comments.length > 0) {
              content += `💬 Comments:\n`;
              point.comments.forEach((comment: string, index: number) => {
                content += `  ${index + 1}. ${comment}\n`;
              });
              content += '\n';
            } else {
              content += `💬 Comments: None\n\n`;
            }
            break;

          default:
            // Unknown section, skip
            break;
        }
      }

      return {
        success: true,
        content: content.trim()
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: `Failed to show point: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
