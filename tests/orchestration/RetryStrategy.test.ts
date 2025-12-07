import {
  RetryExecutor,
  RetryPolicy,
  BackoffType,
  DEFAULT_AGENT_POLICY,
  AGGRESSIVE_POLICY,
  CONSERVATIVE_POLICY,
  createRetryPolicy
} from '../../src/orchestration/RetryStrategy';

describe('RetryExecutor', () => {
  let executor: RetryExecutor;

  beforeEach(() => {
    executor = new RetryExecutor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    executor.removeAllListeners();
  });

  describe('calculateDelay - Exponential Backoff', () => {
    it('should calculate exponential backoff correctly: 2^attempt * baseDelay', () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 60000,
        retryableErrors: [],
        jitter: false
      };

      // Exponential: baseDelay * 2^attempt
      expect(executor.calculateDelay(1, policy)).toBe(2000);  // 1000 * 2^1
      expect(executor.calculateDelay(2, policy)).toBe(4000);  // 1000 * 2^2
      expect(executor.calculateDelay(3, policy)).toBe(8000);  // 1000 * 2^3
      expect(executor.calculateDelay(4, policy)).toBe(16000); // 1000 * 2^4
      expect(executor.calculateDelay(5, policy)).toBe(32000); // 1000 * 2^5
    });

    it('should enforce maxDelay cap on exponential backoff', () => {
      const policy: RetryPolicy = {
        maxAttempts: 10,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 10000, // Cap at 10 seconds
        retryableErrors: [],
        jitter: false
      };

      // Without cap: 1000 * 2^6 = 64000
      // With cap: should be 10000
      expect(executor.calculateDelay(6, policy)).toBe(10000);
      expect(executor.calculateDelay(7, policy)).toBe(10000);
      expect(executor.calculateDelay(10, policy)).toBe(10000);
    });

    it('should add jitter of ±10% variance to exponential backoff', () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        retryableErrors: [],
        jitter: true
      };

      // Run multiple times to test jitter variance
      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(executor.calculateDelay(2, policy));
      }

      // Base delay for attempt 2: 1000 * 2^2 = 4000
      // Jitter range: ±400 (10% of 4000)
      // Expected range: 3600 to 4400
      const minExpected = 3600;
      const maxExpected = 4400;

      // At least some variance should exist
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within jitter range
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(minExpected);
        expect(delay).toBeLessThanOrEqual(maxExpected);
      });
    });

    it('should not add jitter when jitter is disabled', () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        retryableErrors: [],
        jitter: false
      };

      // Should always return exact same value
      const delay1 = executor.calculateDelay(2, policy);
      const delay2 = executor.calculateDelay(2, policy);
      const delay3 = executor.calculateDelay(2, policy);

      expect(delay1).toBe(4000);
      expect(delay2).toBe(4000);
      expect(delay3).toBe(4000);
    });
  });

  describe('calculateDelay - Linear Backoff', () => {
    it('should calculate linear backoff correctly: attempt * baseDelay', () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'linear',
        baseDelayMs: 1000,
        maxDelayMs: 60000,
        retryableErrors: [],
        jitter: false
      };

      // Linear: baseDelay * attempt
      expect(executor.calculateDelay(1, policy)).toBe(1000);  // 1000 * 1
      expect(executor.calculateDelay(2, policy)).toBe(2000);  // 1000 * 2
      expect(executor.calculateDelay(3, policy)).toBe(3000);  // 1000 * 3
      expect(executor.calculateDelay(4, policy)).toBe(4000);  // 1000 * 4
      expect(executor.calculateDelay(5, policy)).toBe(5000);  // 1000 * 5
    });

    it('should progress through linear attempts consistently', () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'linear',
        baseDelayMs: 500,
        maxDelayMs: 10000,
        retryableErrors: [],
        jitter: false
      };

      const delays = [1, 2, 3, 4, 5].map(attempt => executor.calculateDelay(attempt, policy));

      // Each delay should increase by baseDelay
      expect(delays).toEqual([500, 1000, 1500, 2000, 2500]);
    });

    it('should enforce maxDelay cap on linear backoff', () => {
      const policy: RetryPolicy = {
        maxAttempts: 10,
        backoffType: 'linear',
        baseDelayMs: 2000,
        maxDelayMs: 5000,
        retryableErrors: [],
        jitter: false
      };

      // Without cap: 2000 * 5 = 10000
      // With cap: should be 5000
      expect(executor.calculateDelay(5, policy)).toBe(5000);
      expect(executor.calculateDelay(10, policy)).toBe(5000);
    });
  });

  describe('calculateDelay - Fixed Backoff', () => {
    it('should return constant delay regardless of attempt number', () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'fixed',
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        retryableErrors: [],
        jitter: false
      };

      // Fixed: always baseDelay
      expect(executor.calculateDelay(1, policy)).toBe(2000);
      expect(executor.calculateDelay(2, policy)).toBe(2000);
      expect(executor.calculateDelay(3, policy)).toBe(2000);
      expect(executor.calculateDelay(10, policy)).toBe(2000);
      expect(executor.calculateDelay(100, policy)).toBe(2000);
    });

    it('should verify no progression in fixed backoff', () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'fixed',
        baseDelayMs: 1500,
        maxDelayMs: 10000,
        retryableErrors: [],
        jitter: false
      };

      const delays = [1, 2, 3, 4, 5].map(attempt => executor.calculateDelay(attempt, policy));

      // All delays should be identical
      expect(delays).toEqual([1500, 1500, 1500, 1500, 1500]);
    });
  });

  describe('executeWithRetry - Successful Execution', () => {
    it('should return result on first successful attempt without retry', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not emit retry_success event on first attempt success', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retrySuccessSpy = jest.fn();
      executor.on('retry_success', retrySuccessSpy);

      await executor.executeWithRetry(mockFn, policy);

      expect(retrySuccessSpy).not.toHaveBeenCalled();
    });
  });

  describe('executeWithRetry - Retry After Transient Failure', () => {
    it('should retry after transient failure and eventually succeed', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'fixed',
        baseDelayMs: 50, // Short delay for testing
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should emit retry_success event on eventual success after retries', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retrySuccessSpy = jest.fn();
      executor.on('retry_success', retrySuccessSpy);

      await executor.executeWithRetry(mockFn, policy, 'test-op-1');

      expect(retrySuccessSpy).toHaveBeenCalledTimes(1);
      expect(retrySuccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'test-op-1',
          attempts: 2
        })
      );
    });
  });

  describe('executeWithRetry - Max Attempts Exhausted', () => {
    it('should throw error when max attempts are exhausted', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await expect(executor.executeWithRetry(mockFn, policy)).rejects.toThrow('Persistent error');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should emit retry_exhausted event when all attempts fail', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retryExhaustedSpy = jest.fn();
      executor.on('retry_exhausted', retryExhaustedSpy);

      await expect(executor.executeWithRetry(mockFn, policy, 'test-op-2')).rejects.toThrow();

      expect(retryExhaustedSpy).toHaveBeenCalledTimes(1);
      expect(retryExhaustedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'test-op-2',
          attempts: 3,
          lastError: 'Persistent error'
        })
      );
    });

    it('should return last error when all attempts exhausted', async () => {
      const lastError = new Error('Final error message');
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          throw lastError;
        }
        throw new Error('Other error');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await expect(executor.executeWithRetry(mockFn, policy)).rejects.toThrow('Final error message');
    });
  });

  describe('executeWithRetry - Non-Retryable Errors', () => {
    it('should stop immediately on non-retryable error', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('ValidationError: Invalid input'));
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: ['timeout', 'network', 'ECONNRESET'],
        jitter: false
      };

      await expect(executor.executeWithRetry(mockFn, policy)).rejects.toThrow('ValidationError: Invalid input');

      // Should only be called once (no retries)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not emit retry_attempt for non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('ValidationError'));
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: ['timeout'],
        jitter: false
      };

      const retryAttemptSpy = jest.fn();
      executor.on('retry_attempt', retryAttemptSpy);

      await expect(executor.executeWithRetry(mockFn, policy)).rejects.toThrow();

      expect(retryAttemptSpy).not.toHaveBeenCalled();
    });
  });

  describe('executeWithRetry - Retryable Error Patterns', () => {
    it('should match retryable error patterns correctly', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network timeout occurred');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: ['timeout', 'network'],
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should support regex pattern matching for retryable errors', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Error: ETIMEDOUT connection failed');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: ['ETIMED.*', 'ECONNRE.*'],
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should match HTTP status codes in retryable errors', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('HTTP 503 Service Unavailable');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: ['429', '503', '504'],
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Emission - retry_attempt', () => {
    it('should emit retry_attempt event with correct data', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retryAttemptSpy = jest.fn();
      executor.on('retry_attempt', retryAttemptSpy);

      await executor.executeWithRetry(mockFn, policy, 'test-op-3');

      expect(retryAttemptSpy).toHaveBeenCalledTimes(1);
      expect(retryAttemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'test-op-3',
          attempt: 1,
          maxAttempts: 3,
          error: 'Transient error',
          nextDelayMs: 100
        })
      );
    });

    it('should emit multiple retry_attempt events for multiple retries', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'linear',
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retryAttemptSpy = jest.fn();
      executor.on('retry_attempt', retryAttemptSpy);

      await executor.executeWithRetry(mockFn, policy);

      expect(retryAttemptSpy).toHaveBeenCalledTimes(2);

      // First retry attempt
      expect(retryAttemptSpy).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          attempt: 1,
          nextDelayMs: 100 // Linear: 100 * 1
        })
      );

      // Second retry attempt
      expect(retryAttemptSpy).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          attempt: 2,
          nextDelayMs: 200 // Linear: 100 * 2
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero maxAttempts by throwing unknown error', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const policy: RetryPolicy = {
        maxAttempts: 0,
        backoffType: 'fixed',
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      // Loop condition (attempt <= 0) means it won't execute and throws lastError
      await expect(executor.executeWithRetry(mockFn, policy)).rejects.toThrow('Unknown error');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should handle negative baseDelay by treating as zero', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValue('success');

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: -500,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      // Should still work, just with minimal/zero delay
      const startTime = Date.now();
      const result = await executor.executeWithRetry(mockFn, policy);
      const duration = Date.now() - startTime;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
      // Duration should be very short since delay is negative
      expect(duration).toBeLessThan(100);
    });

    it('should retry all errors when retryableErrors array is empty', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Any random error message');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [], // Empty = all errors are retryable
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle regex pattern errors gracefully and fall back to string matching', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Contains [invalid( regex');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: ['[invalid('], // Invalid regex, should fall back to string matching
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle non-Error exceptions', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw 'String error'; // Not an Error object
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('onRetry Callback', () => {
    it('should call onRetry callback on each retry attempt', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const onRetrySpy = jest.fn();
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false,
        onRetry: onRetrySpy
      };

      await executor.executeWithRetry(mockFn, policy);

      expect(onRetrySpy).toHaveBeenCalledTimes(2);

      // First retry
      expect(onRetrySpy).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 50);

      // Second retry
      expect(onRetrySpy).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 50);
    });

    it('should handle errors in onRetry callback without failing retry', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const onRetry = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false,
        onRetry
      };

      // Should still succeed despite callback error
      const result = await executor.executeWithRetry(mockFn, policy);

      expect(result).toBe('success');
      expect(consoleSpy).toHaveBeenCalledWith('Error in onRetry callback:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('State Management', () => {
    it('should track retry state during execution', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          // Check state mid-execution
          const state = executor.getRetryState('state-test-1');
          expect(state).toBeDefined();
          expect(state?.attemptNumber).toBe(callCount);

          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await executor.executeWithRetry(mockFn, policy, 'state-test-1');
    });

    it('should clean up state after successful completion', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await executor.executeWithRetry(mockFn, policy, 'state-test-2');

      const state = executor.getRetryState('state-test-2');
      expect(state).toBeUndefined();
    });

    it('should clean up state after exhausting retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));
      const policy: RetryPolicy = {
        maxAttempts: 2,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await expect(executor.executeWithRetry(mockFn, policy, 'state-test-3')).rejects.toThrow();

      const state = executor.getRetryState('state-test-3');
      expect(state).toBeUndefined();
    });

    it('should track totalBackoffMs correctly', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoffType: 'linear',
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retrySuccessSpy = jest.fn();
      executor.on('retry_success', retrySuccessSpy);

      await executor.executeWithRetry(mockFn, policy);

      // Total backoff: 100 (attempt 1) + 200 (attempt 2) = 300ms
      expect(retrySuccessSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          totalBackoffMs: 300
        })
      );
    });
  });

  describe('Default Policies', () => {
    it('should have correct DEFAULT_AGENT_POLICY configuration', () => {
      expect(DEFAULT_AGENT_POLICY).toEqual({
        maxAttempts: 3,
        backoffType: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        retryableErrors: [],
        jitter: true
      });
    });

    it('should have correct AGGRESSIVE_POLICY configuration', () => {
      expect(AGGRESSIVE_POLICY).toEqual({
        maxAttempts: 5,
        backoffType: 'linear',
        baseDelayMs: 500,
        maxDelayMs: 30000,
        retryableErrors: expect.arrayContaining(['timeout', 'ETIMEDOUT', '503']),
        jitter: true
      });
    });

    it('should have correct CONSERVATIVE_POLICY configuration', () => {
      expect(CONSERVATIVE_POLICY).toEqual({
        maxAttempts: 2,
        backoffType: 'fixed',
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        retryableErrors: expect.arrayContaining(['ETIMEDOUT', 'ECONNRESET']),
        jitter: false
      });
    });

    it('should create custom policy with overrides', () => {
      const custom = createRetryPolicy({
        maxAttempts: 10,
        baseDelayMs: 500
      });

      expect(custom).toEqual({
        ...DEFAULT_AGENT_POLICY,
        maxAttempts: 10,
        baseDelayMs: 500
      });
    });
  });

  describe('Operation ID Generation', () => {
    it('should auto-generate operation ID when not provided', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const policy: RetryPolicy = {
        maxAttempts: 1,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await executor.executeWithRetry(mockFn, policy);

      // Should work without throwing
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should use provided operation ID', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Error');
        }
        return Promise.resolve('success');
      });

      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      const retryAttemptSpy = jest.fn();
      executor.on('retry_attempt', retryAttemptSpy);

      await executor.executeWithRetry(mockFn, policy, 'custom-id');

      expect(retryAttemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: 'custom-id'
        })
      );
    });
  });

  describe('getActiveRetries', () => {
    it('should return copy of active retries map', async () => {
      const mockFn = jest.fn().mockImplementation(async () => {
        // Get active retries while operation is in progress
        const activeRetries = executor.getActiveRetries();
        expect(activeRetries).toBeInstanceOf(Map);
        expect(activeRetries.size).toBeGreaterThan(0);

        throw new Error('Error');
      });

      const policy: RetryPolicy = {
        maxAttempts: 2,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      await expect(executor.executeWithRetry(mockFn, policy, 'active-test')).rejects.toThrow();
    });
  });

  describe('cancelRetry', () => {
    it('should successfully remove retry state from activeRetries map', async () => {
      // cancelRetry only removes state, doesn't stop execution
      const mockFn = jest.fn().mockRejectedValue(new Error('Error'));

      const policy: RetryPolicy = {
        maxAttempts: 2,
        backoffType: 'fixed',
        baseDelayMs: 50,
        maxDelayMs: 1000,
        retryableErrors: [],
        jitter: false
      };

      // Start execution which will fail
      const promise = executor.executeWithRetry(mockFn, policy, 'cancel-test').catch(() => {});

      // Wait a bit for state to be created
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cancel should remove the state
      const cancelled = executor.cancelRetry('cancel-test');
      expect(cancelled).toBe(true);

      // State should be removed
      expect(executor.getRetryState('cancel-test')).toBeUndefined();

      await promise;
    });
  });
});
