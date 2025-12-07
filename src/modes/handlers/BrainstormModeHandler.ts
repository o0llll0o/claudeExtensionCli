/**
 * Brainstorm Mode Handler
 *
 * Handles brainstorming sessions by spawning multiple agents with different perspectives.
 * Uses swarmDensity setting to control the number of agents and synthesizes their responses.
 */

import { BaseModeHandler } from './BaseModeHandler';
import {
  ModeRequest,
  ModeResponse,
  BrainstormModeResponse,
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

  runMultipleAgents?(
    agents: Array<{ type: string; task: string; context?: Record<string, unknown> }>,
    options?: { parallel?: boolean }
  ): Promise<Array<{
    agentType: string;
    result: string;
    metadata?: Record<string, unknown>;
  }>>;
}

/**
 * Interface for Claude service dependency (for synthesis)
 */
export interface ClaudeService {
  sendMessage(
    message: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<{
    response: string;
    tokensUsed?: { input: number; output: number };
  }>;
}

/**
 * Agent perspective configurations
 */
const AGENT_PERSPECTIVES = [
  {
    role: 'Critical Analyst',
    prompt: 'Analyze from a critical perspective. Identify potential problems, edge cases, and challenges.'
  },
  {
    role: 'Creative Innovator',
    prompt: 'Think creatively and suggest innovative, out-of-the-box solutions and approaches.'
  },
  {
    role: 'Practical Engineer',
    prompt: 'Focus on practical, implementable solutions. Consider feasibility and resource constraints.'
  },
  {
    role: 'User Advocate',
    prompt: 'Consider the end-user perspective. Focus on usability, accessibility, and user experience.'
  },
  {
    role: 'Performance Optimizer',
    prompt: 'Analyze from a performance and efficiency standpoint. Suggest optimizations.'
  },
  {
    role: 'Security Expert',
    prompt: 'Focus on security implications, vulnerabilities, and best security practices.'
  },
  {
    role: 'Maintainability Specialist',
    prompt: 'Consider long-term maintainability, code quality, and technical debt.'
  },
  {
    role: 'Integration Architect',
    prompt: 'Think about integration points, dependencies, and system architecture.'
  }
];

/**
 * BrainstormModeHandler spawns multiple agents for diverse perspectives
 */
export class BrainstormModeHandler extends BaseModeHandler {
  readonly mode: AppMode = 'brainstorm';

  constructor(
    private orchestrator: SubagentOrchestrator,
    private claudeService: ClaudeService
  ) {
    super();
  }

  /**
   * Execute brainstorm mode handling
   */
  protected async executeHandler(request: ModeRequest): Promise<ModeResponse> {
    this.emitProgress(request.requestId, 'Initializing brainstorm session...', 0);

    try {
      // Determine number of agents based on swarmDensity
      const agentCount = Math.min(
        Math.max(request.settings.swarmDensity, 2),
        AGENT_PERSPECTIVES.length
      );

      const selectedPerspectives = AGENT_PERSPECTIVES.slice(0, agentCount);

      this.emitProgress(
        request.requestId,
        `Spawning ${agentCount} agents with diverse perspectives...`,
        10
      );

      // Spawn agents in parallel
      const agentPromises = selectedPerspectives.map((perspective, index) =>
        this.runPerspectiveAgent(request, perspective, index, agentCount)
      );

      const agentResults = await Promise.all(agentPromises);

      this.emitProgress(request.requestId, 'All agents completed. Synthesizing responses...', 80);

      // Synthesize the responses
      const synthesis = await this.synthesizeResponses(request, agentResults);

      this.emitProgress(request.requestId, 'Brainstorm session complete', 100);

      const response: BrainstormModeResponse = {
        success: true,
        mode: 'brainstorm',
        requestId: request.requestId,
        processingTime: 0, // Will be set by base handler
        synthesis: synthesis.summary,
        agentResponses: agentResults,
        commonThemes: synthesis.commonThemes,
        divergentIdeas: synthesis.divergentIdeas
      };

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete brainstorm session';
      throw new Error(`Brainstorm mode error: ${errorMessage}`);
    }
  }

