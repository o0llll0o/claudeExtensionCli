/**
 * AgentDebateCoordinator - Inter-Agent Debate and Consensus System
 *
 * Enables autonomous agents to propose solutions, critique each other,
 * defend their proposals, and vote to reach consensus. Prevents bad
 * implementations through structured debate rounds and escalation.
 *
 * @module AgentDebateCoordinator
 * @author arch-3 - API Architect
 * @date 2025-12-07
 *
 * @architecture
 * Debate Flow:
 *   1. PROPOSE: Agents submit solution proposals with confidence scores
 *   2. CRITIQUE: Agents review and critique each other's proposals
 *   3. DEFEND: Authors defend their proposals against critiques
 *   4. VOTE: All agents vote with weighted preferences
 *   5. RESOLVE: 2/3 majority required; escalate if no consensus after 3 rounds
 *
 * Quality Gates:
 *   - BLOCKING critiques must be addressed before voting
 *   - 2/3 supermajority prevents premature consensus
 *   - Maximum 3 debate rounds before escalation
 *   - Architect intervention for unresolvable conflicts
 */

import { EventEmitter } from 'events';

// ============================================
// Core Debate Types
// ============================================

export type CritiqueSeverity = 'minor' | 'major' | 'blocking';
export type DebateRoundType = 'propose' | 'critique' | 'defend' | 'vote';
export type DebateStatus = 'active' | 'consensus_reached' | 'escalated' | 'cancelled';

/**
 * Solution proposal submitted by an agent
 */
export interface Proposal {
    /** Unique identifier for the proposal */
    id: string;
    /** ID of the agent submitting the proposal */
    agentId: string;
    /** The proposed solution (code, architecture, approach, etc.) */
    solution: string;
    /** Reasoning behind the solution */
    reasoning: string;
    /** Confidence score from 0 (uncertain) to 1 (certain) */
    confidence: number;
    /** Timestamp of submission */
    timestamp: number;
    /** Number of votes received */
    voteCount?: number;
    /** Total weighted vote score */
    weightedScore?: number;
    /** Whether all blocking critiques have been addressed */
    blockingResolved?: boolean;
}

/**
 * Critique of another agent's proposal
 */
export interface Critique {
    /** Unique identifier for the critique */
    id: string;
    /** ID of the agent submitting the critique */
    fromAgent: string;
    /** ID of the agent whose proposal is being critiqued */
    toAgent: string;
    /** ID of the proposal being critiqued */
    proposalId: string;
    /** The criticism text */
    criticism: string;
    /** Severity level determining if proposal can proceed */
    severity: CritiqueSeverity;
    /** Optional suggested fix or alternative approach */
    suggestedFix?: string;
    /** Timestamp of submission */
    timestamp: number;
    /** Whether the critique has been addressed by a defense */
    addressed?: boolean;
}

/**
 * Defense of a proposal against critiques
 */
export interface Defense {
    /** Unique identifier for the defense */
    id: string;
    /** ID of the agent defending (should match proposal author) */
    agentId: string;
    /** ID of the proposal being defended */
    proposalId: string;
    /** ID of the critique being addressed */
    critiqueId: string;
    /** Defense text explaining how critique was addressed */
    defense: string;
    /** Whether the proposal was modified in response */
    proposalModified: boolean;
    /** Timestamp of submission */
    timestamp: number;
}

/**
 * Vote cast by an agent for a proposal
 */
export interface Vote {
    /** Unique identifier for the vote */
    id: string;
    /** ID of the voting agent */
    agentId: string;
    /** ID of the proposal being voted for */
    proposalId: string;
    /** Vote weight (can represent expertise, seniority, etc.) */
    weight: number;
    /** Optional justification for the vote */
    justification?: string;
    /** Timestamp of vote */
    timestamp: number;
}

/**
 * A single round in the debate process
 */
export interface DebateRound {
    /** Round number (1-indexed) */
    roundNumber: number;
    /** Type of round */
    type: DebateRoundType;
    /** When the round started */
    startedAt: number;
    /** When the round ended */
    endedAt?: number;
    /** Whether the round is complete */
    complete: boolean;
    /** Proposals submitted in this round (for propose rounds) */
    proposals: Proposal[];
    /** Critiques submitted in this round (for critique rounds) */
    critiques: Critique[];
    /** Defenses submitted in this round (for defend rounds) */
    defenses: Defense[];
    /** Votes submitted in this round (for vote rounds) */
    votes: Vote[];
}

