# Architecture Documentation - ModeDispatcher Integration

This directory contains the complete architecture design for integrating mode-aware message routing into the Claude CLI Extension.

## Agent AR2: Service Integration Architect

**Deliverables:**
1. Complete service integration architecture
2. Message flow diagrams
3. Type definitions
4. Implementation code snippets
5. Integration strategy

---

## Document Index

### 1. [AR2-ServiceIntegration.md](./AR2-ServiceIntegration.md)
**Main Architecture Document** (16 sections, comprehensive)

Complete architectural design covering:
- Current architecture analysis
- New message flow architecture
- Type definitions
- ChatViewProvider integration
- ModeDispatcher interface contract
- Event flow diagrams
- Sequence diagrams
- Migration strategy
- Testing strategy
- Error handling
- Performance considerations
- Security considerations
- Open questions
- Dependencies
- Acceptance criteria

**When to read:** Start here for complete understanding of the integration architecture.

---

### 2. [AR2-IntegrationSummary.md](./AR2-IntegrationSummary.md)
**Quick Reference Guide**

Quick reference containing:
- Key changes summary
- File modification locations
- Message flow summaries
- Implementation checklist
- Testing checklist
- Dependencies
- Open questions
- Architecture Decision Records (ADRs)

**When to read:** When implementing or reviewing specific changes. Use as a checklist during development.

---

### 3. [AR2-ArchitectureDiagram.md](./AR2-ArchitectureDiagram.md)
**Visual Diagrams (Mermaid)**

Visual representations including:
- Component architecture diagram
- Message flow (plan mode) sequence diagram
- Event flow diagram
- Mode routing decision tree
- Class diagram
- Data flow (agent spawning)
- Error handling flow
- State machine (task lifecycle)
- Deployment architecture

**When to read:** For visual understanding of system flows and component interactions.

---

### 4. [AR2-CodeSnippets.md](./AR2-CodeSnippets.md)
**Implementation Code**

Ready-to-use code snippets for:
- ChatViewProvider constructor update
- Event listeners setup
- handleMessage() update
- handleSend() update
- dispose() update
- App.tsx postMessage update
- App.tsx message handler update
- ModeDispatcher interface stub
- Testing helpers

**When to read:** During implementation. Copy-paste these snippets with care.

---

## Type Definitions

### [../src/types/WebviewMessages.ts](../../src/types/WebviewMessages.ts)
**Message Type Definitions**

Complete TypeScript type definitions for all messages:
- Extension → Webview messages
- Webview → Extension messages
- Plan mode payloads
- Swarm mode payloads
- Review mode payloads
- Error payloads

**When to read:** When working with message passing or type checking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Integration Scope                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input (App.tsx)                                           │
│      ↓                                                          │
│  ChatViewProvider (mode routing) ← AR2 DESIGNED THIS           │
│      ↓                                                          │
│  ModeDispatcher (mode logic) ← AR1 IMPLEMENTS THIS             │
│      ↓                                                          │
│  SubagentOrchestrator (existing)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**AR2's Responsibility:**
- Design the integration points
- Define message contracts
- Specify event flows
- Provide implementation guidance

**AR1's Responsibility:**
- Implement ModeDispatcher core logic
- Implement mode handlers (plan, review, brainstorm)
- Implement plan approval workflow
- Handle agent coordination

---

## Key Design Decisions

### ADR-001: Event-Driven Architecture
**Decision:** Use EventEmitter for ModeDispatcher → ChatViewProvider communication

**Rationale:** Decouples components, allows multiple listeners, standard Node.js pattern

---

### ADR-002: Message Type Safety
**Decision:** TypeScript discriminated unions for all messages

**Rationale:** Compile-time type safety, better autocomplete, easier refactoring

---

### ADR-003: Mode Routing Location
**Decision:** Route in ChatViewProvider.handleSend(), not webview

**Rationale:** Backend controls orchestration, easier testing, security

---

## Integration Points

### 1. Message Entry Point
**File:** `src/providers/ChatViewProvider.ts` (line 98)
- Receives messages from webview
- Routes to appropriate handler
- **AR2 designed, ready to implement**

### 2. Mode Routing Logic
**File:** `src/providers/ChatViewProvider.ts` (line 230)
- Routes based on mode parameter
- Delegates to ModeDispatcher or ClaudeService
- **AR2 designed, ready to implement**

### 3. Event Propagation
**File:** `src/providers/ChatViewProvider.ts` (new method)
- Listens to ModeDispatcher events
- Forwards to webview via postMessage
- **AR2 designed, ready to implement**

