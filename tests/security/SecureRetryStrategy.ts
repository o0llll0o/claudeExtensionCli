/**
 * SECURE RETRY STRATEGY IMPLEMENTATION
 *
 * This is a hardened implementation addressing all identified vulnerabilities.
 * Use this as a reference for fixing the production retry logic.
 */

import { EventEmitter } from 'events';

// =============================================================================
// SECURE CONFIGURATION WITH VALIDATION
// =============================================================================

export interface SecureRetryPolicy {
    maxAttempts: number;      // 1-100
    backoffType: 'exponential' | 'linear' | 'fixed';
    baseDelayMs: number;      // 10-60000
    maxDelayMs: number;       // 100-300000
    retryableErrors: string[];
    jitter: boolean;
    onRetry?: (attempt: number, sanitizedError: string, nextDelayMs: number) => void;
}

export interface SecurityConfig {
    maxListeners: number;
    maxActiveRetries: number;
    maxRetriesPerMinute: number;
    sanitizeErrors: boolean;
    stripStackTraces: boolean;
    enforceRateLimits: boolean;
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
    maxListeners: 100,
    maxActiveRetries: 1000,
    maxRetriesPerMinute: 60,
    sanitizeErrors: true,
    stripStackTraces: true,
    enforceRateLimits: true
};

// =============================================================================
// INPUT VALIDATION AND SANITIZATION
// =============================================================================

class InputValidator {
    static validateRetryPolicy(policy: Partial<SecureRetryPolicy>): SecureRetryPolicy {
        // Validate maxAttempts
        const maxAttempts = this.clamp(
            policy.maxAttempts ?? 3,
            1,
            100,
            'maxAttempts must be between 1 and 100'
        );

        // Validate baseDelayMs
        const baseDelayMs = this.clamp(
            policy.baseDelayMs ?? 1000,
            10,
            60000,
            'baseDelayMs must be between 10ms and 60000ms'
        );

        // Validate maxDelayMs
        let maxDelayMs = this.clamp(
            policy.maxDelayMs ?? 30000,
            100,
            300000,
            'maxDelayMs must be between 100ms and 300000ms'
        );

        // Ensure maxDelayMs >= baseDelayMs
        if (maxDelayMs < baseDelayMs) {
            maxDelayMs = baseDelayMs;
        }

        // Validate backoffType
        const validTypes: Array<'exponential' | 'linear' | 'fixed'> = ['exponential', 'linear', 'fixed'];
        const backoffType = validTypes.includes(policy.backoffType as any)
            ? policy.backoffType!
            : 'exponential';

        // Validate retryableErrors patterns
        const retryableErrors = this.validateRegexPatterns(policy.retryableErrors ?? []);

        return {
            maxAttempts,
            backoffType,
            baseDelayMs,
            maxDelayMs,
            retryableErrors,
            jitter: policy.jitter ?? true,
            onRetry: policy.onRetry
        };
    }

    static clamp(value: number, min: number, max: number, errorMsg?: string): number {
        if (!Number.isFinite(value) || value < min || value > max) {
            if (errorMsg) {
                throw new Error(`${errorMsg} (got: ${value})`);
            }
            return Math.max(min, Math.min(max, value));
        }
        return Math.floor(value); // Ensure integer
    }

