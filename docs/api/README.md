# Orchestration API Documentation

Complete API documentation for the autonomous agent orchestration components.

## Components

### [RetryStrategy](./RetryStrategy.md)

Flexible retry mechanism for handling transient failures in asynchronous operations.

**Key Features**:
- Multiple backoff strategies (exponential, linear, fixed)
- Configurable error filtering with regex support
- Jitter support to prevent thundering herd
- Event-based monitoring
- Pre-configured policies for common use cases

**Use Cases**:
- API calls with network failures
- Database operations with connection issues
- Distributed system operations
- Any transient failure scenarios

**Quick Start**:
```typescript
import { RetryExecutor, DEFAULT_AGENT_POLICY } from './RetryStrategy';

const executor = new RetryExecutor();
const result = await executor.executeWithRetry(
  async () => await fetchData(),
  DEFAULT_AGENT_POLICY,
  'fetch-operation'
);
```

---

### [ToolEventHandler](./ToolEventHandler.md)

Comprehensive tracking and monitoring of tool executions in Claude API streams.

**Key Features**:
- Tracks tool execution lifecycle (pending → running → success/error)
- Processes tool_use and tool_result events
- Calculates performance statistics
- Maintains execution history
- Integration hooks for SubagentOrchestrator

**Use Cases**:
- Monitoring autonomous agent tool usage
- Performance analysis of tool executions
- Debugging tool failures
- Tracking agent behavior patterns

**Quick Start**:
```typescript
import { ToolEventHandler } from './ToolEventHandler';

const handler = new ToolEventHandler({ enableLogging: true });

handler.on('tool_completed', ({ toolName, duration }) => {
  console.log(`${toolName} completed in ${duration}ms`);
});

handler.handleAssistantContent(event.message.content);
handler.handleToolResult(toolResultEvent);
```

---

### [AgentDebateCoordinator](./AgentDebateCoordinator.md)

Structured debate system enabling autonomous agents to reach consensus through proposals, critiques, defenses, and voting.

**Key Features**:
- 4-phase debate cycle (propose, critique, defend, vote)
- Blocking critique system prevents bad implementations
- 2/3 supermajority requirement for consensus
- Automatic escalation after max rounds
- Weighted voting support

**Use Cases**:
- Multi-agent decision making
- Preventing bad implementations
- Collaborative problem solving
- Architecture decisions requiring consensus

**Quick Start**:
```typescript
import { AgentDebateCoordinator } from './AgentDebateCoordinator';

const coordinator = new AgentDebateCoordinator();

const debateId = coordinator.startDebate(
  'How should we implement caching?',
  ['agent-1', 'agent-2', 'agent-3']
);

coordinator.submitProposal(debateId, {
  agentId: 'agent-1',
  solution: 'Use Redis with LRU eviction',
  reasoning: 'Distributed caching with built-in eviction',
  confidence: 0.85
});
```

---

## Integration Patterns

### Combining RetryStrategy with ToolEventHandler

Monitor and retry tool executions:

```typescript
import { RetryExecutor, AGGRESSIVE_POLICY } from './RetryStrategy';
import { ToolEventHandler } from './ToolEventHandler';

const executor = new RetryExecutor();
const toolHandler = new ToolEventHandler({ enableMetrics: true });

// Retry tool operations with monitoring
executor.on('retry_attempt', ({ attempt, error }) => {
  console.log(`Retry ${attempt}: ${error}`);
});

const result = await executor.executeWithRetry(
  async () => {
    // Execute tool
    const output = await runTool();
    return output;
  },
  AGGRESSIVE_POLICY,
  'tool-execution'
);
```

---

### Using AgentDebateCoordinator with RetryStrategy

Retry debate operations with backoff:

```typescript
import { AgentDebateCoordinator } from './AgentDebateCoordinator';
import { RetryExecutor, createRetryPolicy } from './RetryStrategy';

const coordinator = new AgentDebateCoordinator();
const executor = new RetryExecutor();

const debatePolicy = createRetryPolicy({
  maxAttempts: 3,
  retryableErrors: ['timeout', 'network'],
  baseDelayMs: 2000
});

// Retry proposal submission
await executor.executeWithRetry(
  async () => {
    coordinator.submitProposal(debateId, proposal);
  },
  debatePolicy,
  'submit-proposal'
);
```

---

### Full Stack: Debate + Tools + Retry

Complete orchestration with all three components:

