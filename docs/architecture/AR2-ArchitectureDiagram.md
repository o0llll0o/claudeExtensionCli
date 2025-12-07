# AR2 Service Integration - Architecture Diagrams

## Component Architecture

```mermaid
graph TB
    subgraph "Webview UI"
        AppTsx[App.tsx]
        PlanView[PlanView Component]
        ReviewView[ReviewView Component]
        SwarmStatus[SwarmStatus Component]
    end

    subgraph "VS Code Extension"
        ChatView[ChatViewProvider]
        ModeDispatcher[ModeDispatcher]
        ClaudeService[ClaudeService]
        Orchestrator[SubagentOrchestrator]
        WorktreeManager[GitWorktreeManager]
    end

    subgraph "Agents (Child Processes)"
        Planner[Planner Agent]
        Coder[Coder Agent]
        Verifier[Verifier Agent]
    end

    AppTsx -->|postMessage| ChatView
    ChatView -->|event listeners| AppTsx
    ChatView -->|mode routing| ModeDispatcher
    ChatView -->|chat mode| ClaudeService
    ModeDispatcher -->|spawn agents| Orchestrator
    Orchestrator -->|create worktree| WorktreeManager
    Orchestrator -->|spawn CLI| Planner
    Orchestrator -->|spawn CLI| Coder
    Orchestrator -->|spawn CLI| Verifier
    ModeDispatcher -->|emit events| ChatView
    Orchestrator -->|emit events| ModeDispatcher

    style ModeDispatcher fill:#10b981,stroke:#0d9668,stroke-width:3px
    style ChatView fill:#34d399,stroke:#10b981,stroke-width:2px
    style Orchestrator fill:#6ee7b7,stroke:#10b981,stroke-width:2px
```

## Message Flow - Plan Mode

```mermaid
sequenceDiagram
    actor User
    participant UI as App.tsx
    participant CV as ChatViewProvider
    participant MD as ModeDispatcher
    participant ORC as Orchestrator
    participant P as Planner
    participant C as Coder
    participant V as Verifier

    User->>UI: Send with mode='plan'
    UI->>CV: postMessage({type:'send', mode:'plan'})
    CV->>MD: handlePlanMode(request)
    MD->>ORC: createTask(taskId)
    ORC-->>MD: worktreeSession
    MD->>CV: emit('swarm_init')
    CV->>UI: postMessage({type:'swarm_init'})
    UI-->>User: Show "Initializing swarm..."

    MD->>ORC: runAgent({role:'planner'})
    ORC->>P: spawn claude CLI
    P-->>ORC: stream output
    ORC->>MD: emit('chunk')
    MD->>CV: emit('agent_update')
    CV->>UI: postMessage({type:'agent_update'})
    UI-->>User: "Planner analyzing..."

    P-->>ORC: plan JSON
    ORC-->>MD: AgentResponse with plan
    MD->>CV: emit('plan_ready')
    CV->>UI: postMessage({type:'plan_ready'})
    UI-->>User: Show plan with "Approve" button

    User->>UI: Click "Approve"
    UI->>CV: postMessage({type:'approvePlan'})
    CV->>MD: approvePlan(taskId)
    MD->>ORC: executePlan(plan)

    loop For each step
        ORC->>C: spawn coder
        C-->>ORC: code implementation
        ORC->>MD: emit('step_update', in_progress)
        MD->>CV: forward
        CV->>UI: postMessage({type:'step_update'})
        UI-->>User: "Step 1/N: Implementing..."

        ORC->>V: spawn verifier
        V-->>ORC: review result
        ORC->>MD: emit('review_result')
        MD->>CV: forward
        CV->>UI: postMessage({type:'review_result'})
        UI-->>User: "Review: PASS ✓"

        ORC->>MD: emit('step_update', completed)
        MD->>CV: forward
        CV->>UI: postMessage({type:'step_update'})
    end

    UI-->>User: "All steps completed!"
```

