# AgentDebateCoordinator API Documentation

## Overview

The AgentDebateCoordinator enables autonomous agents to propose solutions, critique each other, defend their proposals, and vote to reach consensus. This prevents bad implementations through structured debate rounds and automatic escalation when consensus cannot be reached.

**Module**: `src/orchestration/AgentDebateCoordinator.ts`

**Architecture**: Implements a structured 4-phase debate cycle:
1. **PROPOSE**: Agents submit solution proposals with confidence scores
2. **CRITIQUE**: Agents review and critique each other's proposals
3. **DEFEND**: Authors defend their proposals against critiques
4. **VOTE**: All agents vote with weighted preferences

**Quality Gates**:
- BLOCKING critiques must be addressed before voting
- 2/3 supermajority required for consensus
- Maximum 3 debate rounds before escalation to architect
- Prevents premature consensus through strict voting thresholds

---

## Types

### CritiqueSeverity

```typescript
type CritiqueSeverity = 'minor' | 'major' | 'blocking';
```

Severity levels for critiques:
- **minor**: Suggestion for improvement, doesn't block voting
- **major**: Significant concern, but proposal can still be voted on
- **blocking**: Critical issue, proposal cannot be voted on until addressed

---

### DebateRoundType

```typescript
type DebateRoundType = 'propose' | 'critique' | 'defend' | 'vote';
```

Types of rounds in a debate cycle.

---

### DebateStatus

```typescript
type DebateStatus = 'active' | 'consensus_reached' | 'escalated' | 'cancelled';
```

Status of a debate:
- **active**: Debate is ongoing
- **consensus_reached**: 2/3 majority achieved
- **escalated**: Sent to architect after max rounds
- **cancelled**: Manually cancelled

---

## Interfaces

### Proposal

Solution proposal submitted by an agent.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier for the proposal |
| agentId | string | Yes | ID of the agent submitting the proposal |
| solution | string | Yes | The proposed solution (code, architecture, approach, etc.) |
| reasoning | string | Yes | Reasoning behind the solution |
| confidence | number | Yes | Confidence score from 0 (uncertain) to 1 (certain) |
| timestamp | number | Yes | Timestamp of submission (ms since epoch) |
| voteCount | number | No | Number of votes received (populated during voting) |
| weightedScore | number | No | Total weighted vote score (populated during voting) |
| blockingResolved | boolean | No | Whether all blocking critiques have been addressed |

**Example**:
```typescript
{
  id: 'proposal-1701964800000-abc123',
  agentId: 'agent-backend',
  solution: 'Use Redis with LRU eviction policy for distributed caching',
  reasoning: 'Provides high-performance distributed caching with automatic memory management',
  confidence: 0.85,
  timestamp: 1701964800000,
  voteCount: 2,
  weightedScore: 2.0,
  blockingResolved: true
}
```

---

### Critique

Critique of another agent's proposal.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier for the critique |
| fromAgent | string | Yes | ID of the agent submitting the critique |
| toAgent | string | Yes | ID of the agent whose proposal is being critiqued |
| proposalId | string | Yes | ID of the proposal being critiqued |
| criticism | string | Yes | The criticism text |
| severity | CritiqueSeverity | Yes | Severity level determining if proposal can proceed |
| suggestedFix | string | No | Optional suggested fix or alternative approach |
| timestamp | number | Yes | Timestamp of submission (ms since epoch) |
| addressed | boolean | No | Whether the critique has been addressed by a defense |

**Example**:
```typescript
{
  id: 'critique-1701964900000-def456',
  fromAgent: 'agent-architect',
  toAgent: 'agent-backend',
  proposalId: 'proposal-1701964800000-abc123',
  criticism: 'Redis adds operational complexity and requires additional infrastructure',
  severity: 'major',
  suggestedFix: 'Consider using in-memory caching with a CDN for simpler deployment',
  timestamp: 1701964900000,
  addressed: true
}
```

---

### Defense

