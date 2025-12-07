/**
 * Mode Dispatcher
 *
 * Central orchestrator for mode-based message handling. Uses a registry pattern
 * to manage mode handlers and route requests to the appropriate handler.
 * Falls back to chat mode when no handler is available.
 */

import {
  AppMode,
  ModeHandler,
  ModeRequest,
  ModeResponse,
  ModeDispatcherConfig,
  ModeEvent,
  ModeSettings,
  ModeContext
} from './types';

/**
 * Default configuration for the dispatcher
 */
const DEFAULT_CONFIG: ModeDispatcherConfig = {
  defaultMode: 'chat',
  strictValidation: true,
  timeout: 300000, // 5 minutes
  enableLogging: true
};

/**
 * ModeDispatcher orchestrates all mode-based request handling
 */
export class ModeDispatcher {
  /**
   * Registry of mode handlers
   */
  private handlers: Map<AppMode, ModeHandler> = new Map();

  /**
   * Event listeners
   */
  private listeners: Array<(event: ModeEvent) => void> = [];

  /**
   * Configuration
   */
  private config: ModeDispatcherConfig;

  /**
   * Pending timeouts for requests
   */
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Request counter for generating IDs
   */
  private requestCounter = 0;

  constructor(config: Partial<ModeDispatcherConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a mode handler
   */
  public registerHandler(handler: ModeHandler): void {
    if (this.handlers.has(handler.mode)) {
      if (this.config.enableLogging) {
        console.warn(`Handler for mode '${handler.mode}' is being replaced`);
      }
    }

    this.handlers.set(handler.mode, handler);

    // Forward handler events to dispatcher listeners
    if ('addEventListener' in handler && typeof handler.addEventListener === 'function') {
      (handler as any).addEventListener((event: ModeEvent) => {
        this.emit(event);
      });
    }

    if (this.config.enableLogging) {
      console.log(`Registered handler for mode: ${handler.mode}`);
    }
  }

  /**
   * Unregister a mode handler
   */
  public unregisterHandler(mode: AppMode): boolean {
    const removed = this.handlers.delete(mode);
    if (removed && this.config.enableLogging) {
      console.log(`Unregistered handler for mode: ${mode}`);
    }
    return removed;
  }

  /**
   * Get a handler for a specific mode
   */
  public getHandler(mode: AppMode): ModeHandler | undefined {
    return this.handlers.get(mode);
  }

  /**
   * Check if a handler exists for a mode
   */
  public hasHandler(mode: AppMode): boolean {
    return this.handlers.has(mode);
  }

  /**
   * Get all registered modes
   */
  public getRegisteredModes(): AppMode[] {
    return Array.from(this.handlers.keys());
  }

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
  private emit(event: ModeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in dispatcher event listener:', error);
      }
    });
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * Create a mode request object
   */
  public createRequest(
    mode: AppMode,
    message: string,
    context: ModeContext,
    settings: ModeSettings
  ): ModeRequest {
    return {
      mode,
      message,
      context,
      settings,
      requestId: this.generateRequestId(),
      timestamp: new Date()
    };
  }

  /**
   * Dispatch a request to the appropriate handler
   */
  public async dispatch(
    mode: AppMode,
    message: string,
    context: ModeContext,
    settings: ModeSettings
  ): Promise<ModeResponse>;

  public async dispatch(request: ModeRequest): Promise<ModeResponse>;

  public async dispatch(
    modeOrRequest: AppMode | ModeRequest,
    message?: string,
    context?: ModeContext,
    settings?: ModeSettings
  ): Promise<ModeResponse> {
    // Handle overloaded signatures
    const request: ModeRequest = typeof modeOrRequest === 'string'
      ? this.createRequest(modeOrRequest, message!, context!, settings!)
      : modeOrRequest;

    const startTime = Date.now();

    try {
      // Log dispatch
      if (this.config.enableLogging) {
        console.log(`Dispatching request ${request.requestId} to mode: ${request.mode}`);
      }

      // Get handler for the mode
      let handler = this.handlers.get(request.mode);

      // Fallback to chat mode if handler not found
      if (!handler) {
        if (this.config.enableLogging) {
          console.warn(
            `No handler found for mode '${request.mode}', falling back to '${this.config.defaultMode}'`
          );
        }

        handler = this.handlers.get(this.config.defaultMode);

        if (!handler) {
          throw new Error(
            `No handler available for mode '${request.mode}' and default mode '${this.config.defaultMode}' is not registered`
          );
        }

        // Update request mode to match fallback
        request.mode = this.config.defaultMode;
      }

      // Check if handler can process this request
      if (!handler.canHandle(request)) {
        throw new Error(`Handler for mode '${request.mode}' cannot process this request`);
      }

      // Validate request if strict validation is enabled
      if (this.config.strictValidation) {
        const validation = handler.validate(request);
        if (!validation.valid) {
          throw new Error(`Request validation failed: ${validation.errors?.join(', ')}`);
        }
      }

      // Set up timeout
      const timeoutPromise = new Promise<ModeResponse>((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Request ${request.requestId} timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);

        this.timeouts.set(request.requestId, timeout);
      });

      // Execute handler with timeout
      const response = await Promise.race([
        handler.handle(request),
        timeoutPromise
      ]);

      // Clear timeout
      const timeout = this.timeouts.get(request.requestId);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(request.requestId);
      }

      // Log completion
      if (this.config.enableLogging) {
        const duration = Date.now() - startTime;
        console.log(`Request ${request.requestId} completed in ${duration}ms`);
      }

      return response;

    } catch (error) {
      // Clear timeout on error
      const timeout = this.timeouts.get(request.requestId);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(request.requestId);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.config.enableLogging) {
        console.error(`Error dispatching request ${request.requestId}:`, errorMessage);
      }

      // Emit error event
      this.emit({
        type: 'mode:error',
        mode: request.mode,
        requestId: request.requestId,
        error: error instanceof Error ? error : new Error(errorMessage)
      });

      // Return error response
      return {
        success: false,
        mode: request.mode,
        requestId: request.requestId,
        processingTime: Date.now() - startTime,
        error: errorMessage
      } as ModeResponse;
    }
  }

  /**
   * Cancel a pending request
   */
  public async cancel(requestId: string): Promise<void> {
    // Clear timeout
    const timeout = this.timeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(requestId);
    }

    // Stop all handlers that might be processing this request
    const stopPromises = Array.from(this.handlers.values()).map(handler =>
      handler.stop(requestId).catch(error => {
        console.error(`Error stopping handler for request ${requestId}:`, error);
      })
    );

    await Promise.all(stopPromises);

    if (this.config.enableLogging) {
      console.log(`Cancelled request: ${requestId}`);
    }
  }

  /**
   * Get dispatcher statistics
   */
  public getStats(): {
    registeredModes: AppMode[];
    activeRequests: number;
    pendingTimeouts: number;
  } {
    let activeRequests = 0;

    this.handlers.forEach(handler => {
      if ('getActiveRequestCount' in handler && typeof handler.getActiveRequestCount === 'function') {
        activeRequests += (handler as any).getActiveRequestCount();
      }
    });

    return {
      registeredModes: this.getRegisteredModes(),
      activeRequests,
      pendingTimeouts: this.timeouts.size
    };
  }

  /**
   * Clean up all resources
   */
  public dispose(): void {
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    // Clear handlers
    this.handlers.clear();

    // Clear listeners
    this.listeners = [];

    if (this.config.enableLogging) {
      console.log('ModeDispatcher disposed');
    }
  }
}
