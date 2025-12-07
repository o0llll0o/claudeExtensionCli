# RetryStrategy API Documentation

## Overview

The RetryStrategy module provides a flexible retry mechanism for handling transient failures in asynchronous operations. It supports multiple backoff strategies (exponential, linear, fixed), configurable error filtering, and comprehensive event emission for monitoring retry behavior.

**Module**: `src/orchestration/RetryStrategy.ts`

**Key Features**:
- Multiple backoff strategies (exponential, linear, fixed)
- Configurable retry policies with error filtering
- Jitter support to prevent thundering herd problems
- Event-based monitoring of retry lifecycle
- Pre-configured policies for common use cases

---

## Types

### BackoffType

```typescript
type BackoffType = 'exponential' | 'linear' | 'fixed';
```

Defines the type of delay calculation between retry attempts:
- **exponential**: Delay doubles with each attempt (delay = baseDelayMs * 2^attempt)
- **linear**: Delay increases linearly (delay = baseDelayMs * attempt)
- **fixed**: Constant delay between attempts (delay = baseDelayMs)

---

## Interfaces

### RetryPolicy

Configuration object that defines how retries should be executed.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| maxAttempts | number | Yes | 3 | Maximum number of retry attempts before giving up |
| backoffType | BackoffType | Yes | 'exponential' | Type of backoff strategy to use |
| baseDelayMs | number | Yes | 1000 | Base delay in milliseconds for backoff calculation |
| maxDelayMs | number | Yes | 30000 | Maximum delay cap in milliseconds (30 seconds) |
| retryableErrors | string[] | Yes | [] | Array of error patterns that trigger retries (regex supported). Empty array retries all errors |
| jitter | boolean | Yes | true | Whether to add ±10% random jitter to prevent thundering herd |
| onRetry | function | No | - | Optional callback invoked on each retry attempt |

**onRetry Callback Signature**:
```typescript
(attempt: number, error: Error, nextDelayMs: number) => void
```

**Example**:
```typescript
const policy: RetryPolicy = {
  maxAttempts: 5,
  backoffType: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', '503'],
  jitter: true,
  onRetry: (attempt, error, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms due to: ${error.message}`);
  }
};
```

---

### RetryState

Represents the current state of an active retry operation.

| Property | Type | Description |
|----------|------|-------------|
| attemptNumber | number | Current attempt number (1-indexed) |
| lastError | Error \| null | The last error encountered during execution |
| nextRetryAt | string \| null | ISO 8601 timestamp when next retry will occur |
| strategy | RetryPolicy | The retry policy being applied |
| totalBackoffMs | number | Total time spent waiting between retries in milliseconds |

**Example**:
```typescript
{
  attemptNumber: 2,
  lastError: Error('Connection timeout'),
  nextRetryAt: '2025-12-07T15:30:45.123Z',
  strategy: DEFAULT_AGENT_POLICY,
  totalBackoffMs: 3000
}
```

---

## Classes

### RetryExecutor

Executes operations with configurable retry logic. Extends EventEmitter for monitoring retry lifecycle.

**Constructor**:
```typescript
constructor()
```

No configuration needed at initialization. Policies are provided per execution.

---

## Methods

### executeWithRetry<T>

Executes an async function with retry logic based on the provided policy.

**Signature**:
```typescript
async executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  operationId?: string
): Promise<T>
```

**Parameters**:
- **fn**: () => Promise<T> - The async function to execute with retries
- **policy**: RetryPolicy - The retry policy to apply
- **operationId**: string (optional) - Unique identifier for tracking this operation

**Returns**: Promise<T> - The result of the successful execution

**Throws**: Error - The last error encountered if all retry attempts are exhausted

**Example**:
```typescript
const executor = new RetryExecutor();

