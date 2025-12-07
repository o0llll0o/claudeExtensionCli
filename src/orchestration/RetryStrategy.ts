import { EventEmitter } from 'events';

export type BackoffType = 'exponential' | 'linear' | 'fixed';

export interface RetryPolicy {
  /**
   * Maximum number of retry attempts before giving up.
   * Default: 3
   */
  maxAttempts: number;

  /**
   * Type of backoff strategy to use between retries.
   * - exponential: delay = baseDelayMs * (2 ^ attemptNumber)
   * - linear: delay = baseDelayMs * attemptNumber
   * - fixed: delay = baseDelayMs (constant)
   * Default: 'exponential'
   */
  backoffType: BackoffType;

  /**
   * Base delay in milliseconds for the backoff calculation.
   * Default: 1000ms (1 second)
   */
  baseDelayMs: number;

  /**
   * Maximum delay in milliseconds to cap backoff calculations.
   * Default: 30000ms (30 seconds)
   */
  maxDelayMs: number;

  /**
   * Array of error message patterns that should trigger a retry.
   * If empty, all errors are retryable.
   * Supports regex patterns.
   */
  retryableErrors: string[];

  /**
   * Whether to add random jitter (±10%) to delay calculations.
   * This prevents thundering herd problems in distributed systems.
   * Default: true
   */
  jitter: boolean;

  /**
   * Optional callback to log retry attempts.
   */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

export interface RetryState {
  /**
   * Current attempt number (1-indexed).
   */
  attemptNumber: number;

  /**
   * The last error encountered during execution.
   */
  lastError: Error | null;

  /**
   * Timestamp when the next retry should occur (ISO 8601).
   */
  nextRetryAt: string | null;

  /**
   * The retry policy being applied.
   */
  strategy: RetryPolicy;

  /**
   * Total time spent waiting between retries in milliseconds.
   */
  totalBackoffMs: number;
}

/**
 * Executes operations with configurable retry logic.
 * Supports exponential, linear, and fixed backoff strategies.
 * Emits events for monitoring retry attempts.
 *
 * @fires retry_attempt - When a retry is about to occur
 * @fires retry_success - When operation succeeds after retries
 * @fires retry_exhausted - When all retry attempts are exhausted
 */
export class RetryExecutor extends EventEmitter {
  private activeRetries: Map<string, RetryState> = new Map();

  constructor() {
    super();
  }

  /**
   * Executes a function with retry logic based on the provided policy.
   *
   * @param fn The async function to execute
   * @param policy The retry policy to apply
   * @param operationId Optional identifier for tracking
   * @returns The result of the successful execution
   * @throws The last error if all retry attempts are exhausted
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy,
    operationId?: string
  ): Promise<T> {
    const opId = operationId || `retry-${Date.now()}`;
    let lastError: Error = new Error('Unknown error');
    let totalBackoffMs = 0;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      const state: RetryState = {
        attemptNumber: attempt,
        lastError: attempt > 1 ? lastError : null,
        nextRetryAt: null,
        strategy: policy,
        totalBackoffMs
      };
      this.activeRetries.set(opId, state);

      try {
        const result = await fn();

        if (attempt > 1) {
          this.emit('retry_success', {
            operationId: opId,
            attempts: attempt,
            totalBackoffMs
          });
        }

        this.activeRetries.delete(opId);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this is the last attempt
        if (attempt === policy.maxAttempts) {
          this.emit('retry_exhausted', {
            operationId: opId,
            attempts: policy.maxAttempts,
            lastError: lastError.message,
            totalBackoffMs
          });
          this.activeRetries.delete(opId);
          throw lastError;
        }

        // Check if this error is retryable
        if (!this.shouldRetry(lastError.message, policy)) {
          this.activeRetries.delete(opId);
          throw lastError;
        }

        // Calculate delay and wait
        const delayMs = this.calculateDelay(attempt, policy);
        totalBackoffMs += delayMs;
        const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

        // Update state
        state.nextRetryAt = nextRetryAt;
        state.totalBackoffMs = totalBackoffMs;
        this.activeRetries.set(opId, state);

        // Emit retry event
        this.emit('retry_attempt', {
          operationId: opId,
          attempt,
          maxAttempts: policy.maxAttempts,
          error: lastError.message,
          nextDelayMs: delayMs,
          nextRetryAt
        });

        // Call optional retry callback
        if (policy.onRetry) {
          try {
            policy.onRetry(attempt, lastError, delayMs);
          } catch (callbackError) {
            console.error('Error in onRetry callback:', callbackError);
          }
        }

        // Wait before next attempt
        await this.sleep(delayMs);
      }
    }

    // This should never be reached due to the throw in the loop
    this.activeRetries.delete(opId);
    throw lastError;
  }

  /**
   * Calculates the delay for the next retry attempt based on the policy.
   *
   * @param attempt The current attempt number (1-indexed)
   * @param policy The retry policy
   * @returns The delay in milliseconds
   */
  calculateDelay(attempt: number, policy: RetryPolicy): number {
    let delay: number;

    switch (policy.backoffType) {
      case 'exponential':
        // Exponential: delay = baseDelayMs * (2 ^ attempt)
        delay = policy.baseDelayMs * Math.pow(2, attempt);
        break;

      case 'linear':
        // Linear: delay = baseDelayMs * attempt
        delay = policy.baseDelayMs * attempt;
        break;

      case 'fixed':
        // Fixed: delay = baseDelayMs (constant)
        delay = policy.baseDelayMs;
        break;

      default:
        delay = policy.baseDelayMs;
    }

    // Cap at maximum delay
    delay = Math.min(delay, policy.maxDelayMs);

    // Apply jitter if enabled (±10% randomization)
    if (policy.jitter) {
      const jitterRange = delay * 0.1;
      const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
      delay = Math.max(0, delay + jitterOffset);
    }

    return Math.round(delay);
  }

