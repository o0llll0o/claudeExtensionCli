# Architecture Feasibility Report
## Claude CLI Extension - Proposed Enhancements

**Date:** 2025-12-07  
**Analyzed Components:** ClaudeService, Extension Core, React UI, DiffManager

---

## 1. Git Worktree Support

### Current State
- **File System Interactions:** `src/providers/ChatViewProvider.ts` and `src/diff/DiffManager.ts`
  - Uses Node.js `fs` module for file operations (line 3, DiffManager.ts)
  - Uses `path` module for path resolution
  - Workspace folder detection: `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`
  
- **Git Integration:** **NONE DETECTED**
  - No existing git-related imports or functionality
  - No version control awareness in current codebase

### Technical Analysis

**`child_process` Usage:**
- Currently used in `ClaudeService.ts` (line 1):
  ```typescript
  import { spawn, ChildProcess } from 'child_process';
  ```
- Successfully spawns `claude` CLI process (line 71-78)
- Platform-aware process handling (Windows `taskkill` support, line 189)

**Git Availability:**
- Git version detected: `2.50.1.windows.1`
- Git worktree support confirmed (tested `git worktree list`)

### Feasibility: **HIGH (90%)**

**Can Implement:**
- Parallel worktree creation via `spawn('git', ['worktree', 'add', ...])`
- Worktree cleanup and management
- Isolated workspace environments per subagent

**Requirements:**
1. **New Service Class:** `GitWorktreeManager.ts`
   - Methods: `createWorktree()`, `removeWorktree()`, `listWorktrees()`
   - Integration point: `src/extension.ts` activation
   
2. **Refactoring Needed:**
   - `ChatViewProvider.ts` (line 8): Update workspace folder resolution to support dynamic worktree switching
   - `DiffManager.ts` (line 52-60): Enhance path resolution for multi-worktree scenarios

**Blockers:** None identified

---

## 2. Subagent Orchestration

### Current State

**Claude CLI Invocation:**
- Single instance model: `ClaudeService.ts` (line 36):
  ```typescript
  private process: ChildProcess | null = null;
  ```
- Stops previous process before new spawn (line 48)

**CLI Capabilities (from `--help`):**
- **Model Switching:** ✅ `--model <model>` flag (line 68 in ClaudeService)
  - Aliases: `sonnet`, `opus`, `haiku`
  - Full names: `claude-sonnet-4-5-20250929`
- **Agent Support:** ✅ `--agent <agent>` flag
  - Custom agents via `--agents <json>` flag
- **Session Management:** ✅ `--session-id <uuid>` for conversation isolation
- **Parallel Execution:** ✅ Multiple `spawn()` calls supported by Node.js

### Technical Analysis

**Multiple Instance Support:**
```typescript
// Current: Single service instance in extension.ts (line 5)
let claudeService: ClaudeService | undefined;

// Proposed: Service pool pattern
class SubagentPool {
    private agents: Map<string, ClaudeService> = new Map();
    
    spawn(agentId: string, model: string, workdir: string): ClaudeService {
        const service = new ClaudeService(workdir);
        this.agents.set(agentId, service);
        return service;
    }
}
```

**Model Configuration:**
Already implemented in `ClaudeService.sendMessage()` (line 67-69):
```typescript
if (options.model) {
    args.push('--model', options.model);
}
```

### Feasibility: **VERY HIGH (95%)**

**Can Implement:**
- Spawn multiple `ClaudeService` instances concurrently
- Dynamically assign models (Haiku/Sonnet/Opus) via CLI flags
- Session isolation using `--session-id` flag
- Agent-specific system prompts via `--system-prompt`

**Requirements:**
1. **New Orchestrator Class:** `SubagentOrchestrator.ts`
   - Manages lifecycle of multiple ClaudeService instances
   - Coordinates task distribution
   - Aggregates results from parallel agents
   
2. **Extension to ClaudeService:**
   - Add `sessionId` parameter to constructor
   - Support `--agent` and `--agents` CLI flags
   - Implement event aggregation for multi-agent streaming

