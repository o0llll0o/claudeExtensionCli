# ADR-001: Mode Dispatcher Architecture

**Status**: Proposed
**Date**: 2025-12-07
**Authors**: System Architecture Designer
**Stakeholders**: VS Code Extension Team

## Context

The VS Code extension currently has unused mode state (`currentMode` in App.tsx:1029) and settings (`swarmDensity`, `permissionMode`) that are never transmitted to the message handling logic. The `handleSend()` function sends identical messages regardless of mode, resulting in a single-mode experience despite multi-mode UI.

### Current State Problems

1. **Dead Code**: `currentMode` state exists but is never used
2. **Unused Settings**: `swarmDensity` and `permissionMode` are set but never transmitted
3. **Disconnected Components**: `SubagentOrchestrator` exists with planner/coder/verifier roles but isn't integrated
4. **No Differentiation**: All modes use the same message handling logic
5. **Type Safety Gaps**: No type-safe contracts for mode-specific responses

## Decision

We will implement a **Mode Dispatcher System** with a registry pattern to provide:

1. Type-safe mode handling with distinct request/response contracts
2. Pluggable mode handlers for extensibility
3. Event-driven architecture for UI updates
4. Graceful fallback to chat mode when handlers are unavailable
5. Comprehensive validation and error handling

## Architecture

### Component Structure

```
src/modes/
├── types.ts                    # Core type definitions
├── ModeDispatcher.ts          # Central orchestrator
├── index.ts                   # Public API exports
├── handlers/
│   ├── BaseModeHandler.ts     # Abstract base class
│   ├── ChatModeHandler.ts     # Chat mode implementation
│   ├── ReviewModeHandler.ts   # Code review mode
│   ├── PlanModeHandler.ts     # Planning mode
│   └── BrainstormModeHandler.ts # Multi-agent brainstorm
├── README.md                  # Documentation
└── integration-example.ts     # Usage examples
```

### Key Design Patterns

#### 1. Registry Pattern

```typescript
class ModeDispatcher {
  private handlers: Map<AppMode, ModeHandler> = new Map();

  registerHandler(handler: ModeHandler): void
  unregisterHandler(mode: AppMode): boolean
  dispatch(request: ModeRequest): Promise<ModeResponse>
}
```

**Rationale**:
- Decouples mode registration from dispatcher logic
- Enables runtime handler addition/removal
- Supports testing with mock handlers
- Allows progressive feature rollout

#### 2. Template Method Pattern

```typescript
abstract class BaseModeHandler {
  async handle(request): Promise<ModeResponse> {
    validate() → emit(started) → executeHandler() → emit(completed)
  }

  protected abstract executeHandler(request): Promise<ModeResponse>
}
```

**Rationale**:
- Centralizes common logic (validation, timing, events)
- Enforces consistent error handling
- Reduces code duplication across handlers
- Provides extension points for customization

#### 3. Event-Driven Architecture

```typescript
type ModeEvent =
  | { type: 'mode:started' }
  | { type: 'mode:progress'; message: string; progress?: number }
  | { type: 'mode:completed'; response: ModeResponse }
  | { type: 'mode:error'; error: Error }
  | { type: 'mode:cancelled' }
```

**Rationale**:
- Decouples business logic from UI updates
- Enables real-time progress feedback
- Supports multiple listeners (logging, analytics, UI)
- Non-blocking operation with async processing

### Mode-Specific Implementations

#### Chat Mode
- **Purpose**: Direct conversational AI
- **Dependencies**: ClaudeService
- **Response**: Plain text with token usage
- **Use Cases**: General Q&A, explanations, debugging

#### Review Mode
- **Purpose**: Structured code analysis
- **Dependencies**: ClaudeService
- **Response**: Issues (error/warning/info), strengths, recommendations
- **Use Cases**: Security audits, quality checks, best practices

#### Plan Mode
- **Purpose**: Task breakdown and planning
- **Dependencies**: SubagentOrchestrator (planner agent)
- **Response**: Structured steps with dependencies and complexity
- **Use Cases**: Feature planning, refactoring strategies

#### Brainstorm Mode
- **Purpose**: Multi-perspective analysis
- **Dependencies**: SubagentOrchestrator + ClaudeService
- **Response**: Agent perspectives, synthesis, themes
- **Use Cases**: Design decisions, problem-solving, ideation
- **Special**: Uses `swarmDensity` to spawn 2-8 agents

## Alternatives Considered

### Alternative 1: Single Handler with Switch Statement

```typescript
async function handleMessage(mode, message) {
  switch (mode) {
    case 'chat': return handleChat(message);
    case 'review': return handleReview(message);
    // ...
  }
}
```

**Rejected Because**:
- Violates Open/Closed Principle
- Tight coupling between modes
- No type safety for responses
- Difficult to test individual modes
- Hard to add new modes without modifying core logic

### Alternative 2: Strategy Pattern without Registry

```typescript
const strategies = {
  chat: new ChatStrategy(),
  review: new ReviewStrategy()
};

function dispatch(mode) {
  return strategies[mode].handle();
}
```

