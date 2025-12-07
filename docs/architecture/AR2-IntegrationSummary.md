# AR2 Service Integration - Quick Reference

## Overview
This document provides a quick reference for the ChatViewProvider-ModeDispatcher integration.

---

## Key Changes Summary

### 1. ChatViewProvider Constructor
**File:** `src/providers/ChatViewProvider.ts`

```typescript
// ADD these imports
import { ModeDispatcher } from '../modes/ModeDispatcher';
import { SubagentOrchestrator } from '../orchestration/SubagentOrchestrator';
import { GitWorktreeManager } from '../git/GitWorktreeManager';

// ADD these properties
private modeDispatcher: ModeDispatcher;
private orchestrator: SubagentOrchestrator;
private worktreeManager: GitWorktreeManager;

// ADD to constructor
this.worktreeManager = new GitWorktreeManager(this.workspaceFolder);
this.orchestrator = new SubagentOrchestrator(this.workspaceFolder, this.worktreeManager);
this.modeDispatcher = new ModeDispatcher(this.claudeService, this.orchestrator, this.workspaceFolder);
this.setupEventListeners();
```

### 2. handleSend() Signature Change
**Before:**
```typescript
private handleSend(text: string, includeContext: boolean, options: SendOptions = {})
```

**After:**
```typescript
private async handleSend(
    text: string,
    includeContext: boolean,
    options: SendOptions = {},
    mode: AppMode = 'chat',
    swarmDensity: number = 1,
    permissionMode: PermissionMode = 'manual'
): Promise<void>
```

### 3. handleMessage() New Cases
**File:** `src/providers/ChatViewProvider.ts` (lines 98-141)

```typescript
case 'send':
    this.handleSend(
        message.text,
        message.includeContext,
        { model: message.model, ultrathink: message.ultrathink },
        message.mode || 'chat',           // NEW
        message.swarmDensity || 1,        // NEW
        message.permissionMode || 'manual' // NEW
    );
    break;

case 'approvePlan':  // NEW
    this.modeDispatcher.approvePlan(message.taskId);
    break;

case 'rejectPlan':   // NEW
    this.modeDispatcher.rejectPlan(message.taskId, message.reason);
    break;

case 'retryStep':    // NEW
    this.modeDispatcher.retryStep(message.taskId, message.stepId);
    break;

case 'cancelTask':   // NEW
    this.modeDispatcher.cancelTask(message.taskId);
    this.orchestrator.stopTask(message.taskId);
    break;
```

### 4. Event Listeners Setup
**File:** `src/providers/ChatViewProvider.ts`

```typescript
private setupEventListeners(): void {
    // Existing Claude service events
    this.claudeService.on('message', (msg: ClaudeMessage) => {
        this.postMessage({ type: 'claude', payload: msg });
    });

    // NEW: ModeDispatcher events
    this.modeDispatcher.on('plan_ready', (payload) => {
        this.postMessage({ type: 'plan_ready', payload });
    });

    this.modeDispatcher.on('step_update', (payload) => {
        this.postMessage({ type: 'step_update', payload });
    });

    this.modeDispatcher.on('swarm_init', (payload) => {
        this.postMessage({ type: 'swarm_init', payload });
    });

    this.modeDispatcher.on('agent_update', (payload) => {
        this.postMessage({ type: 'agent_update', payload });
    });

    this.modeDispatcher.on('review_result', (payload) => {
        this.postMessage({ type: 'review_result', payload });
    });

    this.modeDispatcher.on('error', (payload) => {
        this.postMessage({ type: 'error', payload });
    });

    // NEW: Orchestrator events (low-level)
    this.orchestrator.on('chunk', ({ taskId, role, content }) => {
        this.modeDispatcher.handleChunk(taskId, role, content);
    });

    this.orchestrator.on('step', ({ taskId, step }) => {
        this.postMessage({ type: 'step_update', payload: { taskId, step } });
    });
}
```

### 5. App.tsx postMessage Change
**File:** `src/webview/App.tsx` (line 1177)

**Before:**
```typescript
vscode.postMessage({ type: 'send', text: userMessage, includeContext, model: selectedModel, ultrathink });
```

**After:**
```typescript
vscode.postMessage({
    type: 'send',
    text: userMessage,
    includeContext,
    model: selectedModel,
    ultrathink,
    mode,              // NEW
    swarmDensity,      // NEW
    permissionMode     // NEW
});
```

---

## ModeDispatcher Interface Contract

The ModeDispatcher must implement:

```typescript
class ModeDispatcher extends EventEmitter {
    constructor(
        claudeService: ClaudeService,
        orchestrator: SubagentOrchestrator,
        workspaceFolder: string
    );

    // Mode handlers
    async handlePlanMode(request: ModeRequest): Promise<void>;
    async handleReviewMode(request: ModeRequest): Promise<void>;
    async handleBrainstormMode(request: ModeRequest): Promise<void>;

    // Plan control
    async approvePlan(taskId: string): Promise<void>;
    async rejectPlan(taskId: string, reason?: string): Promise<void>;
    async retryStep(taskId: string, stepId: number): Promise<void>;
    async cancelTask(taskId: string): Promise<void>;

    // Utilities
    handleChunk(taskId: string, role: string, content: string): void;
    reset(): void;
    dispose(): void;
}
```