**Refactoring Needed:**
- `extension.ts`: Replace singleton service with orchestrator
- `ChatViewProvider.ts`: Route messages to appropriate agent instance

**Blockers:** None identified

---

## 3. UI/UX Enhancements

### Current State

**React Architecture:** `src/webview/App.tsx`
- **Component Structure:**
  - Main `App` component (line 375-694)
  - Subcomponents: `WelcomeScreen`, `ModelSelector`, `UltrathinkToggle`, `CodeBlock`, `MessageContent`
  - State management via React hooks (line 376-392)

- **Existing UI Panels:**
  - Main chat container (line 542-599)
  - Input bar with context controls (line 601-691)
  - Welcome screen (line 281-298)

**Styling System:**
- Verdent Dark Theme (line 700-1213)
- Inline CSS-in-JS styles object
- Component-level styling with color constants

### Technical Analysis

**Component Integration Points:**

1. **Planner Component Location:**
   - **Option A:** New tab in `viewsContainers` (package.json line 16-23)
     ```json
     {
       "id": "claudeAssistant.plannerView",
       "name": "Planner"
     }
     ```
   - **Option B:** Collapsible panel in existing chat view (above messages)
   - **Option C:** Side-by-side split with existing chat

2. **DiffLens Component Location:**
   - **Recommended:** Integrated into `CodeBlock` component (line 177-215)
   - Current actions: Copy, Insert, Apply (line 198-208)
   - **Add:** "View Diff" button triggering inline diff view

**State Management Needs:**
```typescript
// New state required in App.tsx
const [plannerTasks, setPlannerTasks] = useState<Task[]>([]);
const [activeAgents, setActiveAgents] = useState<AgentStatus[]>([]);
const [diffPreviews, setDiffPreviews] = useState<Map<string, DiffData>>(new Map());
```

### Feasibility: **HIGH (85%)**

**Can Implement:**
- Planner component as new webview panel
- DiffLens overlay for code preview
- Real-time agent status indicators
- Task progress visualization

**Requirements:**

1. **New Components:**
   - `PlannerView.tsx` (200-300 lines)
     - Task list with status badges
     - Agent assignment UI
     - Dependency graph visualization (optional: use React Flow)
   
   - `DiffLens.tsx` (150-200 lines)
     - Inline diff viewer (leverage existing DiffManager)
     - Accept/Reject actions
     - Multi-file diff queue

2. **Refactoring Needed:**
   - `App.tsx`: Split into smaller components for maintainability
     - Extract message list → `MessageList.tsx`
     - Extract input area → `InputPanel.tsx`
   
   - `package.json`: Add new view container definitions

3. **Message Protocol Extension:**
   - `ChatViewProvider.ts` (line 44-94): Add handlers for:
     - `planner:updateTasks`
     - `diff:showPreview`
     - `agent:statusUpdate`

**Challenges:**
- **Layout Management:** Existing flex layout may need restructuring for side panels
- **State Synchronization:** React webview ↔ Extension backend communication latency
- **Verdent Theme Consistency:** New components must match existing design system

**Recommended Approach:**
- **Phase 1:** Add Planner as separate view (minimal refactoring)
- **Phase 2:** Integrate DiffLens into CodeBlock (medium refactoring)
- **Phase 3:** Unified dashboard view (major refactoring)

**Blockers:** None critical, but consider using Context API or Zustand for complex state

---

## 4. Summary Matrix

| Feature | Feasibility | New Components | Refactor Needed | Rewrite Needed | Risk |
|---------|-------------|----------------|-----------------|----------------|------|
| **Git Worktree** | 90% | GitWorktreeManager | ChatViewProvider, DiffManager | None | Low |
| **Subagent Orchestration** | 95% | SubagentOrchestrator | extension.ts, ClaudeService | None | Low |
| **Planner UI** | 85% | PlannerView.tsx | App.tsx (split), package.json | None | Medium |
| **DiffLens UI** | 85% | DiffLens.tsx | CodeBlock component | None | Low |

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Low Risk, High Value**
1. Create `GitWorktreeManager.ts`
2. Create `SubagentOrchestrator.ts`
3. Extend `ClaudeService` with session ID support
4. Unit tests for new services