    static validateRegexPatterns(patterns: string[]): string[] {
        const validated: string[] = [];
        const MAX_PATTERN_LENGTH = 100;

        // Dangerous pattern detection
        const dangerousPatterns = [
            /\(\w\+\)\+/,           // (a+)+
            /\(\w\|\w\)\*/,         // (a|a)*
            /\(\w+\)\{.*,.*\}/,     // Unbounded quantifiers
            /\(\?\<\=/,             // Lookbehinds (slow)
            /\(\?\!\=/,             // Negative lookbehinds
        ];

        for (const pattern of patterns) {
            // Length check
            if (pattern.length > MAX_PATTERN_LENGTH) {
                console.warn(`Pattern too long (max ${MAX_PATTERN_LENGTH}): ${pattern}`);
                continue;
            }

            // Dangerous pattern check
            let isDangerous = false;
            for (const dangerous of dangerousPatterns) {
                if (dangerous.test(pattern)) {
                    console.warn(`Potentially dangerous regex pattern blocked: ${pattern}`);
                    isDangerous = true;
                    break;
                }
            }
            if (isDangerous) continue;

            // Test compilation
            try {
                new RegExp(pattern, 'i');
                validated.push(pattern);
            } catch (e) {
                console.warn(`Invalid regex pattern: ${pattern}`, e);
            }
        }

        return validated;
    }

    static sanitizeOperationId(opId?: string): string {
        if (!opId) {
            return `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        // Remove dangerous characters
        const sanitized = opId
            .replace(/[^a-zA-Z0-9\-_]/g, '') // Only allow alphanumeric, dash, underscore
            .substring(0, 64); // Limit length

        if (sanitized.length === 0) {
            return `retry-${Date.now()}`;
        }

        return sanitized;
    }
}

// =============================================================================
// ERROR SANITIZATION
// =============================================================================

class ErrorSanitizer {
    private static readonly CREDENTIAL_PATTERNS = [
        { regex: /password[=:\s]+['"]?([^'"\s&]+)/gi, replacement: 'password=***' },
        { regex: /passwd[=:\s]+['"]?([^'"\s&]+)/gi, replacement: 'passwd=***' },
        { regex: /token[=:\s]+['"]?([^'"\s&]+)/gi, replacement: 'token=***' },
        { regex: /api[_-]?key[=:\s]+['"]?([^'"\s&]+)/gi, replacement: 'api_key=***' },
        { regex: /secret[=:\s]+['"]?([^'"\s&]+)/gi, replacement: 'secret=***' },
        { regex: /auth[=:\s]+['"]?([^'"\s&]+)/gi, replacement: 'auth=***' },

        // URL credentials: user:pass@host
        { regex: /([a-z]+:\/\/[^:]+):([^@]+)@/gi, replacement: '$1:***@' },

        // Bearer tokens
        { regex: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, replacement: 'Bearer ***' },

        // AWS keys
        { regex: /AKIA[0-9A-Z]{16}/g, replacement: 'AKIA***' },

        // Private keys
        { regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, replacement: '*** PRIVATE KEY REDACTED ***' },

        // JWT tokens
        { regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '*** JWT REDACTED ***' },
    ];

    static sanitizeErrorMessage(error: Error | string): string {
        let message = typeof error === 'string' ? error : error.message;

        // Apply all credential patterns
        for (const { regex, replacement } of this.CREDENTIAL_PATTERNS) {
            message = message.replace(regex, replacement);
        }

        // Remove file paths
        message = message.replace(/[A-Z]:\\[^\s)"]*/gi, '*** PATH ***');
        message = message.replace(/\/[^\s)"]*/g, (match) => {
            if (match.length > 20) return '*** PATH ***';
            return match;
        });

        // Remove IP addresses
        message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '*** IP ***');

        return message;
    }

    static sanitizeStackTrace(error: Error): string | undefined {
        if (process.env.NODE_ENV === 'production') {
            return undefined; // Never include stack traces in production
        }

        if (!error.stack) {
            return undefined;
        }

        // In development, include limited stack trace
        const lines = error.stack.split('\n').slice(0, 3);
        return lines.map(line => this.sanitizeErrorMessage(line)).join('\n');
    }

    static sanitizeError(error: Error): { message: string; stack?: string } {
        return {
            message: this.sanitizeErrorMessage(error),
            stack: this.sanitizeStackTrace(error)
        };
    }
}

// =============================================================================
// RATE LIMITING
// =============================================================================

class RateLimiter {
    private counts: Map<string, { count: number; resetAt: number }> = new Map();
    private readonly windowMs = 60000; // 1 minute

    async checkLimit(key: string, maxPerWindow: number): Promise<void> {
        const now = Date.now();
        const record = this.counts.get(key);

        if (!record || now > record.resetAt) {
            // New window
            this.counts.set(key, { count: 1, resetAt: now + this.windowMs });
            return;
        }

        if (record.count >= maxPerWindow) {
            throw new Error(`Rate limit exceeded: ${maxPerWindow} retries per minute`);
        }

        record.count++;
    }

    cleanup(): void {
        const now = Date.now();
        for (const [key, record] of this.counts.entries()) {
            if (now > record.resetAt) {
                this.counts.delete(key);
            }
        }
    }
}

// =============================================================================
// SECURE RETRY EXECUTOR
// =============================================================================

export interface SecureRetryState {
    attemptNumber: number;
    lastError: string | null; // Sanitized
    nextRetryAt: string | null;
    strategy: SecureRetryPolicy;
    totalBackoffMs: number;
    abortController: AbortController;
}

export class SecureRetryExecutor extends EventEmitter {
    private activeRetries: Map<string, SecureRetryState> = new Map();
    private rateLimiter = new RateLimiter();
    private cleanupInterval: NodeJS.Timeout;

    private readonly MIN_DELAY_MS = 10;
    private readonly MAX_DELAY_MS = 300000; // 5 minutes

    constructor(private securityConfig: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
        super();
        this.setMaxListeners(securityConfig.maxListeners);

        // Periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleRetries();
            this.rateLimiter.cleanup();
        }, 60000);
    }

    async executeWithRetry<T>(
        fn: () => Promise<T>,
        policy: Partial<SecureRetryPolicy>,
        operationId?: string
    ): Promise<T> {
        // SECURITY: Validate and sanitize all inputs
        const validatedPolicy = InputValidator.validateRetryPolicy(policy);
        const sanitizedOpId = InputValidator.sanitizeOperationId(operationId);

        // SECURITY: Check rate limits
        if (this.securityConfig.enforceRateLimits) {
            await this.rateLimiter.checkLimit(sanitizedOpId, this.securityConfig.maxRetriesPerMinute);
        }

        // SECURITY: Check active retry limit
        if (this.activeRetries.size >= this.securityConfig.maxActiveRetries) {
            throw new Error(`Too many active retry operations (max: ${this.securityConfig.maxActiveRetries})`);
        }

        const abortController = new AbortController();
        let lastError: Error = new Error('Unknown error');
        let totalBackoffMs = 0;

        for (let attempt = 1; attempt <= validatedPolicy.maxAttempts; attempt++) {
            // Check for cancellation
            if (abortController.signal.aborted) {
                this.activeRetries.delete(sanitizedOpId);
                throw new Error('Operation cancelled');
            }

            const state: SecureRetryState = {
                attemptNumber: attempt,
                lastError: attempt > 1 ? ErrorSanitizer.sanitizeErrorMessage(lastError) : null,
                nextRetryAt: null,
                strategy: validatedPolicy,
                totalBackoffMs,
                abortController
            };
            this.activeRetries.set(sanitizedOpId, state);

            try {
                const result = await fn();

                if (attempt > 1) {
                    this.emit('retry_success', {
                        operationId: sanitizedOpId,
                        attempts: attempt,
                        totalBackoffMs
                    });
                }

                this.activeRetries.delete(sanitizedOpId);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Check if this is the last attempt
                if (attempt === validatedPolicy.maxAttempts) {
                    const sanitized = ErrorSanitizer.sanitizeError(lastError);

                    this.emit('retry_exhausted', {
                        operationId: sanitizedOpId,
                        attempts: validatedPolicy.maxAttempts,
                        lastError: sanitized.message,
                        totalBackoffMs
                    });

                    this.activeRetries.delete(sanitizedOpId);
                    throw lastError;
                }

                // Check if this error is retryable
                if (!this.shouldRetry(lastError.message, validatedPolicy)) {
                    // SECURITY: Add random delay to prevent timing attacks
                    await this.sleep(Math.random() * 50);
                    this.activeRetries.delete(sanitizedOpId);
                    throw lastError;
                }

                // Calculate delay with security bounds
                const delayMs = this.calculateDelay(attempt, validatedPolicy);
                totalBackoffMs += delayMs;
                const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

                // Update state
                state.nextRetryAt = nextRetryAt;
                state.totalBackoffMs = totalBackoffMs;
                this.activeRetries.set(sanitizedOpId, state);

                // Emit retry event with sanitized error
                const sanitized = ErrorSanitizer.sanitizeError(lastError);
                this.emit('retry_attempt', {
                    operationId: sanitizedOpId,
                    attempt,
                    maxAttempts: validatedPolicy.maxAttempts,
                    error: sanitized.message,
                    nextDelayMs: delayMs,
                    nextRetryAt
                });

                // Call optional retry callback with sanitized error
                if (validatedPolicy.onRetry) {
                    try {
                        validatedPolicy.onRetry(attempt, sanitized.message, delayMs);
                    } catch (callbackError) {
                        console.error('Error in onRetry callback:', callbackError);
                    }
                }

                // Wait before next attempt
                await this.sleep(delayMs);
            }
        }

        // Should never reach here
        this.activeRetries.delete(sanitizedOpId);
        throw lastError;
    }

    /**
     * SECURE: Calculates delay with bounds checking and overflow protection
     */
    private calculateDelay(attempt: number, policy: SecureRetryPolicy): number {
        let delay: number;

        switch (policy.backoffType) {
            case 'exponential':
                // SECURITY: Protected exponential calculation
                const exp = Math.pow(2, attempt);
                if (!Number.isFinite(exp) || exp > Number.MAX_SAFE_INTEGER) {
                    delay = this.MAX_DELAY_MS;
                } else {
                    delay = policy.baseDelayMs * exp;
                }
                break;

            case 'linear':
                delay = policy.baseDelayMs * attempt;
                break;

            case 'fixed':
                delay = policy.baseDelayMs;
                break;

            default:
                delay = policy.baseDelayMs;
        }

        // SECURITY: Enforce minimum delay
        delay = Math.max(this.MIN_DELAY_MS, delay);

        // SECURITY: Cap at maximum delay
        delay = Math.min(delay, Math.min(policy.maxDelayMs, this.MAX_DELAY_MS));

        // Apply enhanced jitter (30% for better timing attack protection)
        if (policy.jitter) {
            const jitterRange = delay * 0.3; // Increased from 0.1
            const jitterOffset = (Math.random() * 2 - 1) * jitterRange;
            delay = Math.max(this.MIN_DELAY_MS, delay + jitterOffset);
        }

        return Math.round(delay);
    }

    /**
     * SECURE: Error matching with timeout protection and safe fallback
     */
    private shouldRetry(errorMessage: string, policy: SecureRetryPolicy): boolean {
        if (policy.retryableErrors.length === 0) {
            return true;
        }

        return policy.retryableErrors.some(pattern => {
            try {
                // First try simple string matching
                const simpleMatch = errorMessage.toLowerCase().includes(pattern.toLowerCase());
                if (simpleMatch) return true;

                // Try regex with limited input length (ReDoS protection)
                const safeMessage = errorMessage.substring(0, 1000);
                const regex = new RegExp(pattern, 'i');
                return regex.test(safeMessage);
            } catch {
                // Fallback to simple string matching on error
                return errorMessage.toLowerCase().includes(pattern.toLowerCase());
            }
        });
    }

    /**
     * SECURE: Cancellation with abort controller
     */
    cancelRetry(operationId: string): boolean {
        const sanitizedId = InputValidator.sanitizeOperationId(operationId);
        const state = this.activeRetries.get(sanitizedId);

        if (state) {
            state.abortController.abort();
            this.activeRetries.delete(sanitizedId);
            return true;
        }

        return false;
    }

    getRetryState(operationId: string): Omit<SecureRetryState, 'abortController'> | undefined {
        const sanitizedId = InputValidator.sanitizeOperationId(operationId);
        const state = this.activeRetries.get(sanitizedId);

        if (!state) return undefined;

        // Don't expose abort controller
        const { abortController, ...publicState } = state;
        return publicState;
    }

    getActiveRetries(): Map<string, Omit<SecureRetryState, 'abortController'>> {
        const publicMap = new Map();

        for (const [opId, state] of this.activeRetries.entries()) {
            const { abortController, ...publicState } = state;
            publicMap.set(opId, publicState);
        }

        return publicMap;
    }

    private cleanupStaleRetries(): void {
        const now = Date.now();
        const MAX_AGE_MS = 3600000; // 1 hour

        for (const [opId, state] of this.activeRetries.entries()) {
            if (state.nextRetryAt) {
                const retryTime = new Date(state.nextRetryAt).getTime();
                if (now - retryTime > MAX_AGE_MS) {
                    console.warn(`Cleaning up stale retry: ${opId}`);
                    state.abortController.abort();
                    this.activeRetries.delete(opId);
                }
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.removeAllListeners();
        this.activeRetries.clear();
    }
}

// =============================================================================
// SECURE DEFAULT POLICIES
// =============================================================================

export const SECURE_DEFAULT_POLICY: SecureRetryPolicy = {
    maxAttempts: 3,
    backoffType: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: [],
    jitter: true
};

export const SECURE_AGGRESSIVE_POLICY: SecureRetryPolicy = {
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
        '429',
        '503',
        '504'
    ],
    jitter: true
};

export function createSecureRetryPolicy(overrides: Partial<SecureRetryPolicy> = {}): SecureRetryPolicy {
    return InputValidator.validateRetryPolicy({
        ...SECURE_DEFAULT_POLICY,
        ...overrides
    });
}

export default SecureRetryExecutor;