Defense of a proposal against critiques.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier for the defense |
| agentId | string | Yes | ID of the agent defending (must match proposal author) |
| proposalId | string | Yes | ID of the proposal being defended |
| critiqueId | string | Yes | ID of the critique being addressed |
| defense | string | Yes | Defense text explaining how critique was addressed |
| proposalModified | boolean | Yes | Whether the proposal was modified in response |
| timestamp | number | Yes | Timestamp of submission (ms since epoch) |

**Example**:
```typescript
{
  id: 'defense-1701965000000-ghi789',
  agentId: 'agent-backend',
  proposalId: 'proposal-1701964800000-abc123',
  critiqueId: 'critique-1701964900000-def456',
  defense: 'The application requires distributed caching across multiple instances. In-memory caching won\'t work in this architecture.',
  proposalModified: false,
  timestamp: 1701965000000
}
```

---

### Vote

Vote cast by an agent for a proposal.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier for the vote |
| agentId | string | Yes | ID of the voting agent |
| proposalId | string | Yes | ID of the proposal being voted for |
| weight | number | Yes | Vote weight (can represent expertise, seniority, etc.) |
| justification | string | No | Optional justification for the vote |
| timestamp | number | Yes | Timestamp of vote (ms since epoch) |

**Example**:
```typescript
{
  id: 'vote-1701965100000-jkl012',
  agentId: 'agent-architect',
  proposalId: 'proposal-1701964800000-abc123',
  weight: 1.5,
  justification: 'Redis is the right choice for this use case despite added complexity',
  timestamp: 1701965100000
}
```

---

### DebateRound

A single round in the debate process.

| Property | Type | Description |
|----------|------|-------------|
| roundNumber | number | Round number (1-indexed) |
| type | DebateRoundType | Type of round (propose, critique, defend, vote) |
| startedAt | number | When the round started (ms since epoch) |
| endedAt | number (optional) | When the round ended (ms since epoch) |
| complete | boolean | Whether the round is complete |
| proposals | Proposal[] | Proposals submitted in this round (for propose rounds) |
| critiques | Critique[] | Critiques submitted in this round (for critique rounds) |
| defenses | Defense[] | Defenses submitted in this round (for defend rounds) |
| votes | Vote[] | Votes submitted in this round (for vote rounds) |

**Example**:
```typescript
{
  roundNumber: 1,
  type: 'propose',
  startedAt: 1701964800000,
  endedAt: 1701965000000,
  complete: true,
  proposals: [/* Proposal objects */],
  critiques: [],
  defenses: [],
  votes: []
}
```

---

### Debate

Complete debate session.

| Property | Type | Description |
|----------|------|-------------|
| id | string | Unique identifier for the debate |
| topic | string | Topic or problem being debated |
| participants | string[] | IDs of participating agents |
| rounds | DebateRound[] | All debate rounds |
| currentRound | number | Current round index (0-indexed into rounds array) |
| status | DebateStatus | Debate status |
| consensus | Proposal (optional) | Winning proposal (if consensus reached) |
| startedAt | number | When the debate started (ms since epoch) |
| endedAt | number (optional) | When the debate ended (ms since epoch) |
| escalationReason | string (optional) | Reason for escalation (if escalated) |

**Example**:
```typescript
{
  id: 'debate-1701964800000-xyz789',
  topic: 'How should we implement the caching layer?',
  participants: ['agent-backend', 'agent-architect', 'agent-devops'],
  rounds: [/* DebateRound objects */],
  currentRound: 3,
  status: 'consensus_reached',
  consensus: {/* Winning Proposal */},
  startedAt: 1701964800000,
  endedAt: 1701965400000
}
```

---

### DebateConfig

Configuration options for debate behavior.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| minParticipants | number | 2 | Minimum number of participants required |
| maxRounds | number | 3 | Maximum number of debate cycles before escalation |
| consensusThreshold | number | 2/3 | Required vote percentage for consensus (0-1) |
| allowProposalModifications | boolean | true | Whether to allow proposal modifications during defense |
| roundTimeout | number | 300000 | Maximum time per round in milliseconds (5 minutes) |

