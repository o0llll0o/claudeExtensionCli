# Layered Retry Architecture - C4 Diagram

## Context Diagram (Level 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Autonomous Agent System                       │
│                                                                  │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │   User   │────────▶│Orchestr- │────────▶│  Claude  │        │
│  │          │         │  ator    │         │   CLI    │        │
│  └──────────┘         └──────────┘         └──────────┘        │
│                              │                                   │
│                              ▼                                   │
│                       ┌──────────┐                              │
│                       │  Retry   │                              │
│                       │  System  │                              │
│                       └──────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Container Diagram (Level 2)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Retry System Components                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           SubagentOrchestrator (Layer 3)                     │    │
│  │  - Manages plan execution                                    │    │
│  │  - Delegates to AgentRetryCoordinator                       │    │
│  │  - Emits events (chunk, step, retry_attempt)               │    │
│  └────────────────────┬─────────────────────────────────────────┘    │
│                       │                                               │
│                       ▼                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │         AgentRetryCoordinator (Layer 2)                      │    │
│  │  - Agent-specific retry logic                               │    │
│  │  - Error extraction and recovery                            │    │
│  │  - Policy creation per step type                            │    │
│  │  - Cross-process state management                           │    │
│  └────────────────────┬─────────────────────────────────────────┘    │
│                       │                                               │
│                       ▼                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              RetryExecutor (Layer 1)                         │    │
│  │  - Generic retry mechanism                                  │    │
│  │  - Backoff calculation (exponential, linear, fixed)         │    │
│  │  - Error matching and filtering                             │    │
│  │  - Retry state management                                   │    │
│  │  - Event emission (retry_attempt, retry_exhausted)          │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Diagram (Level 3)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Detailed Component Flow                              │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SubagentOrchestrator                              │    │
│  │                                                                       │    │
│  │  executePlan(plan: AgentPlan) {                                      │    │
│  │    for (step of plan.steps) {                                        │    │
│  │      response = retryCoordinator.executeAgentStepWithRetry(step)     │    │
│  │    }                                                                  │    │
│  │  }                                                                    │    │
│  │                                                                       │    │
│  │  executeStepAttempt(step, attempt, lastError) {                      │    │
│  │    coderPrompt = buildPromptWithError(step, lastError)               │    │
│  │    coder = runAgent(coderPrompt)                                     │    │
│  │    verifier = runAgent(verify(coder))                                │    │
│  │    if (!verifier.success) throw Error                                │    │
│  │    return coder                                                       │    │
│  │  }                                                                    │    │
│  └────────────────────────────┬──────────────────────────────────────────┘    │
│                               │                                               │
│                               ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                  AgentRetryCoordinator                               │    │
│  │                                                                       │    │
│  │  executeAgentStepWithRetry(step, executor) {                         │    │
│  │    lastError = undefined                                             │    │
│  │                                                                       │    │
│  │    return retryExecutor.executeWithRetry(                            │    │
│  │      async (attempt) => {                                            │    │
│  │        // Agent-specific recovery logic                              │    │
│  │        response = await executor(attempt, lastError)                 │    │
│  │                                                                       │    │
│  │        if (!response.success) {                                      │    │
│  │          lastError = extractActionableError(response)                │    │
│  │          throw new Error(lastError)                                  │    │
│  │        }                                                              │    │
│  │                                                                       │    │
│  │        return response                                               │    │
│  │      },                                                               │    │
│  │      createAgentPolicy(step)  // Domain-specific policy              │    │
│  │    )                                                                  │    │
│  │  }                                                                    │    │
│  │                                                                       │    │
│  │  createAgentPolicy(step) {                                           │    │
│  │    return {                                                           │    │
│  │      maxAttempts: getMaxRetries(step),  // 2-5 based on step type   │    │
│  │      backoffType: 'exponential',                                     │    │
│  │      retryableErrors: getRetryableErrors(step)                       │    │
│  │    }                                                                  │    │
│  │  }                                                                    │    │
│  │                                                                       │    │
│  │  extractActionableError(response) {                                  │    │
│  │    // Parse verifier output for specific instructions                │    │
│  │    // Example: "FAIL: Missing import for Express"                    │    │
│  │    return parseStructuredError(response)                             │    │
│  │  }                                                                    │    │
│  └────────────────────────────┬──────────────────────────────────────────┘    │
│                               │                                               │
│                               ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      RetryExecutor                                   │    │
│  │                                                                       │    │
│  │  executeWithRetry(fn, policy, operationId) {                         │    │
│  │    for (attempt = 1; attempt <= policy.maxAttempts; attempt++) {     │    │
│  │      // Setup state tracking                                         │    │
│  │      state = { attemptNumber: attempt, lastError, ... }              │    │
│  │      activeRetries.set(operationId, state)                           │    │
│  │                                                                       │    │
│  │      try {                                                            │    │
│  │        result = await fn(attempt)                                    │    │
│  │        emit('retry_success', { ... })                                │    │
│  │        return result                                                 │    │
│  │      } catch (error) {                                               │    │
│  │        if (attempt === maxAttempts) {                                │    │
│  │          emit('retry_exhausted', { ... })                            │    │
│  │          throw error                                                 │    │
│  │        }                                                              │    │
│  │                                                                       │    │
│  │        if (!shouldRetry(error, policy)) throw error                  │    │
│  │                                                                       │    │
│  │        delay = calculateDelay(attempt, policy)                       │    │
│  │        emit('retry_attempt', { attempt, delay, error })              │    │
│  │        await sleep(delay)                                            │    │
│  │      }                                                                │    │
│  │    }                                                                  │    │
│  │  }                                                                    │    │
│  │                                                                       │    │
│  │  calculateDelay(attempt, policy) {                                   │    │
│  │    switch (policy.backoffType) {                                     │    │
│  │      case 'exponential':                                             │    │
│  │        delay = baseDelayMs * Math.pow(2, attempt)                    │    │
│  │      case 'linear':                                                  │    │
│  │        delay = baseDelayMs * attempt                                 │    │
│  │      case 'fixed':                                                   │    │
│  │        delay = baseDelayMs                                           │    │
│  │    }                                                                  │    │
│  │                                                                       │    │
│  │    // Cap at maxDelayMs                                              │    │
│  │    delay = Math.min(delay, policy.maxDelayMs)                        │    │
│  │                                                                       │    │
│  │    // Apply jitter (±10% randomization)                              │    │
│  │    if (policy.jitter) {                                              │    │
│  │      delay += (Math.random() * 2 - 1) * delay * 0.1                 │    │
│  │    }                                                                  │    │
│  │                                                                       │    │
│  │    return delay                                                       │    │
│  │  }                                                                    │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Sequence Diagram

