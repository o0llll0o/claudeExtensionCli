# AR2 Service Integration - Implementation Code Snippets

This document provides ready-to-use code snippets for implementing the ChatViewProvider-ModeDispatcher integration.

---

## 1. ChatViewProvider Constructor Update

**File:** `src/providers/ChatViewProvider.ts`

**Add imports at top:**
```typescript
import { ModeDispatcher } from '../modes/ModeDispatcher';
import { SubagentOrchestrator } from '../orchestration/SubagentOrchestrator';
import { GitWorktreeManager } from '../git/GitWorktreeManager';
import {
    WebviewToExtensionMessage,
    SendMessagePayload,
    AppMode,
    PermissionMode
} from '../types/WebviewMessages';
```

**Add properties after line 22:**
```typescript
// NEW: Mode-aware services
private modeDispatcher: ModeDispatcher;
private orchestrator: SubagentOrchestrator;
private worktreeManager: GitWorktreeManager;
```

**Replace constructor (lines 24-35) with:**
```typescript
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

    // Set up event listeners (moved to separate method)
    this.setupEventListeners();
}
```

---

## 2. Event Listeners Setup

**File:** `src/providers/ChatViewProvider.ts`

**Add new method after constructor:**
```typescript
private setupEventListeners(): void {
    // Existing: Claude service events
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
        // Optionally show VS Code notification for critical errors
        if (!payload.recoverable) {
            vscode.window.showErrorMessage(`Task failed: ${payload.message}`);
        }
    });

    // NEW: Orchestrator events (low-level, forwarded to ModeDispatcher)
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

**Remove old event listener from constructor:**
Delete these lines (originally lines 32-34):
```typescript
this.claudeService.on('message', (msg: ClaudeMessage) => {
    this.postMessage({ type: 'claude', payload: msg });
});
```

---

## 3. handleMessage() Update

**File:** `src/providers/ChatViewProvider.ts` (lines 98-141)

**Replace entire handleMessage method:**
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

        // NEW: Plan approval workflow
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

---

## 4. handleSend() Update

**File:** `src/providers/ChatViewProvider.ts` (lines 230-241)

**Replace handleSend method:**
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
            // Fallback to chat mode for safety
            console.warn(`Unknown mode: ${mode}, falling back to chat`);
            this.claudeService.sendMessage(finalPrompt, options);
    }
}
```

---

## 5. dispose() Update

**File:** `src/providers/ChatViewProvider.ts` (line 326)

**Replace dispose method:**
```typescript
dispose() {
    this.disposables.forEach(d => d.dispose());
    this.orchestrator.dispose();
    this.modeDispatcher.dispose();
    this.worktreeManager.cleanup();
}
```

---

## 6. App.tsx postMessage Update

**File:** `src/webview/App.tsx` (line 1177)

**Find the handleSend function and update the postMessage call:**

**Before:**
```typescript
vscode.postMessage({
    type: 'send',
    text: userMessage,
    includeContext,
    model: selectedModel,
    ultrathink
});
```

**After:**
```typescript
vscode.postMessage({
    type: 'send',
    text: userMessage,
    includeContext,
    model: selectedModel,
    ultrathink,
    // NEW: mode-aware fields
    mode,              // from mode state
    swarmDensity,      // from swarmDensity state
    permissionMode     // from permissionMode state
});
```

**You'll need to add these state variables in App.tsx:**
```typescript
// Add near other useState hooks (around line 165)
const [mode, setMode] = useState<AppMode>('chat');
const [swarmDensity, setSwarmDensity] = useState(1);
const [permissionMode, setPermissionMode] = useState<PermissionMode>('manual');
```

---

## 7. App.tsx Message Handler Update

**File:** `src/webview/App.tsx`

**Find the useEffect hook with message listener (around line 195):**

**Add these cases to the message handler:**
```typescript
useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        const message = event.data;

        switch (message.type) {
            // ... existing cases ...

            // NEW: Plan mode messages
            case 'plan_ready':
                handlePlanReady(message.payload);
                break;

            case 'step_update':
                handleStepUpdate(message.payload);
                break;

            case 'swarm_init':
                handleSwarmInit(message.payload);
                break;

            case 'agent_update':
                handleAgentUpdate(message.payload);
                break;

            case 'review_result':
                handleReviewResult(message.payload);
                break;

            case 'error':
                handleError(message.payload);
                break;
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}, []);
```

**Add handler functions:**
```typescript
// Add these handler functions in App.tsx

const handlePlanReady = (payload: PlanReadyPayload) => {
    setCurrentPlan(payload.plan);
    setShowPlanApproval(true);
    // UI will show plan with approve/reject buttons
};

const handleStepUpdate = (payload: StepUpdatePayload) => {
    setCurrentPlan(prev => {
        if (!prev || prev.taskId !== payload.taskId) return prev;
        return {
            ...prev,
            steps: prev.steps.map(s =>
                s.id === payload.step.id ? payload.step : s
            )
        };
    });
};

const handleSwarmInit = (payload: SwarmInitPayload) => {
    setSwarmAgents(payload.agents);
    setShowSwarmStatus(true);
};

const handleAgentUpdate = (payload: AgentUpdatePayload) => {
    setSwarmAgents(prev =>
        prev.map(a =>
            a.role === payload.role
                ? { ...a, status: payload.status, currentAction: payload.currentAction }
                : a
        )
    );
};

const handleReviewResult = (payload: ReviewResultPayload) => {
    setReviewResult(payload);
    setShowReviewModal(true);
};

const handleError = (payload: ErrorPayload) => {
    setErrorMessage(payload.message);
    setShowError(true);
    if (payload.recoverable) {
        setRetryableError(payload);
    }
};
```