**Files Created:** 2  
**Files Modified:** 3 (extension.ts, ClaudeService.ts, ChatViewProvider.ts)

### Phase 2: Backend Integration (Week 2-3)
**Medium Risk**
1. Integrate worktree manager into extension activation
2. Replace singleton ClaudeService with orchestrator pool
3. Implement multi-agent message routing
4. Add agent lifecycle management

**Files Created:** 0  
**Files Modified:** 4 (extension.ts, ChatViewProvider.ts, ClaudeService.ts, DiffManager.ts)

### Phase 3: UI Components (Week 3-4)
**Medium Risk**
1. Create `PlannerView.tsx` with basic task list
2. Add view container to package.json
3. Implement webview ↔ extension messaging for planner
4. Create `DiffLens.tsx` inline preview

**Files Created:** 2  
**Files Modified:** 3 (App.tsx, package.json, ChatViewProvider.ts)

### Phase 4: Polish & Integration (Week 4-5)
**Low Risk**
1. Integrate DiffLens into CodeBlock
2. Add real-time agent status to Planner
3. Implement task progress tracking
4. Theme consistency pass for new components

**Files Created:** 0  
**Files Modified:** 4 (App.tsx, PlannerView.tsx, DiffLens.tsx, CodeBlock component)

---

## 6. Technical Recommendations

### Architecture Decisions

**1. Service Layer (Backend)**
```
src/
├── engine/
│   ├── ClaudeService.ts         [EXTEND - add session support]
│   ├── SubagentOrchestrator.ts  [NEW - agent pool manager]
│   └── GitWorktreeManager.ts    [NEW - worktree lifecycle]
├── providers/
│   └── ChatViewProvider.ts      [REFACTOR - multi-agent routing]
```

**2. UI Layer (Frontend)**
```
src/webview/
├── App.tsx                  [REFACTOR - split into smaller components]
├── components/
│   ├── MessageList.tsx      [NEW - extracted from App]
│   ├── InputPanel.tsx       [NEW - extracted from App]
│   ├── PlannerView.tsx      [NEW - task orchestration UI]
│   └── DiffLens.tsx         [NEW - inline diff preview]
```

**3. State Management**
- **Current:** Local React state (sufficient for small apps)
- **Recommended:** Add Zustand (4KB) for cross-component state if planner grows complex
- **Alternative:** React Context API (no new deps)

### Risk Mitigation

**High Priority Risks:**
1. **Worktree Conflicts:** Implement locking mechanism to prevent concurrent modifications
2. **Process Leaks:** Ensure all spawned agents are tracked and cleaned up on extension deactivate
3. **UI State Desync:** Use message acknowledgment pattern for critical updates

**Testing Strategy:**
- Unit tests for GitWorktreeManager (mock `spawn`)
- Integration tests for SubagentOrchestrator (test parallel execution)
- E2E tests for Planner UI (VS Code extension test framework)

---

## 7. Final Verdict

**Overall Feasibility: 88% (Very High)**

**Greenlight Recommendations:**
✅ Proceed with all proposed features  
✅ Existing architecture supports extensions without major rewrites  
✅ Node.js `child_process` and Git CLI provide all necessary primitives  
✅ React component structure is modular and extensible  

**Cautions:**
⚠️ UI complexity may require state management library beyond Phase 3  
⚠️ Thorough process cleanup logic critical to avoid resource leaks  
⚠️ Consider VS Code API rate limits for rapid worktree operations  

**Next Steps:**
1. Approve roadmap phases
2. Create feature branches for Phase 1 work
3. Set up integration test infrastructure
4. Begin implementation of `GitWorktreeManager.ts`
