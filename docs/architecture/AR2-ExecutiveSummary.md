# AR2 Service Integration - Executive Summary

**Project:** ChatViewProvider - ModeDispatcher Integration
**Agent:** AR2 - Service Integration Architect
**Date:** 2025-12-07
**Status:** Design Complete, Ready for Implementation

---

## Overview

This design enables mode-aware message routing in the Claude CLI Extension, allowing users to select different interaction modes (chat, plan, review, brainstorm) with corresponding specialized behaviors powered by multi-agent orchestration.

---

## Problem Statement

**Current State:**
- ChatViewProvider ignores mode parameter (line 230-241)
- All messages route directly to ClaudeService
- SubagentOrchestrator exists but never instantiated
- GitWorktreeManager unused for agent isolation
- No plan approval workflow

**Desired State:**
- Mode-aware routing (chat, plan, review, brainstorm)
- Multi-agent orchestration for complex tasks
- Plan approval workflow with user control
- Agent isolation via Git worktrees
- Real-time progress updates

---

## Solution Architecture

### High-Level Flow

```
User selects mode → App.tsx → ChatViewProvider → Mode Router
                                                        ↓
    ┌────────────────────────────────────────────────────┐
    │                  MODE ROUTING                      │
    ├────────────────────────────────────────────────────┤
    │  chat → ClaudeService (existing)                   │
    │  plan → ModeDispatcher → Orchestrator (NEW)        │
    │  review → ModeDispatcher → Verifier Agent (NEW)    │
    │  brainstorm → ModeDispatcher → Parallel Ideas (NEW)│
    └────────────────────────────────────────────────────┘
```

### Key Components

1. **ChatViewProvider** (Updated)
   - Instantiates ModeDispatcher, Orchestrator, GitWorktreeManager
   - Routes messages based on mode
   - Forwards events to webview

2. **ModeDispatcher** (New - AR1 to implement)
   - Implements mode-specific logic
   - Manages task lifecycle
   - Emits progress events

3. **SubagentOrchestrator** (Existing)
   - Spawns Claude CLI agents
   - Manages worktrees
   - Executes plans

---

## Message Types

### New Messages (Extension → Webview)
- `plan_ready` - Plan generated, awaiting approval
- `step_update` - Plan step status changed
- `swarm_init` - Agents initialized
- `agent_update` - Agent status update
- `review_result` - Code review completed

### New Messages (Webview → Extension)
- `approvePlan` - User approves plan
- `rejectPlan` - User rejects plan
- `retryStep` - Retry failed step
- `cancelTask` - Cancel task

---

## Plan Mode Workflow

```
1. User sends message with mode='plan'
2. ModeDispatcher spawns Planner agent
3. Planner generates step-by-step plan
4. UI shows plan with "Approve" button
5. User approves
6. For each step:
   a. Spawn Coder agent → implement
   b. Spawn Verifier agent → review
   c. Update UI with progress
7. All steps complete → show results
```

**Permission Modes:**
- `manual` - User approval required (default, safest)
- `auto` - Auto-approve small plans (<5 steps)
- `skip` - No approval (power users)

---

## Key Changes

### ChatViewProvider.ts
| Location | Change | Impact |
|----------|--------|--------|
| Constructor | Add ModeDispatcher, Orchestrator, GitWorktreeManager | Enables mode routing |
| handleMessage() | Add 4 new cases (approvePlan, rejectPlan, retryStep, cancelTask) | Plan control |
| handleSend() | Add 3 params (mode, swarmDensity, permissionMode), route by mode | Core routing |
| setupEventListeners() | Listen to 6 ModeDispatcher events | Event propagation |

### App.tsx
| Location | Change | Impact |
|----------|--------|--------|
| postMessage call | Add mode, swarmDensity, permissionMode | Send mode info |
| Message handler | Add 6 new cases (plan_ready, step_update, etc.) | Handle events |
| State | Add mode, swarmDensity, permissionMode state | UI controls |

### New Files
| File | Purpose |
|------|---------|
| `src/types/WebviewMessages.ts` | All message type definitions |
| `src/modes/ModeDispatcher.ts` | Mode routing implementation (AR1) |

---

## Benefits

### For Users
- **Control**: Approve plans before execution
- **Visibility**: Real-time agent progress
- **Flexibility**: Choose interaction mode
- **Safety**: Manual approval prevents unwanted changes

### For Developers
- **Modularity**: Decoupled components
- **Type Safety**: Full TypeScript coverage
- **Testability**: Clear interfaces
- **Extensibility**: Easy to add new modes

