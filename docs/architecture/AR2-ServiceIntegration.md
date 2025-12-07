# AR2: Service Integration Architecture
## ChatViewProvider - ModeDispatcher Integration Design

**Agent:** AR2 - Service Integration Architect
**Date:** 2025-12-07
**Status:** Design Complete

---

## Executive Summary

This document defines the integration architecture between the existing ChatViewProvider and the new ModeDispatcher system, enabling mode-aware message routing with swarm orchestration capabilities.

---

## 1. Current Architecture Analysis

### 1.1 Current Message Flow
```
User Input (App.tsx)
    ↓ postMessage({ type: 'send', text, model, ultrathink })
ChatViewProvider.handleMessage()
    ↓ case 'send'
ChatViewProvider.handleSend()
    ↓ (mode ignored, context optional)
ClaudeService.sendMessage()
```

**Identified Issues:**
- Line 98-141: handleMessage() switch has no mode routing
- Line 230-241: handleSend() lacks mode parameter
- SubagentOrchestrator exists but never instantiated (lines 74-281 in SubagentOrchestrator.ts)
- GitWorktreeManager available but unused for agent isolation

---

## 2. New Message Flow Architecture

### 2.1 Enhanced Message Flow
```
User Input (App.tsx)
    ↓ postMessage({
        type: 'send',
        text,
        model,
        ultrathink,
        mode: AppMode,
        swarmDensity: number,
        permissionMode: 'manual' | 'auto' | 'skip'
      })
ChatViewProvider.handleMessage()
    ↓ case 'send'
ChatViewProvider.handleSend()
    ↓ mode routing decision
    ├─→ mode === 'chat' → ClaudeService.sendMessage()
    ├─→ mode === 'plan' → ModeDispatcher.handlePlanMode()
    ├─→ mode === 'review' → ModeDispatcher.handleReviewMode()
    └─→ mode === 'brainstorm' → ModeDispatcher.handleBrainstormMode()
        ↓
    ModeDispatcher
        ↓ spawns
    SubagentOrchestrator
        ↓ uses
    GitWorktreeManager (isolated workspaces)
        ↓ emits events
    ChatViewProvider (forwards to webview)
        ↓ postMessage
    App.tsx (UI updates)
```

---

## 3. Type Definitions

### 3.1 Extended Message Types

```typescript
// File: src/types/WebviewMessages.ts (NEW)

import { PlanStep, AgentPlan } from '../orchestration/SubagentOrchestrator';

// Base message type (existing)
export type AppMode = 'chat' | 'review' | 'plan' | 'brainstorm';
export type PermissionMode = 'manual' | 'auto' | 'skip';

// ============================================
// Extension → Webview Messages
// ============================================

export interface ExtensionToWebviewMessage {
    type: ExtensionMessageType;
    payload?: any;
}

export type ExtensionMessageType =
    | 'claude'              // Claude response chunk
    | 'context'             // File context update
    | 'initProgress'        // CLI initialization progress
    | 'sessionLoaded'       // Session loaded
    | 'sessions'            // Session list
    | 'plan_ready'          // Plan generated, awaiting approval
    | 'step_update'         // Plan step status changed
    | 'swarm_init'          // Swarm initialized
    | 'agent_update'        // Individual agent status
    | 'review_result';      // Code review completed

// New message payloads
export interface PlanReadyPayload {
    taskId: string;
    plan: AgentPlan;
    requiresApproval: boolean;
    estimatedDuration: number; // milliseconds
}

export interface StepUpdatePayload {
    taskId: string;
    step: PlanStep;
    agentRole?: 'planner' | 'coder' | 'verifier';
    output?: string;
}

export interface SwarmInitPayload {
    taskId: string;
    mode: AppMode;
    agents: {
        role: 'planner' | 'coder' | 'verifier';
        status: 'idle' | 'active' | 'completed' | 'failed';
        worktreePath: string;
    }[];
    swarmDensity: number;
}

export interface AgentUpdatePayload {
    taskId: string;
    role: 'planner' | 'coder' | 'verifier';
    status: 'idle' | 'active' | 'completed' | 'failed';
    currentAction?: string;
    progress?: number; // 0-100
    output?: string;
}

export interface ReviewResultPayload {
    taskId: string;
    verdict: 'PASS' | 'FAIL';
    findings: {
        category: 'correctness' | 'security' | 'performance' | 'style';
        severity: 'critical' | 'major' | 'minor';
        message: string;
        file?: string;
        line?: number;
    }[];
    reviewerNotes: string;
}

// ============================================
// Webview → Extension Messages
// ============================================

export interface WebviewToExtensionMessage {
    type: WebviewMessageType;
    [key: string]: any;
}

export type WebviewMessageType =
    | 'send'
    | 'stop'
    | 'getContext'
    | 'copy'
    | 'apply'
    | 'insert'
    | 'saveSession'
    | 'loadSession'
    | 'getSessions'
    | 'newSession'
    | 'showInfo'
    | 'webviewReady'
    | 'approvePlan'       // NEW: User approves plan
    | 'rejectPlan'        // NEW: User rejects plan
    | 'retryStep'         // NEW: Retry failed step
    | 'cancelTask';       // NEW: Cancel ongoing task

// Extended 'send' message payload
export interface SendMessagePayload {
    type: 'send';
    text: string;
    includeContext: boolean;
    model: string;
    ultrathink: boolean;
    mode: AppMode;
    swarmDensity: number;
    permissionMode: PermissionMode;
}

export interface ApprovePlanPayload {
    type: 'approvePlan';
    taskId: string;
}

export interface RejectPlanPayload {
    type: 'rejectPlan';
    taskId: string;
    reason?: string;
}

export interface RetryStepPayload {
    type: 'retryStep';
    taskId: string;
    stepId: number;
}

export interface CancelTaskPayload {
    type: 'cancelTask';
    taskId: string;
}
```