  /**
   * Run a single agent with a specific perspective
   */
  private async runPerspectiveAgent(
    request: ModeRequest,
    perspective: { role: string; prompt: string },
    index: number,
    total: number
  ): Promise<BrainstormModeResponse['agentResponses'][0]> {
    const agentId = `agent-${index + 1}`;
    const progress = 10 + ((index + 1) / total) * 60;

    this.emitProgress(
      request.requestId,
      `${perspective.role} analyzing...`,
      progress
    );

    // Build task with perspective
    const task = `${perspective.prompt}\n\nTask: ${request.message}\n\nProvide your perspective and key insights.`;

    try {
      // Use orchestrator to run the agent
      const result = await this.orchestrator.runAgent(
        'planner', // Use planner as the base agent type
        task,
        {
          role: perspective.role,
          workspaceRoot: request.context.workspaceRoot,
          activeFile: request.context.activeFile
        }
      );

      // Extract key points from the response
      const keyPoints = this.extractKeyPoints(result.result);

      return {
        agentId,
        role: perspective.role,
        perspective: result.result,
        keyPoints
      };

    } catch (error) {
      // If an agent fails, return a fallback response
      return {
        agentId,
        role: perspective.role,
        perspective: `Unable to generate ${perspective.role} perspective due to an error.`,
        keyPoints: []
      };
    }
  }

  /**
   * Extract key points from agent response
   */
  private extractKeyPoints(response: string): string[] {
    const points: string[] = [];

    // Look for bullet points or numbered lists
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.match(/^[-•*]\s/) ||
        trimmed.match(/^\d+\.\s/)
      ) {
        const point = trimmed
          .replace(/^[-•*]\s/, '')
          .replace(/^\d+\.\s/, '')
          .trim();
        if (point.length > 0) {
          points.push(point);
        }
      }
    }

    // If no bullet points found, take first few sentences
    if (points.length === 0) {
      const sentences = response.match(/[^.!?]+[.!?]+/g) || [];
      points.push(...sentences.slice(0, 3).map(s => s.trim()));
    }

    return points.slice(0, 5); // Limit to 5 key points
  }

  /**
   * Synthesize all agent responses into a coherent summary
   */
  private async synthesizeResponses(
    request: ModeRequest,
    agentResults: BrainstormModeResponse['agentResponses']
  ): Promise<{
    summary: string;
    commonThemes?: string[];
    divergentIdeas?: string[];
  }> {
    // Build synthesis prompt
    const synthesisPrompt = this.buildSynthesisPrompt(request.message, agentResults);

    try {
      const result = await this.claudeService.sendMessage(
        synthesisPrompt,
        [],
        'You are a synthesis expert. Analyze multiple perspectives and create a coherent summary highlighting common themes and divergent ideas.'
      );

      // Try to parse structured response
      return this.parseSynthesis(result.response);

    } catch (error) {
      // Fallback: simple concatenation
      return {
        summary: this.createFallbackSynthesis(agentResults),
        commonThemes: undefined,
        divergentIdeas: undefined
      };
    }
  }

  /**
   * Build synthesis prompt from agent results
   */
  private buildSynthesisPrompt(
    originalTask: string,
    agentResults: BrainstormModeResponse['agentResponses']
  ): string {
    let prompt = `Task: ${originalTask}\n\n`;
    prompt += `Multiple experts have provided their perspectives. Please synthesize these into a coherent summary.\n\n`;

    agentResults.forEach((result, index) => {
      prompt += `### ${result.role} Perspective:\n${result.perspective}\n\n`;
    });

    prompt += `\nProvide a JSON response with:\n`;
    prompt += `{\n`;
    prompt += `  "summary": "Comprehensive synthesis of all perspectives",\n`;
    prompt += `  "commonThemes": ["Theme 1", "Theme 2"],\n`;
    prompt += `  "divergentIdeas": ["Unique idea 1", "Unique idea 2"]\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * Parse synthesis response
   */
  private parseSynthesis(response: string): {
    summary: string;
    commonThemes?: string[];
    divergentIdeas?: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || response,
          commonThemes: parsed.commonThemes,
          divergentIdeas: parsed.divergentIdeas
        };
      }
    } catch (error) {
      // Fall through to return response as summary
    }

    return { summary: response };
  }

  /**
   * Create fallback synthesis when AI synthesis fails
   */
  private createFallbackSynthesis(
    agentResults: BrainstormModeResponse['agentResponses']
  ): string {
    let summary = `Perspectives from ${agentResults.length} experts:\n\n`;

    agentResults.forEach((result, index) => {
      summary += `**${result.role}**: ${result.keyPoints[0] || 'No key points available'}\n\n`;
    });

    return summary;
  }

  /**
   * Custom validation for brainstorm mode
   */
  protected customValidate(request: ModeRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Brainstorm requires a clear topic
    if (request.message.length < 10) {
      errors.push('Brainstorm mode requires a detailed topic (minimum 10 characters)');
    }

    // Check swarm density is reasonable
    if (request.settings.swarmDensity < 2) {
      errors.push('Brainstorm mode requires at least 2 agents (swarmDensity >= 2)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Cleanup for brainstorm mode
   */
  protected async cleanup(requestId: string): Promise<void> {
    // Could be used to cancel all spawned agents
    // This would require tracking agent IDs and having a cancel mechanism
  }
}