---

## 8. ModeDispatcher Interface (Stub for AR1)

**File:** `src/modes/ModeDispatcher.ts` (NEW - AR1's responsibility to implement)

**This is the interface contract that AR1 must implement:**

```typescript
import { EventEmitter } from 'events';
import { ClaudeService, SendOptions } from '../engine/ClaudeService';
import { SubagentOrchestrator, AgentPlan, PlanStep } from '../orchestration/SubagentOrchestrator';
import { FileContext } from '../providers/ChatViewProvider';
import { PermissionMode, AppMode } from '../types/WebviewMessages';

export interface ModeRequest {
    prompt: string;
    options: SendOptions;
    swarmDensity?: number;
    permissionMode?: PermissionMode;
    context?: FileContext | null;
}

interface TaskState {
    taskId: string;
    mode: AppMode;
    status: 'planning' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
    plan?: AgentPlan;
    worktreePath?: string;
    permissionMode: PermissionMode;
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

    // Mode handlers (AR1 to implement)
    async handlePlanMode(request: ModeRequest): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    async handleReviewMode(request: ModeRequest): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    async handleBrainstormMode(request: ModeRequest): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    // Plan approval workflow (AR1 to implement)
    async approvePlan(taskId: string): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    async rejectPlan(taskId: string, reason?: string): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    async retryStep(taskId: string, stepId: number): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    async cancelTask(taskId: string): Promise<void> {
        // TODO: AR1 implementation
        throw new Error('Not implemented');
    }

    // Internal coordination (AR1 to implement)
    handleChunk(taskId: string, role: string, content: string): void {
        // TODO: AR1 implementation
    }

    reset(): void {
        this.activeTasks.clear();
    }

    dispose(): void {
        this.activeTasks.clear();
        this.removeAllListeners();
    }

    // Events emitted (AR1 must emit these):
    // - 'plan_ready': PlanReadyPayload
    // - 'step_update': StepUpdatePayload
    // - 'swarm_init': SwarmInitPayload
    // - 'agent_update': AgentUpdatePayload
    // - 'review_result': ReviewResultPayload
    // - 'error': ErrorPayload
}
```

---

## 9. FileContext Interface Export

**File:** `src/providers/ChatViewProvider.ts` (line 7)

**Make FileContext interface exportable:**

**Before:**
```typescript
interface FileContext {
    fileName: string;
    relativePath: string;
    language: string;
    content: string;
    selection?: string;
    lineCount: number;
}
```

**After:**
```typescript
export interface FileContext {
    fileName: string;
    relativePath: string;
    language: string;
    content: string;
    selection?: string;
    lineCount: number;
}
```

---

## 10. Testing Helpers

**File:** `src/test/ChatViewProvider.test.ts` (NEW)

```typescript
import * as assert from 'assert';
import { ChatViewProvider } from '../providers/ChatViewProvider';
import { ClaudeService } from '../engine/ClaudeService';

describe('ChatViewProvider Mode Routing', () => {
    let chatView: ChatViewProvider;

    beforeEach(() => {
        const mockService = new ClaudeService();
        chatView = new ChatViewProvider(
            /* mock URI */,
            mockService,
            '/mock/workspace'
        );
    });

    it('should route chat mode to ClaudeService', async () => {
        const sendSpy = jest.spyOn(chatView['claudeService'], 'sendMessage');

        await chatView['handleSend'](
            'test message',
            false,
            {},
            'chat',
            1,
            'manual'
        );

        assert(sendSpy.called);
    });

    it('should route plan mode to ModeDispatcher', async () => {
        const planSpy = jest.spyOn(chatView['modeDispatcher'], 'handlePlanMode');

        await chatView['handleSend'](
            'test message',
            false,
            {},
            'plan',
            1,
            'manual'
        );

        assert(planSpy.called);
    });
});
```

---

## Implementation Checklist

- [ ] Copy WebviewMessages.ts to `src/types/`
- [ ] Update ChatViewProvider constructor
- [ ] Add setupEventListeners() method
- [ ] Update handleMessage() switch
- [ ] Update handleSend() signature and routing
- [ ] Update dispose() method
- [ ] Export FileContext interface
- [ ] Create ModeDispatcher stub in `src/modes/`
- [ ] Update App.tsx postMessage call
- [ ] Add mode state variables to App.tsx
- [ ] Add message handlers to App.tsx
- [ ] Write unit tests
- [ ] Integration test with existing chat mode
- [ ] Document changes

---

**Status:** Ready for Implementation
**Owner:** AR2 - Service Integration Architect
**Date:** 2025-12-07