/**
 * Complete debate session
 */
export interface Debate {
    /** Unique identifier for the debate */
    id: string;
    /** Topic or problem being debated */
    topic: string;
    /** IDs of participating agents */
    participants: string[];
    /** All debate rounds */
    rounds: DebateRound[];
    /** Current round index */
    currentRound: number;
    /** Debate status */
    status: DebateStatus;
    /** Winning proposal (if consensus reached) */
    consensus?: Proposal;
    /** When the debate started */
    startedAt: number;
    /** When the debate ended */
    endedAt?: number;
    /** Reason for escalation (if escalated) */
    escalationReason?: string;
}

// ============================================
// Configuration
// ============================================

export interface DebateConfig {
    /** Minimum number of participants required */
    minParticipants?: number;
    /** Maximum number of debate cycles before escalation */
    maxRounds?: number;
    /** Required vote percentage for consensus (0-1) */
    consensusThreshold?: number;
    /** Whether to allow proposal modifications during defense */
    allowProposalModifications?: boolean;
    /** Maximum time per round in milliseconds */
    roundTimeout?: number;
}

const DEFAULT_CONFIG: Required<DebateConfig> = {
    minParticipants: 2,
    maxRounds: 3,
    consensusThreshold: 2 / 3, // 2/3 majority
    allowProposalModifications: true,
    roundTimeout: 300000, // 5 minutes
};

// ============================================
// Event Definitions
// ============================================

export interface DebateEvents {
    debate_started: (debate: Debate) => void;
    round_started: (debateId: string, round: DebateRound) => void;
    round_completed: (debateId: string, round: DebateRound) => void;
    proposal_submitted: (debateId: string, proposal: Proposal) => void;
    critique_submitted: (debateId: string, critique: Critique) => void;
    defense_submitted: (debateId: string, defense: Defense) => void;
    vote_cast: (debateId: string, vote: Vote) => void;
    consensus_reached: (debateId: string, proposal: Proposal) => void;
    debate_escalated: (debateId: string, reason: string) => void;
    debate_cancelled: (debateId: string) => void;
    error: (debateId: string, error: Error) => void;
}

// ============================================
// AgentDebateCoordinator Class
// ============================================

/**
 * Coordinates structured debates between autonomous agents to reach
 * consensus on implementation decisions.
 *
 * @example
 * ```typescript
 * const coordinator = new AgentDebateCoordinator();
 *
 * // Start a debate
 * const debateId = coordinator.startDebate(
 *   'How should we implement the caching layer?',
 *   ['agent-1', 'agent-2', 'agent-3']
 * );
 *
 * // Agents submit proposals
 * coordinator.submitProposal(debateId, {
 *   agentId: 'agent-1',
 *   solution: 'Use Redis with LRU eviction',
 *   reasoning: 'Provides distributed caching with built-in eviction',
 *   confidence: 0.85
 * });
 *
 * // Agents critique each other
 * coordinator.submitCritique(debateId, {
 *   fromAgent: 'agent-2',
 *   toAgent: 'agent-1',
 *   criticism: 'Redis adds infrastructure complexity',
 *   severity: 'major',
 *   suggestedFix: 'Consider in-memory caching first'
 * });
 *
 * // Original author defends
 * coordinator.defendProposal(debateId, 'agent-1',
 *   'In-memory caching won\'t work across multiple instances'
 * );
 *
 * // Agents vote
 * coordinator.castVote(debateId, {
 *   agentId: 'agent-2',
 *   proposalId: 'proposal-1',
 *   weight: 1
 * });
 *
 * // Resolve to find consensus
 * const winner = coordinator.resolveDebate(debateId);
 * ```
 */
export class AgentDebateCoordinator extends EventEmitter {
    private debates: Map<string, Debate> = new Map();
    private config: Required<DebateConfig>;
    private roundTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(config?: DebateConfig) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ============================================
    // Debate Lifecycle Management
    // ============================================