---

## 4. ChatViewProvider Integration

### 4.1 Constructor Modifications

```typescript
// File: src/providers/ChatViewProvider.ts

import { ModeDispatcher } from '../modes/ModeDispatcher';
import { SubagentOrchestrator } from '../orchestration/SubagentOrchestrator';
import { GitWorktreeManager } from '../git/GitWorktreeManager';
import {
    WebviewToExtensionMessage,
    SendMessagePayload,
    AppMode,
    PermissionMode
} from '../types/WebviewMessages';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private disposables: vscode.Disposable[] = [];
    private diffManager: DiffManager;
    private sessionManager: SessionManager;
    private workspaceFolder: string;
    private cliInitialized: boolean = false;

    // NEW: Mode-aware services
    private modeDispatcher: ModeDispatcher;
    private orchestrator: SubagentOrchestrator;
    private worktreeManager: GitWorktreeManager;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly claudeService: ClaudeService,
        workspaceFolder?: string
    ) {
        this.workspaceFolder = workspaceFolder || '';
        this.diffManager = new DiffManager();
        this.sessionManager = new SessionManager(this.workspaceFolder);

        // Initialize mode-aware services
        this.worktreeManager = new GitWorktreeManager(this.workspaceFolder);
        this.orchestrator = new SubagentOrchestrator(
            this.workspaceFolder,
            this.worktreeManager
        );
        this.modeDispatcher = new ModeDispatcher(
            this.claudeService,
            this.orchestrator,
            this.workspaceFolder
        );

        // Set up event listeners
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Claude service events (existing)
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

        // NEW: Orchestrator events (low-level)
        this.orchestrator.on('chunk', ({ taskId, role, content }) => {
            this.modeDispatcher.handleChunk(taskId, role, content);
        });

        this.orchestrator.on('step', ({ taskId, step }) => {
            this.postMessage({
                type: 'step_update',
                payload: { taskId, step }
            });
        });
    }
```

### 4.2 Enhanced handleMessage() Switch

