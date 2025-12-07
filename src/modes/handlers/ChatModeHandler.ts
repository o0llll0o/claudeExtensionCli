/**
 * Chat Mode Handler
 *
 * Handles standard conversational interactions with Claude.
 * Provides direct access to ClaudeService with conversation history support.
 */

import { BaseModeHandler } from './BaseModeHandler';
import {
  ModeRequest,
  ModeResponse,
  ChatModeResponse,
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
 * ChatModeHandler provides standard conversational AI interactions
 */
export class ChatModeHandler extends BaseModeHandler {
  readonly mode: AppMode = 'chat';

  constructor(private claudeService: ClaudeService) {
    super();
  }

  /**
   * Execute chat mode handling
   */
  protected async executeHandler(request: ModeRequest): Promise<ModeResponse> {
    this.emitProgress(request.requestId, 'Processing chat request...', 0);

    try {
      // Get custom system prompt if configured
      const systemPrompt = request.settings.systemPrompts?.chat;

      // Call Claude service
      const result = await this.claudeService.sendMessage(
        request.message,
        request.context.conversationHistory,
        systemPrompt
      );

      this.emitProgress(request.requestId, 'Chat response received', 100);

      const response: ChatModeResponse = {
        success: true,
        mode: 'chat',
        requestId: request.requestId,
        processingTime: 0, // Will be set by base handler
        response: result.response,
        tokensUsed: result.tokensUsed
      };

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get chat response';
      throw new Error(`Chat mode error: ${errorMessage}`);
    }
  }

  /**
   * Custom validation for chat mode
   */
  protected customValidate(request: ModeRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Chat mode has no special validation requirements
    // Message length check could be added here if needed
    if (request.message.length > 100000) {
      errors.push('Message exceeds maximum length of 100,000 characters');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Cleanup for chat mode
   */
  protected async cleanup(requestId: string): Promise<void> {
    // Chat mode typically doesn't need cleanup
    // Could be used to cancel streaming responses in the future
  }
}