    /**
     * Starts a new debate session
     *
     * @param topic - The topic or problem to debate
     * @param participants - Array of agent IDs participating
     * @returns Unique debate ID
     * @throws Error if insufficient participants
     */
    startDebate(topic: string, participants: string[]): string {
        if (participants.length < this.config.minParticipants) {
            throw new Error(
                `Insufficient participants. Minimum ${this.config.minParticipants} required, got ${participants.length}`
            );
        }

        const debateId = this.generateId('debate');
        const now = Date.now();

        const debate: Debate = {
            id: debateId,
            topic,
            participants,
            rounds: [],
            currentRound: 0,
            status: 'active',
            startedAt: now,
        };

        this.debates.set(debateId, debate);

        // Start the first round (PROPOSE)
        this.startRound(debateId, 'propose');

        this.emit('debate_started', debate);

        return debateId;
    }

    /**
     * Cancels an ongoing debate
     *
     * @param debateId - ID of the debate to cancel
     */
    cancelDebate(debateId: string): void {
        const debate = this.getDebate(debateId);
        debate.status = 'cancelled';
        debate.endedAt = Date.now();

        this.clearRoundTimer(debateId);
        this.emit('debate_cancelled', debateId);
    }

    /**
     * Gets the current state of a debate
     *
     * @param debateId - ID of the debate
     * @returns The debate object
     */
    getDebateState(debateId: string): Debate {
        return this.getDebate(debateId);
    }

    /**
     * Gets all active debates
     *
     * @returns Array of active debate objects
     */
    getActiveDebates(): Debate[] {
        return Array.from(this.debates.values()).filter(
            (d) => d.status === 'active'
        );
    }

    // ============================================
    // Round Management
    // ============================================

    private startRound(debateId: string, type: DebateRoundType): void {
        const debate = this.getDebate(debateId);
        const roundNumber = debate.rounds.length + 1;

        const round: DebateRound = {
            roundNumber,
            type,
            startedAt: Date.now(),
            complete: false,
            proposals: [],
            critiques: [],
            defenses: [],
            votes: [],
        };

        debate.rounds.push(round);
        debate.currentRound = debate.rounds.length - 1;

        this.emit('round_started', debateId, round);

        // Set timeout for round
        if (this.config.roundTimeout > 0) {
            const timer = setTimeout(() => {
                this.handleRoundTimeout(debateId);
            }, this.config.roundTimeout);
            this.roundTimers.set(debateId, timer);
        }
    }

    private completeRound(debateId: string): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        round.complete = true;
        round.endedAt = Date.now();