```
User          Orchestrator    Coordinator       Executor        Claude CLI
 │                 │               │               │                │
 │  executePlan    │               │               │                │
 │─────────────────▶               │               │                │
 │                 │               │               │                │
 │                 │  executeAgentStepWithRetry    │                │
 │                 │───────────────▶               │                │
 │                 │               │               │                │
 │                 │               │  executeWithRetry              │
 │                 │               │───────────────▶                │
 │                 │               │               │                │
 │                 │               │               │  Attempt 1     │
 │                 │               │               │  spawn()       │
 │                 │               │               │───────────────▶│
 │                 │               │               │                │
 │                 │               │               │  ❌ Error      │
 │                 │               │               │◀───────────────│
 │                 │               │               │                │
 │                 │               │  emit('retry_attempt')         │
 │                 │               │───────────────▶                │
 │                 │               │               │                │
 │                 │               │  calculateDelay()              │
 │                 │               │  sleep(2000ms)                 │
 │                 │               │               │                │
 │                 │               │  extractActionableError()      │
 │                 │               │◀──────────────│                │
 │                 │               │               │                │
 │                 │               │               │  Attempt 2     │
 │                 │               │               │  spawn() with  │
 │                 │               │               │  lastError     │
 │                 │               │               │───────────────▶│
 │                 │               │               │                │
 │                 │               │               │  ✅ Success    │
 │                 │               │               │◀───────────────│
 │                 │               │               │                │
 │                 │               │  emit('retry_success')         │
 │                 │               │───────────────▶                │
 │                 │               │               │                │
 │                 │               │  return result                 │
 │                 │               │◀──────────────│                │
 │                 │               │                                │
 │                 │  return response                               │
 │                 │◀──────────────│                                │
 │                 │                                                │
 │  emit('chunk')  │                                                │
 │◀────────────────│                                                │
```