  /**
   * Determines if an error should trigger a retry based on the policy.
   *
   * @param errorMessage The error message to check
   * @param policy The retry policy
   * @returns True if the error should be retried
   */
  shouldRetry(errorMessage: string, policy: RetryPolicy): boolean {
    // If no retryable errors are specified, all errors are retryable
    if (policy.retryableErrors.length === 0) {
      return true;
    }

    // Check if error message matches any retryable pattern
    return policy.retryableErrors.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(errorMessage);
      } catch {
        return errorMessage.toLowerCase().includes(pattern.toLowerCase());
      }
    });
  }

  /**
   * Gets the current state of an active retry operation.
   */
  getRetryState(operationId: string): RetryState | undefined {
    return this.activeRetries.get(operationId);
  }

  /**
   * Gets all active retry operations.
   */
  getActiveRetries(): Map<string, RetryState> {
    return new Map(this.activeRetries);
  }

  /**
   * Cancels an active retry operation.
   */
  cancelRetry(operationId: string): boolean {
    return this.activeRetries.delete(operationId);
  }

  /**
   * Sleeps for the specified number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default retry policy for agent operations.
 * - 3 attempts with exponential backoff
 * - Base delay: 1 second
 * - Max delay: 30 seconds
 * - Jitter enabled to prevent thundering herd
 */
export const DEFAULT_AGENT_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffType: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [],
  jitter: true
};

/**
 * Aggressive retry policy for critical operations.
 * - 5 attempts with linear backoff
 * - Base delay: 500ms (faster initial retry)
 * - Retries common transient errors
 */
export const AGGRESSIVE_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoffType: 'linear',
  baseDelayMs: 500,
  maxDelayMs: 30000,
  retryableErrors: [
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'network',
    'rate limit',
    '429',
    '503',
    '504'
  ],
  jitter: true
};

/**
 * Conservative retry policy for non-critical operations.
 * - 2 attempts with fixed backoff
 * - Base delay: 2 seconds
 * - Only retries specific transient errors
 */
export const CONSERVATIVE_POLICY: RetryPolicy = {
  maxAttempts: 2,
  backoffType: 'fixed',
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    '503',
    '504'
  ],
  jitter: false
};

/**
 * Creates a custom retry policy with optional overrides.
 */
export function createRetryPolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy {
  return {
    ...DEFAULT_AGENT_POLICY,
    ...overrides
  };
}

export default RetryExecutor;
