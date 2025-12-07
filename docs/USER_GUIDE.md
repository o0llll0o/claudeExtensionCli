# Autonomous Agent User Guide

**Version:** 0.2.0
**Date:** 2025-12-07
**Platform:** VS Code Extension - Claude Assistant

---

## Table of Contents

1. [Getting Started with Autonomous Agents](#1-getting-started-with-autonomous-agents)
2. [Retry Configuration Guide](#2-retry-configuration-guide)
3. [Tool Execution Monitoring](#3-tool-execution-monitoring)
4. [Agent Debate System](#4-agent-debate-system)
5. [UI Features Guide](#5-ui-features-guide)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Getting Started with Autonomous Agents

### What are Autonomous Agents?

Autonomous agents are AI-powered assistants that work independently to complete coding tasks. The Claude Assistant extension uses a Level 4 Agent Orchestration system where multiple specialized agents collaborate to:

- Plan complex implementations
- Write production-ready code
- Review and critique solutions
- Execute tests and validations
- Reach consensus through structured debates

### Key Concepts

#### Agent Roles

The system includes several specialized agent types:

- **Planner Agent**: Breaks down complex tasks into actionable steps
- **Coder Agent**: Implements code based on plans and specifications
- **Verifier/Tester Agent**: Validates implementations and runs tests
- **Reviewer Agent**: Critiques code quality and suggests improvements
- **Architect Agent**: Resolves complex design decisions when agents can't reach consensus

#### Operational Modes

**Chat Mode** (Default)
- Traditional conversational interaction
- Single Claude instance responds to queries
- Best for: Quick questions, exploratory coding

**Plan Mode**
- Agent generates execution plan before implementation
- User approves/rejects plan
- Steps execute sequentially with status updates
- Best for: Well-defined features, multi-step tasks

**Review Mode**
- Code undergoes structured review process
- Multiple agents critique implementation
- Verdict: PASS or FAIL with detailed findings
- Best for: Quality assurance, pre-commit reviews

**Brainstorm Mode**
- Multiple sub-agents simulate parallel perspectives
- Configurable swarm density (1-12 agents)
- Synthesizes diverse solutions
- Best for: Architecture decisions, creative problem-solving

### How Retry Logic Improves Reliability

Autonomous agents operate with intelligent retry mechanisms that automatically recover from transient failures:

**Automatic Recovery**
- Network timeouts
- File system locks (EBUSY)
- Rate limiting (429, 503 errors)
- Temporary API unavailability

**Configurable Strategies**
- Exponential backoff: Delay doubles with each retry (default)
- Linear backoff: Delay increases steadily
- Fixed backoff: Constant delay between retries

**Benefits**
- Reduces manual intervention by 80%+
- Handles transient cloud/network issues
- Prevents task failures from temporary problems
- Provides transparency with visual progress indicators

### Understanding Tool Execution Feedback

Every action an agent takes is visible through the tool execution feedback system:

**Tool Categories**
- **File Operations**: Read, Write, Edit, Glob, Grep
- **Terminal Commands**: Bash execution with output capture
- **Git Operations**: Commit, branch, worktree management
- **Workspace Operations**: Search, navigation, indexing

**Status Indicators**
- Pending: Tool queued for execution
- Running: Actively executing
- Done: Successfully completed
- Error: Execution failed (may trigger retry)

**Execution Metadata**
- Duration: Milliseconds elapsed
- Input Parameters: Arguments passed to tool
- Output: Result data or error messages
- Retry State: Current attempt, max attempts, backoff delay

---

## 2. Retry Configuration Guide

### Default Retry Policies

#### Standard Agent Policy
```typescript
{
  maxAttempts: 3,
  backoffType: 'exponential',
  baseDelayMs: 1000,      // 1 second
  maxDelayMs: 30000,      // 30 seconds
  retryableErrors: [],    // All errors retryable
  jitter: true            // ±10% randomization
}
```

**Use when:** General agent operations, balanced reliability

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: ~2 seconds (2^1 × 1000ms + jitter)
- Attempt 3: ~4 seconds (2^2 × 1000ms + jitter)

#### Aggressive Policy
```typescript
{
  maxAttempts: 5,
  backoffType: 'linear',
  baseDelayMs: 500,       // 500ms
  maxDelayMs: 30000,
  retryableErrors: [
    'timeout', 'ETIMEDOUT', 'ECONNRESET',
    'network', 'rate limit', '429', '503', '504'
  ],
  jitter: true
}
```

**Use when:** Critical operations, external API calls

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: ~500ms (1 × 500ms)
- Attempt 3: ~1000ms (2 × 500ms)
- Attempt 4: ~1500ms (3 × 500ms)
- Attempt 5: ~2000ms (4 × 500ms)

#### Conservative Policy
```typescript
{
  maxAttempts: 2,
  backoffType: 'fixed',
  baseDelayMs: 2000,      // 2 seconds
  maxDelayMs: 30000,
  retryableErrors: [
    'ETIMEDOUT', 'ECONNRESET', '503', '504'
  ],
  jitter: false           // No randomization
}
```

**Use when:** Non-critical operations, quick failures preferred

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: Exactly 2 seconds

### When to Use Each Backoff Strategy

#### Exponential Backoff (Recommended)
```
Best for: Most scenarios
Pros: Rapidly backs off, prevents server overload
Cons: May wait longer than necessary
Delay Pattern: 1s → 2s → 4s → 8s → 16s
```

**Ideal scenarios:**
- External API calls (GitHub, package registries)
- Database queries
- Network requests
- Any operation that might be throttled

#### Linear Backoff
```
Best for: Predictable retry intervals
Pros: Consistent delays, easier to reason about
Cons: May retry too quickly under load
Delay Pattern: 1s → 2s → 3s → 4s → 5s
```

**Ideal scenarios:**
- File system operations (waiting for lock release)
- Local resource contention
- Queue-based operations

#### Fixed Backoff
```
Best for: Time-sensitive operations
Pros: Simple, predictable, fast recovery
Cons: May overwhelm systems under load
Delay Pattern: 2s → 2s → 2s → 2s → 2s
```

**Ideal scenarios:**
- Quick health checks
- Non-critical background tasks
- Operations with strict time budgets

### Setting Appropriate Max Attempts

**2 Attempts** - Conservative
- Non-critical operations
- User-facing UI updates
- Quick validation checks
- Acceptable failure rate: 5-10%

**3 Attempts** - Standard (Default)
- General agent operations
- File I/O operations
- Most API calls
- Acceptable failure rate: 1-2%

**5 Attempts** - Aggressive
- Critical workflows
- Payment/transaction operations
- Data persistence operations
- Acceptable failure rate: <0.1%

**10+ Attempts** - Persistent
- Health checks
- Service discovery
- Background sync operations
- Failure not acceptable

### Custom Retryable Error Patterns

The retry system supports regex patterns to match specific errors:

#### Common Pattern Examples

**Network Errors**
```typescript
retryableErrors: [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'socket hang up'
]
```

**HTTP Status Codes**
```typescript
retryableErrors: [
  '429',     // Rate limited
  '500',     // Internal server error
  '502',     // Bad gateway
  '503',     // Service unavailable
  '504'      // Gateway timeout
]
```

**File System Errors**
```typescript
retryableErrors: [
  'EBUSY',   // Resource busy
  'EAGAIN',  // Try again
  'EACCES',  // Permission denied (may resolve)
  'EMFILE'   // Too many open files
]
```

**API-Specific Patterns (Regex)**
```typescript
retryableErrors: [
  'rate limit exceeded',
  'temporary failure',
  'try again later',
  'quota exceeded',
  'service temporarily unavailable'
]
```

#### Custom Policy Example

```typescript
// Retry policy for GitHub API operations
const githubApiPolicy = {
  maxAttempts: 5,
  backoffType: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 60000,  // Up to 1 minute
  retryableErrors: [
    '403',              // Forbidden (rate limit)
    '429',              // Too many requests
    '502',              // Bad gateway
    'rate limit',       // API message
    'abuse detection'   // API message
  ],
  jitter: true,
  onRetry: (attempt, error, nextDelay) => {
    console.log(`GitHub API retry ${attempt}, waiting ${nextDelay}ms`);
    console.log(`Error: ${error.message}`);
  }
};
```

### Jitter: Why Randomization Matters

**Without Jitter** (Thundering Herd Problem)
```
Multiple agents retry simultaneously:
Time 0s:  All fail
Time 2s:  All retry → Server overloaded → All fail
Time 4s:  All retry → Server overloaded → All fail
Time 8s:  All retry → Server overloaded → All fail
```

**With Jitter** (Staggered Retries)
```
Agents retry at different times:
Time 0s:  All fail
Time 2s:  Agents retry between 1.8s-2.2s (±10%)
        → Load distributed → Some succeed
Time 4s:  Remaining retry between 3.6s-4.4s
        → More succeed
```

**Key Benefits:**
- Prevents synchronized retry storms
- Reduces server load spikes
- Increases overall success rate
- Standard in distributed systems (AWS, Google Cloud)

**When to Disable Jitter:**
- Single-agent scenarios
- Local operations (file system)
- Predictable testing/debugging
- Time-critical operations requiring exact delays

---

## 3. Tool Execution Monitoring

### Reading Tool Execution Feedback

The VS Code extension provides real-time visibility into every tool execution:

#### Tool Execution Card Anatomy

```
┌─────────────────────────────────────────────────┐
│ [Tool Icon] tool_name                  [Status]│
│                                                 │
│ Input Parameters:                               │
│   • param1: value1                              │
│   • param2: value2                              │
│                                                 │
│ Output:                                         │
│   Result data or error message...               │
│                                                 │
│ Duration: 1.23s                                 │
│                                                 │
│ [Retry Indicator] (if applicable)               │
└─────────────────────────────────────────────────┘
```

#### Example: Successful File Read

```
┌─────────────────────────────────────────────────┐
│ 📄 Read                                    ✓ Done│
│                                                 │
│ Input:                                          │
│   • file_path: /src/components/Header.tsx      │
│                                                 │
│ Output:                                         │
│   Successfully read 245 lines                   │
│                                                 │
│ Duration: 0.08s                                 │
└─────────────────────────────────────────────────┘
```

#### Example: File Read with Retry

```
┌─────────────────────────────────────────────────┐
│ 📄 Read                      🔄 Retry 2/3  Running│
│                                                 │
│ Input:                                          │
│   • file_path: /src/utils/config.json          │
│                                                 │
│ Previous Error:                                 │
│   ENOENT: File not found                        │
│                                                 │
│ ⏱️ Next retry in 3s                              │
└─────────────────────────────────────────────────┘
```

#### Example: Retry Success

```
┌─────────────────────────────────────────────────┐
│ 📄 Read                ✓ Retry succeeded (2/3)  │
│                                                 │
│ Input:                                          │
│   • file_path: /src/utils/config.json          │
│                                                 │
│ Output:                                         │
│   File successfully read after retry            │
│                                                 │
│ Duration: 0.12s (including 2s retry delay)      │
└─────────────────────────────────────────────────┘
```

#### Example: All Retries Exhausted

```
┌─────────────────────────────────────────────────┐
│ 🌐 Bash              ✗ All retries exhausted (3/3)│
│                                                 │
│ Input:                                          │
│   • command: npm install package-xyz            │
│                                                 │
│ Final Error:                                    │
│   Network timeout after 30s                     │
│                                                 │
│ Total Duration: 47.5s (including retries)       │
└─────────────────────────────────────────────────┘
```

### Understanding Tool Status Indicators

| Icon | Status | Meaning | Next Action |
|------|--------|---------|-------------|
| ⏳ | Pending | Tool queued for execution | Wait for agent to process |
| ▶️ | Running | Currently executing | Monitor progress |
| ✓ | Done | Successfully completed | Review output |
| ⚠️ | Error | Failed without retries | Check error message |
| 🔄 | Retry | Attempting recovery | Wait for retry completion |
| ✓🔄 | Retry Success | Recovered after retry | Review output |
| ✗🔄 | Retry Failed | All attempts exhausted | Manual intervention needed |

### Interpreting Execution Duration

**Fast Operations** (<100ms)
- File reads (small files)
- Memory operations
- Simple bash commands (echo, pwd)
- Git status checks

**Medium Operations** (100ms-1s)
- File writes
- Complex grep searches
- Git commits
- Directory operations

**Slow Operations** (1s-10s)
- Large file operations
- Bash scripts with network calls
- Git pushes
- Workspace indexing

**Very Slow Operations** (10s+)
- npm install/build
- Database migrations
- Large file transfers
- Complex test suites

**With Retries**
```
Total Duration = Initial Attempt + Σ(Retry Delay + Retry Attempt)

Example (3 attempts with exponential backoff):
Initial: 0.5s
Retry 1: 2s delay + 0.5s = 2.5s
Retry 2: 4s delay + 0.5s = 4.5s
Total: 7.5s
```

### Handling Tool Errors

#### Error Categories

**Transient Errors** (Retryable)
- Network timeouts
- Rate limits
- File system locks
- Temporary unavailability

**Permanent Errors** (Not Retryable)
- File not found (invalid path)
- Permission denied (insufficient privileges)
- Syntax errors in commands
- Invalid arguments

#### Reading Error Messages

**Network Error Example**
```
Error: ETIMEDOUT
Meaning: Network request timed out
Likely Cause: Slow connection, server overload
Resolution: Retry automatically (exponential backoff)
User Action: Wait for retry completion
```

**File System Error Example**
```
Error: ENOENT: no such file or directory
Meaning: File path doesn't exist
Likely Cause: Typo in path, file moved/deleted
Resolution: Agent may retry (file might be created)
User Action: Verify file path, check agent logic
```

**Permission Error Example**
```
Error: EACCES: permission denied
Meaning: Insufficient file system permissions
Likely Cause: File owned by another user, readonly
Resolution: May retry (permissions might change)
User Action: Grant permissions or change file ownership
```

**Rate Limit Error Example**
```
Error: 429 Too Many Requests
Meaning: API rate limit exceeded
Likely Cause: Too many requests in time window
Resolution: Retry with exponential backoff
User Action: Wait for rate limit reset (automatic)
```

### Advanced Monitoring Features

#### Expand Tool Details

Click on any tool execution card to expand full details:

```
┌─────────────────────────────────────────────────┐
│ 📄 Read                                    ✓ Done│  [Click to expand]
└─────────────────────────────────────────────────┘

                    ↓ (Expanded)

┌─────────────────────────────────────────────────┐
│ 📄 Read                                    ✓ Done│
│                                                 │
│ Full Input Parameters:                          │
│ {                                               │
│   "file_path": "/src/components/Header.tsx",   │
│   "offset": 0,                                  │
│   "limit": null,                                │
│   "encoding": "utf-8"                           │
│ }                                               │
│                                                 │
│ Full Output:                                    │
│ Successfully read 245 lines                     │
│ File size: 8.5 KB                               │
│ Encoding: utf-8                                 │
│ Last modified: 2025-12-07T10:30:00Z             │
│                                                 │
│ Execution Metadata:                             │
│   • Start: 10:30:15.123                         │
│   • End: 10:30:15.201                           │
│   • Duration: 78ms                              │
│   • Memory: 1.2 MB                              │
│                                                 │
│ Retry History: None                             │
└─────────────────────────────────────────────────┘
```

#### Filter by Status

Use the filter dropdown to show only:
- Running tools
- Failed tools
- Retry operations
- Completed tools

#### Search Tool History

Search through all tool executions:
- By tool name (Read, Write, Bash)
- By status (done, error, retry)
- By file path
- By error message

---

## 4. Agent Debate System

### How Agents Reach Consensus

The Agent Debate System enables autonomous agents to propose solutions, critique each other, and vote to reach consensus without human intervention.

#### Debate Lifecycle

**Phase 1: PROPOSE** (1-2 minutes)
```
Each agent submits a solution proposal:
  • Solution description (code, architecture, approach)
  • Reasoning behind the solution
  • Confidence score (0.0 - 1.0)

Example:
Agent-Coder: "Use Redis for caching"
  Reasoning: "Distributed, LRU eviction, proven at scale"
  Confidence: 0.85
```

**Phase 2: CRITIQUE** (2-3 minutes)
```
Agents review each other's proposals:
  • Identify flaws or concerns
  • Suggest improvements
  • Assign severity level

Example:
Agent-Reviewer → Agent-Coder:
  Criticism: "Redis adds infrastructure complexity"
  Severity: MAJOR
  Suggested Fix: "Try in-memory cache first"
```

**Phase 3: DEFEND** (1-2 minutes)
```
Authors defend their proposals:
  • Address critiques
  • Modify proposal if needed
  • Explain reasoning

Example:
Agent-Coder defends:
  "In-memory won't work across multiple instances.
   Redis provides session persistence needed for
   horizontal scaling."
  Proposal Modified: No
```

**Phase 4: VOTE** (30 seconds - 1 minute)
```
All agents vote for best proposal:
  • Vote weight (typically 1 per agent)
  • Justification (optional)
  • Cannot vote for proposals with unresolved blocking critiques

Example:
Agent-Reviewer votes for Agent-Coder's proposal:
  Weight: 1
  Justification: "Defense addresses concerns, scaling argument valid"
```

**Phase 5: RESOLVE**
```
System determines consensus:
  • 2/3 supermajority required (e.g., 3 of 4 agents)
  • Winning proposal selected
  • OR: Start new round if no consensus
  • OR: Escalate to Architect after 3 rounds
```

### Understanding Critique Severity Levels

#### Minor Severity
```
Impact: Low
Blocking: No (voting can proceed)
Examples:
  • Code style suggestions
  • Performance micro-optimizations
  • Documentation improvements
  • Variable naming

Response Required: Optional
Vote Impact: Minimal (proposal still viable)
```

**Example Minor Critique:**
```
From: Agent-Reviewer
To: Agent-Coder
Severity: MINOR

"Consider using const instead of let for immutable variables.
 This improves code clarity and prevents accidental reassignment."

Suggested Fix: "Replace let with const where applicable"
```

#### Major Severity
```
Impact: Medium
Blocking: No (but should be addressed)
Examples:
  • Architectural concerns
  • Maintainability issues
  • Incomplete error handling
  • Scalability limitations

Response Required: Recommended
Vote Impact: Moderate (may lose votes if unaddressed)
```

**Example Major Critique:**
```
From: Agent-Architect
To: Agent-Coder
Severity: MAJOR

"The proposed caching strategy doesn't handle cache invalidation.
 Stale data could persist indefinitely, causing data consistency issues."

Suggested Fix: "Implement TTL-based expiration or event-driven invalidation"
```

#### Blocking Severity
```
Impact: High
Blocking: YES (cannot vote for proposal until resolved)
Examples:
  • Security vulnerabilities
  • Data corruption risks
  • Critical bugs
  • Violates requirements

Response Required: MANDATORY
Vote Impact: Critical (proposal ineligible until fixed)
```

**Example Blocking Critique:**
```
From: Agent-Security
To: Agent-Coder
Severity: BLOCKING

"The API endpoint lacks authentication. This exposes sensitive user
 data to unauthorized access, violating security requirements."

Suggested Fix: "Add JWT authentication middleware to all protected routes"
```

### When Debates Escalate

Debates escalate to an Architect agent when:

**Condition 1: Maximum Rounds Exceeded** (Default: 3 rounds)
```
Round 1: Propose → Critique → Defend → Vote → No consensus
Round 2: Propose → Critique → Defend → Vote → No consensus
Round 3: Propose → Critique → Defend → Vote → No consensus
→ ESCALATE to Architect
```

**Condition 2: All Proposals Blocked**
```
Situation: Every proposal has unresolved blocking critiques
Reason: Fundamental disagreement on approach
Result: Immediate escalation (no voting possible)
```

**Condition 3: Tie in Voting**
```
Situation: Multiple proposals meet 2/3 threshold
Example: 4 agents, 2 votes each for 2 proposals
Result: Start new round OR escalate after 3 rounds
```

**Condition 4: Deadlock Detection**
```
Situation: Same proposals/critiques repeated across rounds
Indicator: No meaningful progress in 2+ rounds
Result: Automatic escalation to prevent infinite loop
```

#### Escalation Process

**Step 1: Debate Suspended**
```
Status changes to: ESCALATED
All agent operations paused
Debate history preserved
```

**Step 2: Architect Review**
```
Architect agent analyzes:
  • All proposals
  • All critiques
  • All defenses
  • Voting patterns
```

**Step 3: Architect Decision**
```
Architect can:
  • Select winning proposal (with modifications)
  • Request new proposals with specific constraints
  • Merge multiple proposals
  • Declare debate unresolvable (human intervention)
```

**Step 4: Resolution**
```
If Architect decides:
  • Debate status: CONSENSUS_REACHED
  • Winning proposal: [Architect's choice]
  • Implementation proceeds

If unresolvable:
  • Debate status: CANCELLED
  • User notification: Manual decision required
```

### Participating in Voting (Human Override)

Users can observe debates in real-time and optionally intervene:

#### View Debate Progress

Open the Debate Visualization panel to see:
- Current debate phase
- All proposals (with confidence scores)
- All critiques (color-coded by severity)
- Vote tallies (real-time updates)
- Consensus threshold indicator

#### Manual Intervention Options

**Option 1: Cancel Debate**
```
When: You disagree with debate direction
Action: Click "Cancel Debate"
Result: All agents stop, awaiting new instructions
```

**Option 2: Force Selection**
```
When: You prefer a specific proposal
Action: Click "Select Proposal" on preferred option
Result: Debate concludes, selected proposal wins
```

**Option 3: Add Constraint**
```
When: Agents missing key requirement
Action: Send message with constraint
Result: New debate round with updated context
```

**Option 4: Override with Human Vote**
```
When: Close vote needs tiebreaker
Action: Cast weighted vote (weight: 2-3)
Result: May tip consensus threshold
```

---

## 5. UI Features Guide

### Using the RetryIndicator

The RetryIndicator component provides real-time visual feedback during retry operations.

#### Visual States

**Retrying State**
```
┌─────────────────────────────────────┐
│  ⟳     Retrying...                  │
│ 2/3    (Attempt 2/3)                │
│                                     │
│ ⏱️ Next retry in 3s                 │
│                                     │
│ Error Details:                      │
│ Network timeout after 30s           │
└─────────────────────────────────────┘

Color: Amber/Yellow (#f59e0b)
Animation: Spinning icon, pulsing border
```

**Success State**
```
┌─────────────────────────────────────┐
│  ✓     Operation successful         │
│ 2/3                                 │
│                                     │
│ Recovered after 2 attempts          │
└─────────────────────────────────────┘

Color: Green (#10b981)
Animation: Check mark fade-in
```

**Exhausted State**
```
┌─────────────────────────────────────┐
│  ✗     Max retry attempts reached   │
│ 3/3                                 │
│                                     │
│ Error Details:                      │
│ Connection refused: ECONNREFUSED    │
│ [Show more...]                      │
└─────────────────────────────────────┘

Color: Red (#ef4444)
Animation: Shake effect
```

#### Circular Progress Indicator

```
Visual representation of retry progress:

  ┌───────┐
  │ ⟳ 2/3 │  ← Current/Max attempts
  └───────┘
     ↑
  Progress ring (filled 66%)
```

- **Empty (gray)**: No retries yet
- **Partially filled (yellow)**: Retrying in progress
- **Fully filled (green)**: All attempts used successfully
- **Fully filled (red)**: All attempts exhausted, failed

#### Countdown Timer

```
Shows time until next retry:

⏱️ Next retry in 3s
⏱️ Next retry in 2s
⏱️ Next retry in 1s
▶️ Retrying now...
```

- Updates every second
- Disappears when retry executes
- Accounts for jitter (may show slight variations)

#### Expandable Error Details

Long error messages are truncated by default:

**Collapsed (default)**
```
Error Details:
Connection to database failed: ECONNREFUSED 127.0.0.1:5432 - Ser...
[Show more]
```

**Expanded (after clicking "Show more")**
```
Error Details:
Connection to database failed: ECONNREFUSED 127.0.0.1:5432 - Server
is not running on localhost and accepting TCP/IP connections on port
5432. This may be caused by the PostgreSQL service not starting, a
firewall blocking the connection, or incorrect connection parameters
in the configuration file.
[Show less]
```

### Understanding Progress Visualization

#### Agent Progress Cards

Each active agent displays real-time progress:

```
┌─────────────────────────────────────────┐
│ [Icon] Agent-Coder          [Status]    │
│                                         │
│ Current Action:                         │
│ "Implementing authentication middleware"│
│                                         │
│ Progress: [████████░░] 80%              │
│                                         │
│ Tools Used: 12 Read, 5 Write, 3 Bash    │
│ Duration: 45s                           │
└─────────────────────────────────────────┘
```

**Status Colors:**
- Blue: Active/Working
- Green: Completed
- Red: Failed
- Gray: Idle/Waiting

#### Plan Execution Timeline

Plan mode shows sequential step execution:

```
Timeline View:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Step 1: Analyze requirements     [2m 30s]
✓ Step 2: Design schema            [1m 45s]
▶ Step 3: Generate migrations      [Running...]
⏳ Step 4: Write tests              [Pending]
⏳ Step 5: Deploy                   [Pending]
```

**Step States:**
- ✓ Complete (green)
- ▶ Running (blue, animated)
- ⏳ Pending (gray)
- ✗ Failed (red)
- 🔄 Retrying (yellow, pulsing)

### Expanding Tool Details

Click any tool card to reveal full execution context:

**Compact View (default)**
```
┌─────────────────────────────────┐
│ 📝 Write  ✓ Done      [Expand] │
└─────────────────────────────────┘
```

**Expanded View**
```
┌──────────────────────────────────────────────────┐
│ 📝 Write  ✓ Done                      [Collapse] │
│                                                  │
│ Input Parameters:                                │
│ {                                                │
│   "file_path": "/src/auth/middleware.ts",       │
│   "content": "import { Request, Response, ... } "│
│ }                                                │
│                                                  │
│ Output:                                          │
│ File successfully written                        │
│ 156 lines, 4.2 KB                                │
│                                                  │
│ Duration: 0.023s                                 │
│                                                  │
│ Stack Trace: (if error)                          │
│   at RetryExecutor.executeWithRetry (...)        │
│   at Agent.writeFile (...)                       │
│                                                  │
│ Retry History:                                   │
│   Attempt 1: Failed (EBUSY) at 10:30:15          │
│   Attempt 2: Success at 10:30:17                 │
└──────────────────────────────────────────────────┘
```

### Debate Visualization Walkthrough

#### Opening the Debate Panel

1. **Automatic**: Opens when agents enter debate mode
2. **Manual**: Click "View Debates" in activity bar
3. **Shortcut**: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

#### Panel Layout

```
┌────────────────────────────────────────────────────┐
│ Debate: How to implement caching?         [Status]│
│ #debate-1733584800-abc123                          │
├────────────────────────────────────────────────────┤
│                                                    │
│ Participants (4)                                   │
│ [AC] [AR] [AT] [AS]  ← Agent avatars (color-coded)│
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ Timeline:                                          │
│ ● Proposing  →  ● Critiquing  →  ● Defending  →   │
│   ● Voting  →  ○ Resolved                          │
│   (Green: complete, Blue: active, Gray: pending)   │
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ Proposals (3)                                      │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ [AC] Agent-Coder                             │  │
│ │ Solution: "Use Redis with LRU eviction"      │  │
│ │ Confidence: ████████░ 85%                    │  │
│ │ Votes: 3 🟢 CONSENSUS                        │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ [AS] Agent-Security                          │  │
│ │ Solution: "In-memory cache with encryption"  │  │
│ │ Confidence: ██████░░░ 70%                    │  │
│ │ Votes: 1                                     │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ Critiques (5)                                      │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ [AR] → [AC]                    [MAJOR]       │  │
│ │ "Redis adds infrastructure complexity"       │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ [AS] → [AC]                    [BLOCKING] 🚫 │  │
│ │ "No authentication on Redis connection"      │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ Consensus Indicator:                               │
│ Threshold: 3/4 votes (2/3 majority)                │
│ Total Votes Cast: 4                                │
│                                                    │
│ ┌────────────────────────────────────────────┐    │
│ │ Progress:  ██████████████░░░░  75%         │    │
│ │                          ↑                  │    │
│ │                    2/3 Threshold            │    │
│ └────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Interactive Elements

**Click on Agent Avatar**
- Shows agent's role and specialization
- Lists all proposals and critiques by that agent
- Vote history

**Click on Proposal Card**
- Expands full solution details
- Shows all critiques received
- Defense history
- Vote breakdown

**Click on Critique**
- Shows full criticism text
- Displays suggested fix
- Shows whether addressed by defense
- Links to related proposal

**Hover on Vote Bar**
- Tooltip shows individual votes
- Agent justifications
- Vote weights

#### Animation Effects

**Proposal Submission**
- Card slides in from left
- Confidence bar fills with animation

**New Critique**
- Card slides in from right
- Severity badge pulses

**Vote Cast**
- Vote counter increments with bounce
- Vote bar expands smoothly
- Confetti animation if consensus reached

**Consensus Reached**
- Winning proposal highlights with glow
- Winner badge appears
- Confetti falls from top of screen

**Escalation**
- Status changes to red "ESCALATED"
- All animations pause
- Notification banner appears

---

## 6. Troubleshooting

### Common Retry Issues and Solutions

#### Issue 1: Infinite Retry Loop

**Symptoms:**
- Tool keeps retrying indefinitely
- Same error message repeats
- No progress after 5+ minutes

**Diagnosis:**
```
Check RetryIndicator:
  • maxAttempts should not be >10 for standard operations
  • Error message should change between retries
  • If same error persists, it's likely permanent
```

**Solution:**
```
1. Check if error is actually retryable
   Example: "File not found" won't resolve automatically

2. Reduce maxAttempts for non-transient errors
   retryableErrors: ['ETIMEDOUT', 'ECONNRESET']
   (Don't include 'ENOENT', 'EACCES')

3. Add timeout to prevent infinite loops
   maxDelayMs: 30000  // Max 30s backoff

4. Cancel operation manually if stuck
   Click "Stop Generation" button
```

#### Issue 2: Retries Exhausted Too Quickly

**Symptoms:**
- Operation fails after 2-3 seconds
- Feels like no real retry occurred
- Error: "All retries exhausted"

**Diagnosis:**
```
Check retry configuration:
  • baseDelayMs might be too low (e.g., 100ms)
  • backoffType might be 'fixed' instead of 'exponential'
  • maxAttempts might be too low (e.g., 1)
```

**Solution:**
```
1. Use exponential backoff for network operations
   backoffType: 'exponential'

2. Increase base delay for slow operations
   baseDelayMs: 1000  // Start with 1 second

3. Allow more attempts for unreliable operations
   maxAttempts: 5  // Instead of 3

4. Example aggressive policy:
   {
     maxAttempts: 5,
     backoffType: 'exponential',
     baseDelayMs: 1000,
     maxDelayMs: 60000,
     jitter: true
   }
```

#### Issue 3: Retry Success Not Showing

**Symptoms:**
- Operation succeeds, but UI shows error
- No green "Retry succeeded" badge
- Confusing success/failure state

**Diagnosis:**
```
Check tool execution feedback:
  • Status should change from 'retry' to 'retry_success'
  • RetryIndicator color should change to green
  • If still showing error, backend didn't emit success event
```

**Solution:**
```
1. Verify backend emits correct events:
   retryExecutor.on('retry_success', (data) => {
     postMessage({ type: 'retry_success', ...data });
   });

2. Check ThoughtStep type:
   Should be 'retry_success', not 'retry' or 'done'

3. Ensure UI updates on status change:
   useEffect(() => {
     // Listen for 'retry_success' messages
   }, [thoughtSteps]);

4. Clear cache and reload extension
   Ctrl+Shift+P → "Developer: Reload Window"
```

### Tool Timeout Handling

#### Understanding Timeouts

**Default Timeouts by Tool:**
- Read: 30 seconds
- Write: 60 seconds (larger files)
- Bash: 120 seconds (2 minutes)
- Git operations: 300 seconds (5 minutes)

**When Timeouts Occur:**
```
Timeout triggers if:
  • Tool execution exceeds time limit
  • Network request hangs
  • Process becomes unresponsive
  • System under heavy load
```

#### Configuring Timeouts

**Per-Tool Configuration:**
```typescript
const toolConfig = {
  Read: { timeout: 30000 },      // 30 seconds
  Write: { timeout: 60000 },     // 60 seconds
  Bash: { timeout: 120000 },     // 2 minutes
  GitPush: { timeout: 300000 }   // 5 minutes
};
```

**Dynamic Timeout Scaling:**
```typescript
// Increase timeout based on file size
const timeout = fileSize > 1_000_000
  ? 120000  // 2 minutes for large files
  : 30000;  // 30 seconds for small files
```

#### Handling Timeout Errors

**Retry Configuration for Timeouts:**
```typescript
const timeoutPolicy = {
  maxAttempts: 3,
  backoffType: 'exponential',
  baseDelayMs: 2000,
  retryableErrors: [
    'ETIMEDOUT',
    'timeout',
    'operation timed out'
  ]
};
```

**User Notification:**
```
When timeout occurs:

┌────────────────────────────────────────┐
│ ⚠️ Operation Timeout                   │
│                                        │
│ The operation exceeded the maximum     │
│ allowed time of 2 minutes.             │
│                                        │
│ Retrying with extended timeout...      │
│ Attempt 2/3                            │
│                                        │
│ [Extend Timeout] [Cancel] [Continue]   │
└────────────────────────────────────────┘
```

### Debate Deadlock Resolution

#### Identifying Deadlock

**Symptoms:**
- Debate stuck in same phase >10 minutes
- Agents repeating same proposals/critiques
- No consensus after 3 full rounds
- Vote tallies unchanging

**Deadlock Types:**

**Type 1: All Proposals Blocked**
```
Situation:
  Proposal A: 2 blocking critiques unaddressed
  Proposal B: 1 blocking critique unaddressed
  Proposal C: 3 blocking critiques unaddressed

Result: No proposal eligible for voting
Resolution: Automatic escalation
```

**Type 2: Voting Stalemate**
```
Situation:
  Proposal A: 2 votes (50%)
  Proposal B: 2 votes (50%)
  Threshold: 3 votes (75%) required

Result: Neither reaches consensus
Resolution: New round OR escalation after 3 rounds
```

**Type 3: Circular Critiques**
```
Situation:
  Agent A critiques Agent B
  Agent B critiques Agent C
  Agent C critiques Agent A
  No defenses accepted

Result: Infinite critique loop
Resolution: Escalation with deadlock reason
```

#### Manual Resolution Options

**Option 1: Force Consensus**
```
Action: Select a proposal manually
Steps:
  1. Open Debate Visualization
  2. Review all proposals
  3. Click "Force Select" on preferred proposal
  4. Provide justification
  5. Debate concludes, agents implement selection
```

**Option 2: Restart Debate with Constraints**
```
Action: Cancel and restart with clearer requirements
Steps:
  1. Click "Cancel Debate"
  2. Refine task description
  3. Add explicit constraints:
     - "Must use existing infrastructure"
     - "Budget: <$100/month"
     - "Must support 1M+ users"
  4. Start new debate with updated context
```

**Option 3: Break Tie with Human Vote**
```
Action: Cast deciding vote
Steps:
  1. Identify tied proposals
  2. Click "Cast Vote" button
  3. Select preferred proposal
  4. Vote weight: 3 (heavier than agent votes)
  5. System recalculates consensus
```

**Option 4: Escalate to Architect**
```
Action: Let Architect agent decide
Steps:
  1. Click "Escalate to Architect"
  2. Architect reviews debate history
  3. Architect proposes hybrid solution
  4. Implementation proceeds automatically
```

#### Preventing Deadlocks

**Best Practices:**

1. **Provide Clear Requirements**
   ```
   Bad: "Implement caching"
   Good: "Implement distributed caching with <100ms latency,
          Redis or equivalent, must support 10K+ req/sec"
   ```

2. **Set Realistic Consensus Threshold**
   ```
   2 agents: 100% consensus (2/2)
   3 agents: 67% consensus (2/3)  ← Recommended
   4+ agents: 67% consensus (⌈n*2/3⌉)
   ```

3. **Limit Debate Rounds**
   ```
   maxRounds: 3  // Default, prevents infinite debates
   roundTimeout: 300000  // 5 minutes per round
   ```

4. **Use Severity Appropriately**
   ```
   Reserve BLOCKING for:
     - Security vulnerabilities
     - Data corruption risks
     - Requirement violations

   Use MAJOR for:
     - Architectural concerns
     - Scalability issues

   Use MINOR for:
     - Code style
     - Documentation
   ```

### Performance Optimization Tips

#### Reducing Retry Overhead

**Problem: Too Many Retries Slowing Down Operations**

**Solution 1: Optimize Retryable Error Patterns**
```typescript
// ❌ Bad: Retries everything
retryableErrors: []

// ✅ Good: Only retry transient errors
retryableErrors: [
  'ETIMEDOUT',
  'ECONNRESET',
  '429',
  '503',
  '504'
]
```

**Solution 2: Use Aggressive Backoff for Quick Recovery**
```typescript
// ❌ Bad: Slow exponential backoff
{
  backoffType: 'exponential',
  baseDelayMs: 5000,  // 5 seconds
  maxAttempts: 5
}
// Total delay: 5s + 10s + 20s + 40s = 75 seconds

// ✅ Good: Fast linear backoff
{
  backoffType: 'linear',
  baseDelayMs: 500,  // 500ms
  maxAttempts: 3
}
// Total delay: 0.5s + 1s + 1.5s = 3 seconds
```

**Solution 3: Circuit Breaker Pattern**
```typescript
// Stop retrying if service is down
let failureCount = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;

function shouldRetry(error: Error): boolean {
  failureCount++;

  if (failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn('Circuit breaker open, skipping retries');
    return false;
  }

  return isTransientError(error);
}
```

#### Optimizing Debate Performance

**Problem: Debates Taking Too Long**

**Solution 1: Parallel Critique Phase**
```typescript
// Allow agents to critique simultaneously
const debateConfig = {
  parallelCritiques: true,  // Default: sequential
  critiqueTimeout: 60000     // 1 minute per agent
};
```

**Solution 2: Reduce Round Timeout**
```typescript
// Shorter deadlines force faster decisions
const debateConfig = {
  roundTimeout: 120000  // 2 minutes (default: 5 minutes)
};
```

**Solution 3: Skip Defense for Minor Critiques**
```typescript
// Auto-accept minor critiques, no defense needed
const debateConfig = {
  autoAcceptMinor: true,  // Skip defend phase for MINOR
  autoAcceptMajor: false
};
```

#### Optimizing Tool Execution

**Problem: Tools Running Slowly**

**Solution 1: Batch File Operations**
```typescript
// ❌ Bad: Multiple individual reads
await agent.read('/src/file1.ts');
await agent.read('/src/file2.ts');
await agent.read('/src/file3.ts');

// ✅ Good: Batch read with glob
await agent.glob('src/**/*.ts');
```

**Solution 2: Use Streaming for Large Files**
```typescript
// ❌ Bad: Load entire file into memory
const content = await agent.read('/large-file.json');

// ✅ Good: Stream file chunks
const stream = await agent.readStream('/large-file.json');
stream.on('data', (chunk) => processChunk(chunk));
```

**Solution 3: Cache Frequently Accessed Data**
```typescript
// Cache file contents to avoid repeated reads
const fileCache = new Map<string, string>();

async function cachedRead(path: string): Promise<string> {
  if (fileCache.has(path)) {
    return fileCache.get(path)!;
  }

  const content = await agent.read(path);
  fileCache.set(path, content);
  return content;
}
```

#### Memory Optimization

**Problem: Extension Using Too Much Memory**

**Solution 1: Limit Debate History**
```typescript
const debateConfig = {
  maxHistorySize: 100,  // Keep last 100 debates
  autoCleanup: true     // Delete old debates
};
```

**Solution 2: Stream Large Tool Outputs**
```typescript
// Don't store entire output in memory
const output = await tool.execute({ streaming: true });
```

**Solution 3: Cleanup Completed Tasks**
```typescript
// Dispose resources after task completion
task.on('completed', () => {
  task.dispose();
  worktree.cleanup();
  fileCache.clear();
});
```

---

## Appendix A: Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open Agent Panel | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| View Debates | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Stop Generation | `Ctrl+Shift+S` | `Cmd+Shift+S` |
| Expand Tool Details | `Enter` (when focused) | `Enter` |
| Toggle Retry Indicator | `R` | `R` |
| Force Select Proposal | `Ctrl+Enter` | `Cmd+Enter` |
| Cancel Debate | `Escape` | `Escape` |

---

## Appendix B: Configuration Reference

### VS Code Settings

Open Settings (`Ctrl+,`) and search for "Claude Assistant":

```json
{
  "claudeAssistant.defaultModel": "claude-opus-4-5",
  "claudeAssistant.ultrathinkDefault": false,
  "claudeAssistant.autoIndex": true,
  "claudeAssistant.swarmDensity": 3,
  "claudeAssistant.executionPermission": "auto",
  "claudeAssistant.retryPolicy": {
    "maxAttempts": 3,
    "backoffType": "exponential",
    "baseDelayMs": 1000
  },
  "claudeAssistant.debateConfig": {
    "minParticipants": 2,
    "maxRounds": 3,
    "consensusThreshold": 0.67,
    "roundTimeout": 300000
  }
}
```

---

## Appendix C: API Reference

For developers integrating with the autonomous agent system:

### RetryExecutor API

```typescript
import { RetryExecutor, RetryPolicy } from './orchestration/RetryStrategy';

const executor = new RetryExecutor();

// Execute with retry
const result = await executor.executeWithRetry(
  async () => {
    return await riskyOperation();
  },
  {
    maxAttempts: 3,
    backoffType: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['ETIMEDOUT'],
    jitter: true,
    onRetry: (attempt, error, delay) => {
      console.log(`Retry ${attempt}, waiting ${delay}ms`);
    }
  },
  'operation-id-123'
);

// Listen to events
executor.on('retry_attempt', (data) => {
  console.log(`Retry attempt ${data.attempt}/${data.maxAttempts}`);
});

executor.on('retry_success', (data) => {
  console.log(`Success after ${data.attempts} attempts`);
});

executor.on('retry_exhausted', (data) => {
  console.error(`All retries exhausted: ${data.lastError}`);
});
```

### AgentDebateCoordinator API

```typescript
import { AgentDebateCoordinator } from './orchestration/AgentDebateCoordinator';

const coordinator = new AgentDebateCoordinator({
  minParticipants: 2,
  maxRounds: 3,
  consensusThreshold: 2/3
});

// Start debate
const debateId = coordinator.startDebate(
  'How should we implement feature X?',
  ['agent-1', 'agent-2', 'agent-3']
);

// Submit proposal
coordinator.submitProposal(debateId, {
  agentId: 'agent-1',
  solution: 'Use approach A',
  reasoning: 'Because...',
  confidence: 0.85
});

// Submit critique
coordinator.submitCritique(debateId, {
  fromAgent: 'agent-2',
  toAgent: 'agent-1',
  proposalId: 'proposal-id',
  criticism: 'Concern about...',
  severity: 'major',
  suggestedFix: 'Try approach B instead'
});

// Listen to events
coordinator.on('consensus_reached', (debateId, proposal) => {
  console.log(`Consensus: ${proposal.solution}`);
});

coordinator.on('debate_escalated', (debateId, reason) => {
  console.log(`Escalated: ${reason}`);
});
```

---

## Appendix D: Glossary

**Agent**: An autonomous AI assistant with a specialized role (e.g., Coder, Reviewer)

**Backoff**: Delay strategy between retry attempts

**Blocking Critique**: Severe critique that prevents voting until addressed

**Consensus**: Agreement among agents (requires 2/3 supermajority)

**Debate Round**: One complete cycle of propose → critique → defend → vote

**Escalation**: Transferring decision to Architect when agents can't reach consensus

**Jitter**: Random variance in retry delays (±10%) to prevent synchronized retries

**Retry Policy**: Configuration defining how retries behave

**Swarm Density**: Number of sub-agents in brainstorm mode (1-12)

**ThoughtStep**: Individual unit of agent reasoning/action displayed in UI

**Tool**: Capability provided to agents (Read, Write, Bash, etc.)

**Transient Error**: Temporary failure likely to resolve with retry

**Worktree**: Isolated Git working directory for parallel agent execution

---

## Support and Resources

**Documentation**: `/docs/` directory in extension

**Issues**: Report bugs via VS Code extension marketplace

**Version**: Check Help → About for current version

**Updates**: Extension auto-updates via VS Code marketplace

**Logs**: View logs in Output panel → "Claude Assistant"

---

**End of User Guide**

*Last Updated: 2025-12-07*
*For Claude Assistant v0.2.0*