**Example**:
```typescript
const config: DebateConfig = {
  minParticipants: 3,
  maxRounds: 5,
  consensusThreshold: 0.75,
  allowProposalModifications: true,
  roundTimeout: 600000
};
```

---

## Classes

### AgentDebateCoordinator

Coordinates structured debates between autonomous agents to reach consensus on implementation decisions. Extends EventEmitter for monitoring debate lifecycle.

**Constructor**:
```typescript
constructor(config?: DebateConfig)
```

**Parameters**:
- **config**: DebateConfig (optional) - Configuration options (merged with defaults)

**Example**:
```typescript
const coordinator = new AgentDebateCoordinator({
  minParticipants: 3,
  maxRounds: 5,
  consensusThreshold: 0.7
});
```

---

## Methods

### Debate Lifecycle Management

#### startDebate

Starts a new debate session.

**Signature**:
```typescript
startDebate(topic: string, participants: string[]): string
```

**Parameters**:
- **topic**: string - The topic or problem to debate
- **participants**: string[] - Array of agent IDs participating

**Returns**: string - Unique debate ID

**Throws**: Error if insufficient participants

**Example**:
```typescript
const debateId = coordinator.startDebate(
  'How should we implement authentication?',
  ['agent-security', 'agent-backend', 'agent-frontend']
);
console.log('Debate started:', debateId);
```

---

#### cancelDebate

Cancels an ongoing debate.

**Signature**:
```typescript
cancelDebate(debateId: string): void
```

**Parameters**:
- **debateId**: string - ID of the debate to cancel

**Returns**: void

**Example**:
```typescript
coordinator.cancelDebate(debateId);
console.log('Debate cancelled');
```

---

#### getDebateState

Gets the current state of a debate.

**Signature**:
```typescript
getDebateState(debateId: string): Debate
```

**Parameters**:
- **debateId**: string - ID of the debate

**Returns**: Debate - The debate object

**Throws**: Error if debate not found

**Example**:
```typescript
const debate = coordinator.getDebateState(debateId);
console.log('Status:', debate.status);
console.log('Round:', debate.currentRound + 1);
console.log('Type:', debate.rounds[debate.currentRound].type);
```

---

#### getActiveDebates

Gets all active debates.

**Signature**:
```typescript
getActiveDebates(): Debate[]
```

**Returns**: Debate[] - Array of active debate objects

**Example**:
```typescript
const active = coordinator.getActiveDebates();
console.log(`${active.length} active debates`);
active.forEach(d => {
  console.log(`  ${d.topic} (${d.participants.length} participants)`);
});
```

---

### Proposal Management

#### submitProposal

Submits a solution proposal.

**Signature**:
```typescript
submitProposal(
  debateId: string,
  proposal: Omit<Proposal, 'id' | 'timestamp'>
): void
```

**Parameters**:
- **debateId**: string - ID of the debate
- **proposal**: Partial proposal object (id and timestamp auto-generated)

**Returns**: void

**Throws**:
- Error if not in propose round
- Error if agent not a participant
- Error if confidence not in [0, 1]

**Example**:
```typescript
coordinator.submitProposal(debateId, {
  agentId: 'agent-backend',
  solution: 'Use JWT tokens with Redis session storage',
  reasoning: 'Provides stateless authentication with centralized session management',
  confidence: 0.9
});
```

---

### Critique Management

#### submitCritique

Submits a critique of another agent's proposal.

**Signature**:
```typescript
submitCritique(
  debateId: string,
  critique: Omit<Critique, 'id' | 'timestamp' | 'addressed'>
): void
```

**Parameters**:
- **debateId**: string - ID of the debate
- **critique**: Partial critique object (id, timestamp, addressed auto-generated)

**Returns**: void

**Throws**:
- Error if not in critique round
- Error if proposal not found
- Error if toAgent doesn't match proposal author
- Error if agent critiques their own proposal

