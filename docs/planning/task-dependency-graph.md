# Task Dependency Graph - Autonomous Agent Upgrade

## Executive Summary

**Critical Path Length**: 5 layers (sequential dependencies)
**Total Tasks**: 14 implementation + 7 testing = 21 tasks
**Parallelizable Groups**: 4 major groups
**Estimated Timeline**: 8-12 hours with proper parallelization
**Blocking Risk**: High on RetryStrategy.ts and ToolEventHandler.ts

---

## 1. COMPLETE DEPENDENCY GRAPH

```
LAYER 0: FOUNDATION (Independent - Fully Parallelizable)
├─── [T1] src/orchestration/RetryStrategy.ts (NEW)
│    │    Purpose: Exponential backoff, jitter, circuit breaker
│    │    Dependencies: NONE
│    │    Risk: HIGH - Blocks 4 downstream tasks
│    │    Estimate: 2-3 hours
│    │
├─── [T2] src/orchestration/ToolEventHandler.ts (NEW)
│    │    Purpose: Tool execution lifecycle, error handling
│    │    Dependencies: NONE
│    │    Risk: HIGH - Blocks 3 downstream tasks
│    │    Estimate: 2-3 hours
│    │
└─── [T3] src/orchestration/AgentDebateCoordinator.ts (NEW)
         Purpose: Multi-agent consensus, voting mechanisms
         Dependencies: NONE
         Risk: MEDIUM - Blocks 2 downstream tasks
         Estimate: 3-4 hours

LAYER 1: CORE INTEGRATION (Depends on Layer 0)
├─── [T4] src/orchestration/SubagentOrchestrator.ts (MODIFY)
│    │    Imports: RetryStrategy, ToolEventHandler, AgentDebateCoordinator
│    │    Changes:
│    │    - Add retry logic to runAgent()
│    │    - Integrate tool event handlers
│    │    - Add debate coordination to executePlan()
│    │    Dependencies: T1, T2, T3
│    │    Risk: CRITICAL - Main orchestration logic
│    │    Estimate: 3-4 hours
│    │
└─── [T5] src/webview/components/RetryIndicator.tsx (NEW)
│    │    Purpose: UI for retry status visualization
│    │    Dependencies: T1 (needs RetryStrategy types)
│    │    Risk: LOW - UI only
│    │    Estimate: 1-2 hours
│
└─── [T6] src/webview/components/ToolExecutionFeedback.tsx (NEW)
         Purpose: UI for tool execution feedback
         Dependencies: T2 (needs ToolEventHandler types)
         Risk: LOW - UI only
         Estimate: 1-2 hours

LAYER 2: PROVIDER INTEGRATION (Depends on Layer 1)
└─── [T7] src/providers/ChatViewProvider.ts (MODIFY)
     │    Imports: SubagentOrchestrator events
     │    Changes:
     │    - Listen to retry events from orchestrator
     │    - Listen to tool execution events
     │    - Forward debate updates to webview
     │    - Add message handlers for new UI components
     │    Dependencies: T4
     │    Risk: HIGH - Main communication hub
     │    Estimate: 2-3 hours

LAYER 3: UI INTEGRATION (Depends on Layer 2)
└─── [T8] src/webview/App.tsx (MODIFY)
     │    Imports: RetryIndicator, ToolExecutionFeedback
     │    Changes:
     │    - Handle retry_update messages
     │    - Handle tool_execution messages
     │    - Handle debate_update messages
     │    - Integrate new UI components
     │    Dependencies: T5, T6, T7
     │    Risk: MEDIUM - Main UI orchestration
     │    Estimate: 2-3 hours

LAYER 4: TESTING & VALIDATION (Depends on implementations)
├─── [T9] tests/unit/RetryStrategy.test.ts (NEW)
│    Dependencies: T1
│    Estimate: 1 hour
│
├─── [T10] tests/unit/ToolEventHandler.test.ts (NEW)
│    Dependencies: T2
│    Estimate: 1 hour
│
├─── [T11] tests/unit/AgentDebateCoordinator.test.ts (NEW)
│    Dependencies: T3
│    Estimate: 1 hour
│
├─── [T12] tests/integration/SubagentOrchestrator.test.ts (MODIFY)
│    Dependencies: T4
│    Estimate: 2 hours
│
├─── [T13] tests/integration/ChatViewProvider.test.ts (MODIFY)
│    Dependencies: T7
│    Estimate: 1.5 hours
│
└─── [T14] tests/e2e/retry-workflow.test.ts (NEW)
     Dependencies: T8
     Estimate: 2 hours
```

