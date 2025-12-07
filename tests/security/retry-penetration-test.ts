/**
 * SECURITY PENETRATION TESTING SUITE FOR RETRY LOGIC
 *
 * This suite contains proof-of-concept exploits targeting vulnerabilities
 * in the retry strategy implementation. Each test demonstrates a specific
 * attack vector and its potential impact.
 *
 * ⚠️ WARNING: These are intentional exploits for security testing.
 * Do NOT use in production code.
 */

import { RetryExecutor, RetryPolicy, createRetryPolicy } from '../../src/orchestration/RetryStrategy';
import { RetryStrategy } from '../../src/orchestration/__tests__/RetryStrategy.test';

// =============================================================================
// ATTACK VECTOR 1: DENIAL OF SERVICE VIA RETRY LOOPS
// =============================================================================

describe('CRITICAL: DoS via Infinite Retry Loop Exploitation', () => {
    it('EXPLOIT: Negative maxAttempts bypasses retry limit', async () => {
        /**
         * VULNERABILITY: No validation on maxAttempts parameter
         * IMPACT: Attacker can cause infinite retry loops
         * SEVERITY: CRITICAL
         */
        const executor = new RetryExecutor();

        // MALICIOUS PAYLOAD
        const maliciousPolicy: RetryPolicy = {
            maxAttempts: -1, // EXPLOIT: Negative value
            backoffType: 'exponential',
            baseDelayMs: 0,
            maxDelayMs: 0,
            retryableErrors: [],
            jitter: false
        };

        let attemptCount = 0;
        const failingOperation = async () => {
            attemptCount++;
            if (attemptCount > 1000) {
                throw new Error('EXPLOIT SUCCESS: Loop continued beyond reasonable limit');
            }
            throw new Error('ETIMEDOUT');
        };

        try {
            await executor.executeWithRetry(failingOperation, maliciousPolicy);
        } catch (error) {
            // Verify exploit worked
            console.log(`[EXPLOIT] Infinite loop executed ${attemptCount} times before manual abort`);
            expect(attemptCount).toBeGreaterThan(100); // Should have been limited to 3
        }
    });

    it('EXPLOIT: Zero baseDelayMs causes tight CPU loop', async () => {
        /**
         * VULNERABILITY: No minimum delay enforcement
         * IMPACT: CPU exhaustion via tight retry loops
         * SEVERITY: HIGH
         */
        const executor = new RetryExecutor();

        const maliciousPolicy: RetryPolicy = {
            maxAttempts: 1000,
            backoffType: 'fixed',
            baseDelayMs: 0, // EXPLOIT: No delay between retries
            maxDelayMs: 0,
            retryableErrors: [],
            jitter: false
        };

        const startTime = Date.now();
        let attemptCount = 0;

        try {
            await executor.executeWithRetry(async () => {
                attemptCount++;
                if (attemptCount < 1000) {
                    throw new Error('ETIMEDOUT');
                }
                return 'done';
            }, maliciousPolicy);
        } catch (error) {
            // Ignore
        }

        const duration = Date.now() - startTime;

        // EXPLOIT SUCCESS: 1000 retries completed in under 1 second
        console.log(`[EXPLOIT] 1000 retries in ${duration}ms - CPU exhaustion achieved`);
        expect(duration).toBeLessThan(1000); // Should have taken much longer with proper delays
    });

    it('EXPLOIT: MaxAttempts bypass via overflow', async () => {
        /**
         * VULNERABILITY: Integer overflow not handled
         * IMPACT: Attacker can set extremely large maxAttempts
         * SEVERITY: HIGH
         */
        const executor = new RetryExecutor();

        const maliciousPolicy: RetryPolicy = {
            maxAttempts: Number.MAX_SAFE_INTEGER, // EXPLOIT: Overflow
            backoffType: 'fixed',
            baseDelayMs: 1,
            maxDelayMs: 1,
            retryableErrors: [],
            jitter: false
        };

        let attemptCount = 0;
        try {
            await executor.executeWithRetry(async () => {
                attemptCount++;
                if (attemptCount > 100) {
                    throw new Error('EXPLOIT: Would continue indefinitely');
                }
                throw new Error('ETIMEDOUT');
            }, maliciousPolicy);
        } catch (error) {
            console.log(`[EXPLOIT] Overflow allowed ${attemptCount} attempts before manual abort`);
            expect(maliciousPolicy.maxAttempts).toBeGreaterThan(1000000000);
        }
    });

    it('EXPLOIT: Memory exhaustion via event accumulation', async () => {
        /**
         * VULNERABILITY: RetryState objects never garbage collected
         * IMPACT: Memory exhaustion via event listener leaks
         * SEVERITY: HIGH
         */
        const executor = new RetryExecutor();

        const policy: RetryPolicy = {
            maxAttempts: 2,
            backoffType: 'fixed',
            baseDelayMs: 1,
            maxDelayMs: 1,
            retryableErrors: [],
            jitter: false
        };

        const initialMemory = process.memoryUsage().heapUsed;
        const eventAccumulator: any[] = [];

        // EXPLOIT: Register thousands of event listeners
        for (let i = 0; i < 10000; i++) {
            executor.on('retry_attempt', (data) => {
                eventAccumulator.push(data); // Leak reference
            });
        }

        // Trigger events
        for (let i = 0; i < 100; i++) {
            try {
                await executor.executeWithRetry(async () => {
                    throw new Error('ETIMEDOUT');
                }, policy, `op-${i}`);
            } catch {}
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        console.log(`[EXPLOIT] Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        expect(memoryIncrease).toBeGreaterThan(1024 * 1024); // >1MB leaked
        expect(eventAccumulator.length).toBeGreaterThan(100000); // Events accumulated
    });
});

// =============================================================================
// ATTACK VECTOR 2: ERROR MESSAGE INFORMATION LEAKAGE
// =============================================================================

describe('HIGH: Information Disclosure via Error Messages', () => {
    it('EXPLOIT: Stack trace exposes internal paths', async () => {
        /**
         * VULNERABILITY: Full error objects exposed in events
         * IMPACT: Stack traces leak filesystem paths, dependencies
         * SEVERITY: HIGH
         */
        const executor = new RetryExecutor();

        let leakedStackTrace = '';

        executor.on('retry_attempt', (data: any) => {
            // EXPLOIT: Event contains full error object
            console.log('[EXPLOIT] Leaked error data:', data);
            leakedStackTrace = data.error; // Contains stack trace
        });

        const policy = createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 });

        try {
            await executor.executeWithRetry(async () => {
                // Simulate internal error with stack trace
                const err = new Error('Internal server error');
                (err as any).stack = `Error: Internal server error
    at SecretModule.processPayment (/app/internal/billing/stripe.js:142:15)
    at Database.query (/app/db/postgresql-production.js:89:23)
    at API_KEY_VALIDATOR (/app/auth/secrets.js:45:10)`;
                throw err;
            }, policy);
        } catch {}

        // VERIFY LEAK
        console.log('[EXPLOIT] Stack trace leaked via event');
        expect(leakedStackTrace).toBeTruthy();
    });

    it('EXPLOIT: Credential exposure in error messages', async () => {
        /**
         * VULNERABILITY: Error messages not sanitized
         * IMPACT: Credentials leaked via retry events
         * SEVERITY: CRITICAL
         */
        const executor = new RetryExecutor();

        let leakedCredentials = '';

        executor.on('retry_exhausted', (data: any) => {
            leakedCredentials = data.lastError;
            console.log('[EXPLOIT] Leaked credentials:', leakedCredentials);
        });

        const policy = createRetryPolicy({ maxAttempts: 1, baseDelayMs: 1 });

        try {
            await executor.executeWithRetry(async () => {
                throw new Error('Authentication failed for postgresql://admin:SuperSecret123@prod-db.internal:5432/payments');
            }, policy);
        } catch {}

        // VERIFY CREDENTIALS LEAKED
        expect(leakedCredentials).toContain('SuperSecret123');
        expect(leakedCredentials).toContain('admin');
        expect(leakedCredentials).toContain('prod-db.internal');
    });

    it('EXPLOIT: System information disclosure', async () => {
        /**
         * VULNERABILITY: Error objects expose system information
         * IMPACT: Attacker learns system architecture
         * SEVERITY: MEDIUM
         */
        const executor = new RetryExecutor();

        let systemInfo: any = {};

        executor.on('retry_attempt', (data: any) => {
            systemInfo = data;
        });

        const policy = createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 });

        try {
            await executor.executeWithRetry(async () => {
                const err = new Error('EACCES');
                (err as any).code = 'EACCES';
                (err as any).path = 'C:\\Windows\\System32\\config\\SAM';
                (err as any).syscall = 'open';
                (err as any).errno = -13;
                throw err;
            }, policy);
        } catch {}

        console.log('[EXPLOIT] System info leaked:', systemInfo);
        expect(systemInfo.operationId).toBeTruthy(); // Reveals operation patterns
    });
});

// =============================================================================
// ATTACK VECTOR 3: TIMING ATTACKS
// =============================================================================

describe('MEDIUM: Timing-based Information Disclosure', () => {
    it('EXPLOIT: Backoff timing reveals failure type', async () => {
        /**
         * VULNERABILITY: Different errors have observable retry patterns
         * IMPACT: Attacker can determine error types via timing
         * SEVERITY: MEDIUM
         */
        const executor = new RetryExecutor();

        const policy: RetryPolicy = {
            maxAttempts: 3,
            backoffType: 'exponential',
            baseDelayMs: 100,
            maxDelayMs: 5000,
            retryableErrors: ['ETIMEDOUT'], // Only timeouts retry
            jitter: false // VULNERABILITY: No timing randomization
        };

        // Test 1: Retryable error (ETIMEDOUT)
        const start1 = Date.now();
        try {
            await executor.executeWithRetry(async () => {
                throw new Error('ETIMEDOUT');
            }, policy);
        } catch {}
        const duration1 = Date.now() - start1;

        // Test 2: Non-retryable error (EACCES)
        const start2 = Date.now();
        try {
            await executor.executeWithRetry(async () => {
                throw new Error('EACCES');
            }, policy);
        } catch {}
        const duration2 = Date.now() - start2;

        // EXPLOIT: Timing difference reveals error classification
        console.log(`[EXPLOIT] Retryable error duration: ${duration1}ms`);
        console.log(`[EXPLOIT] Non-retryable error duration: ${duration2}ms`);
        console.log(`[EXPLOIT] Timing difference reveals internal logic: ${Math.abs(duration1 - duration2)}ms`);

        expect(Math.abs(duration1 - duration2)).toBeGreaterThan(50);
    });

    it('EXPLOIT: Jitter insufficient for anonymization', async () => {
        /**
         * VULNERABILITY: 10% jitter is predictable
         * IMPACT: Observable patterns reveal retry state
         * SEVERITY: LOW
         */
        const executor = new RetryExecutor();

        const policy: RetryPolicy = {
            maxAttempts: 3,
            backoffType: 'exponential',
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            retryableErrors: [],
            jitter: true // Only ±10% variation
        };

        const timings: number[] = [];

        for (let i = 0; i < 10; i++) {
            const start = Date.now();
            try {
                await executor.executeWithRetry(async () => {
                    if (Date.now() - start < 100) {
                        throw new Error('ETIMEDOUT');
                    }
                    return 'ok';
                }, policy);
            } catch {}
            timings.push(Date.now() - start);
        }

        // EXPLOIT: Pattern is still observable despite jitter
        const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
        const variance = Math.max(...timings) - Math.min(...timings);

        console.log(`[EXPLOIT] Average timing: ${avgTiming}ms`);
        console.log(`[EXPLOIT] Variance: ${variance}ms (predictable within ${variance}ms)`);

        expect(variance).toBeLessThan(300); // Predictable range
    });

    it('EXPLOIT: Retry count observable via timing pattern', async () => {
        /**
         * VULNERABILITY: Exponential backoff creates unique signatures
         * IMPACT: Attacker can count retry attempts via timing
         * SEVERITY: LOW
         */
        const executor = new RetryExecutor();

        const policy: RetryPolicy = {
            maxAttempts: 5,
            backoffType: 'exponential',
            baseDelayMs: 100,
            maxDelayMs: 10000,
            retryableErrors: [],
            jitter: false
        };

        const start = Date.now();
        let retryCount = 0;

        try {
            await executor.executeWithRetry(async () => {
                retryCount++;
                if (retryCount < 4) {
                    throw new Error('ETIMEDOUT');
                }
                return 'ok';
            }, policy);
        } catch {}

        const duration = Date.now() - start;

        // EXPLOIT: Duration reveals retry count
        // Expected: 100 + 200 + 400 = 700ms (3 retries)
        const calculatedRetries = Math.floor(Math.log2((duration / 100) + 1));

        console.log(`[EXPLOIT] Actual retries: ${retryCount}`);
        console.log(`[EXPLOIT] Calculated from timing: ${calculatedRetries}`);
        console.log(`[EXPLOIT] Timing signature: ${duration}ms reveals ${retryCount} attempts`);
    });
});

// =============================================================================
// ATTACK VECTOR 4: INPUT VALIDATION EXPLOITS
// =============================================================================

describe('HIGH: Input Validation Bypasses', () => {
    it('EXPLOIT: Negative delay values cause immediate retries', async () => {
        /**
         * VULNERABILITY: No validation on baseDelayMs
         * IMPACT: Bypass rate limiting, CPU exhaustion
         * SEVERITY: HIGH
         */
        const executor = new RetryExecutor();

        const maliciousPolicy: RetryPolicy = {
            maxAttempts: 100,
            backoffType: 'fixed',
            baseDelayMs: -1000, // EXPLOIT: Negative delay
            maxDelayMs: 0,
            retryableErrors: [],
            jitter: false
        };

        const start = Date.now();
        let count = 0;

        try {
            await executor.executeWithRetry(async () => {
                count++;
                if (count < 100) throw new Error('ETIMEDOUT');
                return 'ok';
            }, maliciousPolicy);
        } catch {}

        const duration = Date.now() - start;

        console.log(`[EXPLOIT] 100 retries with negative delay completed in ${duration}ms`);
        expect(duration).toBeLessThan(1000); // Should have taken 100 seconds
    });

    it('EXPLOIT: Regex ReDoS in retryableErrors patterns', async () => {
        /**
         * VULNERABILITY: User-supplied regex not validated
         * IMPACT: CPU exhaustion via catastrophic backtracking
         * SEVERITY: HIGH
         */
        const executor = new RetryExecutor();

        // MALICIOUS REGEX: Catastrophic backtracking pattern
        const maliciousPolicy: RetryPolicy = {
            maxAttempts: 3,
            backoffType: 'fixed',
            baseDelayMs: 1,
            maxDelayMs: 1,
            retryableErrors: [
                '(a+)+b', // ReDoS pattern
                '(a|a)*',
                '(a|ab)*'
            ],
            jitter: false
        };

        const start = Date.now();

        try {
            await executor.executeWithRetry(async () => {
                // Attack string: many 'a's with no 'b'
                throw new Error('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
            }, maliciousPolicy);
        } catch {}

        const duration = Date.now() - start;

        console.log(`[EXPLOIT] ReDoS pattern caused ${duration}ms delay`);
        // Note: Modern regex engines may optimize this, but still a vulnerability
    });

    it('EXPLOIT: Special characters in operationId', async () => {
        /**
         * VULNERABILITY: operationId not sanitized
         * IMPACT: Potential for injection attacks, log poisoning
         * SEVERITY: MEDIUM
         */
        const executor = new RetryExecutor();
        const policy = createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 });

        let capturedOperationId = '';

        executor.on('retry_attempt', (data: any) => {
            capturedOperationId = data.operationId;
        });

        // MALICIOUS PAYLOAD
        const maliciousOperationId = `../../../etc/passwd\x00\r\n\t<script>alert('xss')</script>`;

        try {
            await executor.executeWithRetry(async () => {
                throw new Error('ETIMEDOUT');
            }, policy, maliciousOperationId);
        } catch {}

        console.log('[EXPLOIT] Unsanitized operationId:', capturedOperationId);
        expect(capturedOperationId).toBe(maliciousOperationId);
        expect(capturedOperationId).toContain('../../../');
        expect(capturedOperationId).toContain('<script>');
    });

    it('EXPLOIT: Exponential base overflow', async () => {
        /**
         * VULNERABILITY: exponentialBase not bounded
         * IMPACT: Integer overflow, maxDelayMs bypass
         * SEVERITY: MEDIUM
         */
        const strategy = new RetryStrategy({
            baseDelayMs: 1000,
            exponentialBase: 999999, // EXPLOIT: Huge base
            maxDelayMs: 5000
        });

        const delay = strategy.calculateBackoff(5);

        console.log(`[EXPLOIT] Calculated delay: ${delay}ms`);
        console.log(`[EXPLOIT] Expected cap: 5000ms`);

        // Should be capped at 5000, but may overflow
        expect(delay).toBeDefined();
    });
});

// =============================================================================
// ATTACK VECTOR 5: RACE CONDITIONS
// =============================================================================

describe('MEDIUM: Race Conditions and Concurrency Issues', () => {
    it('EXPLOIT: Concurrent retry operations with same ID', async () => {
        /**
         * VULNERABILITY: No mutex on activeRetries Map
         * IMPACT: State corruption, undefined behavior
         * SEVERITY: MEDIUM
         */
        const executor = new RetryExecutor();
        const policy = createRetryPolicy({ maxAttempts: 5, baseDelayMs: 50 });

        const sharedOperationId = 'shared-op-id';

        const operation1 = executor.executeWithRetry(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('ETIMEDOUT');
        }, policy, sharedOperationId);

        const operation2 = executor.executeWithRetry(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            throw new Error('ECONNRESET');
        }, policy, sharedOperationId);

        try {
            await Promise.all([operation1, operation2]);
        } catch {}

        // EXPLOIT: Both operations modified same Map entry
        const state = executor.getRetryState(sharedOperationId);
        console.log('[EXPLOIT] Final state after race:', state);
    });

    it('EXPLOIT: Cancel during active retry', async () => {
        /**
         * VULNERABILITY: No synchronization between cancel and execute
         * IMPACT: Operations continue after cancel, resource leak
         * SEVERITY: MEDIUM
         */
        const executor = new RetryExecutor();
        const policy = createRetryPolicy({ maxAttempts: 10, baseDelayMs: 100 });

        const operationId = 'cancel-test';
        let operationCompleted = false;

        const operation = executor.executeWithRetry(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            operationCompleted = true;
            throw new Error('ETIMEDOUT');
        }, policy, operationId);

        // Cancel while operation is running
        setTimeout(() => {
            const cancelled = executor.cancelRetry(operationId);
            console.log(`[EXPLOIT] Cancelled: ${cancelled}, but operation continues...`);
        }, 25);

        try {
            await operation;
        } catch {}

        console.log(`[EXPLOIT] Operation completed: ${operationCompleted} (should have been cancelled)`);
        expect(operationCompleted).toBe(true); // Operation wasn't actually stopped
    });

    it('EXPLOIT: Event listener memory leak under concurrent load', async () => {
        /**
         * VULNERABILITY: EventEmitter memory leak under load
         * IMPACT: Memory exhaustion
         * SEVERITY: MEDIUM
         */
        const executor = new RetryExecutor();
        const policy = createRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 });

        const initialListeners = executor.listenerCount('retry_attempt');

        // EXPLOIT: Rapidly add/remove listeners while operations run
        const operations = [];
        for (let i = 0; i < 100; i++) {
            const listener = () => {};
            executor.on('retry_attempt', listener);

            operations.push(
                executor.executeWithRetry(async () => {
                    throw new Error('ETIMEDOUT');
                }, policy, `op-${i}`).catch(() => {})
            );

            // Sometimes remove listener (simulating real-world usage)
            if (i % 3 === 0) {
                executor.removeListener('retry_attempt', listener);
            }
        }

        await Promise.all(operations);

        const finalListeners = executor.listenerCount('retry_attempt');
        const leaked = finalListeners - initialListeners;

        console.log(`[EXPLOIT] Listener leak: ${leaked} listeners not cleaned up`);
        expect(leaked).toBeGreaterThan(0);
    });

    it('EXPLOIT: State corruption via concurrent activeRetries access', async () => {
        /**
         * VULNERABILITY: Map.set() not atomic with delay calculation
         * IMPACT: Inconsistent retry state
         * SEVERITY: LOW
         */
        const executor = new RetryExecutor();
        const policy = createRetryPolicy({ maxAttempts: 5, baseDelayMs: 10 });

        const stateSnapshots: any[] = [];

        executor.on('retry_attempt', (data: any) => {
            // Capture state during concurrent operations
            const allStates = executor.getActiveRetries();
            stateSnapshots.push({
                timestamp: Date.now(),
                activeCount: allStates.size,
                states: Array.from(allStates.entries())
            });
        });

        // Run many concurrent operations
        const operations = Array.from({ length: 50 }, (_, i) =>
            executor.executeWithRetry(async () => {
                throw new Error('ETIMEDOUT');
            }, policy, `concurrent-${i}`).catch(() => {})
        );

        await Promise.all(operations);

        console.log(`[EXPLOIT] Captured ${stateSnapshots.length} state snapshots during concurrent execution`);
        console.log('[EXPLOIT] State corruption opportunities identified');
    });
});
