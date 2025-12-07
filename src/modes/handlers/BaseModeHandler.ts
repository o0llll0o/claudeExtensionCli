/**
 * Base Mode Handler
 *
 * Abstract base class that provides common functionality for all mode handlers.
 * Implements shared validation, error handling, and timing logic.
 */

import {
  ModeHandler,
  ModeRequest,
  ModeResponse,
  AppMode,
  ModeEvent
} from '../types';

/**
 * Abstract base class for mode handlers
 */
export abstract class BaseModeHandler implements ModeHandler {
  /**
   * Active request IDs being processed
   */
  protected activeRequests: Set<string> = new Set();

  /**
   * Event listeners
   */
  protected listeners: Array<(event: ModeEvent) => void> = [];

  /**
   * The mode this handler supports (must be implemented by subclass)
   */
  abstract readonly mode: AppMode;

  /**
   * Add an event listener
   */
  public addEventListener(listener: (event: ModeEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  public removeEventListener(listener: (event: ModeEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   */
  protected emit(event: ModeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in mode event listener:', error);
      }
    });
  }

  /**
   * Default implementation - checks if mode matches
   */
  public canHandle(request: ModeRequest): boolean {
    return request.mode === this.mode;
  }

  /**
   * Validate the request structure and required fields
   */
  public validate(request: ModeRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!request.requestId) {
      errors.push('Request ID is required');
    }

    if (!request.message || request.message.trim().length === 0) {
      errors.push('Message cannot be empty');
    }

    if (!request.mode) {
      errors.push('Mode is required');
    }

    if (request.mode !== this.mode) {
      errors.push(`Expected mode '${this.mode}', got '${request.mode}'`);
    }

    if (!request.settings) {
      errors.push('Settings are required');
    }

    if (!request.context) {
      errors.push('Context is required');
    }

    // Validate swarm density if present
    if (request.settings?.swarmDensity !== undefined) {
      if (request.settings.swarmDensity < 1 || request.settings.swarmDensity > 10) {
        errors.push('Swarm density must be between 1 and 10');
      }
    }

    // Validate temperature if present
    if (request.settings?.temperature !== undefined) {
      if (request.settings.temperature < 0 || request.settings.temperature > 1) {
        errors.push('Temperature must be between 0 and 1');
      }
    }

    // Allow subclasses to add custom validation
    const customValidation = this.customValidate(request);
    if (customValidation.errors) {
      errors.push(...customValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Custom validation hook for subclasses
   */
  protected customValidate(request: ModeRequest): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  /**
   * Main entry point for handling requests
   */
  public async handle(request: ModeRequest): Promise<ModeResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      const validation = this.validate(request);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }

      // Track active request
      this.activeRequests.add(request.requestId);

      // Emit started event
      this.emit({
        type: 'mode:started',
        mode: this.mode,
        requestId: request.requestId
      });

      // Execute the handler-specific logic
      const response = await this.executeHandler(request);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Ensure response has correct structure
      const completeResponse: ModeResponse = {
        ...response,
        mode: this.mode,
        requestId: request.requestId,
        processingTime,
        success: true
      };

      // Emit completion event
      this.emit({
        type: 'mode:completed',
        mode: this.mode,
        requestId: request.requestId,
        response: completeResponse
      });

      return completeResponse;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit error event
      this.emit({
        type: 'mode:error',
        mode: this.mode,
        requestId: request.requestId,
        error: error instanceof Error ? error : new Error(errorMessage)
      });

      // Return error response
      return {
        success: false,
        mode: this.mode,
        requestId: request.requestId,
        processingTime,
        error: errorMessage
      } as ModeResponse;

    } finally {
      // Clean up active request tracking
      this.activeRequests.delete(request.requestId);
    }
  }

  /**
   * Execute the mode-specific handling logic (implemented by subclasses)
   */
  protected abstract executeHandler(request: ModeRequest): Promise<ModeResponse>;

  /**
   * Stop processing for a specific request
   */
  public async stop(requestId: string): Promise<void> {
    if (this.activeRequests.has(requestId)) {
      // Emit cancellation event
      this.emit({
        type: 'mode:cancelled',
        mode: this.mode,
        requestId
      });

      // Remove from active requests
      this.activeRequests.delete(requestId);

      // Allow subclass to perform cleanup
      await this.cleanup(requestId);
    }
  }

  /**
   * Cleanup hook for subclasses
   */
  protected async cleanup(requestId: string): Promise<void> {
    // Default: no-op
  }

  /**
   * Emit a progress event
   */
  protected emitProgress(requestId: string, message: string, progress?: number): void {
    this.emit({
      type: 'mode:progress',
      mode: this.mode,
      requestId,
      message,
      progress
    });
  }

  /**
   * Check if a request is currently being processed
   */
  public isProcessing(requestId: string): boolean {
    return this.activeRequests.has(requestId);
  }

  /**
   * Get count of active requests
   */
  public getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}