## Data Flow: Cross-Process State Management

```
┌────────────────────────────────────────────────────────────────┐
│              Process Boundary State Propagation                 │
│                                                                 │
│  Orchestrator Process         │         Agent Process          │
│  ─────────────────────────────┼──────────────────────────────  │
│                                │                                │
│  ┌──────────────────┐          │                                │
│  │ Retry State      │          │                                │
│  │ ─────────────    │          │                                │
│  │ attempt: 2       │          │                                │
│  │ lastError: "..." │          │                                │
│  │ outputs: [...]   │          │                                │
│  └────────┬─────────┘          │                                │
│           │                    │                                │
│           ▼                    │                                │
│  ┌──────────────────┐          │                                │
│  │ Encode in Prompt │          │                                │
│  │ ─────────────    │          │                                │
│  │ {                │          │                                │
│  │   task: "...",   │          │                                │
│  │   retryContext: {│          │                                │
│  │     attempt: 2,  │          │                                │
│  │     lastError,   │          │                                │
│  │     hint: "..."  │          │                                │
│  │   }              │          │                                │
│  │ }                │          │                                │
│  └────────┬─────────┘          │                                │
│           │                    │                                │
│           │    spawn()         │                                │
│           │    with stdin      │                                │
│           └────────────────────┼───────▶ ┌───────────────┐     │
│                                │         │ Claude CLI    │     │
│                                │         │ ─────────     │     │
│                                │         │ Reads prompt  │     │
│                                │         │ from stdin    │     │
│                                │         │               │     │
│                                │         │ Sees retry    │     │
│                                │         │ context       │     │
│                                │         └───────┬───────┘     │
│                                │                 │             │
│                                │                 ▼             │
│                                │         ┌───────────────┐     │
│                                │         │ LLM with      │     │
│                                │         │ Context       │     │
│                                │         │ ─────────     │     │
│                                │         │ "On attempt 2"│     │
│                                │         │ "Last error   │     │
│                                │         │  was X"       │     │
│                                │         │ "Try Y"       │     │
│                                │         └───────┬───────┘     │
│                                │                 │             │
│           ┌────────────────────┼─────────────────┘             │
│           │    stdout          │                               │
│           ▼                    │                               │
│  ┌──────────────────┐          │                               │
│  │ Parse Response   │          │                               │
│  │ ─────────────    │          │                               │
│  │ success: true    │          │                               │
│  │ content: "..."   │          │                               │
│  └────────┬─────────┘          │                               │
│           │                    │                               │
│           ▼                    │                               │
│  ┌──────────────────┐          │                               │
│  │ Store Output     │          │                               │
│  │ ─────────────    │          │                               │
│  │ outputs[2] = ... │          │                               │
│  └──────────────────┘          │                               │
│                                │                               │
└────────────────────────────────────────────────────────────────┘
```

## Retry Policy Decision Tree