```typescript
    private handleMessage(message: WebviewToExtensionMessage) {
        switch (message.type) {
            case 'send':
                this.handleSend(
                    message.text,
                    message.includeContext,
                    {
                        model: message.model,
                        ultrathink: message.ultrathink
                    },
                    message.mode || 'chat',
                    message.swarmDensity || 1,
                    message.permissionMode || 'manual'
                );
                break;

            case 'stop':
                this.claudeService.stop();
                this.orchestrator.stopAll();
                break;

            case 'getContext':
                this.sendActiveFileContext();
                break;

            case 'copy':
                this.handleCopy(message.code);
                break;

            case 'apply':
                this.handleApply(message.code, message.language, message.filePath);
                break;

            case 'insert':
                this.handleInsert(message.code);
                break;

            case 'saveSession':
                this.sessionManager.save(message.id, message.messages);
                break;

            case 'loadSession':
                this.handleLoadSession(message.id);
                break;

            case 'getSessions':
                this.handleGetSessions();
                break;

            case 'newSession':
                this.claudeService.createSession();
                this.modeDispatcher.reset();
                break;

            case 'showInfo':
                vscode.window.showInformationMessage(message.message);
                break;

            case 'webviewReady':
                this.simulateCliInit();
                this.claudeService.initialize();
                break;

            // NEW: Plan approval flow
            case 'approvePlan':
                this.modeDispatcher.approvePlan(message.taskId);
                break;

            case 'rejectPlan':
                this.modeDispatcher.rejectPlan(message.taskId, message.reason);
                break;

            case 'retryStep':
                this.modeDispatcher.retryStep(message.taskId, message.stepId);
                break;

            case 'cancelTask':
                this.modeDispatcher.cancelTask(message.taskId);
                this.orchestrator.stopTask(message.taskId);
                break;
        }
    }
```

### 4.3 New handleSend() Signature with Mode Routing

```typescript
    private async handleSend(
        text: string,
        includeContext: boolean,
        options: SendOptions = {},
        mode: AppMode = 'chat',
        swarmDensity: number = 1,
        permissionMode: PermissionMode = 'manual'
    ): Promise<void> {
        let finalPrompt = text;

        // Build contextual prompt if requested
        if (includeContext) {
            const context = this.getActiveFileContext();
            if (context) {
                finalPrompt = this.buildContextualPrompt(text, context);
            }
        }

        // Route based on mode
        switch (mode) {
            case 'chat':
                // Standard chat mode - direct to Claude
                this.claudeService.sendMessage(finalPrompt, options);
                break;

            case 'plan':
                // Plan mode - use orchestrator for TDD workflow
                await this.modeDispatcher.handlePlanMode({
                    prompt: finalPrompt,
                    options,
                    swarmDensity,
                    permissionMode,
                    context: includeContext ? this.getActiveFileContext() : undefined
                });
                break;

            case 'review':
                // Review mode - spawn verifier agent
                await this.modeDispatcher.handleReviewMode({
                    prompt: finalPrompt,
                    options,
                    context: includeContext ? this.getActiveFileContext() : undefined
                });
                break;

            case 'brainstorm':
                // Brainstorm mode - parallel ideation
                await this.modeDispatcher.handleBrainstormMode({
                    prompt: finalPrompt,
                    options,
                    swarmDensity,
                    context: includeContext ? this.getActiveFileContext() : undefined
                });
                break;

            default:
                // Fallback to chat mode
                this.claudeService.sendMessage(finalPrompt, options);
        }
    }
```

### 4.4 Cleanup and Disposal

```typescript
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.orchestrator.dispose();
        this.modeDispatcher.dispose();
        this.worktreeManager.cleanup();
    }
```

---

## 5. ModeDispatcher Interface Contract

### 5.1 ModeDispatcher Public API

