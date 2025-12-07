# Execution Playbook - Autonomous Agent Upgrade

## Quick Start Commands

### Phase 1: Foundation (3 Parallel Agents - 3-4 hours)

```bash
# Agent 1: Retry Strategy
npx claude-flow sparc run architect "Create RetryStrategy.ts with:
- Exponential backoff with configurable base delay and max delay
- Jitter algorithm to prevent thundering herd
- Circuit breaker with CLOSED, OPEN, HALF_OPEN states
- Retry budget tracking to prevent infinite loops
- Type-safe configuration interface"

# Agent 2: Tool Event Handler
npx claude-flow sparc run architect "Create ToolEventHandler.ts with:
- Event lifecycle: STARTED, IN_PROGRESS, SUCCESS, FAILED, CANCELLED
- Error categorization: TRANSIENT, PERMANENT, TIMEOUT, CANCELLED
- Event aggregation for analytics and monitoring
- Generic event handler registration system
- Type-safe event payload interfaces"

# Agent 3: Agent Debate Coordinator
npx claude-flow sparc run architect "Create AgentDebateCoordinator.ts with:
- Multi-agent voting mechanism (majority, weighted, unanimous)
- Consensus building algorithms
- Conflict resolution strategies (weighted average, expert override)
- Debate history tracking for learning
- Performance-optimized for 3-10 agents"
```

### Phase 2: Integration (3 Parallel Agents - 3-4 hours)

```bash
# Agent 1: Orchestrator Integration (CRITICAL - Most Complex)
npx claude-flow sparc run refinement "Modify SubagentOrchestrator.ts:
1. Import RetryStrategy, ToolEventHandler, AgentDebateCoordinator
2. Add retryStrategy instance to class
3. Wrap runAgent() calls with retry logic
4. Emit tool events at key lifecycle points (start, progress, complete, error)
5. Add debate coordination to executePlan() for step verification
6. Maintain backward compatibility with existing code
7. Add comprehensive error handling"

# Agent 2: Retry UI Component
npx claude-flow sparc run coder "Create RetryIndicator.tsx:
- Display current retry count and max retries
- Visual progress bar for retry delay (exponential backoff)
- Circuit breaker state indicator (green/yellow/red)
- Retry history log (collapsible)
- Accessibility: ARIA labels, keyboard navigation"

# Agent 3: Tool Feedback UI Component
npx claude-flow sparc run coder "Create ToolExecutionFeedback.tsx:
- Real-time tool execution status display
- Error categorization badges (transient/permanent/timeout)
- Execution timeline visualization
- Performance metrics (duration, success rate)
- Collapsible execution history with filtering"
```

### Phase 3: Provider & UI (2 Sequential Agents - 4-6 hours)

```bash
# Agent 1: Provider Integration (MUST COMPLETE FIRST)
npx claude-flow sparc run refinement "Modify ChatViewProvider.ts:
1. Listen to orchestrator 'retry_attempt' events
2. Listen to orchestrator 'tool_execution' events
3. Listen to orchestrator 'debate_update' events
4. Forward all events to webview with postMessage()
5. Add message handlers for UI interactions:
   - retry_cancel (user cancels retry)
   - tool_details_request (user clicks for details)
6. Update handleMessage() switch statement
7. Ensure proper event cleanup to prevent memory leaks"

# Agent 2: UI Integration (AFTER Agent 1 completes)
npx claude-flow sparc run coder "Modify App.tsx:
1. Import RetryIndicator and ToolExecutionFeedback components
2. Add state for retry status and tool execution status
3. Add message handlers for:
   - retry_update → update retry state
   - tool_execution → update tool state
   - debate_update → update debate state
4. Integrate RetryIndicator into chat UI (show during agent execution)
5. Integrate ToolExecutionFeedback into message stream
6. Add loading states and error boundaries
7. Test message flow end-to-end"
```

### Phase 4: Testing (6 Parallel Agents - 2-3 hours)

```bash
# Parallel test creation
npx claude-flow sparc concurrent tester "tests-manifest.txt"

# tests-manifest.txt contents:
# tests/unit/RetryStrategy.test.ts
# tests/unit/ToolEventHandler.test.ts
# tests/unit/AgentDebateCoordinator.test.ts
# tests/integration/SubagentOrchestrator.test.ts
# tests/integration/ChatViewProvider.test.ts
# tests/e2e/retry-workflow.test.ts
```

---

## Detailed Task Specifications