## Event Flow

```mermaid
graph LR
    subgraph "Event Sources"
        ORC_CHUNK[Orchestrator.emit<br/>'chunk']
        ORC_STEP[Orchestrator.emit<br/>'step']
        MD_PLAN[ModeDispatcher.emit<br/>'plan_ready']
        MD_AGENT[ModeDispatcher.emit<br/>'agent_update']
        MD_REVIEW[ModeDispatcher.emit<br/>'review_result']
    end

    subgraph "Event Listeners (ChatViewProvider)"
        LISTEN_CHUNK[on 'chunk']
        LISTEN_STEP[on 'step']
        LISTEN_PLAN[on 'plan_ready']
        LISTEN_AGENT[on 'agent_update']
        LISTEN_REVIEW[on 'review_result']
    end

    subgraph "Webview Messages"
        POST_PLAN[postMessage<br/>plan_ready]
        POST_STEP[postMessage<br/>step_update]
        POST_AGENT[postMessage<br/>agent_update]
        POST_REVIEW[postMessage<br/>review_result]
    end

    ORC_CHUNK --> LISTEN_CHUNK
    ORC_STEP --> LISTEN_STEP
    MD_PLAN --> LISTEN_PLAN
    MD_AGENT --> LISTEN_AGENT
    MD_REVIEW --> LISTEN_REVIEW

    LISTEN_CHUNK --> MD_AGENT
    LISTEN_STEP --> POST_STEP
    LISTEN_PLAN --> POST_PLAN
    LISTEN_AGENT --> POST_AGENT
    LISTEN_REVIEW --> POST_REVIEW

    POST_PLAN --> UI[App.tsx]
    POST_STEP --> UI
    POST_AGENT --> UI
    POST_REVIEW --> UI

    style LISTEN_CHUNK fill:#34d399
    style LISTEN_STEP fill:#34d399
    style LISTEN_PLAN fill:#34d399
    style LISTEN_AGENT fill:#34d399
    style LISTEN_REVIEW fill:#34d399
```

## Mode Routing Decision Tree

```mermaid
graph TD
    START[User sends message] --> RECV[ChatViewProvider.handleSend]
    RECV --> CHECK_MODE{mode?}

    CHECK_MODE -->|chat| CLAUDE[ClaudeService.sendMessage]
    CHECK_MODE -->|plan| PLAN[ModeDispatcher.handlePlanMode]
    CHECK_MODE -->|review| REVIEW[ModeDispatcher.handleReviewMode]
    CHECK_MODE -->|brainstorm| BRAIN[ModeDispatcher.handleBrainstormMode]

    CLAUDE --> END1[Stream to UI]

    PLAN --> PLANNER[Spawn Planner]
    PLANNER --> PLAN_GEN[Generate Plan]
    PLAN_GEN --> APPROVAL{requiresApproval?}
    APPROVAL -->|manual| WAIT[Wait for user]
    APPROVAL -->|auto| AUTO_EXEC[Auto execute]
    APPROVAL -->|skip| AUTO_EXEC
    WAIT --> USER_CHOICE{User action?}
    USER_CHOICE -->|approve| AUTO_EXEC
    USER_CHOICE -->|reject| CANCEL[Cancel task]
    AUTO_EXEC --> EXEC[Execute plan steps]
    EXEC --> END2[Complete]
    CANCEL --> END2

    REVIEW --> SPAWN_V[Spawn Verifier]
    SPAWN_V --> ANALYZE[Analyze code]
    ANALYZE --> FINDINGS[Return findings]
    FINDINGS --> END3[Show review]

    BRAIN --> MULTI[Spawn N planners]
    MULTI --> COLLECT[Collect ideas]
    COLLECT --> MERGE[Merge results]
    MERGE --> END4[Present options]

    style CHECK_MODE fill:#10b981
    style APPROVAL fill:#fbbf24
    style USER_CHOICE fill:#fbbf24
```