```typescript
// File: src/modes/ModeDispatcher.ts (Interface Definition)

import { EventEmitter } from 'events';
import { ClaudeService, SendOptions } from '../engine/ClaudeService';
import { SubagentOrchestrator } from '../orchestration/SubagentOrchestrator';
import { FileContext } from '../providers/ChatViewProvider';
import {
    PlanReadyPayload,
    StepUpdatePayload,
    SwarmInitPayload,
    AgentUpdatePayload,
    ReviewResultPayload,
    PermissionMode
} from '../types/WebviewMessages';

export interface ModeRequest {
    prompt: string;
    options: SendOptions;
    swarmDensity?: number;
    permissionMode?: PermissionMode;
    context?: FileContext | null;
}

export class ModeDispatcher extends EventEmitter {
    private claudeService: ClaudeService;
    private orchestrator: SubagentOrchestrator;
    private workspaceFolder: string;
    private activeTasks: Map<string, TaskState>;

    constructor(
        claudeService: ClaudeService,
        orchestrator: SubagentOrchestrator,
        workspaceFolder: string
    ) {
        super();
        this.claudeService = claudeService;
        this.orchestrator = orchestrator;
        this.workspaceFolder = workspaceFolder;
        this.activeTasks = new Map();
    }

    // Mode handlers
    async handlePlanMode(request: ModeRequest): Promise<void>;
    async handleReviewMode(request: ModeRequest): Promise<void>;
    async handleBrainstormMode(request: ModeRequest): Promise<void>;

    // Plan approval workflow
    async approvePlan(taskId: string): Promise<void>;
    async rejectPlan(taskId: string, reason?: string): Promise<void>;
    async retryStep(taskId: string, stepId: number): Promise<void>;
    async cancelTask(taskId: string): Promise<void>;

    // Internal coordination
    handleChunk(taskId: string, role: string, content: string): void;
    reset(): void;
    dispose(): void;

    // Events emitted:
    // - 'plan_ready': PlanReadyPayload
    // - 'step_update': StepUpdatePayload
    // - 'swarm_init': SwarmInitPayload
    // - 'agent_update': AgentUpdatePayload
    // - 'review_result': ReviewResultPayload
}

interface TaskState {
    taskId: string;
    mode: AppMode;
    status: 'planning' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
    plan?: AgentPlan;
    worktreePath?: string;
    permissionMode: PermissionMode;
}
```

---

## 6. Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx (Webview)                       │
│  User clicks "Send" with mode='plan', swarmDensity=3            │
└────────────────────────┬────────────────────────────────────────┘
                         │ postMessage({ type: 'send', mode: 'plan', ... })
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ChatViewProvider.handleMessage()             │
│  Receives message → routes to handleSend()                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ mode routing
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ModeDispatcher.handlePlanMode()               │
│  1. Generate taskId                                             │
│  2. Emit 'swarm_init' (show agents initializing)                │
│  3. Create worktree session                                     │
│  4. Spawn planner agent via orchestrator                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ orchestrator.runAgent({ role: 'planner' })
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SubagentOrchestrator                         │
│  Spawns claude CLI process, captures output                     │
│  Emits 'chunk' events during streaming                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ on('chunk')
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ModeDispatcher.handleChunk()                 │
│  Buffers output, updates agent status                           │
│  Emits 'agent_update' with progress                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ emit('agent_update')
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│               ChatViewProvider event listener                   │
│  Receives 'agent_update' → forwards to webview                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ postMessage({ type: 'agent_update' })
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    App.tsx message handler                      │
│  Updates UI with agent status (e.g., "Planner: analyzing...")   │
└─────────────────────────────────────────────────────────────────┘
                         │ planner completes
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ModeDispatcher                               │
│  Parses plan JSON from planner output                           │
│  Emits 'plan_ready' with plan steps                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ emit('plan_ready')
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    App.tsx                                      │
│  Shows plan with "Approve" / "Reject" buttons                   │
│  User clicks "Approve"                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ postMessage({ type: 'approvePlan' })
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ModeDispatcher.approvePlan()                       │
│  Calls orchestrator.executePlan()                               │
│  For each step: spawn coder → spawn verifier                    │
│  Emits 'step_update' as steps progress                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ all steps complete
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ModeDispatcher                               │
│  Emits final 'step_update' with status='completed'              │
│  Cleans up worktree (optional, based on config)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Sequence Diagrams

### 7.1 Plan Mode Flow (Manual Approval)