        this.clearRoundTimer(debateId);
        this.emit('round_completed', debateId, round);
    }

    private handleRoundTimeout(debateId: string): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        console.warn(
            `Round ${round.roundNumber} (${round.type}) timed out for debate ${debateId}`
        );

        this.completeRound(debateId);

        // Move to next round or escalate
        this.advanceDebate(debateId);
    }

    private clearRoundTimer(debateId: string): void {
        const timer = this.roundTimers.get(debateId);
        if (timer) {
            clearTimeout(timer);
            this.roundTimers.delete(debateId);
        }
    }

    // ============================================
    // Proposal Management
    // ============================================

    /**
     * Submits a solution proposal
     *
     * @param debateId - ID of the debate
     * @param proposal - The proposal (without id and timestamp)
     * @throws Error if not in propose round or agent not a participant
     */
    submitProposal(
        debateId: string,
        proposal: Omit<Proposal, 'id' | 'timestamp'>
    ): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        this.validateActiveDebate(debate);
        this.validateParticipant(debate, proposal.agentId);

        if (round.type !== 'propose') {
            throw new Error(
                `Cannot submit proposal in ${round.type} round. Current round is for ${round.type}.`
            );
        }

        if (proposal.confidence < 0 || proposal.confidence > 1) {
            throw new Error('Confidence must be between 0 and 1');
        }

        const fullProposal: Proposal = {
            ...proposal,
            id: this.generateId('proposal'),
            timestamp: Date.now(),
            voteCount: 0,
            weightedScore: 0,
            blockingResolved: true, // Initially true, becomes false if blocking critiques added
        };

        round.proposals.push(fullProposal);
        this.emit('proposal_submitted', debateId, fullProposal);
    }

    // ============================================
    // Critique Management
    // ============================================

    /**
     * Submits a critique of another agent's proposal
     *
     * @param debateId - ID of the debate
     * @param critique - The critique (without id and timestamp)
     * @throws Error if not in critique round or invalid critique
     */
    submitCritique(
        debateId: string,
        critique: Omit<Critique, 'id' | 'timestamp' | 'addressed'>
    ): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        this.validateActiveDebate(debate);
        this.validateParticipant(debate, critique.fromAgent);

        if (round.type !== 'critique') {
            throw new Error(
                `Cannot submit critique in ${round.type} round. Current round is for ${round.type}.`
            );
        }

        // Validate proposal exists
        const proposal = this.findProposalById(debate, critique.proposalId);
        if (!proposal) {
            throw new Error(`Proposal ${critique.proposalId} not found`);
        }

        // Validate toAgent matches proposal author
        if (proposal.agentId !== critique.toAgent) {
            throw new Error(
                `toAgent ${critique.toAgent} does not match proposal author ${proposal.agentId}`
            );
        }

        // Agents cannot critique their own proposals
        if (critique.fromAgent === critique.toAgent) {
            throw new Error('Agents cannot critique their own proposals');
        }

        const fullCritique: Critique = {
            ...critique,
            id: this.generateId('critique'),
            timestamp: Date.now(),
            addressed: false,
        };

        round.critiques.push(fullCritique);

        // Mark proposal as having unresolved blocking critiques
        if (critique.severity === 'blocking') {
            proposal.blockingResolved = false;
        }

        this.emit('critique_submitted', debateId, fullCritique);
    }

    // ============================================
    // Defense Management
    // ============================================

    /**
     * Defends a proposal against a critique
     *
     * @param debateId - ID of the debate
     * @param agentId - ID of the defending agent
     * @param defense - Defense text
     * @param critiqueId - Optional specific critique to address
     * @param modifiedProposal - Optional modified proposal if changes were made
     * @throws Error if not in defend round or agent is not proposal author
     */
    defendProposal(
        debateId: string,
        agentId: string,
        defense: string,
        critiqueId?: string,
        modifiedProposal?: string
    ): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        this.validateActiveDebate(debate);
        this.validateParticipant(debate, agentId);

        if (round.type !== 'defend') {
            throw new Error(
                `Cannot submit defense in ${round.type} round. Current round is for ${round.type}.`
            );
        }

        // Find the agent's proposal from the propose round
        const proposeRound = this.getRoundByType(debate, 'propose');
        const proposal = proposeRound?.proposals.find(
            (p) => p.agentId === agentId
        );

        if (!proposal) {
            throw new Error(`No proposal found for agent ${agentId}`);
        }

        // Find critiques to address
        const critiqueRound = this.getRoundByType(debate, 'critique');
        let critiquesToAddress: Critique[] = [];

        if (critiqueId) {
            const critique = critiqueRound?.critiques.find(
                (c) => c.id === critiqueId
            );
            if (!critique) {
                throw new Error(`Critique ${critiqueId} not found`);
            }
            if (critique.proposalId !== proposal.id) {
                throw new Error(
                    `Critique ${critiqueId} is not for this proposal`
                );
            }
            critiquesToAddress = [critique];
        } else {
            // Address all critiques for this proposal
            critiquesToAddress =
                critiqueRound?.critiques.filter(
                    (c) => c.proposalId === proposal.id
                ) || [];
        }

        if (critiquesToAddress.length === 0) {
            throw new Error('No critiques to address');
        }

        // Create defenses for each critique
        critiquesToAddress.forEach((critique) => {
            const fullDefense: Defense = {
                id: this.generateId('defense'),
                agentId,
                proposalId: proposal.id,
                critiqueId: critique.id,
                defense,
                proposalModified: !!modifiedProposal,
                timestamp: Date.now(),
            };

            round.defenses.push(fullDefense);
            critique.addressed = true;

            this.emit('defense_submitted', debateId, fullDefense);
        });

        // Update proposal if modified
        if (modifiedProposal) {
            if (!this.config.allowProposalModifications) {
                throw new Error('Proposal modifications are not allowed');
            }
            proposal.solution = modifiedProposal;
        }

        // Check if all blocking critiques are now addressed
        const blockingCritiques =
            critiqueRound?.critiques.filter(
                (c) =>
                    c.proposalId === proposal.id && c.severity === 'blocking'
            ) || [];
        const allBlockingAddressed = blockingCritiques.every(
            (c) => c.addressed
        );

        if (allBlockingAddressed) {
            proposal.blockingResolved = true;
        }
    }

    // ============================================
    // Voting Management
    // ============================================

    /**
     * Casts a vote for a proposal
     *
     * @param debateId - ID of the debate
     * @param vote - The vote (without id and timestamp)
     * @throws Error if not in vote round or invalid vote
     */
    castVote(
        debateId: string,
        vote: Omit<Vote, 'id' | 'timestamp'>
    ): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        this.validateActiveDebate(debate);
        this.validateParticipant(debate, vote.agentId);

        if (round.type !== 'vote') {
            throw new Error(
                `Cannot cast vote in ${round.type} round. Current round is for ${round.type}.`
            );
        }

        // Validate proposal exists
        const proposal = this.findProposalById(debate, vote.proposalId);
        if (!proposal) {
            throw new Error(`Proposal ${vote.proposalId} not found`);
        }

        // Check if proposal has unresolved blocking critiques
        if (!proposal.blockingResolved) {
            throw new Error(
                `Cannot vote for proposal ${vote.proposalId} - it has unresolved blocking critiques`
            );
        }

        // Check if agent already voted
        const existingVote = round.votes.find(
            (v) => v.agentId === vote.agentId
        );
        if (existingVote) {
            throw new Error(`Agent ${vote.agentId} has already voted`);
        }

        if (vote.weight < 0) {
            throw new Error('Vote weight must be non-negative');
        }

        const fullVote: Vote = {
            ...vote,
            id: this.generateId('vote'),
            timestamp: Date.now(),
        };

        round.votes.push(fullVote);

        // Update proposal vote counts
        proposal.voteCount = (proposal.voteCount || 0) + 1;
        proposal.weightedScore = (proposal.weightedScore || 0) + vote.weight;

        this.emit('vote_cast', debateId, fullVote);
    }

    // ============================================
    // Consensus Resolution
    // ============================================

    /**
     * Attempts to resolve the debate and determine consensus
     *
     * @param debateId - ID of the debate
     * @returns The winning proposal if consensus reached, null otherwise
     */
    resolveDebate(debateId: string): Proposal | null {
        const debate = this.getDebate(debateId);

        if (debate.status !== 'active') {
            throw new Error(`Debate ${debateId} is not active`);
        }

        const round = this.getCurrentRound(debate);

        // Only resolve after voting round
        if (round.type !== 'vote' || !round.complete) {
            throw new Error('Can only resolve after vote round is complete');
        }

        // Get all proposals that are eligible (no blocking critiques)
        const proposeRound = this.getRoundByType(debate, 'propose');
        const eligibleProposals =
            proposeRound?.proposals.filter((p) => p.blockingResolved) || [];

        if (eligibleProposals.length === 0) {
            // No proposals can pass - escalate
            this.escalateToArchitect(
                debateId,
                'No proposals eligible (all have unresolved blocking critiques)'
            );
            return null;
        }

        // Calculate total voting weight
        const totalWeight = round.votes.reduce(
            (sum, vote) => sum + vote.weight,
            0
        );

        // Find proposal(s) that meet consensus threshold
        const consensusProposals = eligibleProposals.filter((proposal) => {
            const score = proposal.weightedScore || 0;
            return score / totalWeight >= this.config.consensusThreshold;
        });

        if (consensusProposals.length === 1) {
            // Consensus reached
            const winner = consensusProposals[0];
            debate.consensus = winner;
            debate.status = 'consensus_reached';
            debate.endedAt = Date.now();

            this.clearRoundTimer(debateId);
            this.emit('consensus_reached', debateId, winner);

            return winner;
        } else if (consensusProposals.length > 1) {
            // Multiple proposals meet threshold - need another round
            console.warn(
                `Multiple proposals meet consensus threshold in debate ${debateId}`
            );
            this.advanceDebate(debateId);
            return null;
        } else {
            // No consensus - need another round or escalate
            this.advanceDebate(debateId);
            return null;
        }
    }

    // ============================================
    // Escalation
    // ============================================

    /**
     * Escalates the debate to an architect for manual resolution
     *
     * @param debateId - ID of the debate
     * @param reason - Optional reason for escalation
     */
    escalateToArchitect(debateId: string, reason?: string): void {
        const debate = this.getDebate(debateId);

        const escalationReason =
            reason ||
            `Failed to reach consensus after ${this.config.maxRounds} debate rounds`;

        debate.status = 'escalated';
        debate.endedAt = Date.now();
        debate.escalationReason = escalationReason;

        this.clearRoundTimer(debateId);
        this.emit('debate_escalated', debateId, escalationReason);
    }

    // ============================================
    // Debate Flow Control
    // ============================================

    /**
     * Advances the debate to the next round or escalates if max rounds reached
     */
    private advanceDebate(debateId: string): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        // Complete current round if not already
        if (!round.complete) {
            this.completeRound(debateId);
        }

        // Calculate how many complete debate cycles we've done
        const cycleCount = Math.floor((debate.rounds.length) / 4);

        // Check if we've exceeded max rounds
        if (cycleCount >= this.config.maxRounds) {
            this.escalateToArchitect(
                debateId,
                `Maximum ${this.config.maxRounds} debate cycles reached without consensus`
            );
            return;
        }

        // Determine next round type
        let nextRoundType: DebateRoundType;
        switch (round.type) {
            case 'propose':
                nextRoundType = 'critique';
                break;
            case 'critique':
                nextRoundType = 'defend';
                break;
            case 'defend':
                nextRoundType = 'vote';
                break;
            case 'vote':
                // Start a new cycle
                nextRoundType = 'propose';
                break;
        }

        this.startRound(debateId, nextRoundType);
    }

    /**
     * Manually advances to the next round (for testing or manual control)
     *
     * @param debateId - ID of the debate
     */
    advanceToNextRound(debateId: string): void {
        const debate = this.getDebate(debateId);
        const round = this.getCurrentRound(debate);

        if (!round.complete) {
            this.completeRound(debateId);
        }

        this.advanceDebate(debateId);
    }

    // ============================================
    // Utility Methods
    // ============================================

    private getDebate(debateId: string): Debate {
        const debate = this.debates.get(debateId);
        if (!debate) {
            throw new Error(`Debate ${debateId} not found`);
        }
        return debate;
    }

    private getCurrentRound(debate: Debate): DebateRound {
        if (debate.rounds.length === 0) {
            throw new Error(`No rounds in debate ${debate.id}`);
        }
        return debate.rounds[debate.currentRound];
    }

    private getRoundByType(
        debate: Debate,
        type: DebateRoundType
    ): DebateRound | undefined {
        // Get the most recent round of the specified type
        for (let i = debate.rounds.length - 1; i >= 0; i--) {
            if (debate.rounds[i].type === type) {
                return debate.rounds[i];
            }
        }
        return undefined;
    }

    private findProposalById(
        debate: Debate,
        proposalId: string
    ): Proposal | undefined {
        for (const round of debate.rounds) {
            const proposal = round.proposals.find((p) => p.id === proposalId);
            if (proposal) return proposal;
        }
        return undefined;
    }

    private validateActiveDebate(debate: Debate): void {
        if (debate.status !== 'active') {
            throw new Error(
                `Debate ${debate.id} is not active (status: ${debate.status})`
            );
        }
    }

    private validateParticipant(debate: Debate, agentId: string): void {
        if (!debate.participants.includes(agentId)) {
            throw new Error(
                `Agent ${agentId} is not a participant in debate ${debate.id}`
            );
        }
    }

    private generateId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleans up resources
     */
    dispose(): void {
        // Clear all timers
        for (const debateId of this.roundTimers.keys()) {
            this.clearRoundTimer(debateId);
        }
        this.removeAllListeners();
    }
}