**Example**:
```typescript
coordinator.submitCritique(debateId, {
  fromAgent: 'agent-security',
  toAgent: 'agent-backend',
  proposalId: 'proposal-123',
  criticism: 'JWT tokens should have short expiration times for security',
  severity: 'major',
  suggestedFix: 'Set token expiration to 15 minutes with refresh tokens'
});
```

---

### Defense Management

#### defendProposal

Defends a proposal against a critique.

**Signature**:
```typescript
defendProposal(
  debateId: string,
  agentId: string,
  defense: string,
  critiqueId?: string,
  modifiedProposal?: string
): void
```

**Parameters**:
- **debateId**: string - ID of the debate
- **agentId**: string - ID of the defending agent
- **defense**: string - Defense text
- **critiqueId**: string (optional) - Specific critique to address (otherwise addresses all)
- **modifiedProposal**: string (optional) - Modified proposal if changes were made

**Returns**: void

**Throws**:
- Error if not in defend round
- Error if agent is not proposal author
- Error if no proposal found for agent
- Error if proposal modifications disabled in config

**Example**:
```typescript
// Defend without modifying proposal
coordinator.defendProposal(
  debateId,
  'agent-backend',
  'Token expiration is configurable. We can set it to 15 minutes as suggested.'
);

// Defend with modified proposal
coordinator.defendProposal(
  debateId,
  'agent-backend',
  'Updated proposal to include 15-minute token expiration',
  'critique-456',
  'Use JWT tokens with Redis session storage. Token expiration: 15 minutes with refresh tokens.'
);
```

---

### Voting Management

#### castVote

Casts a vote for a proposal.

**Signature**:
```typescript
castVote(
  debateId: string,
  vote: Omit<Vote, 'id' | 'timestamp'>
): void
```

**Parameters**:
- **debateId**: string - ID of the debate
- **vote**: Partial vote object (id and timestamp auto-generated)

**Returns**: void

**Throws**:
- Error if not in vote round
- Error if proposal not found
- Error if proposal has unresolved blocking critiques
- Error if agent already voted
- Error if vote weight is negative

**Example**:
```typescript
coordinator.castVote(debateId, {
  agentId: 'agent-security',
  proposalId: 'proposal-123',
  weight: 1.0,
  justification: 'Proposal addresses security concerns adequately'
});

// Weighted vote (e.g., senior architect has more weight)
coordinator.castVote(debateId, {
  agentId: 'agent-architect',
  proposalId: 'proposal-123',
  weight: 1.5
});
```

---

### Consensus Resolution

#### resolveDebate

Attempts to resolve the debate and determine consensus.

**Signature**:
```typescript
resolveDebate(debateId: string): Proposal | null
```

**Parameters**:
- **debateId**: string - ID of the debate

**Returns**: Proposal | null - The winning proposal if consensus reached, null otherwise

**Throws**:
- Error if debate is not active
- Error if called before vote round is complete

**Consensus Algorithm**:
1. Filter proposals with unresolved blocking critiques
2. Calculate total voting weight
3. Find proposals meeting consensus threshold (weightedScore / totalWeight >= threshold)
4. If exactly one proposal meets threshold, consensus reached
5. If multiple proposals meet threshold, start new round
6. If no proposals meet threshold, start new round or escalate if max rounds reached

**Example**:
```typescript
// After vote round completes
const winner = coordinator.resolveDebate(debateId);

if (winner) {
  console.log('Consensus reached!');
  console.log('Winning proposal:', winner.solution);
  console.log('By:', winner.agentId);
  console.log('Vote score:', winner.weightedScore);
} else {
  console.log('No consensus yet, starting new round');
}
```

---

### Escalation

#### escalateToArchitect

Escalates the debate to an architect for manual resolution.

**Signature**:
```typescript
escalateToArchitect(debateId: string, reason?: string): void
```

**Parameters**:
- **debateId**: string - ID of the debate
- **reason**: string (optional) - Reason for escalation