// Execute with default policy
const result = await executor.executeWithRetry(
  async () => {
    const response = await fetch('https://api.example.com/data');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  DEFAULT_AGENT_POLICY,
  'fetch-api-data'
);

// Execute with custom policy
const aggressiveResult = await executor.executeWithRetry(
  async () => await performCriticalOperation(),
  AGGRESSIVE_POLICY
);
```

---

### calculateDelay

Calculates the delay for the next retry attempt based on the policy.

**Signature**:
```typescript
calculateDelay(attempt: number, policy: RetryPolicy): number
```

**Parameters**:
- **attempt**: number - The current attempt number (1-indexed)
- **policy**: RetryPolicy - The retry policy containing backoff configuration

**Returns**: number - The delay in milliseconds (rounded)

**Backoff Formulas**:
- **Exponential**: `min(baseDelayMs * 2^attempt, maxDelayMs)`
- **Linear**: `min(baseDelayMs * attempt, maxDelayMs)`
- **Fixed**: `min(baseDelayMs, maxDelayMs)`

**Jitter Applied**: If enabled, adds random ±10% variation

**Example**:
```typescript
const executor = new RetryExecutor();
const policy = AGGRESSIVE_POLICY;

const delay1 = executor.calculateDelay(1, policy); // 500ms
const delay2 = executor.calculateDelay(2, policy); // 1000ms
const delay3 = executor.calculateDelay(3, policy); // 1500ms
```

---

### shouldRetry

Determines if an error should trigger a retry based on the policy's retryable error patterns.

**Signature**:
```typescript
shouldRetry(errorMessage: string, policy: RetryPolicy): boolean
```

**Parameters**:
- **errorMessage**: string - The error message to check
- **policy**: RetryPolicy - The retry policy containing retryable error patterns

**Returns**: boolean - True if the error should be retried

**Behavior**:
- If `policy.retryableErrors` is empty, all errors are retryable
- Patterns are tested as case-insensitive regex
- Falls back to substring matching if regex is invalid

**Example**:
```typescript
const executor = new RetryExecutor();
const policy = AGGRESSIVE_POLICY;

executor.shouldRetry('Connection ETIMEDOUT', policy); // true
executor.shouldRetry('Rate limit exceeded (429)', policy); // true
executor.shouldRetry('Invalid API key', policy); // false
```

---

### getRetryState

Gets the current state of an active retry operation.

**Signature**:
```typescript
getRetryState(operationId: string): RetryState | undefined
```

**Parameters**:
- **operationId**: string - The unique identifier provided to executeWithRetry

**Returns**: RetryState | undefined - The current state, or undefined if operation not found

**Example**:
```typescript
const state = executor.getRetryState('fetch-api-data');
if (state) {
  console.log(`Attempt ${state.attemptNumber}/${state.strategy.maxAttempts}`);
  console.log(`Next retry at: ${state.nextRetryAt}`);
}
```

---

### getActiveRetries

Gets all currently active retry operations.

**Signature**:
```typescript
getActiveRetries(): Map<string, RetryState>
```

**Returns**: Map<string, RetryState> - A new Map containing all active retry states (defensive copy)

**Example**:
```typescript
const active = executor.getActiveRetries();
active.forEach((state, opId) => {
  console.log(`${opId}: Attempt ${state.attemptNumber}`);
});
```

---

### cancelRetry

Cancels an active retry operation by removing it from tracking.

**Signature**:
```typescript
cancelRetry(operationId: string): boolean
```

**Parameters**:
- **operationId**: string - The unique identifier of the operation to cancel

**Returns**: boolean - True if the operation was found and cancelled, false otherwise

**Note**: This only removes tracking; it does not abort in-flight operations.

**Example**:
```typescript
const cancelled = executor.cancelRetry('long-running-task');
if (cancelled) {
  console.log('Operation cancelled successfully');
}
```

---

## Events

The RetryExecutor class emits the following events:

### retry_attempt

Emitted when a retry is about to occur (after waiting for the backoff delay).

**Payload**:
```typescript
{
  operationId: string;      // Unique operation identifier
  attempt: number;          // Current attempt number
  maxAttempts: number;      // Maximum attempts configured
  error: string;            // Error message that triggered retry
  nextDelayMs: number;      // Delay before this retry (ms)
  nextRetryAt: string;      // ISO 8601 timestamp of retry
}
```

**Example**:
```typescript
executor.on('retry_attempt', (payload) => {
  console.log(`[${payload.operationId}] Retry ${payload.attempt}/${payload.maxAttempts}`);
  console.log(`Error: ${payload.error}`);
  console.log(`Waiting ${payload.nextDelayMs}ms until ${payload.nextRetryAt}`);
});
```

---

### retry_success

Emitted when an operation succeeds after one or more retries.

**Payload**:
```typescript
{
  operationId: string;      // Unique operation identifier
  attempts: number;         // Total number of attempts (including final success)
  totalBackoffMs: number;   // Total time spent in backoff delays
}
```

**Example**:
```typescript
executor.on('retry_success', (payload) => {
  console.log(`[${payload.operationId}] Succeeded after ${payload.attempts} attempts`);
  console.log(`Total backoff time: ${payload.totalBackoffMs}ms`);
});
```

---

### retry_exhausted

Emitted when all retry attempts are exhausted and the operation fails.

**Payload**:
```typescript
{
  operationId: string;      // Unique operation identifier
  attempts: number;         // Total number of attempts made
  lastError: string;        // Final error message
  totalBackoffMs: number;   // Total time spent in backoff delays
}
```

**Example**:
```typescript
executor.on('retry_exhausted', (payload) => {
  console.error(`[${payload.operationId}] Failed after ${payload.attempts} attempts`);
  console.error(`Last error: ${payload.lastError}`);
  console.error(`Total backoff: ${payload.totalBackoffMs}ms`);
});
```

---

## Pre-configured Policies

### DEFAULT_AGENT_POLICY

Standard retry policy for agent operations with exponential backoff.

```typescript
const DEFAULT_AGENT_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffType: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [],
  jitter: true
};
```

**Use Case**: General-purpose retry for most agent operations

**Backoff Sequence** (with jitter disabled for illustration):
- Attempt 1: Immediate
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay

---

### AGGRESSIVE_POLICY

Aggressive retry policy for critical operations with linear backoff.

```typescript
const AGGRESSIVE_POLICY: RetryPolicy = {
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
```

**Use Case**: Critical operations that must succeed, only retries transient errors

**Backoff Sequence** (with jitter disabled):
- Attempt 1: Immediate
- Attempt 2: 500ms delay
- Attempt 3: 1000ms delay
- Attempt 4: 1500ms delay
- Attempt 5: 2000ms delay

---

### CONSERVATIVE_POLICY

Conservative retry policy for non-critical operations with fixed backoff.

```typescript
const CONSERVATIVE_POLICY: RetryPolicy = {
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
```

**Use Case**: Non-critical operations where fast failure is preferred

**Backoff Sequence**:
- Attempt 1: Immediate
- Attempt 2: 2 seconds delay

---

## Utility Functions

### createRetryPolicy

Creates a custom retry policy by merging overrides with DEFAULT_AGENT_POLICY.

**Signature**:
```typescript
function createRetryPolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy
```

**Parameters**:
- **overrides**: Partial<RetryPolicy> - Properties to override in the default policy

**Returns**: RetryPolicy - A complete retry policy object

**Example**:
```typescript
// Create policy with more attempts but same backoff
const customPolicy = createRetryPolicy({
  maxAttempts: 5,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
});

// Create policy with faster initial retry
const fastPolicy = createRetryPolicy({
  baseDelayMs: 500
});
```

---

## Complete Usage Examples

### Basic Retry with Monitoring

```typescript
import { RetryExecutor, DEFAULT_AGENT_POLICY } from './RetryStrategy';

const executor = new RetryExecutor();

// Set up event listeners
executor.on('retry_attempt', ({ attempt, maxAttempts, error }) => {
  console.log(`Retry ${attempt}/${maxAttempts}: ${error}`);
});

executor.on('retry_success', ({ attempts, totalBackoffMs }) => {
  console.log(`Success after ${attempts} attempts (${totalBackoffMs}ms total)`);
});

executor.on('retry_exhausted', ({ lastError }) => {
  console.error(`Failed: ${lastError}`);
});

// Execute with retries
try {
  const result = await executor.executeWithRetry(
    async () => {
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    DEFAULT_AGENT_POLICY,
    'api-fetch'
  );
  console.log('Data:', result);
} catch (error) {
  console.error('Final failure:', error);
}
```

---

### Custom Policy with Specific Error Handling

```typescript
import { RetryExecutor, createRetryPolicy } from './RetryStrategy';

const executor = new RetryExecutor();

// Custom policy for database operations
const dbPolicy = createRetryPolicy({
  maxAttempts: 5,
  backoffType: 'exponential',
  baseDelayMs: 500,
  retryableErrors: [
    'ECONNREFUSED',
    'lock timeout',
    'deadlock',
    'connection pool exhausted'
  ],
  onRetry: (attempt, error, delay) => {
    logger.warn(`DB retry ${attempt}: ${error.message} (waiting ${delay}ms)`);
  }
});

// Execute database query with retries
const users = await executor.executeWithRetry(
  async () => await db.query('SELECT * FROM users WHERE active = true'),
  dbPolicy,
  'fetch-active-users'
);
```

---

### Monitoring Active Retries

```typescript
import { RetryExecutor, AGGRESSIVE_POLICY } from './RetryStrategy';

const executor = new RetryExecutor();

// Start several retry operations
const operations = [
  executor.executeWithRetry(() => fetchData('endpoint1'), AGGRESSIVE_POLICY, 'op1'),
  executor.executeWithRetry(() => fetchData('endpoint2'), AGGRESSIVE_POLICY, 'op2'),
  executor.executeWithRetry(() => fetchData('endpoint3'), AGGRESSIVE_POLICY, 'op3')
];

// Monitor progress
const interval = setInterval(() => {
  const active = executor.getActiveRetries();
  console.log(`Active retries: ${active.size}`);

  active.forEach((state, opId) => {
    console.log(`  ${opId}: Attempt ${state.attemptNumber}/${state.strategy.maxAttempts}`);
    if (state.nextRetryAt) {
      console.log(`    Next retry: ${state.nextRetryAt}`);
    }
  });

  if (active.size === 0) {
    clearInterval(interval);
  }
}, 1000);

await Promise.allSettled(operations);
```

---

### Cancelling Long-Running Retries

```typescript
import { RetryExecutor, createRetryPolicy } from './RetryStrategy';

const executor = new RetryExecutor();

const slowPolicy = createRetryPolicy({
  maxAttempts: 10,
  baseDelayMs: 5000
});

// Start a long-running operation
const operationId = 'slow-operation';
const promise = executor.executeWithRetry(
  async () => await slowApiCall(),
  slowPolicy,
  operationId
);

// Cancel after 30 seconds
setTimeout(() => {
  const cancelled = executor.cancelRetry(operationId);
  if (cancelled) {
    console.log('Operation cancelled due to timeout');
  }
}, 30000);

try {
  await promise;
} catch (error) {
  console.error('Operation failed or was cancelled:', error);
}
```

---

## Best Practices

1. **Choose the Right Policy**:
   - Use `DEFAULT_AGENT_POLICY` for general operations
   - Use `AGGRESSIVE_POLICY` for critical operations with transient failures
   - Use `CONSERVATIVE_POLICY` for non-critical operations
   - Use `createRetryPolicy()` for custom requirements

2. **Always Specify Operation IDs**:
   - Provides better tracking and debugging
   - Enables operation cancellation
   - Improves log correlation

3. **Listen to Events**:
   - Monitor `retry_attempt` for operational visibility
   - Track `retry_exhausted` for alerting
   - Use `retry_success` for metrics

4. **Configure Retryable Errors Carefully**:
   - Be specific about which errors should trigger retries
   - Avoid retrying non-transient errors (auth failures, validation errors)
   - Use regex patterns for flexible matching

5. **Enable Jitter in Production**:
   - Prevents thundering herd problems
   - Distributes retry load
   - Only disable for testing/debugging

6. **Set Reasonable Timeouts**:
   - Balance between persistence and responsiveness
   - Consider downstream service SLAs
   - Account for total backoff time in your timeout calculations

---

## Error Handling

The RetryExecutor throws the final error if all retries are exhausted. Always wrap executeWithRetry in try-catch:

```typescript
try {
  const result = await executor.executeWithRetry(fn, policy);
  // Handle success
} catch (error) {
  // Handle final failure after all retries exhausted
  if (error.message.includes('ETIMEDOUT')) {
    // Handle timeout specifically
  } else {
    // Handle other errors
  }
}
```

---

## Performance Considerations

1. **Memory Usage**: Each active retry operation stores a RetryState object. Monitor with `getActiveRetries()`.

2. **Total Execution Time**: Calculate worst-case scenario:
   ```typescript
   // Example: Exponential backoff
   // maxAttempts=3, baseDelayMs=1000
   // Total time = 2s + 4s = 6s + actual execution time per attempt
   ```

3. **Concurrent Retries**: The executor can handle multiple concurrent retry operations efficiently.

4. **Event Listener Cleanup**: Remove event listeners when no longer needed to prevent memory leaks:
   ```typescript
   executor.removeAllListeners();
   ```

---

## TypeScript Types Export

```typescript
export type BackoffType = 'exponential' | 'linear' | 'fixed';
export interface RetryPolicy { /* ... */ }
export interface RetryState { /* ... */ }
export class RetryExecutor extends EventEmitter { /* ... */ }
export const DEFAULT_AGENT_POLICY: RetryPolicy;
export const AGGRESSIVE_POLICY: RetryPolicy;
export const CONSERVATIVE_POLICY: RetryPolicy;
export function createRetryPolicy(overrides?: Partial<RetryPolicy>): RetryPolicy;
export default RetryExecutor;
```
