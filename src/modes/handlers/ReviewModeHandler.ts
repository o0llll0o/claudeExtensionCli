/**
 * Review Mode Handler
 *
 * Handles code review requests with specialized prompts and structured analysis.
 * Analyzes code for issues, strengths, and improvement opportunities.
 */

import { BaseModeHandler } from './BaseModeHandler';
import {
  ModeRequest,
  ModeResponse,
  ReviewModeResponse,
  AppMode
} from '../types';

/**
 * Interface for Claude service dependency
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
 * Default system prompt for code review
 */
const DEFAULT_REVIEW_PROMPT = `You are an expert code reviewer. Analyze the provided code and provide:

1. A concise summary of the code's purpose and quality
2. Specific issues categorized by severity (error, warning, info)
3. Strengths and positive aspects of the code
4. Actionable recommendations for improvement

Format your response as JSON with this structure:
{
  "summary": "Overall review summary",
  "issues": [
    {
      "severity": "error|warning|info",
      "message": "Issue description",
      "file": "optional file path",
      "line": optional line number,
      "suggestion": "How to fix it"
    }
  ],
  "strengths": ["Positive aspect 1", "Positive aspect 2"],
  "recommendations": ["Improvement 1", "Improvement 2"]
}

Focus on:
- Code quality and maintainability
- Security vulnerabilities
- Performance issues
- Best practices and patterns
- Documentation and readability`;

/**
 * ReviewModeHandler provides structured code review analysis
 */
export class ReviewModeHandler extends BaseModeHandler {
  readonly mode: AppMode = 'review';

  constructor(private claudeService: ClaudeService) {
    super();
  }

  /**
   * Execute review mode handling
   */
  protected async executeHandler(request: ModeRequest): Promise<ModeResponse> {
    this.emitProgress(request.requestId, 'Analyzing code...', 0);

    try {
      // Prepare review context
      const reviewContext = this.buildReviewContext(request);

      this.emitProgress(request.requestId, 'Performing code review...', 30);

      // Get custom system prompt or use default
      const systemPrompt = request.settings.systemPrompts?.review || DEFAULT_REVIEW_PROMPT;

      // Call Claude service
      const result = await this.claudeService.sendMessage(
        reviewContext,
        [], // Reviews typically don't need conversation history
        systemPrompt
      );

      this.emitProgress(request.requestId, 'Parsing review results...', 80);

      // Parse the review response
      const reviewData = this.parseReviewResponse(result.response);

      this.emitProgress(request.requestId, 'Review complete', 100);

      const response: ReviewModeResponse = {
        success: true,
        mode: 'review',
        requestId: request.requestId,
        processingTime: 0, // Will be set by base handler
        summary: reviewData.summary,
        issues: reviewData.issues,
        strengths: reviewData.strengths,
        recommendations: reviewData.recommendations,
        metadata: {
          tokensUsed: result.tokensUsed
        }
      };

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform code review';
      throw new Error(`Review mode error: ${errorMessage}`);
    }
  }

  /**
   * Build review context from request
   */
  private buildReviewContext(request: ModeRequest): string {
    let context = `Please review the following:\n\n`;

    // Add selected code if available
    if (request.context.selectedText) {
      context += `Code to review:\n\`\`\`\n${request.context.selectedText}\n\`\`\`\n\n`;
    }

    // Add file context
    if (request.context.activeFile) {
      context += `File: ${request.context.activeFile}\n\n`;
    }

    // Add user's specific review request
    context += `Review focus: ${request.message}\n`;

    return context;
  }

  /**
   * Parse Claude's review response into structured format
   */
  private parseReviewResponse(response: string): {
    summary: string;
    issues: ReviewModeResponse['issues'];
    strengths?: string[];
    recommendations?: string[];
  } {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Review completed',
          issues: parsed.issues || [],
          strengths: parsed.strengths,
          recommendations: parsed.recommendations
        };
      }

      // Fallback: extract from markdown/text format
      return this.parseTextReview(response);

    } catch (error) {
      // If parsing fails, return the full response as summary
      return {
        summary: response,
        issues: []
      };
    }
  }

  /**
   * Parse text-based review into structured format
   */
  private parseTextReview(text: string): {
    summary: string;
    issues: ReviewModeResponse['issues'];
    strengths?: string[];
    recommendations?: string[];
  } {
    const lines = text.split('\n');
    const issues: ReviewModeResponse['issues'] = [];
    const strengths: string[] = [];
    const recommendations: string[] = [];
    let summary = '';
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect sections
      if (trimmed.toLowerCase().includes('summary')) {
        currentSection = 'summary';
        continue;
      } else if (trimmed.toLowerCase().includes('issue') || trimmed.toLowerCase().includes('problem')) {
        currentSection = 'issues';
        continue;
      } else if (trimmed.toLowerCase().includes('strength') || trimmed.toLowerCase().includes('positive')) {
        currentSection = 'strengths';
        continue;
      } else if (trimmed.toLowerCase().includes('recommend') || trimmed.toLowerCase().includes('improvement')) {
        currentSection = 'recommendations';
        continue;
      }

      // Extract content based on section
      if (trimmed.length > 0) {
        if (currentSection === 'summary') {
          summary += trimmed + ' ';
        } else if (currentSection === 'issues' && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
          const message = trimmed.substring(1).trim();
          issues.push({
            severity: this.detectSeverity(message),
            message
          });
        } else if (currentSection === 'strengths' && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
          strengths.push(trimmed.substring(1).trim());
        } else if (currentSection === 'recommendations' && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
          recommendations.push(trimmed.substring(1).trim());
        }
      }
    }

    return {
      summary: summary.trim() || text.substring(0, 200),
      issues,
      strengths: strengths.length > 0 ? strengths : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  /**
   * Detect severity from issue text
   */
  private detectSeverity(message: string): 'error' | 'warning' | 'info' {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('critical') ||
      lowerMessage.includes('security') ||
      lowerMessage.includes('error') ||
      lowerMessage.includes('bug')
    ) {
      return 'error';
    }

    if (
      lowerMessage.includes('warning') ||
      lowerMessage.includes('potential') ||
      lowerMessage.includes('should')
    ) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Custom validation for review mode
   */
  protected customValidate(request: ModeRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Review mode should have either selected text or a file reference
    if (!request.context.selectedText && !request.context.activeFile) {
      errors.push('Review mode requires either selected text or an active file');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}