---

## 2. CRITICAL PATH ANALYSIS

**CRITICAL PATH** (Longest dependency chain - 5 layers):
```
T1/T2/T3 → T4 → T7 → T8 → T14
(Foundation → Core → Provider → UI → E2E Test)

Minimum Timeline: 13-18 hours (sequential execution)
Optimized Timeline: 8-12 hours (with parallelization)
```

**WHY THIS IS CRITICAL**:
1. T1, T2, T3 must be created before anything can integrate
2. T4 (SubagentOrchestrator) is the integration hub
3. T7 (ChatViewProvider) bridges backend and frontend
4. T8 (App.tsx) is the final UI integration point
5. T14 validates the entire workflow

---

## 3. PARALLELIZABLE TASK GROUPS

### GROUP A: Foundation Layer (PARALLEL - Day 1 Morning)
```
┌─────────────────────────────────┐
│ T1: RetryStrategy.ts           │ ← Developer 1 / Agent 1
│ T2: ToolEventHandler.ts        │ ← Developer 2 / Agent 2
│ T3: AgentDebateCoordinator.ts  │ ← Developer 3 / Agent 3
└─────────────────────────────────┘
Time: 3-4 hours (parallel)
Dependencies: NONE
```

### GROUP B: Integration Layer (PARALLEL - Day 1 Afternoon)
```
┌─────────────────────────────────┐
│ T4: SubagentOrchestrator.ts    │ ← Developer 1 (after T1,T2,T3)
│ T5: RetryIndicator.tsx         │ ← Developer 2 (after T1)
│ T6: ToolExecutionFeedback.tsx  │ ← Developer 3 (after T2)
└─────────────────────────────────┘
Time: 3-4 hours (parallel)
Dependencies: T1, T2, T3 must complete first
```

### GROUP C: Provider & UI Layer (SEQUENTIAL - Day 1 Evening)
```
┌─────────────────────────────────┐
│ T7: ChatViewProvider.ts        │ ← Must complete BEFORE T8
│       ↓                         │
│ T8: App.tsx                    │ ← Depends on T5, T6, T7
└─────────────────────────────────┘
Time: 4-6 hours (sequential)
Dependencies: T4, T5, T6 must complete
```

### GROUP D: Testing Layer (PARALLEL - Day 2)
```
┌─────────────────────────────────┐
│ T9:  RetryStrategy.test.ts     │ ← Agent 1
│ T10: ToolEventHandler.test.ts  │ ← Agent 2
│ T11: AgentDebate.test.ts       │ ← Agent 3
│ T12: SubagentOrch.test.ts      │ ← Agent 4
│ T13: ChatViewProvider.test.ts  │ ← Agent 5
│ T14: E2E retry-workflow.test   │ ← Agent 6 (after all impl)
└─────────────────────────────────┘
Time: 2-3 hours (mostly parallel)
Dependencies: All implementations must complete
```

---

## 4. BLOCKING DEPENDENCIES & BOTTLENECKS

### CRITICAL BLOCKERS (Must complete early):

**BLOCKER 1: RetryStrategy.ts (T1)**
- Blocks: T4 (orchestrator), T5 (UI), T9 (test)
- Impact: 3 downstream tasks
- Risk: If delayed, entire integration stalls
- Mitigation: Assign to most experienced developer
- Priority: P0 - Start immediately

**BLOCKER 2: ToolEventHandler.ts (T2)**
- Blocks: T4 (orchestrator), T6 (UI), T10 (test)
- Impact: 3 downstream tasks
- Risk: Tool execution feedback unavailable
- Mitigation: Create interface stub early for parallel work
- Priority: P0 - Start immediately

**BLOCKER 3: SubagentOrchestrator.ts (T4)**
- Blocks: T7 (provider), T12 (test)
- Impact: Entire backend integration
- Risk: Most complex modification
- Mitigation: Break into sub-tasks, implement incrementally
- Priority: P1 - Start after T1, T2, T3

### INTEGRATION BOTTLENECKS:

**BOTTLENECK 1: ChatViewProvider.ts (T7)**
- Blocks: T8 (App.tsx), T13 (test)
- Risk: Message routing complexity
- Mitigation: Use type-safe message interfaces
- Priority: P1 - Critical path item