```typescript
import { AgentDebateCoordinator } from './AgentDebateCoordinator';
import { ToolEventHandler, patchToolEventHandler } from './ToolEventHandler';
import { RetryExecutor, AGGRESSIVE_POLICY } from './RetryStrategy';
import { SubagentOrchestrator } from './SubagentOrchestrator';

// Initialize components
const orchestrator = new SubagentOrchestrator('/workspace');
const toolHandler = patchToolEventHandler(orchestrator, { enableLogging: true });
const debateCoordinator = new AgentDebateCoordinator({ minParticipants: 3 });
const retryExecutor = new RetryExecutor();

// Monitor debate with tool tracking
debateCoordinator.on('proposal_submitted', async (debateId, proposal) => {
  console.log(`Proposal from ${proposal.agentId}`);

  // Run agent with retry and tool tracking
  await retryExecutor.executeWithRetry(
    async () => {
      return await orchestrator.runAgent({
        taskId: `validate-${proposal.id}`,
        prompt: `Validate this proposal: ${proposal.solution}`,
        timeout: 60000
      });
    },
    AGGRESSIVE_POLICY,
    `validate-${proposal.id}`
  );
});

// Get comprehensive stats
const toolStats = toolHandler.getStatistics();
const activeDebates = debateCoordinator.getActiveDebates();
const activeRetries = retryExecutor.getActiveRetries();

console.log('System Status:', {
  tools: toolStats,
  debates: activeDebates.length,
  retries: activeRetries.size
});
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ AUTONOMOUS AGENT ORCHESTRATION ARCHITECTURE                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ SubagentOrchestrator │
│  (Agent Execution)   │
└──────────┬───────────┘
           │
           │ integrates with
           ↓
┌──────────────────────┐     tracks     ┌─────────────────┐
│  ToolEventHandler    │ <────────────  │ Claude API      │
│  (Tool Monitoring)   │                │ Stream Events   │
└──────────┬───────────┘                └─────────────────┘
           │
           │ uses
           ↓
┌──────────────────────┐                ┌─────────────────┐
│   RetryStrategy      │ <────────────  │ Transient       │
│  (Fault Tolerance)   │     retries    │ Failures        │
└──────────────────────┘                └─────────────────┘

┌──────────────────────┐                ┌─────────────────┐
│ AgentDebateCoord.    │ ────────────>  │ Multiple Agents │
│ (Consensus Building) │   coordinates  │ Collaborate     │
└──────────────────────┘                └─────────────────┘
           │
           │ escalates
           ↓
┌──────────────────────┐
│  Human Architect     │
│  (Manual Override)   │
└──────────────────────┘
```

---

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ COMPLETE EVENT FLOW                                         │
└─────────────────────────────────────────────────────────────┘

1. AGENT STARTS TASK
   ↓
   [SubagentOrchestrator]
   ↓
2. TOOL INVOCATION
   ↓
   [Claude API: tool_use event]
   ↓
   [ToolEventHandler.handleAssistantContent()]
   emit('tool_invoked')
   ↓
3. TOOL EXECUTION (with retry)
   ↓
   [RetryExecutor.executeWithRetry()]
   ├─ Success
   │  emit('retry_success')
   └─ Failure
      ├─ Retry
      │  emit('retry_attempt')
      └─ Exhausted
         emit('retry_exhausted')
   ↓
4. TOOL RESULT
   ↓
   [Claude API: tool_result event]
   ↓
   [ToolEventHandler.handleToolResult()]
   emit('tool_completed' or 'tool_error')
   emit('statistics_updated')
   ↓
5. AGENT COMPLETES TASK
   ↓
6. DEBATE PHASE (if multi-agent)
   ↓
   [AgentDebateCoordinator]
   ├─ Round 1: PROPOSE
   │  emit('proposal_submitted')
   ├─ Round 2: CRITIQUE
   │  emit('critique_submitted')
   ├─ Round 3: DEFEND
   │  emit('defense_submitted')
   ├─ Round 4: VOTE
   │  emit('vote_cast')
   └─ RESOLVE
      ├─ Consensus
      │  emit('consensus_reached')
      └─ No Consensus
         ├─ More rounds
         └─ Escalate
            emit('debate_escalated')