## Class Diagram

```mermaid
classDiagram
    class ChatViewProvider {
        -view: WebviewView
        -claudeService: ClaudeService
        -modeDispatcher: ModeDispatcher
        -orchestrator: SubagentOrchestrator
        -worktreeManager: GitWorktreeManager
        +handleMessage(message)
        +handleSend(text, mode, ...)
        -setupEventListeners()
        -postMessage(message)
    }

    class ModeDispatcher {
        -claudeService: ClaudeService
        -orchestrator: SubagentOrchestrator
        -activeTasks: Map
        +handlePlanMode(request)
        +handleReviewMode(request)
        +handleBrainstormMode(request)
        +approvePlan(taskId)
        +rejectPlan(taskId)
        +cancelTask(taskId)
        +handleChunk(taskId, role, content)
    }

    class SubagentOrchestrator {
        -worktreeManager: GitWorktreeManager
        -activeProcesses: Map
        +createTask(taskId)
        +runAgent(request)
        +executePlan(plan)
        +stopTask(taskId)
    }

    class GitWorktreeManager {
        -basePath: string
        +create(taskId)
        +cleanup(taskId)
    }

    class ClaudeService {
        +sendMessage(prompt, options)
        +stop()
    }

    ChatViewProvider --> ModeDispatcher : uses
    ChatViewProvider --> SubagentOrchestrator : uses
    ChatViewProvider --> GitWorktreeManager : uses
    ChatViewProvider --> ClaudeService : uses
    ModeDispatcher --> ClaudeService : delegates chat
    ModeDispatcher --> SubagentOrchestrator : spawns agents
    SubagentOrchestrator --> GitWorktreeManager : creates worktrees
    ModeDispatcher ..|> EventEmitter : extends
    SubagentOrchestrator ..|> EventEmitter : extends
```

## Data Flow - Agent Spawning

```mermaid
graph TD
    START[ModeDispatcher.handlePlanMode] --> GEN_ID[Generate taskId]
    GEN_ID --> EMIT_INIT[emit 'swarm_init']
    EMIT_INIT --> CREATE_WT[orchestrator.createTask]
    CREATE_WT --> WORKTREE[GitWorktreeManager.create]
    WORKTREE --> WT_PATH[Get worktree path]
    WT_PATH --> SPAWN_P[orchestrator.runAgent<br/>role='planner']

    SPAWN_P --> BUILD_CMD[Build claude CLI command]
    BUILD_CMD --> EXEC[spawn 'claude' process]
    EXEC --> STDIN[Write prompt to stdin]
    STDIN --> STREAM[Stream stdout]
    STREAM --> PARSE[Parse JSON events]
    PARSE --> BUFFER[Buffer assistant content]
    BUFFER --> EMIT_CHUNK[emit 'chunk']
    EMIT_CHUNK --> MD_HANDLE[ModeDispatcher.handleChunk]
    MD_HANDLE --> EMIT_AGENT[emit 'agent_update']

    BUFFER --> COMPLETE{Process exit?}
    COMPLETE -->|yes| EXTRACT[Extract plan JSON]
    EXTRACT --> VALIDATE{Valid plan?}
    VALIDATE -->|yes| EMIT_PLAN[emit 'plan_ready']
    VALIDATE -->|no| EMIT_ERROR[emit 'error']

    EMIT_PLAN --> CV[ChatViewProvider listener]
    CV --> WEBVIEW[postMessage to webview]
    WEBVIEW --> UI[App.tsx updates UI]

    style EMIT_INIT fill:#10b981
    style EMIT_CHUNK fill:#34d399
    style EMIT_AGENT fill:#34d399
    style EMIT_PLAN fill:#10b981
    style EMIT_ERROR fill:#ef4444
```

## Error Handling Flow