**BOTTLENECK 2: App.tsx (T8)**
- Blocks: T14 (E2E test)
- Risk: State management complexity
- Mitigation: Incremental integration, feature flags
- Priority: P2 - Final integration point

---

## 5. DEPENDENCY MATRIX

| Task | Depends On | Blocks | Can Parallel With | Risk Level |
|------|-----------|--------|------------------|------------|
| T1 | - | T4, T5, T9 | T2, T3 | HIGH |
| T2 | - | T4, T6, T10 | T1, T3 | HIGH |
| T3 | - | T4, T11 | T1, T2 | MEDIUM |
| T4 | T1, T2, T3 | T7, T12 | T5, T6 | CRITICAL |
| T5 | T1 | T8 | T4, T6 | LOW |
| T6 | T2 | T8 | T4, T5 | LOW |
| T7 | T4 | T8, T13 | - | HIGH |
| T8 | T5, T6, T7 | T14 | - | MEDIUM |
| T9 | T1 | - | T10, T11, T12 | LOW |
| T10 | T2 | - | T9, T11, T12 | LOW |
| T11 | T3 | - | T9, T10, T12 | LOW |
| T12 | T4 | - | T9, T10, T11 | MEDIUM |
| T13 | T7 | - | T9, T10, T11 | MEDIUM |
| T14 | T8 | - | - | LOW |

---

## 6. EXECUTION TIMELINE (Optimized)

### DAY 1 - SPRINT 1 (Morning - 4 hours)
**Phase: Foundation**
```
08:00-12:00
┌──────────────────────────────────────────────────┐
│ PARALLEL EXECUTION (3 agents)                    │
├──────────────────────────────────────────────────┤
│ Agent 1: T1 RetryStrategy.ts                     │
│ Agent 2: T2 ToolEventHandler.ts                  │
│ Agent 3: T3 AgentDebateCoordinator.ts            │
└──────────────────────────────────────────────────┘
Deliverables: 3 new core files + type definitions
```

### DAY 1 - SPRINT 2 (Afternoon - 4 hours)
**Phase: Integration**
```
13:00-17:00
┌──────────────────────────────────────────────────┐
│ PARALLEL EXECUTION (3 agents)                    │
├──────────────────────────────────────────────────┤
│ Agent 1: T4 SubagentOrchestrator.ts (COMPLEX)    │
│ Agent 2: T5 RetryIndicator.tsx                   │
│ Agent 3: T6 ToolExecutionFeedback.tsx            │
└──────────────────────────────────────────────────┘
Deliverables: Orchestrator integration + 2 UI components
```

### DAY 1 - SPRINT 3 (Evening - 4 hours)
**Phase: Provider & UI**
```
17:00-21:00
┌──────────────────────────────────────────────────┐
│ SEQUENTIAL EXECUTION (handoff required)          │
├──────────────────────────────────────────────────┤
│ Agent 1: T7 ChatViewProvider.ts (2 hours)        │
│          ↓ (handoff)                             │
│ Agent 2: T8 App.tsx (2 hours)                    │
└──────────────────────────────────────────────────┘
Deliverables: Complete backend-frontend integration
```

### DAY 2 - SPRINT 4 (Morning - 3 hours)
**Phase: Testing & Validation**
```
08:00-11:00
┌──────────────────────────────────────────────────┐
│ PARALLEL EXECUTION (6 agents)                    │
├──────────────────────────────────────────────────┤
│ Agent 1: T9  RetryStrategy.test.ts               │
│ Agent 2: T10 ToolEventHandler.test.ts            │
│ Agent 3: T11 AgentDebateCoordinator.test.ts      │
│ Agent 4: T12 SubagentOrchestrator.test.ts        │
│ Agent 5: T13 ChatViewProvider.test.ts            │
│ Agent 6: T14 E2E retry-workflow.test.ts          │
└──────────────────────────────────────────────────┘
Deliverables: Complete test coverage
```

---

## 7. RISK MITIGATION STRATEGIES

### HIGH-RISK TASKS:

**T1 - RetryStrategy.ts**
- Risk: Complex retry logic with edge cases
- Mitigation:
  - Start with simple exponential backoff
  - Add circuit breaker in phase 2
  - Extensive unit testing for edge cases
  - Use proven algorithms (AWS SDK patterns)

