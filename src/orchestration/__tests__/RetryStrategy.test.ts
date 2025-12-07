import {
    createMockRetryContext,
    simulateTimeout,
    expectAsyncError
} from './setup';

/**
 * Retry Strategy for Agent Operations
 *
 * Implements exponential backoff with jitter for resilient agent orchestration.
 */

export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    exponentialBase: number;
    jitterFactor: number;
}

export interface RetryContext {
    attemptNumber: number;
    error: Error;
    startTime: number;
    totalDuration: number;
}

export class RetryStrategy {
    private config: RetryConfig;

    constructor(config: Partial<RetryConfig> = {}) {
        this.config = {
            maxAttempts: config.maxAttempts ?? 3,
            baseDelayMs: config.baseDelayMs ?? 1000,
            maxDelayMs: config.maxDelayMs ?? 30000,
            exponentialBase: config.exponentialBase ?? 2,
            jitterFactor: config.jitterFactor ?? 0.1,
        };
    }

    /**
     * Calculates the delay for the next retry attempt using exponential backoff.
     *
     * Formula: min(baseDelay * (exponentialBase ^ attemptNumber), maxDelay)
     *
     * @param attemptNumber - Current attempt number (1-indexed)
     * @returns Delay in milliseconds before jitter
     */
    calculateBackoff(attemptNumber: number): number {
        const exponentialDelay = this.config.baseDelayMs *
            Math.pow(this.config.exponentialBase, attemptNumber - 1);
        return Math.min(exponentialDelay, this.config.maxDelayMs);
    }

    /**
     * Applies random jitter to a delay value to prevent thundering herd.
     *
     * Jitter formula: delay * (1 + random(-jitterFactor, +jitterFactor))
     *
     * @param delay - Base delay in milliseconds
     * @returns Delay with jitter applied
     */
    applyJitter(delay: number): number {
        const jitter = (Math.random() * 2 - 1) * this.config.jitterFactor;
        return Math.max(0, Math.round(delay * (1 + jitter)));
    }

    /**
     * Determines whether to retry based on attempt count and error type.
     *
     * @param context - Current retry context
     * @returns True if should retry, false otherwise
     */
    shouldRetry(context: RetryContext): boolean {
        // Don't retry if max attempts reached
        if (context.attemptNumber >= this.config.maxAttempts) {
            return false;
        }

        // Check if error is retryable
        return this.isRetryableError(context.error);
    }

    /**
     * Checks if an error is retryable based on error patterns.
     *
     * Retryable errors:
     * - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)
     * - Temporary failures (EBUSY, EAGAIN)
     * - Rate limiting (429, 503)
     *
     * Non-retryable errors:
     * - Validation errors (400)
     * - Authorization errors (401, 403)
     * - Not found errors (404)
     *
     * @param error - The error to check
     * @returns True if error is retryable
     */
    isRetryableError(error: Error): boolean {
        const message = error.message.toLowerCase();
        const errorCode = (error as any).code;
        const statusCode = (error as any).statusCode;

        // Network errors
        const networkErrors = ['econnreset', 'etimedout', 'enotfound', 'econnrefused'];
        if (networkErrors.some(code => errorCode === code || message.includes(code))) {
            return true;
        }

        // Temporary failures
        const temporaryErrors = ['ebusy', 'eagain', 'temporary'];
        if (temporaryErrors.some(code => errorCode === code || message.includes(code))) {
            return true;
        }

        // Rate limiting and server errors
        const retryableStatusCodes = [429, 500, 502, 503, 504];
        if (statusCode && retryableStatusCodes.includes(statusCode)) {
            return true;
        }

        // Timeout errors
        if (message.includes('timeout') || message.includes('timed out')) {
            return true;
        }

        // Non-retryable errors
        const nonRetryableStatusCodes = [400, 401, 403, 404];
        if (statusCode && nonRetryableStatusCodes.includes(statusCode)) {
            return false;
        }

        // Default to non-retryable for unknown errors
        return false;
    }