**Returns**: void

**Example**:
```typescript
// Manual escalation
coordinator.escalateToArchitect(
  debateId,
  'Technical constraints prevent any proposal from being viable'
);

// Automatic escalation happens when max rounds reached
```

---

### Debate Flow Control

#### advanceToNextRound

Manually advances to the next round (for testing or manual control).

**Signature**:
```typescript
advanceToNextRound(debateId: string): void
```

**Parameters**:
- **debateId**: string - ID of the debate

**Returns**: void

**Example**:
```typescript
// Manually advance round (e.g., in testing)
coordinator.advanceToNextRound(debateId);

const debate = coordinator.getDebateState(debateId);
console.log('Now in round:', debate.rounds[debate.currentRound].type);
```

---

### Cleanup

#### dispose

Cleans up resources (clears timers, removes listeners).

**Signature**:
```typescript
dispose(): void
```

**Returns**: void

**Example**:
```typescript
// When shutting down
coordinator.dispose();
```

---

## Events

### debate_started

Emitted when a debate is started.

**Payload**: Debate (complete debate object)

**Example**:
```typescript
coordinator.on('debate_started', (debate) => {
  console.log(`Debate started: ${debate.topic}`);
  console.log(`Participants: ${debate.participants.join(', ')}`);
});
```

---

### round_started

Emitted when a new round starts.

**Payload**:
```typescript
(debateId: string, round: DebateRound) => void
```

**Example**:
```typescript
coordinator.on('round_started', (debateId, round) => {
  console.log(`Round ${round.roundNumber} started: ${round.type}`);
});
```

---

### round_completed

Emitted when a round completes.

**Payload**:
```typescript
(debateId: string, round: DebateRound) => void
```

**Example**:
```typescript
coordinator.on('round_completed', (debateId, round) => {
  const duration = round.endedAt! - round.startedAt;
  console.log(`Round ${round.roundNumber} (${round.type}) completed in ${duration}ms`);
});
```

---

### proposal_submitted

Emitted when a proposal is submitted.

**Payload**:
```typescript
(debateId: string, proposal: Proposal) => void
```

**Example**:
```typescript
coordinator.on('proposal_submitted', (debateId, proposal) => {
  console.log(`Proposal from ${proposal.agentId}:`);
  console.log(`  ${proposal.solution}`);
  console.log(`  Confidence: ${(proposal.confidence * 100).toFixed(0)}%`);
});
```

---

### critique_submitted

Emitted when a critique is submitted.

**Payload**:
```typescript
(debateId: string, critique: Critique) => void
```

**Example**:
```typescript
coordinator.on('critique_submitted', (debateId, critique) => {
  console.log(`${critique.fromAgent} → ${critique.toAgent}: ${critique.severity}`);
  console.log(`  ${critique.criticism}`);
});
```

---

### defense_submitted

Emitted when a defense is submitted.

**Payload**:
```typescript
(debateId: string, defense: Defense) => void
```

**Example**:
```typescript
coordinator.on('defense_submitted', (debateId, defense) => {
  console.log(`${defense.agentId} defended proposal:`);
  console.log(`  ${defense.defense}`);
  if (defense.proposalModified) {
    console.log('  (Proposal was modified)');
  }
});
```

---

### vote_cast

Emitted when a vote is cast.

**Payload**:
```typescript
(debateId: string, vote: Vote) => void
```

**Example**:
```typescript
coordinator.on('vote_cast', (debateId, vote) => {
  console.log(`${vote.agentId} voted for ${vote.proposalId}`);
  console.log(`  Weight: ${vote.weight}`);
});
```

---

### consensus_reached

Emitted when consensus is reached.

**Payload**:
```typescript
(debateId: string, proposal: Proposal) => void
```

**Example**:
```typescript
coordinator.on('consensus_reached', (debateId, proposal) => {
  console.log('🎉 Consensus reached!');
  console.log(`Winner: ${proposal.agentId}`);
  console.log(`Solution: ${proposal.solution}`);
  console.log(`Score: ${proposal.weightedScore}`);
});
```