```

---

## Performance Characteristics

### RetryStrategy

| Metric | Value |
|--------|-------|
| Memory per operation | ~200 bytes (RetryState) |
| CPU overhead | Minimal (only during retries) |
| Max concurrent operations | Unlimited |
| Event emission rate | 1-3 events per retry |

### ToolEventHandler

| Metric | Value |
|--------|-------|
| Memory per tool | ~500 bytes (ToolEvent) |
| History size (default) | 1000 events |
| CPU overhead | Low (O(1) lookups) |
| Event emission rate | 3-4 events per tool |

### AgentDebateCoordinator

| Metric | Value |
|--------|-------|
| Memory per debate | ~5KB (full debate state) |
| Max concurrent debates | Unlimited |
| Rounds per debate | 1-12 (3 cycles × 4 rounds) |
| Event emission rate | 5-15 events per round |

---

## Testing

### Unit Tests

Each component has comprehensive unit tests:

```bash
# Test RetryStrategy
npm test -- RetryStrategy.test.ts

# Test ToolEventHandler
npm test -- ToolEventHandler.test.ts

# Test AgentDebateCoordinator
npm test -- AgentDebateCoordinator.test.ts
```

### Integration Tests

Test components together:

```bash
npm test -- integration.test.ts
```

---

## Common Patterns

### Pattern 1: Reliable Tool Execution

```typescript
const executor = new RetryExecutor();
const toolHandler = new ToolEventHandler();

async function reliableToolExecution(toolName: string, input: any) {
  return await executor.executeWithRetry(
    async () => {
      // Track tool start
      const toolId = `tool-${Date.now()}`;
      toolHandler.trackToolExecution(toolId);

      // Execute tool
      const result = await executeTool(toolName, input);

      // Track completion
      toolHandler.handleToolResult({
        type: 'tool_result',
        tool_use_id: toolId,
        content: result
      });

      return result;
    },
    AGGRESSIVE_POLICY,
    `execute-${toolName}`
  );
}
```

---

### Pattern 2: Monitored Debate Resolution

```typescript
const coordinator = new AgentDebateCoordinator();

async function monitoredDebate(topic: string, agents: string[]) {
  const metrics = {
    proposals: 0,
    critiques: 0,
    defenses: 0,
    votes: 0
  };

  coordinator.on('proposal_submitted', () => metrics.proposals++);
  coordinator.on('critique_submitted', () => metrics.critiques++);
  coordinator.on('defense_submitted', () => metrics.defenses++);
  coordinator.on('vote_cast', () => metrics.votes++);

  const debateId = coordinator.startDebate(topic, agents);

  return new Promise((resolve, reject) => {
    coordinator.once('consensus_reached', (id, proposal) => {
      resolve({ proposal, metrics });
    });

    coordinator.once('debate_escalated', (id, reason) => {
      reject({ reason, metrics });
    });
  });
}
```

---

### Pattern 3: Retry with Statistics

```typescript
const executor = new RetryExecutor();
const stats = {
  attempts: new Map<string, number>(),
  successes: 0,
  failures: 0
};

executor.on('retry_attempt', ({ operationId, attempt }) => {
  stats.attempts.set(operationId, attempt);
});

executor.on('retry_success', ({ operationId }) => {
  stats.successes++;
  stats.attempts.delete(operationId);
});

executor.on('retry_exhausted', ({ operationId }) => {
  stats.failures++;
  stats.attempts.delete(operationId);
});

// Get retry statistics
function getRetryStats() {
  return {
    active: stats.attempts.size,
    successes: stats.successes,
    failures: stats.failures,
    successRate: stats.successes / (stats.successes + stats.failures)
  };
}
```

---

## Troubleshooting

### Issue: High Retry Rate

**Symptoms**: Too many retry attempts, slow operations

**Solution**:
```typescript
// Use more conservative policy
const policy = createRetryPolicy({
  maxAttempts: 2,
  backoffType: 'fixed',
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET']
});
```

---

### Issue: Debate Never Reaches Consensus

**Symptoms**: Debates always escalate after max rounds

**Solution**:
```typescript
// Lower consensus threshold or increase max rounds
const coordinator = new AgentDebateCoordinator({
  consensusThreshold: 0.5,  // Simple majority
  maxRounds: 5
});
```

---

### Issue: Tool Events Not Tracked

**Symptoms**: No tool events emitted

**Solution**:
```typescript
// Ensure handler is patched into orchestrator
const handler = patchToolEventHandler(orchestrator, {
  enableLogging: true  // Enable logging to debug
});

// Check if events are being processed
handler.on('tool_invoked', () => {
  console.log('Tool tracking is working');
});
```

---

## License

MIT

---

## Contributors

- **docs-1** - API Documentation Specialist
- **arch-3** - API Architect
- **tester-2** - Testing Engineer

---

## Changelog

### v1.0.0 (2025-12-07)
- Initial API documentation
- Complete coverage of all three components
- Integration patterns and examples
- Performance characteristics
- Troubleshooting guide