### 4. ModeDispatcher Core
**File:** `src/modes/ModeDispatcher.ts` (NEW)
- Implements mode-specific logic
- Emits events to ChatViewProvider
- **AR1 to implement based on AR2 interface contract**

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)
- [ ] Create `src/types/WebviewMessages.ts`
- [ ] Update ChatViewProvider constructor
- [ ] Add setupEventListeners() method
- [ ] No UI changes (backward compatible)

### Phase 2: Mode Routing (Week 2)
- [ ] Implement handleSend() mode routing
- [ ] Update handleMessage() with new cases
- [ ] Create ModeDispatcher stub
- [ ] Test with 'chat' mode

### Phase 3: Plan Mode (Week 3)
- [ ] AR1 implements handlePlanMode()
- [ ] Wire plan approval flow
- [ ] Update App.tsx for plan UI
- [ ] End-to-end testing

### Phase 4: Additional Modes (Week 4)
- [ ] AR1 implements handleReviewMode()
- [ ] AR1 implements handleBrainstormMode()
- [ ] Swarm density scaling
- [ ] Performance optimization

---

## Testing Strategy

### Unit Tests
- ChatViewProvider mode routing logic
- ModeDispatcher event emission
- Message type validation

### Integration Tests
- End-to-end plan mode flow
- Event propagation chain
- Session cleanup

### E2E Tests
- User initiates plan → approves → completion
- User cancels mid-execution
- Error scenarios

---

## Dependencies

### Upstream (Must Exist First)
- [x] SubagentOrchestrator (exists)
- [x] GitWorktreeManager (exists)
- [ ] AR1: ModeDispatcher implementation

### Downstream (Will Use This)
- [ ] App.tsx message handler updates
- [ ] UI components (PlanView, ReviewView)

---

## Open Questions for AR1

1. **Task Persistence**: Should tasks survive extension reload?
2. **Concurrency**: How many simultaneous plan tasks allowed?
3. **Swarm Density Algorithm**: Linear or exponential scaling?
4. **Worktree Cleanup**: Immediate or delayed?
5. **Cross-Mode State**: Can tasks transition between modes?

---

## Getting Started

### For Implementers
1. Read `AR2-ServiceIntegration.md` (sections 1-5)
2. Review `AR2-ArchitectureDiagram.md` (message flow)
3. Use `AR2-CodeSnippets.md` for implementation
4. Reference `AR2-IntegrationSummary.md` as checklist

### For Reviewers
1. Review `AR2-IntegrationSummary.md` (key changes)
2. Check `AR2-ServiceIntegration.md` (sections 11-12 for error handling, performance)
3. Validate `AR2-ArchitectureDiagram.md` (sequence diagrams)
4. Approve interface contract in section 5

### For AR1 (ModeDispatcher Implementer)
1. Review `AR2-ServiceIntegration.md` (section 5 - ModeDispatcher interface)
2. Read `AR2-IntegrationSummary.md` (ModeDispatcher interface contract)
3. Use `AR2-CodeSnippets.md` (section 8 - stub implementation)
4. Reference `src/types/WebviewMessages.ts` for payloads

---

## File Locations

| File | Purpose | Status |
|------|---------|--------|
| `src/types/WebviewMessages.ts` | Message type definitions | Created by AR2 |
| `src/providers/ChatViewProvider.ts` | Service integration | AR2 designed, needs implementation |
| `src/modes/ModeDispatcher.ts` | Mode routing logic | AR1 to implement |
| `src/webview/App.tsx` | UI updates | UI team to implement |
| `docs/architecture/*.md` | Architecture docs | Created by AR2 |

---

## Acceptance Criteria

This design is complete when:
- [x] Message flow documented and approved
- [x] Type definitions compile without errors
- [x] ChatViewProvider integration designed
- [x] Event flow validated for all modes
- [x] Error handling strategy defined
- [ ] AR1 confirms implementable
- [ ] Architecture team approves

---

## Contact

**Design Owner:** AR2 - Service Integration Architect
**Date Created:** 2025-12-07
**Status:** Design Complete, Awaiting Implementation

**Next Steps:**
1. AR1 reviews ModeDispatcher interface contract
2. Team reviews architecture documents
3. Approve and proceed to implementation
4. AR1 implements ModeDispatcher core
5. Integrate and test

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-12-07 | 1.0 | AR2 | Initial design complete |

---

**Ready for Review and Implementation**