---

### debate_escalated

Emitted when a debate is escalated to an architect.

**Payload**:
```typescript
(debateId: string, reason: string) => void
```

**Example**:
```typescript
coordinator.on('debate_escalated', (debateId, reason) => {
  console.log('⚠️ Debate escalated to architect');
  console.log(`Reason: ${reason}`);
  // Trigger manual review workflow
});
```

---

### debate_cancelled

Emitted when a debate is cancelled.

**Payload**:
```typescript
(debateId: string) => void
```

**Example**:
```typescript
coordinator.on('debate_cancelled', (debateId) => {
  console.log('Debate cancelled:', debateId);
});
```

---

### error

Emitted when an error occurs.

**Payload**:
```typescript
(debateId: string, error: Error) => void
```

**Example**:
```typescript
coordinator.on('error', (debateId, error) => {
  console.error(`Error in debate ${debateId}:`, error.message);
});
```

---

## Debate Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ DEBATE CYCLE FLOW                                           │
└─────────────────────────────────────────────────────────────┘

START DEBATE
   ↓
┌──────────────────┐
│ 1. PROPOSE ROUND │
└──────────────────┘
   • Agents submit proposals with confidence scores
   • Each agent can submit one proposal per round
   ↓
┌──────────────────┐
│ 2. CRITIQUE ROUND│
└──────────────────┘
   • Agents critique other agents' proposals
   • Critiques marked as: minor, major, or blocking
   • Agents cannot critique their own proposals
   • BLOCKING critiques prevent voting
   ↓
┌──────────────────┐
│ 3. DEFEND ROUND  │
└──────────────────┘
   • Proposal authors defend against critiques
   • Can modify proposals (if config allows)
   • Must address all BLOCKING critiques
   • Critiques marked as "addressed"
   ↓
┌──────────────────┐
│ 4. VOTE ROUND    │
└──────────────────┘
   • Agents vote for proposals (weighted votes)
   • Cannot vote for proposals with unresolved blocking critiques
   • Each agent can vote once
   ↓
┌──────────────────┐
│ RESOLVE DEBATE   │
└──────────────────┘
   • Calculate weighted scores
   • Check if any proposal meets consensus threshold (2/3)
   ↓
   ├─ ONE PROPOSAL MEETS THRESHOLD
   │  → CONSENSUS REACHED ✓
   │
   ├─ NO PROPOSAL MEETS THRESHOLD
   │  ├─ Rounds < maxRounds
   │  │  → START NEW CYCLE (back to PROPOSE)
   │  │
   │  └─ Rounds >= maxRounds
   │     → ESCALATE TO ARCHITECT ⚠️
   │
   └─ MULTIPLE PROPOSALS MEET THRESHOLD
      → START NEW CYCLE (back to PROPOSE)

ESCALATION REASONS:
• No consensus after maxRounds cycles
• No eligible proposals (all have blocking critiques)
• Manual escalation by system
```

---

## Complete Usage Examples

### Basic Debate Flow

```typescript
import { AgentDebateCoordinator } from './AgentDebateCoordinator';

const coordinator = new AgentDebateCoordinator({
  minParticipants: 3,
  consensusThreshold: 2/3
});

// Set up event listeners
coordinator.on('consensus_reached', (debateId, proposal) => {
  console.log('✓ Consensus:', proposal.solution);
  console.log('By:', proposal.agentId);
});

coordinator.on('debate_escalated', (debateId, reason) => {
  console.log('⚠️ Escalated:', reason);
});

// Start debate
const debateId = coordinator.startDebate(
  'How should we implement the API rate limiting?',
  ['agent-backend', 'agent-devops', 'agent-security']
);

// Round 1: PROPOSE
coordinator.submitProposal(debateId, {
  agentId: 'agent-backend',
  solution: 'Use Redis with token bucket algorithm',
  reasoning: 'Distributed, high-performance, supports sliding windows',
  confidence: 0.8
});