**T2 - ToolEventHandler.ts**
- Risk: Event lifecycle complexity
- Mitigation:
  - Define clear event interfaces first
  - Use TypeScript strict mode
  - Mock events for early integration
  - Document event flow diagram

**T4 - SubagentOrchestrator.ts**
- Risk: Most complex modification, integration hell
- Mitigation:
  - Create feature branch immediately
  - Incremental integration (one feature at a time)
  - Keep existing code working (feature flags)
  - Comprehensive integration tests

**T7 - ChatViewProvider.ts**
- Risk: Message routing complexity
- Mitigation:
  - Type-safe message interfaces
  - Message flow documentation
  - Unit test each message handler
  - Use discriminated unions for type safety

### INTEGRATION RISKS:

**Backend-Frontend Communication**
- Risk: Message protocol mismatch
- Mitigation:
  - Shared TypeScript types
  - Message schema validation
  - Integration tests for message flow

**State Management**
- Risk: UI state inconsistency
- Mitigation:
  - Single source of truth (App.tsx state)
  - Immutable updates
  - React DevTools for debugging

**Backward Compatibility**
- Risk: Breaking existing workflows
- Mitigation:
  - Feature flags for new features
  - Regression testing
  - Graceful degradation

---

## 8. SUCCESS CRITERIA

### PER-TASK VALIDATION:

**T1 - RetryStrategy.ts**
- [ ] Exponential backoff with configurable parameters
- [ ] Jitter to prevent thundering herd
- [ ] Circuit breaker with state transitions
- [ ] 90%+ unit test coverage
- [ ] Performance benchmarks < 1ms overhead

**T2 - ToolEventHandler.ts**
- [ ] Complete event lifecycle (start, progress, success, error)
- [ ] Error categorization and handling
- [ ] Event aggregation for analytics
- [ ] 85%+ unit test coverage
- [ ] Type-safe event interfaces

**T3 - AgentDebateCoordinator.ts**
- [ ] Multi-agent voting mechanism
- [ ] Consensus algorithms (majority, weighted)
- [ ] Conflict resolution strategies
- [ ] 80%+ unit test coverage
- [ ] Performance < 100ms for 3-agent debate

**T4 - SubagentOrchestrator.ts**
- [ ] Retry logic integrated into runAgent()
- [ ] Tool event emission at key points
- [ ] Debate coordination in executePlan()
- [ ] Backward compatible with existing code
- [ ] 75%+ integration test coverage

**T5 - RetryIndicator.tsx**
- [ ] Visual retry count display
- [ ] Exponential backoff visualization
- [ ] Circuit breaker state indicator
- [ ] Responsive design (mobile-friendly)
- [ ] Accessibility (ARIA labels)

**T6 - ToolExecutionFeedback.tsx**
- [ ] Real-time tool execution status
- [ ] Error display with categorization
- [ ] Success/failure indicators
- [ ] Collapsible execution history
- [ ] Performance metrics display

**T7 - ChatViewProvider.ts**
- [ ] Retry event forwarding to UI
- [ ] Tool execution event routing
- [ ] Debate update messages
- [ ] Message handler registration
- [ ] No memory leaks (event cleanup)

**T8 - App.tsx**
- [ ] Retry UI integration
- [ ] Tool feedback UI integration
- [ ] State management for new components
- [ ] Message handler implementation
- [ ] Visual regression tests pass

### INTEGRATION VALIDATION:

- [ ] End-to-end retry workflow completes successfully
- [ ] Tool execution feedback displays in real-time
- [ ] Agent debate results visible in UI
- [ ] No performance degradation (< 5% overhead)
- [ ] All existing tests pass (regression protection)
- [ ] New E2E test coverage > 70%

---

## 9. AGENT ASSIGNMENT RECOMMENDATIONS

### OPTIMAL AGENT ALLOCATION:

**SPRINT 1 (Foundation):**
```
Agent 1 (planner/architect) → T1 RetryStrategy.ts
  - Needs algorithmic expertise
  - Pattern design skills

Agent 2 (coder/backend-dev) → T2 ToolEventHandler.ts
  - Event-driven architecture experience
  - TypeScript generics knowledge

Agent 3 (ml-developer/researcher) → T3 AgentDebateCoordinator.ts
  - Consensus algorithm knowledge
  - Multi-agent system expertise
```