```
User          App.tsx      ChatView    ModeDispatcher   Orchestrator   Planner   Coder   Verifier
 │               │             │              │               │            │        │        │
 │─Send(plan)───→│             │              │               │            │        │        │
 │               │─postMsg────→│              │               │            │        │        │
 │               │             │─handleSend──→│               │            │        │        │
 │               │             │              │─swarm_init───→│            │        │        │
 │               │←────────────postMsg(init)──│               │            │        │        │
 │←─Show agents─│             │              │               │            │        │        │
 │               │             │              │─runAgent──────→│           │        │        │
 │               │             │              │               │─spawn─────→│        │        │
 │               │←────────────postMsg(agent_update: active)──│            │        │        │
 │←─Planner...──│             │              │               │            │─work──→│        │
 │               │←────────────postMsg(plan_ready)────────────│←─output────│        │        │
 │←─Show plan───│             │              │               │            │        │        │
 │─Approve─────→│             │              │               │            │        │        │
 │               │─postMsg────→│              │               │            │        │        │
 │               │             │─approvePlan─→│               │            │        │        │
 │               │             │              │─executePlan──→│            │        │        │
 │               │             │              │               │─runAgent(coder)────→│        │
 │               │←────────────postMsg(step_update: in_progress)──────────│        │        │
 │←─Step 1/N────│             │              │               │            │        │─code──→│
 │               │             │              │               │─runAgent(verifier)─────────→│
 │               │←────────────postMsg(review_result)──────────────────────────────│        │
 │←─Review: ✓───│             │              │               │            │        │        │
 │               │←────────────postMsg(step_update: completed)─────────────────────│        │
 │←─Done────────│             │              │               │            │        │        │
```

### 7.2 Review Mode Flow

```
User          App.tsx      ChatView    ModeDispatcher   Orchestrator   Verifier
 │               │             │              │               │            │
 │─Send(review)─→│             │              │               │            │
 │               │─postMsg────→│              │               │            │
 │               │             │─handleSend──→│               │            │
 │               │             │              │─handleReview─→│            │
 │               │             │              │─runAgent─────→│            │
 │               │             │              │               │─spawn─────→│
 │               │←────────────postMsg(agent_update)──────────│            │
 │←─Reviewing...│             │              │               │            │─analyze
 │               │←────────────postMsg(review_result)─────────│←───────────│
 │←─Show review─│             │              │               │            │
```

---

## 8. Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create `src/types/WebviewMessages.ts` with all message types
2. Update `ChatViewProvider` constructor to instantiate ModeDispatcher, Orchestrator, GitWorktreeManager
3. Set up event listeners in `ChatViewProvider.setupEventListeners()`
4. No UI changes yet - maintain backward compatibility

### Phase 2: Mode Routing (Week 2)
1. Implement `ChatViewProvider.handleSend()` mode routing logic
2. Update `handleMessage()` switch with new cases
3. Create stub `ModeDispatcher` class with event emitters
4. Test with 'chat' mode to ensure no regression

### Phase 3: Plan Mode Implementation (Week 3)
1. Implement `ModeDispatcher.handlePlanMode()`
2. Wire up plan approval flow (`approvePlan`, `rejectPlan`)
3. Update `App.tsx` to accept new message types
4. Add plan UI components

### Phase 4: Additional Modes (Week 4)
1. Implement `ModeDispatcher.handleReviewMode()`
2. Implement `ModeDispatcher.handleBrainstormMode()`
3. Complete swarm density scaling logic
4. Performance testing and optimization

---

## 9. Testing Strategy

### 9.1 Unit Tests
- `ChatViewProvider.handleSend()` mode routing
- `ModeDispatcher` event emission
- Message type validation
- Orchestrator event forwarding

### 9.2 Integration Tests
- End-to-end plan mode flow
- Event propagation from Orchestrator → ModeDispatcher → ChatViewProvider → Webview
- Session cleanup and disposal
- Error handling and task cancellation

### 9.3 E2E Tests
- User initiates plan mode → approves plan → sees completion
- User initiates review mode → sees review results
- User cancels mid-execution → verify cleanup

---

## 10. Error Handling

### 10.1 Error Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Planner produces invalid JSON | Parse error in ModeDispatcher | Emit error event, fallback to chat mode |
| Coder agent fails | Orchestrator emits error | Mark step as 'failed', allow retry |
| Verifier rejects code | Review result verdict='FAIL' | Show findings, allow manual edit + retry |
| User cancels mid-execution | 'cancelTask' message | Stop orchestrator, cleanup worktree |
| Git worktree creation fails | GitWorktreeManager throws | Emit error, use main workspace |