### T1: RetryStrategy.ts Implementation

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\orchestration\RetryStrategy.ts`

**Interface**:
```typescript
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;      // milliseconds
    maxDelay: number;       // milliseconds
    jitterFactor: number;   // 0-1
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class RetryStrategy {
    constructor(config: RetryConfig);

    async execute<T>(
        fn: () => Promise<T>,
        context: string
    ): Promise<T>;

    getCircuitState(): CircuitState;
    getRemainingRetries(): number;
    reset(): void;
}
```

**Test Cases**:
- Exponential backoff delays increase correctly
- Jitter adds randomness within bounds
- Circuit breaker opens after threshold failures
- Circuit breaker auto-recovers after timeout
- Retry budget prevents infinite loops

---

### T2: ToolEventHandler.ts Implementation

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\orchestration\ToolEventHandler.ts`

**Interface**:
```typescript
export enum ToolEventType {
    STARTED = 'started',
    IN_PROGRESS = 'in_progress',
    SUCCESS = 'success',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

export enum ErrorCategory {
    TRANSIENT = 'transient',
    PERMANENT = 'permanent',
    TIMEOUT = 'timeout',
    CANCELLED = 'cancelled'
}

export interface ToolEvent {
    type: ToolEventType;
    taskId: string;
    toolName: string;
    timestamp: number;
    duration?: number;
    error?: {
        category: ErrorCategory;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, any>;
}

export class ToolEventHandler extends EventEmitter {
    emit(event: ToolEvent): void;
    on(type: ToolEventType, handler: (event: ToolEvent) => void): void;
    getHistory(taskId: string): ToolEvent[];
    getMetrics(): ToolMetrics;
}
```

**Integration Points**:
- SubagentOrchestrator.runAgent() emits STARTED before execution
- SubagentOrchestrator.runAgent() emits IN_PROGRESS during streaming
- SubagentOrchestrator.runAgent() emits SUCCESS/FAILED on completion

---

### T3: AgentDebateCoordinator.ts Implementation

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\orchestration\AgentDebateCoordinator.ts`

**Interface**:
```typescript
export interface DebateVote {
    agentId: string;
    decision: 'approve' | 'reject' | 'abstain';
    confidence: number;  // 0-1
    reasoning: string;
}

export enum ConsensusAlgorithm {
    MAJORITY = 'majority',
    WEIGHTED = 'weighted',
    UNANIMOUS = 'unanimous'
}

export class AgentDebateCoordinator {
    constructor(algorithm: ConsensusAlgorithm);

    async conductDebate(
        topic: string,
        agents: string[],
        context: any
    ): Promise<DebateResult>;

    private async getVote(agentId: string, topic: string): Promise<DebateVote>;
    private calculateConsensus(votes: DebateVote[]): DebateResult;
}

export interface DebateResult {
    decision: 'approved' | 'rejected';
    confidence: number;
    votes: DebateVote[];
    duration: number;
}
```

**Use Case**:
- executePlan() uses debate for step verification
- Multiple verifier agents vote on code quality
- Consensus determines if step passes/fails

---

### T4: SubagentOrchestrator.ts Modifications

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\orchestration\SubagentOrchestrator.ts`

**Changes**:

1. **Add Retry Logic to runAgent()**:
```typescript
async runAgent(request: AgentRequest): Promise<AgentResponse> {
    return this.retryStrategy.execute(async () => {
        this.toolEventHandler.emit({
            type: ToolEventType.STARTED,
            taskId: request.taskId,
            toolName: 'claude-cli',
            timestamp: Date.now()
        });

        // ... existing runAgent logic ...

        this.toolEventHandler.emit({
            type: response.success ? ToolEventType.SUCCESS : ToolEventType.FAILED,
            taskId: request.taskId,
            toolName: 'claude-cli',
            timestamp: Date.now(),
            duration: Date.now() - startTime
        });

        return response;
    }, `runAgent-${request.role}-${request.taskId}`);
}
```

2. **Add Debate to executePlan()**:
```typescript
async executePlan(plan: AgentPlan, worktreePath: string): Promise<AgentResponse[]> {
    for (const step of plan.steps) {
        // ... existing coder logic ...

        if (coderResponse.success) {
            // Multi-agent debate for verification
            const debateResult = await this.debateCoordinator.conductDebate(
                `Verify step ${step.id}: ${step.action}`,
                ['verifier-1', 'verifier-2', 'verifier-3'],
                { code: coderResponse.content, step }
            );

            this.emit('debate', { taskId: plan.taskId, step, debateResult });

            step.status = debateResult.decision === 'approved' ? 'completed' : 'failed';
        }
    }
}
```