    /**
     * Calculates the next retry delay with exponential backoff and jitter.
     *
     * @param context - Current retry context
     * @returns Delay in milliseconds
     */
    getNextDelay(context: RetryContext): number {
        const backoff = this.calculateBackoff(context.attemptNumber + 1);
        return this.applyJitter(backoff);
    }

    /**
     * Executes a function with retry logic.
     *
     * @param fn - Async function to execute
     * @param context - Optional initial context
     * @returns Promise resolving to function result
     */
    async execute<T>(
        fn: () => Promise<T>,
        context?: Partial<RetryContext>
    ): Promise<T> {
        const startTime = context?.startTime ?? Date.now();
        let attemptNumber = context?.attemptNumber ?? 1;
        let lastError: Error = new Error('No attempts made');

        while (attemptNumber <= this.config.maxAttempts) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;
                const totalDuration = Date.now() - startTime;

                const retryContext: RetryContext = {
                    attemptNumber,
                    error: lastError,
                    startTime,
                    totalDuration
                };

                if (!this.shouldRetry(retryContext)) {
                    throw lastError;
                }

                const delay = this.getNextDelay(retryContext);
                await simulateTimeout(delay);
                attemptNumber++;
            }
        }

        throw lastError;
    }
}

// Tests
describe('RetryStrategy', () => {
    let strategy: RetryStrategy;

    beforeEach(() => {
        strategy = new RetryStrategy();
    });

    describe('calculateBackoff', () => {
        it('should calculate exponential backoff correctly', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 1000,
                exponentialBase: 2
            });

            expect(strategy.calculateBackoff(1)).toBe(1000);    // 1000 * 2^0
            expect(strategy.calculateBackoff(2)).toBe(2000);    // 1000 * 2^1
            expect(strategy.calculateBackoff(3)).toBe(4000);    // 1000 * 2^2
            expect(strategy.calculateBackoff(4)).toBe(8000);    // 1000 * 2^3
        });

        it('should respect max delay cap', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 1000,
                exponentialBase: 2,
                maxDelayMs: 5000
            });

            expect(strategy.calculateBackoff(1)).toBe(1000);
            expect(strategy.calculateBackoff(2)).toBe(2000);
            expect(strategy.calculateBackoff(3)).toBe(4000);
            expect(strategy.calculateBackoff(4)).toBe(5000);    // Capped at maxDelay
            expect(strategy.calculateBackoff(5)).toBe(5000);    // Still capped
        });

        it('should handle different exponential bases', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 100,
                exponentialBase: 3
            });

            expect(strategy.calculateBackoff(1)).toBe(100);     // 100 * 3^0
            expect(strategy.calculateBackoff(2)).toBe(300);     // 100 * 3^1
            expect(strategy.calculateBackoff(3)).toBe(900);     // 100 * 3^2
        });
    });

    describe('applyJitter', () => {
        it('should apply jitter within expected range', () => {
            const strategy = new RetryStrategy({ jitterFactor: 0.1 });
            const baseDelay = 1000;

            // Run multiple times to test randomness
            for (let i = 0; i < 100; i++) {
                const jittered = strategy.applyJitter(baseDelay);

                // Jitter should be within ±10% (±100ms)
                expect(jittered).toBeGreaterThanOrEqual(900);
                expect(jittered).toBeLessThanOrEqual(1100);
            }
        });

        it('should never return negative delays', () => {
            const strategy = new RetryStrategy({ jitterFactor: 2.0 });
            const baseDelay = 100;

            for (let i = 0; i < 100; i++) {
                const jittered = strategy.applyJitter(baseDelay);
                expect(jittered).toBeGreaterThanOrEqual(0);
            }
        });

        it('should return integer values', () => {
            const strategy = new RetryStrategy({ jitterFactor: 0.1 });
            const baseDelay = 1000;

            for (let i = 0; i < 100; i++) {
                const jittered = strategy.applyJitter(baseDelay);
                expect(jittered).toBe(Math.floor(jittered));
            }
        });

        it('should handle zero jitter factor', () => {
            const strategy = new RetryStrategy({ jitterFactor: 0 });
            const baseDelay = 1000;

            expect(strategy.applyJitter(baseDelay)).toBe(1000);
        });
    });

    describe('shouldRetry', () => {
        it('should not retry when max attempts reached', () => {
            const strategy = new RetryStrategy({ maxAttempts: 3 });

            const context = createMockRetryContext({
                attemptNumber: 3,
                error: new Error('ETIMEDOUT')
            });

            expect(strategy.shouldRetry(context)).toBe(false);
        });

        it('should retry for retryable errors', () => {
            const strategy = new RetryStrategy({ maxAttempts: 3 });

            const context = createMockRetryContext({
                attemptNumber: 1,
                error: new Error('ETIMEDOUT')
            });

            expect(strategy.shouldRetry(context)).toBe(true);
        });

        it('should not retry for non-retryable errors', () => {
            const strategy = new RetryStrategy({ maxAttempts: 3 });

            const error = new Error('Validation failed');
            (error as any).statusCode = 400;

            const context = createMockRetryContext({
                attemptNumber: 1,
                error
            });

            expect(strategy.shouldRetry(context)).toBe(false);
        });
    });

    describe('isRetryableError', () => {
        it('should identify network errors as retryable', () => {
            const networkErrors = [
                { code: 'ECONNRESET' },
                { code: 'ETIMEDOUT' },
                { code: 'ENOTFOUND' },
                { code: 'ECONNREFUSED' }
            ];

            networkErrors.forEach(({ code }) => {
                const error = new Error(`Network error: ${code}`);
                (error as any).code = code;
                expect(strategy.isRetryableError(error)).toBe(true);
            });
        });

        it('should identify temporary failures as retryable', () => {
            const tempErrors = [
                { code: 'EBUSY' },
                { code: 'EAGAIN' },
                { message: 'Temporary failure' }
            ];

            tempErrors.forEach(({ code, message }) => {
                const error = new Error(message || code);
                if (code) {
                    (error as any).code = code;
                }
                expect(strategy.isRetryableError(error)).toBe(true);
            });
        });

        it('should identify rate limiting as retryable', () => {
            const retryableStatusCodes = [429, 500, 502, 503, 504];

            retryableStatusCodes.forEach(statusCode => {
                const error = new Error(`HTTP ${statusCode}`);
                (error as any).statusCode = statusCode;
                expect(strategy.isRetryableError(error)).toBe(true);
            });
        });

        it('should identify timeout errors as retryable', () => {
            const timeoutErrors = [
                new Error('Request timeout'),
                new Error('Operation timed out'),
                new Error('Connection timeout')
            ];

            timeoutErrors.forEach(error => {
                expect(strategy.isRetryableError(error)).toBe(true);
            });
        });

        it('should identify validation errors as non-retryable', () => {
            const nonRetryableStatusCodes = [400, 401, 403, 404];

            nonRetryableStatusCodes.forEach(statusCode => {
                const error = new Error(`HTTP ${statusCode}`);
                (error as any).statusCode = statusCode;
                expect(strategy.isRetryableError(error)).toBe(false);
            });
        });

        it('should treat unknown errors as non-retryable by default', () => {
            const unknownError = new Error('Something weird happened');
            expect(strategy.isRetryableError(unknownError)).toBe(false);
        });
    });

    describe('getNextDelay', () => {
        it('should combine backoff and jitter', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 1000,
                exponentialBase: 2,
                jitterFactor: 0.1
            });

            const context = createMockRetryContext({ attemptNumber: 1 });
            const delay = strategy.getNextDelay(context);

            // Next attempt (2) should be ~2000ms with ±10% jitter
            expect(delay).toBeGreaterThanOrEqual(1800);
            expect(delay).toBeLessThanOrEqual(2200);
        });

        it('should increase with attempt number', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 100,
                exponentialBase: 2,
                jitterFactor: 0
            });

            const delays = [1, 2, 3, 4].map(attemptNumber => {
                const context = createMockRetryContext({ attemptNumber });
                return strategy.getNextDelay(context);
            });

            // Each delay should be roughly double the previous
            expect(delays[0]).toBe(200);    // Next is attempt 2
            expect(delays[1]).toBe(400);    // Next is attempt 3
            expect(delays[2]).toBe(800);    // Next is attempt 4
            expect(delays[3]).toBe(1600);   // Next is attempt 5
        });
    });

    describe('execute', () => {
        it('should succeed on first attempt', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const result = await strategy.execute(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on retryable errors', async () => {
            const error = new Error('ETIMEDOUT');
            (error as any).code = 'ETIMEDOUT';

            const fn = jest.fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            const strategy = new RetryStrategy({
                maxAttempts: 3,
                baseDelayMs: 10,
                jitterFactor: 0
            });

            const result = await strategy.execute(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should not retry on non-retryable errors', async () => {
            const error = new Error('Validation failed');
            (error as any).statusCode = 400;

            const fn = jest.fn().mockRejectedValue(error);

            const strategy = new RetryStrategy({ maxAttempts: 3 });

            await expectAsyncError(
                () => strategy.execute(fn),
                'Validation failed'
            );

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should throw after max attempts', async () => {
            const error = new Error('ETIMEDOUT');
            (error as any).code = 'ETIMEDOUT';

            const fn = jest.fn().mockRejectedValue(error);

            const strategy = new RetryStrategy({
                maxAttempts: 3,
                baseDelayMs: 10,
                jitterFactor: 0
            });

            await expectAsyncError(
                () => strategy.execute(fn),
                'ETIMEDOUT'
            );

            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should apply exponential backoff between retries', async () => {
            const error = new Error('ETIMEDOUT');
            (error as any).code = 'ETIMEDOUT';

            const fn = jest.fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            const strategy = new RetryStrategy({
                maxAttempts: 3,
                baseDelayMs: 100,
                exponentialBase: 2,
                jitterFactor: 0
            });

            const startTime = Date.now();
            await strategy.execute(fn);
            const duration = Date.now() - startTime;

            // Should wait 100ms then 200ms = 300ms total
            // Allow more tolerance for Windows timer variations
            expect(duration).toBeGreaterThanOrEqual(290);
            expect(duration).toBeLessThan(1000);
        });

        it('should handle custom retry context', async () => {
            const fn = jest.fn().mockResolvedValue('success');

            const customContext = {
                attemptNumber: 2,
                startTime: Date.now() - 5000
            };

            await strategy.execute(fn, customContext);

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('edge cases', () => {
        it('should handle zero base delay', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 0,
                exponentialBase: 2
            });

            expect(strategy.calculateBackoff(1)).toBe(0);
            expect(strategy.calculateBackoff(2)).toBe(0);
        });

        it('should handle extremely large attempt numbers', () => {
            const strategy = new RetryStrategy({
                baseDelayMs: 1000,
                exponentialBase: 2,
                maxDelayMs: 60000
            });

            // Should be capped at maxDelayMs
            expect(strategy.calculateBackoff(100)).toBe(60000);
        });

        it('should handle concurrent executions independently', async () => {
            const error = new Error('ETIMEDOUT');
            (error as any).code = 'ETIMEDOUT';

            const fn1 = jest.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success-1');

            const fn2 = jest.fn()
                .mockRejectedValueOnce(error)
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success-2');

            const strategy = new RetryStrategy({
                baseDelayMs: 10,
                jitterFactor: 0
            });

            const [result1, result2] = await Promise.all([
                strategy.execute(fn1),
                strategy.execute(fn2)
            ]);

            expect(result1).toBe('success-1');
            expect(result2).toBe('success-2');
            expect(fn1).toHaveBeenCalledTimes(2);
            expect(fn2).toHaveBeenCalledTimes(3);
        });
    });
});