### 10.2 Error Message Types

```typescript
export interface ErrorPayload {
    taskId: string;
    type: 'planner_error' | 'coder_error' | 'verifier_error' | 'system_error';
    message: string;
    recoverable: boolean;
    suggestedAction?: string;
}

// In ChatViewProvider
this.modeDispatcher.on('error', (payload: ErrorPayload) => {
    this.postMessage({ type: 'error', payload });
    if (!payload.recoverable) {
        vscode.window.showErrorMessage(`Task failed: ${payload.message}`);
    }
});
```

---

## 11. Performance Considerations

### 11.1 Optimization Strategies

1. **Lazy Instantiation**: Only create GitWorktreeManager when mode !== 'chat'
2. **Event Throttling**: Throttle 'agent_update' events to max 10/second
3. **Memory Management**: Clean up completed tasks after 5 minutes
4. **Swarm Density Cap**: Limit max agents to 5 to prevent resource exhaustion

### 11.2 Resource Monitoring

```typescript
// In ModeDispatcher
private monitorResources(): void {
    const activeTaskCount = this.activeTasks.size;
    if (activeTaskCount > 3) {
        console.warn(`High task count: ${activeTaskCount} active tasks`);
        // Emit warning to UI
    }
}
```

---

## 12. Security Considerations

### 12.1 Input Validation

- Validate `mode` against allowed values before routing
- Sanitize `taskId` to prevent injection attacks
- Limit plan step count to max 50 steps

### 12.2 Worktree Isolation

- Each task gets isolated Git worktree
- Prevent cross-task file access
- Clean up worktrees on task completion or extension shutdown

### 12.3 Permission Modes

- `manual`: User must approve every plan (default, safest)
- `auto`: Auto-approve plans < 5 steps (convenience vs. risk)
- `skip`: No approval required (power users, risky)

---

## 13. Open Questions for AR1 (Core ModeDispatcher)

1. **Task Persistence**: Should active tasks survive extension reload?
2. **Concurrency**: How to handle multiple simultaneous plan-mode tasks?
3. **Swarm Density Algorithm**: Linear scaling (density=3 → 3 agents) or exponential?
4. **Worktree Cleanup**: Immediate cleanup or keep for 24h for debugging?
5. **Cross-Mode State**: Can a task transition from 'plan' to 'review' mode?

---

## 14. Dependencies

### 14.1 Upstream Dependencies (Must Exist)
- AR1: ModeDispatcher implementation
- GitWorktreeManager: Worktree creation and cleanup APIs
- SubagentOrchestrator: Agent spawning and execution (exists)

### 14.2 Downstream Dependencies (Will Use This)
- App.tsx: Must handle new message types
- UI components: PlanView, ReviewView, SwarmStatus

---

## 15. Acceptance Criteria

**This design is complete when:**

1. Message flow diagram accepted by architecture team
2. Type definitions compile without errors
3. ChatViewProvider interface changes reviewed
4. Event flow validated for all 4 modes
5. Error handling strategy approved
6. AR1 confirms ModeDispatcher interface contract is implementable

---

## 16. Appendix: Code Location Map

| File | Lines | Purpose |
|------|-------|---------|
| `src/providers/ChatViewProvider.ts` | 98-141 | handleMessage() - add new cases |
| `src/providers/ChatViewProvider.ts` | 230-241 | handleSend() - add mode routing |
| `src/providers/ChatViewProvider.ts` | 24-35 | constructor - add ModeDispatcher, Orchestrator |
| `src/types/WebviewMessages.ts` | NEW | All message type definitions |
| `src/modes/ModeDispatcher.ts` | NEW | Core mode routing logic (AR1's responsibility) |
| `src/webview/App.tsx` | 1165-1178 | handleSend() - add mode params to postMessage |
| `src/webview/App.tsx` | TBD | Message handler - handle new message types |

---

**Design Status:** COMPLETE
**Next Steps:** AR1 to implement ModeDispatcher, UI team to update App.tsx message handling
**Review Date:** 2025-12-07
**Approved By:** [Pending Review]