**SPRINT 2 (Integration):**
```
Agent 1 (coder/system-architect) → T4 SubagentOrchestrator.ts
  - Most critical, needs senior developer
  - Complex integration work

Agent 2 (mobile-dev/coder) → T5 RetryIndicator.tsx
  - UI/UX expertise
  - React component skills

Agent 3 (mobile-dev/coder) → T6 ToolExecutionFeedback.tsx
  - UI/UX expertise
  - React component skills
```

**SPRINT 3 (Provider & UI):**
```
Agent 1 (backend-dev/system-architect) → T7 ChatViewProvider.ts
  - VSCode extension expertise
  - Message routing knowledge

Agent 2 (coder/mobile-dev) → T8 App.tsx
  - React state management
  - UI integration experience
```

**SPRINT 4 (Testing):**
```
Agent 1 (tester/reviewer) → T9, T10, T11 (unit tests)
Agent 2 (tester/reviewer) → T12, T13 (integration tests)
Agent 3 (tester/reviewer) → T14 (E2E tests)
```

---

## 10. DEBATE POSITION: PROPER SEQUENCING PREVENTS INTEGRATION HELL

### THE CASE FOR DEPENDENCY-DRIVEN DEVELOPMENT:

**THESIS**: Respecting dependencies eliminates 80% of integration bugs.

**EVIDENCE**:
1. **Foundation-First Approach**
   - Creating RetryStrategy, ToolEventHandler, and AgentDebateCoordinator first ensures type stability
   - Downstream code can import stable interfaces
   - No "type definition changing mid-integration" issues

2. **Integration Hub Strategy**
   - SubagentOrchestrator is the integration hub
   - Must wait for all foundations to stabilize
   - Prevents circular dependency hell

3. **Provider-Before-UI Pattern**
   - ChatViewProvider establishes message contracts
   - App.tsx implements UI against stable contracts
   - No "message protocol mismatch" bugs

4. **Parallel Execution Where Safe**
   - Foundation layer fully parallelizable (T1, T2, T3)
   - UI components parallelizable (T5, T6)
   - Testing fully parallelizable (T9-T14)
   - Maximizes throughput without risk

**ANTI-PATTERN WARNING**:
- Starting App.tsx before ChatViewProvider = type errors
- Starting SubagentOrchestrator before RetryStrategy = import errors
- Starting tests before implementation = wasted effort

**RECOMMENDED EXECUTION**:
```
DAY 1 MORNING:   T1, T2, T3 (parallel) ← SAFE
DAY 1 AFTERNOON: T4, T5, T6 (parallel) ← SAFE (after foundations)
DAY 1 EVENING:   T7 → T8 (sequential)  ← REQUIRED (provider before UI)
DAY 2 MORNING:   T9-T14 (parallel)     ← SAFE (after implementations)
```

### CONCLUSION:
The dependency graph is not bureaucratic overhead—it's a map to avoid integration disasters. Follow the layers, respect the blockers, and parallelelize aggressively within safe boundaries.

---

## 11. QUICK REFERENCE GUIDE

### START HERE (Day 1 Morning):
```bash
# Create 3 parallel branches
git checkout -b feature/retry-strategy
git checkout -b feature/tool-event-handler
git checkout -b feature/agent-debate

# Assign to 3 agents
Task("Create RetryStrategy.ts with exponential backoff", "agent-1")
Task("Create ToolEventHandler.ts with event lifecycle", "agent-2")
Task("Create AgentDebateCoordinator.ts with consensus", "agent-3")
```

### INTEGRATION CHECKPOINT (Day 1 Afternoon):
```bash
# Merge foundations
git merge feature/retry-strategy
git merge feature/tool-event-handler
git merge feature/agent-debate

# Start integration work
Task("Modify SubagentOrchestrator.ts to integrate all foundations", "agent-1")
Task("Create RetryIndicator.tsx UI component", "agent-2")
Task("Create ToolExecutionFeedback.tsx UI component", "agent-3")
```

### FINAL INTEGRATION (Day 1 Evening):
```bash
# Sequential handoff
Task("Modify ChatViewProvider.ts for event routing", "agent-1")
# Wait for agent-1 to complete, then:
Task("Modify App.tsx to integrate all UI components", "agent-2")
```

### VALIDATION (Day 2 Morning):
```bash
# Parallel testing blitz
Task("Write all unit tests", "tester-swarm", parallel=true, count=6)
npm run test
npm run build
```

**END OF DEPENDENCY GRAPH**