**Backward Compatibility**:
- All new features behind optional flags
- Existing tests must pass unchanged
- Graceful degradation if components unavailable

---

### T5: RetryIndicator.tsx Implementation

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\webview\components\RetryIndicator.tsx`

**Component**:
```tsx
interface RetryIndicatorProps {
    currentRetry: number;
    maxRetries: number;
    delayMs: number;
    circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    onCancel?: () => void;
}

export const RetryIndicator: React.FC<RetryIndicatorProps> = ({
    currentRetry,
    maxRetries,
    delayMs,
    circuitState,
    onCancel
}) => {
    return (
        <div className="retry-indicator">
            <div className="retry-header">
                <span>Retry {currentRetry}/{maxRetries}</span>
                <span className={`circuit-${circuitState.toLowerCase()}`}>
                    {circuitState}
                </span>
            </div>
            <ProgressBar delay={delayMs} />
            {onCancel && <button onClick={onCancel}>Cancel</button>}
        </div>
    );
};
```

**Styling**: Verdent dark theme, accessibility-first

---

### T6: ToolExecutionFeedback.tsx Implementation

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\webview\components\ToolExecutionFeedback.tsx`

**Component**:
```tsx
interface ToolExecutionFeedbackProps {
    events: ToolEvent[];
    expanded?: boolean;
    onExpand?: () => void;
}

export const ToolExecutionFeedback: React.FC<ToolExecutionFeedbackProps> = ({
    events,
    expanded,
    onExpand
}) => {
    const latestEvent = events[events.length - 1];

    return (
        <div className="tool-execution-feedback">
            <div className="tool-status">
                <StatusIcon type={latestEvent.type} />
                <span>{latestEvent.toolName}</span>
                <span className="duration">{latestEvent.duration}ms</span>
            </div>
            {expanded && (
                <div className="tool-history">
                    {events.map(event => (
                        <EventRow key={event.timestamp} event={event} />
                    ))}
                </div>
            )}
        </div>
    );
};
```

---

### T7: ChatViewProvider.ts Modifications

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\providers\ChatViewProvider.ts`

**Event Listeners**:
```typescript
// In resolveWebviewView(), after existing orchestrator listeners:

this.orchestrator.on('retry', (data: { taskId: string; attempt: number; delay: number }) => {
    this.postMessage({
        type: 'retry_update',
        taskId: data.taskId,
        attempt: data.attempt,
        delay: data.delay
    });
});

this.orchestrator.on('tool_event', (event: ToolEvent) => {
    this.postMessage({
        type: 'tool_execution',
        event
    });
});

this.orchestrator.on('debate', (data: { taskId: string; debateResult: DebateResult }) => {
    this.postMessage({
        type: 'debate_update',
        taskId: data.taskId,
        result: data.debateResult
    });
});
```

**Message Handlers**:
```typescript
// In handleMessage():
case 'retry_cancel':
    this.orchestrator.cancelRetry(message.taskId);
    break;
case 'tool_details':
    const history = this.orchestrator.getToolHistory(message.taskId);
    this.postMessage({ type: 'tool_history', history });
    break;
```

---

### T8: App.tsx Modifications

**File**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\src\webview\App.tsx`

**State Additions**:
```tsx
const [retryState, setRetryState] = useState<RetryState | null>(null);
const [toolEvents, setToolEvents] = useState<Map<string, ToolEvent[]>>(new Map());
const [debateResults, setDebateResults] = useState<Map<string, DebateResult>>(new Map());
```

**Message Handlers**:
```tsx
useEffect(() => {
    const handler = (event: MessageEvent) => {
        switch (event.data.type) {
            case 'retry_update':
                setRetryState({
                    taskId: event.data.taskId,
                    attempt: event.data.attempt,
                    delay: event.data.delay
                });
                break;
            case 'tool_execution':
                setToolEvents(prev => {
                    const events = prev.get(event.data.taskId) || [];
                    return new Map(prev).set(event.data.taskId, [...events, event.data.event]);
                });
                break;
            case 'debate_update':
                setDebateResults(prev =>
                    new Map(prev).set(event.data.taskId, event.data.result)
                );
                break;
        }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}, []);
```