coordinator.submitProposal(debateId, {
  agentId: 'agent-devops',
  solution: 'Use NGINX rate limiting module',
  reasoning: 'Simple, no external dependencies, easy to configure',
  confidence: 0.7
});

coordinator.submitProposal(debateId, {
  agentId: 'agent-security',
  solution: 'Use API Gateway (AWS/Kong) with built-in rate limiting',
  reasoning: 'Enterprise-grade, managed service, additional security features',
  confidence: 0.9
});

// Advance to CRITIQUE round
coordinator.advanceToNextRound(debateId);

// Round 2: CRITIQUE
coordinator.submitCritique(debateId, {
  fromAgent: 'agent-devops',
  toAgent: 'agent-backend',
  proposalId: 'proposal-redis-123',
  criticism: 'Adds operational complexity with Redis dependency',
  severity: 'major',
  suggestedFix: 'NGINX is simpler to operate'
});

coordinator.submitCritique(debateId, {
  fromAgent: 'agent-backend',
  toAgent: 'agent-security',
  proposalId: 'proposal-gateway-456',
  criticism: 'Vendor lock-in and high cost for managed API Gateway',
  severity: 'blocking',
  suggestedFix: 'Use open-source alternative'
});

// Advance to DEFEND round
coordinator.advanceToNextRound(debateId);

// Round 3: DEFEND
coordinator.defendProposal(
  debateId,
  'agent-backend',
  'Redis is already in our stack for caching. Minimal additional complexity.'
);

coordinator.defendProposal(
  debateId,
  'agent-security',
  'Updated to use Kong (open-source) instead of AWS API Gateway',
  undefined,
  'Use Kong API Gateway with built-in rate limiting (open-source)'
);

// Advance to VOTE round
coordinator.advanceToNextRound(debateId);

// Round 4: VOTE
coordinator.castVote(debateId, {
  agentId: 'agent-backend',
  proposalId: 'proposal-redis-123',
  weight: 1.0,
  justification: 'My own proposal, addresses concerns'
});

coordinator.castVote(debateId, {
  agentId: 'agent-devops',
  proposalId: 'proposal-nginx-789',
  weight: 1.0,
  justification: 'Simplicity is key'
});

coordinator.castVote(debateId, {
  agentId: 'agent-security',
  proposalId: 'proposal-gateway-456',
  weight: 1.0,
  justification: 'Kong addresses cost concerns'
});

// Resolve
const winner = coordinator.resolveDebate(debateId);
// No consensus (each got 1 vote), starts new round or escalates
```

---

### Monitoring Debate Progress

```typescript
const coordinator = new AgentDebateCoordinator();

// Track all debate activity
coordinator.on('round_started', (debateId, round) => {
  console.log(`\n=== Round ${round.roundNumber}: ${round.type.toUpperCase()} ===`);
});

coordinator.on('proposal_submitted', (debateId, proposal) => {
  console.log(`📝 Proposal by ${proposal.agentId}:`);
  console.log(`   "${proposal.solution}"`);
  console.log(`   Confidence: ${(proposal.confidence * 100).toFixed(0)}%`);
});

coordinator.on('critique_submitted', (debateId, critique) => {
  const severity = critique.severity === 'blocking' ? '🚫' :
                   critique.severity === 'major' ? '⚠️' : 'ℹ️';
  console.log(`${severity} Critique from ${critique.fromAgent}:`);
  console.log(`   "${critique.criticism}"`);
});

coordinator.on('defense_submitted', (debateId, defense) => {
  console.log(`🛡️ Defense by ${defense.agentId}:`);
  console.log(`   "${defense.defense}"`);
});

coordinator.on('vote_cast', (debateId, vote) => {
  console.log(`🗳️ ${vote.agentId} voted for proposal ${vote.proposalId}`);
  console.log(`   Weight: ${vote.weight}`);
});