```mermaid
graph TD
    ERROR[Error Occurs] --> TYPE{Error Type?}

    TYPE -->|Planner fails| P_ERR[planner_error]
    TYPE -->|Coder fails| C_ERR[coder_error]
    TYPE -->|Verifier fails| V_ERR[verifier_error]
    TYPE -->|System error| S_ERR[system_error]

    P_ERR --> RECOVER1{Recoverable?}
    C_ERR --> RECOVER2{Recoverable?}
    V_ERR --> RECOVER3{Recoverable?}
    S_ERR --> RECOVER4{Recoverable?}

    RECOVER1 -->|yes| EMIT_WARN[emit 'error' with retry suggestion]
    RECOVER1 -->|no| EMIT_FATAL[emit 'error' + fallback to chat]

    RECOVER2 -->|yes| MARK_FAILED[Mark step as 'failed']
    RECOVER2 -->|no| CANCEL[Cancel entire task]

    RECOVER3 -->|yes| RETRY_V[Allow manual retry]
    RECOVER3 -->|no| CANCEL

    RECOVER4 -->|no| CANCEL

    EMIT_WARN --> UI_RETRY[Show retry button]
    EMIT_FATAL --> UI_FALLBACK[Switch to chat mode]
    MARK_FAILED --> UI_STEP[Highlight failed step]
    CANCEL --> CLEANUP[Clean up worktree]
    CLEANUP --> UI_CANCEL[Show cancellation message]

    style EMIT_FATAL fill:#ef4444
    style CANCEL fill:#ef4444
    style CLEANUP fill:#fbbf24
```

## State Machine - Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Planning: handlePlanMode()
    Planning --> AwaitingApproval: plan_ready
    Planning --> Failed: planner_error

    AwaitingApproval --> Executing: approvePlan()
    AwaitingApproval --> Cancelled: rejectPlan()

    Executing --> Executing: step_update (in_progress)
    Executing --> ReviewingStep: coder_complete
    ReviewingStep --> Executing: review_pass → next step
    ReviewingStep --> StepFailed: review_fail

    StepFailed --> Executing: retryStep()
    StepFailed --> Cancelled: cancelTask()

    Executing --> Completed: all steps done
    Failed --> [*]
    Cancelled --> [*]
    Completed --> [*]

    note right of AwaitingApproval
        permissionMode='manual'
        requires user approval
    end note

    note right of Executing
        permissionMode='auto'
        auto-executes plan
    end note
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "User Machine"
        subgraph "VS Code Extension Host"
            EXT[Extension Process]
            CV[ChatViewProvider]
            MD[ModeDispatcher]
            ORC[Orchestrator]
        end

        subgraph "VS Code Webview"
            UI[App.tsx React App]
        end

        subgraph "File System"
            WORKSPACE[Workspace Folder]
            WORKTREE1[.worktrees/task-1]
            WORKTREE2[.worktrees/task-2]
        end

        subgraph "Child Processes"
            CLI1[claude CLI - Planner]
            CLI2[claude CLI - Coder]
            CLI3[claude CLI - Verifier]
        end
    end

    subgraph "Anthropic API"
        CLAUDE_API[Claude API]
    end

    UI <-->|postMessage| CV
    CV --> MD
    MD --> ORC
    ORC -->|spawn| CLI1
    ORC -->|spawn| CLI2
    ORC -->|spawn| CLI3
    CLI1 --> CLAUDE_API
    CLI2 --> CLAUDE_API
    CLI3 --> CLAUDE_API
    ORC -->|create| WORKTREE1
    ORC -->|create| WORKTREE2
    CLI1 -.->|cwd| WORKTREE1
    CLI2 -.->|cwd| WORKTREE2

    style MD fill:#10b981
    style ORC fill:#6ee7b7
    style CLAUDE_API fill:#7c3aed
```

---

**Document Status:** Complete
**Created By:** AR2 - Service Integration Architect
**Date:** 2025-12-07