**UI Integration**:
```tsx
return (
    <div className="app">
        {retryState && (
            <RetryIndicator
                currentRetry={retryState.attempt}
                maxRetries={5}
                delayMs={retryState.delay}
                circuitState="CLOSED"
                onCancel={() => vscode.postMessage({ type: 'retry_cancel', taskId: retryState.taskId })}
            />
        )}

        <ChatMessages messages={messages}>
            {messages.map(msg => (
                <div key={msg.id}>
                    {msg.content}
                    {toolEvents.get(msg.taskId) && (
                        <ToolExecutionFeedback events={toolEvents.get(msg.taskId)!} />
                    )}
                </div>
            ))}
        </ChatMessages>
    </div>
);
```

---

## Testing Strategy

### Unit Tests (T9, T10, T11)

**RetryStrategy.test.ts**:
```typescript
describe('RetryStrategy', () => {
    it('should exponentially increase delay', async () => {
        const strategy = new RetryStrategy({ baseDelay: 100, maxRetries: 3 });
        const delays = [];

        await strategy.execute(() => {
            delays.push(Date.now());
            throw new Error('test');
        }, 'test');

        expect(delays[1] - delays[0]).toBeGreaterThanOrEqual(100);
        expect(delays[2] - delays[1]).toBeGreaterThanOrEqual(200);
    });

    it('should open circuit after threshold', async () => {
        // ... test circuit breaker ...
    });
});
```

### Integration Tests (T12, T13)

**SubagentOrchestrator.test.ts**:
```typescript
describe('SubagentOrchestrator with retry', () => {
    it('should retry failed agent calls', async () => {
        const orchestrator = new SubagentOrchestrator('/workspace');
        let attempts = 0;

        // Mock runAgent to fail twice then succeed
        orchestrator.runAgent = jest.fn(async () => {
            attempts++;
            if (attempts < 3) throw new Error('fail');
            return { success: true, content: 'success' };
        });

        const result = await orchestrator.runAgent({ taskId: 'test', role: 'coder', prompt: 'test' });

        expect(attempts).toBe(3);
        expect(result.success).toBe(true);
    });
});
```

### E2E Tests (T14)

**retry-workflow.test.ts**:
```typescript
describe('E2E Retry Workflow', () => {
    it('should show retry indicator in UI when agent retries', async () => {
        // Start agent task that will fail
        await page.click('[data-testid="send-button"]');

        // Wait for retry indicator to appear
        await page.waitForSelector('[data-testid="retry-indicator"]');

        // Verify retry count increments
        const retryText = await page.textContent('[data-testid="retry-count"]');
        expect(retryText).toContain('Retry 1/5');

        // Wait for eventual success
        await page.waitForSelector('[data-testid="success-message"]');
    });
});
```

---

## Validation Checklist

### Before Merging Each Phase:

**Phase 1 (Foundation)**:
- [ ] RetryStrategy.ts exports all interfaces
- [ ] ToolEventHandler.ts extends EventEmitter correctly
- [ ] AgentDebateCoordinator.ts has working consensus logic
- [ ] All unit tests pass with >80% coverage
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with no warnings

**Phase 2 (Integration)**:
- [ ] SubagentOrchestrator imports all foundations without errors
- [ ] UI components render without React errors
- [ ] Integration tests pass
- [ ] No regression in existing tests
- [ ] Build succeeds (npm run build)

**Phase 3 (Provider & UI)**:
- [ ] ChatViewProvider forwards all events correctly
- [ ] App.tsx renders all new components
- [ ] Message flow works end-to-end (manual testing)
- [ ] No console errors in webview
- [ ] Visual regression tests pass

**Phase 4 (Testing)**:
- [ ] All tests pass (npm run test)
- [ ] Coverage >70% overall
- [ ] E2E test completes successfully
- [ ] Performance benchmarks <5% overhead
- [ ] Manual testing in real VSCode extension

---

## Rollback Plan

If integration fails at any phase:

1. **Revert to last working commit**:
```bash
git reset --hard HEAD~1
```

2. **Feature flag the broken component**:
```typescript
const ENABLE_RETRY = process.env.ENABLE_RETRY === 'true';

if (ENABLE_RETRY) {
    // new retry logic
} else {
    // old logic
}
```

3. **Debug in isolation**:
- Extract failing component to separate test file
- Use debugger to step through
- Check event emission/subscription

4. **Incremental re-integration**:
- Merge one component at a time
- Test after each merge
- Identify exact breaking point

---

**END OF PLAYBOOK**
