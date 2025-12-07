/**
 * Plan Mode Handler
 *
 * Handles planning and task breakdown using the SubagentOrchestrator's planner agent.
 * Generates structured, actionable plans with dependencies and risk analysis.
 */

import { BaseModeHandler } from './BaseModeHandler';
import {
  ModeRequest,
  ModeResponse,
  PlanModeResponse,
  AppMode
} from '../types';

/**
 * Interface for SubagentOrchestrator dependency
 */
export interface SubagentOrchestrator {
  runAgent(
    agentType: 'planner' | 'coder' | 'verifier',
    task: string,
    context?: Record<string, unknown>
  ): Promise<{
    result: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Default system prompt for planning
 */
const DEFAULT_PLAN_PROMPT = `You are an expert project planner. Break down the task into a structured plan.

Provide your response as JSON with this structure:
{
  "planSummary": "High-level overview of the plan",
  "steps": [
    {
      "id": "step-1",
      "title": "Step title",
      "description": "Detailed description",
      "dependencies": ["step-id-1", "step-id-2"],
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "risks": [
    {
      "description": "Risk description",
      "mitigation": "How to mitigate"
    }
  ],
  "successCriteria": ["Criterion 1", "Criterion 2"]
}

Focus on:
- Clear, actionable steps
- Realistic dependencies
- Potential risks and mitigations
- Measurable success criteria`;

/**
 * PlanModeHandler generates structured plans using the planner agent
 */
export class PlanModeHandler extends BaseModeHandler {
  readonly mode: AppMode = 'plan';

  constructor(private orchestrator: SubagentOrchestrator) {
    super();
  }

  /**
   * Execute plan mode handling
   */
  protected async executeHandler(request: ModeRequest): Promise<ModeResponse> {
    this.emitProgress(request.requestId, 'Initializing planner agent...', 0);

    try {
      // Build planning context
      const planContext = this.buildPlanContext(request);

      this.emitProgress(request.requestId, 'Analyzing requirements...', 20);

      // Run the planner agent
      const result = await this.orchestrator.runAgent(
        'planner',
        planContext,
        {
          workspaceRoot: request.context.workspaceRoot,
          activeFile: request.context.activeFile,
          settings: request.settings
        }
      );

      this.emitProgress(request.requestId, 'Structuring plan...', 70);

      // Parse the plan response
      const planData = this.parsePlanResponse(result.result);

      this.emitProgress(request.requestId, 'Plan generation complete', 100);

      const response: PlanModeResponse = {
        success: true,
        mode: 'plan',
        requestId: request.requestId,
        processingTime: 0, // Will be set by base handler
        planSummary: planData.planSummary,
        steps: planData.steps,
        risks: planData.risks,
        successCriteria: planData.successCriteria,
        metadata: result.metadata
      };

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate plan';
      throw new Error(`Plan mode error: ${errorMessage}`);
    }
  }

  /**
   * Build planning context from request
   */
  private buildPlanContext(request: ModeRequest): string {
    let context = `Please create a detailed plan for the following:\n\n`;
    context += `Task: ${request.message}\n\n`;

    if (request.context.workspaceRoot) {
      context += `Workspace: ${request.context.workspaceRoot}\n`;
    }

    if (request.context.activeFile) {
      context += `Current file: ${request.context.activeFile}\n`;
    }

    if (request.context.selectedText) {
      context += `\nContext code:\n\`\`\`\n${request.context.selectedText}\n\`\`\`\n`;
    }

    // Add custom planning prompt if configured
    if (request.settings.systemPrompts?.plan) {
      context += `\n${request.settings.systemPrompts.plan}\n`;
    } else {
      context += `\n${DEFAULT_PLAN_PROMPT}\n`;
    }

    return context;
  }

  /**
   * Parse planner response into structured format
   */
  private parsePlanResponse(response: string): {
    planSummary: string;
    steps: PlanModeResponse['steps'];
    risks?: PlanModeResponse['risks'];
    successCriteria?: string[];
  } {
    try {
      // Try to parse as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          planSummary: parsed.planSummary || 'Plan generated',
          steps: parsed.steps || [],
          risks: parsed.risks,
          successCriteria: parsed.successCriteria
        };
      }

      // Fallback: extract from markdown/text format
      return this.parseTextPlan(response);

    } catch (error) {
      // If parsing fails, create a simple plan
      return {
        planSummary: response.substring(0, 200),
        steps: [{
          id: 'step-1',
          title: 'Review plan details',
          description: 'See full plan in summary',
          estimatedComplexity: 'medium'
        }]
      };
    }
  }

  /**
   * Parse text-based plan into structured format
   */
  private parseTextPlan(text: string): {
    planSummary: string;
    steps: PlanModeResponse['steps'];
    risks?: PlanModeResponse['risks'];
    successCriteria?: string[];
  } {
    const lines = text.split('\n');
    const steps: PlanModeResponse['steps'] = [];
    const risks: PlanModeResponse['risks'] = [];
    const successCriteria: string[] = [];
    let summary = '';
    let currentSection = '';
    let stepCounter = 1;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect sections
      if (trimmed.toLowerCase().includes('summary') || trimmed.toLowerCase().includes('overview')) {
        currentSection = 'summary';
        continue;
      } else if (trimmed.toLowerCase().includes('step') || trimmed.toLowerCase().includes('phase')) {
        currentSection = 'steps';
        continue;
      } else if (trimmed.toLowerCase().includes('risk')) {
        currentSection = 'risks';
        continue;
      } else if (trimmed.toLowerCase().includes('success') || trimmed.toLowerCase().includes('criteria')) {
        currentSection = 'successCriteria';
        continue;
      }

      // Extract content
      if (trimmed.length > 0) {
        if (currentSection === 'summary') {
          summary += trimmed + ' ';
        } else if (currentSection === 'steps') {
          if (trimmed.match(/^\d+\./) || trimmed.startsWith('-') || trimmed.startsWith('•')) {
            const description = trimmed.replace(/^\d+\./, '').replace(/^[-•]/, '').trim();
            steps.push({
              id: `step-${stepCounter++}`,
              title: description.substring(0, 50),
              description,
              estimatedComplexity: this.estimateComplexity(description)
            });
          }
        } else if (currentSection === 'risks' && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
          const riskText = trimmed.substring(1).trim();
          risks.push({
            description: riskText,
            mitigation: 'Review and address as needed'
          });
        } else if (currentSection === 'successCriteria' && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
          successCriteria.push(trimmed.substring(1).trim());
        }
      }
    }

    return {
      planSummary: summary.trim() || text.substring(0, 200),
      steps,
      risks: risks.length > 0 ? risks : undefined,
      successCriteria: successCriteria.length > 0 ? successCriteria : undefined
    };
  }

  /**
   * Estimate complexity from step description
   */
  private estimateComplexity(description: string): 'low' | 'medium' | 'high' {
    const lowerDesc = description.toLowerCase();

    if (
      lowerDesc.includes('complex') ||
      lowerDesc.includes('refactor') ||
      lowerDesc.includes('architecture') ||
      lowerDesc.includes('migrate')
    ) {
      return 'high';
    }

    if (
      lowerDesc.includes('implement') ||
      lowerDesc.includes('integrate') ||
      lowerDesc.includes('design')
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Custom validation for plan mode
   */
  protected customValidate(request: ModeRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Plan mode requires a clear task description
    if (request.message.length < 10) {
      errors.push('Plan mode requires a detailed task description (minimum 10 characters)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