coordinator.on('consensus_reached', (debateId, proposal) => {
  console.log(`\n🎉 CONSENSUS REACHED!`);
  console.log(`Winner: ${proposal.agentId}`);
  console.log(`Solution: "${proposal.solution}"`);
  console.log(`Score: ${proposal.weightedScore}`);
});

coordinator.on('debate_escalated', (debateId, reason) => {
  console.log(`\n⚠️ ESCALATED TO ARCHITECT`);
  console.log(`Reason: ${reason}`);
});
```

---

### Automatic Debate Management

```typescript
class DebateManager {
  private coordinator: AgentDebateCoordinator;
  private autoAdvance = true;

  constructor() {
    this.coordinator = new AgentDebateCoordinator({
      maxRounds: 3,
      consensusThreshold: 0.67,
      roundTimeout: 60000 // 1 minute
    });

    this.setupAutoAdvance();
  }

  private setupAutoAdvance() {
    this.coordinator.on('round_completed', (debateId, round) => {
      if (!this.autoAdvance) return;

      // Auto-advance after short delay
      setTimeout(() => {
        try {
          if (round.type === 'vote') {
            // Try to resolve after voting
            const winner = this.coordinator.resolveDebate(debateId);
            if (!winner) {
              console.log('No consensus, starting new cycle');
            }
          } else {
            // Auto-advance to next round
            this.coordinator.advanceToNextRound(debateId);
          }
        } catch (error) {
          console.error('Auto-advance error:', error);
        }
      }, 5000);
    });
  }

  async runDebate(topic: string, agents: string[]) {
    return new Promise((resolve, reject) => {
      const debateId = this.coordinator.startDebate(topic, agents);

      this.coordinator.once('consensus_reached', (id, proposal) => {
        resolve(proposal);
      });

      this.coordinator.once('debate_escalated', (id, reason) => {
        reject(new Error(`Escalated: ${reason}`));
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        this.coordinator.cancelDebate(debateId);
        reject(new Error('Debate timeout'));
      }, 600000);
    });
  }
}

// Usage
const manager = new DebateManager();
try {
  const solution = await manager.runDebate(
    'Database migration strategy',
    ['agent-db', 'agent-backend', 'agent-devops']
  );
  console.log('Consensus solution:', solution);
} catch (error) {
  console.error('Debate failed:', error.message);
}
```

---

## Best Practices

1. **Require Minimum 3 Participants**:
   ```typescript
   const coordinator = new AgentDebateCoordinator({
     minParticipants: 3
   });
   ```

2. **Use Weighted Votes Appropriately**:
   - Domain experts: 1.5x weight
   - Architects: 2.0x weight
   - Regular agents: 1.0x weight

3. **Severity Guidelines**:
   - **minor**: Suggestions, style issues
   - **major**: Significant concerns but not fatal
   - **blocking**: Security issues, architecture violations, unworkable solutions

4. **Monitor Escalations**:
   ```typescript
   coordinator.on('debate_escalated', async (debateId, reason) => {
     const debate = coordinator.getDebateState(debateId);
     await notifyArchitect(debate, reason);
   });
   ```

5. **Set Realistic Timeouts**:
   - Development: 5-10 minutes per round
   - Production: 2-3 minutes per round

6. **Clean Up Resources**:
   ```typescript
   process.on('SIGINT', () => {
     coordinator.dispose();
   });
   ```

---

## TypeScript Types Export

```typescript
export type CritiqueSeverity = 'minor' | 'major' | 'blocking';
export type DebateRoundType = 'propose' | 'critique' | 'defend' | 'vote';
export type DebateStatus = 'active' | 'consensus_reached' | 'escalated' | 'cancelled';
export interface Proposal { /* ... */ }
export interface Critique { /* ... */ }
export interface Defense { /* ... */ }
export interface Vote { /* ... */ }
export interface DebateRound { /* ... */ }
export interface Debate { /* ... */ }
export interface DebateConfig { /* ... */ }
export interface DebateEvents { /* ... */ }
export class AgentDebateCoordinator extends EventEmitter { /* ... */ }
```