```
                         ┌─────────────────┐
                         │  Step Received  │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Determine Step  │
                         │     Type        │
                         └────────┬────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
       ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
       │  run_tests     │ │ install_deps │ │ create_file  │
       │  ─────────     │ │ ──────────── │ │ ───────────  │
       │  maxAttempts:5 │ │ maxAttempts:3│ │ maxAttempts:2│
       │  backoff: exp  │ │ backoff: lin │ │ backoff: fix │
       │  baseDelay: 1s │ │ baseDelay:500│ │ baseDelay: 2s│
       └────────┬───────┘ └──────┬───────┘ └──────┬───────┘
                │                 │                 │
                └─────────────────┼─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Create Policy  │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Add Retryable  │
                         │     Errors      │
                         └────────┬────────┘
                                  │
                  ┌───────────────┼───────────────┐
                  │               │               │
                  ▼               ▼               ▼
         ┌────────────────┐ ┌────────────┐ ┌────────────┐
         │  Tests         │ │   Deps     │ │   Files    │
         │  ─────         │ │   ────     │ │   ─────    │
         │ "test failed"  │ │ "ECONNRESET│ │ "EEXIST"   │
         │ "assertion"    │ │ "ETIMEDOUT"│ │ "EACCES"   │
         │ "expect"       │ │ "404"      │ │            │
         └────────────────┘ └────────────┘ └────────────┘
```

## Benefits of Layered Architecture

### Separation of Concerns
```
┌──────────────────────────────────────────────────┐
│ Layer 1: RetryExecutor                           │
│ ──────────────────────                           │
│ - Pure retry logic                               │
│ - No knowledge of agents                         │
│ - Reusable across entire system                  │
│ - Testable in isolation                          │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Layer 2: AgentRetryCoordinator                   │
│ ─────────────────────────────────                │
│ - Agent-specific extensions                      │
│ - Error extraction and recovery                  │
│ - Domain knowledge (step types)                  │
│ - Policy customization                           │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Layer 3: SubagentOrchestrator                    │
│ ────────────────────────────                     │
│ - Plan execution                                 │
│ - Agent lifecycle management                     │
│ - Event emission                                 │
│ - Focus on orchestration, not retry logic        │
└──────────────────────────────────────────────────┘
```

### Testability

```typescript
// Layer 1: Test retry logic in isolation
describe('RetryExecutor', () => {
  test('exponential backoff calculation', () => {
    const executor = new RetryExecutor();
    expect(executor.calculateDelay(1, policy)).toBe(2000);
    expect(executor.calculateDelay(2, policy)).toBe(4000);
    expect(executor.calculateDelay(3, policy)).toBe(8000);
  });
});

// Layer 2: Test agent-specific logic
describe('AgentRetryCoordinator', () => {
  test('extracts actionable errors from verifier', () => {
    const coordinator = new AgentRetryCoordinator(mockExecutor);
    const error = coordinator.extractActionableError(verifierResponse);
    expect(error).toContain('Missing import for Express');
  });
});

// Layer 3: Test orchestration flow
describe('SubagentOrchestrator', () => {
  test('executes plan with retry coordination', async () => {
    const orchestrator = new SubagentOrchestrator(workspace);
    const result = await orchestrator.executePlan(mockPlan);
    expect(result).toHaveLength(mockPlan.steps.length);
  });
});
```

### Extensibility

```typescript
// Easy to add new retry strategies
export class CircuitBreakerRetryExecutor extends RetryExecutor {
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';

  async executeWithRetry<T>(...) {
    if (this.circuitState === 'open') {
      throw new Error('Circuit breaker is open');
    }
    // Call parent with circuit breaker logic
  }
}

// Easy to add new agent types
export class SecurityAgentRetryCoordinator extends AgentRetryCoordinator {
  createAgentPolicy(step: PlanStep): RetryPolicy {
    const basePolicy = super.createAgentPolicy(step);

    // Security agents get more conservative retry
    if (step.action.includes('security')) {
      basePolicy.maxAttempts = 1; // No retry for security scans
    }

    return basePolicy;
  }
}
```

---

**Key Advantages**:
1. Single Responsibility Principle
2. Open/Closed Principle (extend without modifying)
3. Dependency Inversion Principle (depends on abstractions)
4. Easy to test each layer independently
5. Reusable components
6. Clear ownership and boundaries

**Trade-offs**:
- More files/classes to maintain
- Requires understanding of layer responsibilities
- Slightly more complex than monolithic approach

**Overall Assessment**: The benefits far outweigh the trade-offs for a production system.