### For Architecture
- **Event-Driven**: Clean separation of concerns
- **Scalable**: Supports concurrent tasks
- **Isolated**: Git worktrees prevent conflicts
- **Observable**: Rich event stream for debugging

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing chat mode | Maintain backward compatibility, default to chat |
| Task persistence across reloads | Recommend no persistence for MVP |
| Concurrent task conflicts | Limit to 3 concurrent plan tasks |
| Worktree cleanup failures | Graceful degradation, log errors |
| Invalid planner output | Parse validation, fallback to chat |

---

## Dependencies

### Required from AR1
- ModeDispatcher implementation
- handlePlanMode() logic
- handleReviewMode() logic
- handleBrainstormMode() logic

### Required from UI Team
- Update App.tsx message handlers
- PlanView component
- ReviewView component
- SwarmStatus component

### Already Available
- SubagentOrchestrator (fully implemented)
- GitWorktreeManager (exists)
- ClaudeService (existing)

---

## Implementation Timeline

| Phase | Duration | Deliverables | Owner |
|-------|----------|--------------|-------|
| Phase 1: Foundation | Week 1 | Type defs, ChatViewProvider update | Dev Team |
| Phase 2: Mode Routing | Week 2 | Mode routing, stub ModeDispatcher | Dev Team |
| Phase 3: Plan Mode | Week 3 | Plan workflow, UI components | AR1 + UI Team |
| Phase 4: Additional Modes | Week 4 | Review, brainstorm modes | AR1 |

**Total: 4 weeks**

---

## Success Metrics

### Technical
- [ ] All message types compile without errors
- [ ] Chat mode regression tests pass
- [ ] Plan mode end-to-end test passes
- [ ] Event propagation verified
- [ ] No memory leaks in orchestrator

### User Experience
- [ ] User can select mode from UI
- [ ] Plan displays before execution
- [ ] Approve/reject buttons work
- [ ] Agent status updates in real-time
- [ ] Error messages are actionable

---

## Open Questions

1. **Task Persistence**: Should tasks survive extension reload?
   - **Recommendation**: No for MVP, add in v2

2. **Max Concurrent Tasks**: How many simultaneous plan tasks?
   - **Recommendation**: Limit to 3

3. **Worktree Cleanup**: Immediate or delayed?
   - **Recommendation**: Immediate on success, keep on failure for debugging

4. **Swarm Density**: Linear or exponential scaling?
   - **Recommendation**: Linear (density=3 → 3 agents)

---

## Architecture Decision Records

### ADR-001: Event-Driven Architecture
**Decision:** EventEmitter for component communication
**Rationale:** Decoupling, multiple listeners, standard pattern

### ADR-002: Message Type Safety
**Decision:** TypeScript discriminated unions
**Rationale:** Compile-time safety, better autocomplete

### ADR-003: Backend Mode Routing
**Decision:** Route in ChatViewProvider, not webview
**Rationale:** Security, testability, control

---

## Deliverables

- [x] Complete architecture document (AR2-ServiceIntegration.md)
- [x] Quick reference guide (AR2-IntegrationSummary.md)
- [x] Visual diagrams (AR2-ArchitectureDiagram.md)
- [x] Implementation code snippets (AR2-CodeSnippets.md)
- [x] Type definitions (WebviewMessages.ts)
- [x] Executive summary (this document)
- [ ] AR1 review and approval (pending)
- [ ] Architecture team approval (pending)

---

## Next Steps

1. **Immediate (This Week)**
   - AR1 reviews ModeDispatcher interface contract
   - Architecture team reviews design docs
   - Approval to proceed

2. **Week 1**
   - Create type definitions file
   - Update ChatViewProvider constructor
   - Set up event listeners

3. **Week 2**
   - Implement mode routing in handleSend()
   - Update handleMessage() switch
   - AR1 creates ModeDispatcher stub

4. **Week 3**
   - AR1 implements handlePlanMode()
   - UI team creates PlanView component
   - Integration testing

5. **Week 4**
   - AR1 implements review/brainstorm modes
   - Performance optimization
   - Production deployment

---

## Approval

| Role | Name | Approval | Date |
|------|------|----------|------|
| Design Owner | AR2 | Approved | 2025-12-07 |
| ModeDispatcher Implementer | AR1 | Pending | - |
| Architecture Review | Team | Pending | - |
| Product Owner | - | Pending | - |

---

## Contact

**Design Owner:** AR2 - Service Integration Architect
**Documents:** `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\docs\architecture\`
**Questions:** See "Open Questions for AR1" in AR2-ServiceIntegration.md

---

**Status: Design Complete - Ready for Implementation**