**Events Emitted:**
- `plan_ready`: Plan generated, needs approval
- `step_update`: Plan step status changed
- `swarm_init`: Swarm initialized with agents
- `agent_update`: Individual agent status update
- `review_result`: Code review completed
- `error`: Error occurred

---

## Message Flow Summary

### Chat Mode (Default)
```
User → App.tsx → ChatViewProvider → ClaudeService → Stream → Webview
```

### Plan Mode
```
User → App.tsx → ChatViewProvider → ModeDispatcher → Orchestrator
  ↓
Spawns: Planner Agent
  ↓
Emits: plan_ready → Webview shows plan
  ↓
User approves → ModeDispatcher.approvePlan()
  ↓
Spawns: Coder + Verifier (per step)
  ↓
Emits: step_update → Webview shows progress
  ↓
Complete: final step_update
```

### Review Mode
```
User → App.tsx → ChatViewProvider → ModeDispatcher → Orchestrator
  ↓
Spawns: Verifier Agent
  ↓
Analyzes code
  ↓
Emits: review_result → Webview shows findings
```

---

## File Creation Checklist

- [x] `src/types/WebviewMessages.ts` - Message type definitions
- [ ] `src/modes/ModeDispatcher.ts` - Core mode routing (AR1's task)
- [ ] Update `src/providers/ChatViewProvider.ts` constructor
- [ ] Update `src/providers/ChatViewProvider.ts` handleMessage()
- [ ] Update `src/providers/ChatViewProvider.ts` handleSend()
- [ ] Add `src/providers/ChatViewProvider.ts` setupEventListeners()
- [ ] Update `src/webview/App.tsx` postMessage call
- [ ] Add `src/webview/App.tsx` message handlers for new types
- [ ] Add UI components for plan display
- [ ] Add UI components for review display

---

## Testing Checklist

### Unit Tests
- [ ] ChatViewProvider mode routing
- [ ] Message type validation
- [ ] Event listener setup
- [ ] Disposal cleanup

### Integration Tests
- [ ] Plan mode end-to-end
- [ ] Review mode end-to-end
- [ ] Event propagation chain
- [ ] Error handling

### Manual Tests
- [ ] Chat mode still works (regression test)
- [ ] Plan mode creates worktree
- [ ] Plan approval flow works
- [ ] Cancel task cleanup works
- [ ] Error messages display correctly

---

## Dependencies

**Required from AR1:**
- ModeDispatcher implementation
- handlePlanMode() logic
- handleReviewMode() logic
- handleBrainstormMode() logic

**Required from UI Team:**
- Update App.tsx message handler
- PlanView component
- ReviewView component
- SwarmStatus component

**Already Exists:**
- SubagentOrchestrator (fully implemented)
- GitWorktreeManager (exists, needs verification)
- ClaudeService (existing)

---

## Open Questions

1. **Task persistence:** Should tasks survive extension reload?
   - Recommendation: No for MVP, add in v2

2. **Concurrency:** Max simultaneous plan-mode tasks?
   - Recommendation: Limit to 3 concurrent tasks

3. **Worktree cleanup:** When to clean up?
   - Recommendation: Immediate cleanup on completion, keep on failure for debugging

4. **Permission mode defaults:** What's the safest default?
   - Recommendation: 'manual' for safety

5. **Cross-mode transitions:** Can a task switch modes?
   - Recommendation: No for MVP, treat as separate tasks

---

## Architecture Decision Records

### ADR-001: Event-Driven Architecture
**Decision:** Use EventEmitter pattern for ModeDispatcher → ChatViewProvider communication

**Rationale:**
- Decouples ModeDispatcher from ChatViewProvider
- Allows multiple listeners
- Standard Node.js pattern

**Alternatives Considered:**
- Callbacks: Too tightly coupled
- Promises: Not suitable for streaming updates

---

### ADR-002: Message Type Safety
**Decision:** Use TypeScript discriminated unions for all messages

**Rationale:**
- Type safety at compile time
- Better IDE autocomplete
- Easier refactoring

**Alternatives Considered:**
- String-based types: Less type safe
- Separate message classes: More boilerplate

---

### ADR-003: Mode Routing Location
**Decision:** Route modes in ChatViewProvider.handleSend(), not in webview

**Rationale:**
- Backend controls orchestration logic
- Easier to test
- Security: don't trust webview input

**Alternatives Considered:**
- Route in App.tsx: Violates separation of concerns
- Route in ClaudeService: Too low-level

---

## Next Steps

1. AR1 implements ModeDispatcher core logic
2. Update ChatViewProvider as specified
3. UI team updates App.tsx
4. Integration testing
5. Documentation update

---

**Status:** Design Complete - Ready for Implementation
**Owner:** AR2 - Service Integration Architect
**Date:** 2025-12-07