**Rejected Because**:
- Fixed set of strategies at compile time
- No graceful fallback mechanism
- Missing validation and event infrastructure
- Handlers can't be dynamically added/removed

### Alternative 3: Microservice-Style Separate Services

Each mode as a completely separate service with its own lifecycle.

**Rejected Because**:
- Over-engineering for current scale
- Adds complexity without benefit in single-process extension
- Harder to share resources (ClaudeService instance)
- Performance overhead from IPC or network calls

## Consequences

### Positive

1. **Type Safety**: Full TypeScript type inference for all mode responses
2. **Extensibility**: New modes added without modifying existing code
3. **Testability**: Each handler tested in isolation with mocks
4. **Maintainability**: Clear separation of concerns, ~200 LOC per handler
5. **User Experience**: Real-time progress updates via events
6. **Graceful Degradation**: Automatic fallback to chat mode
7. **Resource Efficiency**: Shared service instances across handlers
8. **Settings Integration**: `swarmDensity` and `permissionMode` now functional

### Negative

1. **Code Volume**: ~1500 LOC vs ~200 LOC for simple switch approach
2. **Learning Curve**: Team needs to understand registry and template patterns
3. **Initial Setup**: More upfront work to integrate with App.tsx
4. **Debugging Complexity**: Event-driven flow harder to trace than linear code

### Neutral

1. **Performance**: Negligible overhead from registry lookup and event emission
2. **Bundle Size**: +~15KB minified (acceptable for desktop extension)
3. **Memory**: 4 handler instances + dispatcher (~5KB runtime overhead)

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
- [ ] Implement types.ts with all interfaces
- [ ] Create ModeDispatcher with registry
- [ ] Implement BaseModeHandler abstract class
- [ ] Write comprehensive unit tests

### Phase 2: Handler Implementation (Week 2)
- [ ] ChatModeHandler (reuse existing logic)
- [ ] ReviewModeHandler (new structured analysis)
- [ ] PlanModeHandler (integrate SubagentOrchestrator)
- [ ] BrainstormModeHandler (multi-agent coordination)

### Phase 3: Integration (Week 3)
- [ ] Modify App.tsx handleSend() to use dispatcher
- [ ] Wire up event listeners for UI updates
- [ ] Add mode-specific UI components for results
- [ ] Integration testing

### Phase 4: Polish (Week 4)
- [ ] Documentation and examples
- [ ] Performance optimization
- [ ] Error handling refinement
- [ ] User acceptance testing

## Risk Analysis

### Risk 1: SubagentOrchestrator API Mismatch
**Likelihood**: Medium
**Impact**: High
**Mitigation**:
- Define interface early and validate against actual implementation
- Create adapter layer if API doesn't match expectations
- Maintain backward compatibility with mock implementation

### Risk 2: Performance Degradation in Brainstorm Mode
**Likelihood**: Low
**Impact**: Medium
**Mitigation**:
- Implement configurable timeout (default 5 minutes)
- Run agents in parallel using Promise.all()
- Add progress cancellation mechanism
- Monitor and log processing times

### Risk 3: Breaking Changes to Existing Behavior
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- Chat mode handler replicates exact existing behavior
- Feature flag to enable new mode system
- Comprehensive regression testing
- Gradual rollout starting with chat mode

### Risk 4: Type Safety Complexity
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- Extensive JSDoc comments
- Code examples in README
- Type guards for response discrimination
- Integration examples provided

## Success Metrics

1. **Functionality**: All 4 modes operational with distinct behaviors
2. **Type Safety**: Zero `any` types in public API, full type inference
3. **Test Coverage**: ≥90% coverage for dispatcher and handlers
4. **Performance**: Mode dispatch overhead <10ms
5. **User Adoption**: >50% of messages use non-chat modes within 1 month
6. **Error Rate**: <1% of requests fail due to dispatcher issues

## Open Questions

1. **Q**: Should we support custom modes via extension API?
   **A**: Defer to v2. Focus on core 4 modes first.

2. **Q**: How to handle streaming responses in review/plan modes?
   **A**: Use progress events for intermediate results, full response at end.

3. **Q**: Should brainstorm mode cache agent responses?
   **A**: No initially. Add if latency becomes an issue.

4. **Q**: What happens if ClaudeService or SubagentOrchestrator is unavailable?
   **A**: Validation in handler constructor throws clear error. Graceful degradation to available modes.

## References

- [Original Audit Findings](../audit/unused-state-analysis.md)
- [SubagentOrchestrator Implementation](../src/services/SubagentOrchestrator.ts)
- [Gang of Four Design Patterns](https://en.wikipedia.org/wiki/Design_Patterns)
- [TypeScript Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

## Approval

- [ ] Technical Lead Review
- [ ] Architecture Review Board
- [ ] Security Review (for code review mode)
- [ ] Product Owner Approval

---

**Next Steps**:
1. Circulate ADR for stakeholder review
2. Schedule architecture review meeting
3. Begin Phase 1 implementation upon approval
