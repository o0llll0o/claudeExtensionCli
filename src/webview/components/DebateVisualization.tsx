import React, { useState, useEffect } from 'react';
import './DebateVisualization.css';

interface Proposal {
  agentId: string;
  solution: string;
  confidence: number;
}

interface Critique {
  fromAgent: string;
  toAgent: string;
  criticism: string;
  severity: 'minor' | 'major' | 'blocking';
}

interface Vote {
  agentId: string;
  proposalId: string;
  weight: number;
}

type DebateStatus = 'proposing' | 'critiquing' | 'defending' | 'voting' | 'resolved' | 'escalated';

interface DebateVisualizationProps {
  debateId: string;
  topic: string;
  participants: string[];
  proposals: Proposal[];
  critiques: Critique[];
  votes: Vote[];
  status: DebateStatus;
  winner?: string;
}

const DebateVisualization: React.FC<DebateVisualizationProps> = ({
  debateId,
  topic,
  participants,
  proposals,
  critiques,
  votes,
  status,
  winner,
}) => {
  const [animatedProposals, setAnimatedProposals] = useState<Set<number>>(new Set());
  const [animatedCritiques, setAnimatedCritiques] = useState<Set<number>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [voteAnimation, setVoteAnimation] = useState<Set<string>>(new Set());

  // Trigger animations for new proposals
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProposals(new Set(proposals.map((_, i) => i)));
    }, 100);
    return () => clearTimeout(timer);
  }, [proposals]);

  // Trigger animations for new critiques
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedCritiques(new Set(critiques.map((_, i) => i)));
    }, 100);
    return () => clearTimeout(timer);
  }, [critiques]);

  // Trigger vote animations
  useEffect(() => {
    if (votes.length > 0) {
      const newVotes = new Set(votes.map(v => `${v.agentId}-${v.proposalId}`));
      setVoteAnimation(newVotes);
      const timer = setTimeout(() => setVoteAnimation(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [votes]);

  // Show confetti when consensus is reached
  useEffect(() => {
    if (status === 'resolved' && winner) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status, winner]);

  const getStatusColor = (status: DebateStatus): string => {
    const colors: Record<DebateStatus, string> = {
      proposing: '#3b82f6',
      critiquing: '#f59e0b',
      defending: '#8b5cf6',
      voting: '#10b981',
      resolved: '#22c55e',
      escalated: '#ef4444',
    };
    return colors[status];
  };

  const getSeverityColor = (severity: 'minor' | 'major' | 'blocking'): string => {
    const colors = {
      minor: '#3b82f6',
      major: '#f97316',
      blocking: '#ef4444',
    };
    return colors[severity];
  };

  const getVoteTally = (proposalIndex: number): number => {
    return votes
      .filter(v => v.proposalId === proposalIndex.toString())
      .reduce((sum, v) => sum + v.weight, 0);
  };

  const getTotalVotes = (): number => {
    return votes.reduce((sum, v) => sum + v.weight, 0);
  };

  const getConsensusThreshold = (): number => {
    return Math.ceil((participants.length * 2) / 3);
  };

  const hasConsensus = (proposalIndex: number): boolean => {
    const tally = getVoteTally(proposalIndex);
    return tally >= getConsensusThreshold();
  };

  const getAgentInitials = (agentId: string): string => {
    return agentId
      .split('-')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAgentColor = (agentId: string): string => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    const index = participants.indexOf(agentId) % colors.length;
    return colors[index];
  };

  return (
    <div className="debate-visualization">
      {showConfetti && <div className="confetti-container">{renderConfetti()}</div>}

      {/* Header */}
      <div className="debate-header">
        <div className="debate-topic">
          <h2>{topic}</h2>
          <span className="debate-id">#{debateId}</span>
        </div>
        <div
          className="status-badge"
          style={{ backgroundColor: getStatusColor(status) }}
        >
          {status.toUpperCase()}
        </div>
      </div>

      {/* Participants */}
      <div className="participants-section">
        <h3>Participants ({participants.length})</h3>
        <div className="participants-row">
          {participants.map((participant, index) => (
            <div
              key={participant}
              className="participant-avatar"
              style={{ backgroundColor: getAgentColor(participant) }}
              title={participant}
            >
              {getAgentInitials(participant)}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline-section">
        <h3>Debate Timeline</h3>
        <div className="timeline">
          <TimelineItem
            label="Proposing"
            active={status === 'proposing'}
            completed={['critiquing', 'defending', 'voting', 'resolved', 'escalated'].includes(status)}
          />
          <TimelineItem
            label="Critiquing"
            active={status === 'critiquing'}
            completed={['defending', 'voting', 'resolved', 'escalated'].includes(status)}
          />
          <TimelineItem
            label="Defending"
            active={status === 'defending'}
            completed={['voting', 'resolved', 'escalated'].includes(status)}
          />
          <TimelineItem
            label="Voting"
            active={status === 'voting'}
            completed={['resolved', 'escalated'].includes(status)}
          />
          <TimelineItem
            label={status === 'escalated' ? 'Escalated' : 'Resolved'}
            active={status === 'resolved' || status === 'escalated'}
            completed={false}
          />
        </div>
      </div>

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="proposals-section">
          <h3>Proposals ({proposals.length})</h3>
          <div className="proposals-grid">
            {proposals.map((proposal, index) => {
              const voteTally = getVoteTally(index);
              const consensus = hasConsensus(index);
              const isWinner = winner === index.toString();

              return (
                <div
                  key={index}
                  className={`proposal-card ${animatedProposals.has(index) ? 'slide-in' : ''} ${
                    isWinner ? 'winner' : ''
                  }`}
                >
                  <div className="proposal-header">
                    <div
                      className="proposal-agent"
                      style={{ backgroundColor: getAgentColor(proposal.agentId) }}
                    >
                      {getAgentInitials(proposal.agentId)}
                    </div>
                    <span className="proposal-agent-name">{proposal.agentId}</span>
                    {isWinner && <span className="winner-badge">WINNER</span>}
                  </div>

                  <div className="proposal-solution">{proposal.solution}</div>

                  <div className="confidence-section">
                    <div className="confidence-label">
                      Confidence: {Math.round(proposal.confidence * 100)}%
                    </div>
                    <div className="confidence-bar-container">
                      <div
                        className="confidence-bar"
                        style={{ width: `${proposal.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {status === 'voting' || status === 'resolved' ? (
                    <div className="vote-section">
                      <div className="vote-tally">
                        <span className={voteAnimation.has(`${index}`) ? 'vote-animate' : ''}>
                          {voteTally} votes
                        </span>
                        {consensus && <span className="consensus-badge">CONSENSUS</span>}
                      </div>
                      <div className="vote-bar-container">
                        <div
                          className="vote-bar"
                          style={{ width: `${(voteTally / participants.length) * 100}%` }}
                        />
                        <div
                          className="consensus-line"
                          style={{ left: `${(getConsensusThreshold() / participants.length) * 100}%` }}
                        >
                          <span className="consensus-label">2/3</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Critiques */}
      {critiques.length > 0 && (
        <div className="critiques-section">
          <h3>Critiques ({critiques.length})</h3>
          <div className="critiques-list">
            {critiques.map((critique, index) => (
              <div
                key={index}
                className={`critique-card ${animatedCritiques.has(index) ? 'slide-in' : ''}`}
                style={{ borderLeftColor: getSeverityColor(critique.severity) }}
              >
                <div className="critique-header">
                  <div className="critique-agents">
                    <div
                      className="critique-agent from"
                      style={{ backgroundColor: getAgentColor(critique.fromAgent) }}
                    >
                      {getAgentInitials(critique.fromAgent)}
                    </div>
                    <span className="critique-arrow">→</span>
                    <div
                      className="critique-agent to"
                      style={{ backgroundColor: getAgentColor(critique.toAgent) }}
                    >
                      {getAgentInitials(critique.toAgent)}
                    </div>
                  </div>
                  <span
                    className="severity-badge"
                    style={{ backgroundColor: getSeverityColor(critique.severity) }}
                  >
                    {critique.severity.toUpperCase()}
                  </span>
                </div>
                <div className="critique-text">{critique.criticism}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consensus Indicator */}
      {(status === 'voting' || status === 'resolved') && (
        <div className="consensus-indicator">
          <div className="consensus-info">
            <span className="consensus-threshold">
              Consensus Threshold: {getConsensusThreshold()} / {participants.length} votes (2/3 majority)
            </span>
            <span className="total-votes">
              Total Votes Cast: {getTotalVotes()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Timeline Item Component
const TimelineItem: React.FC<{
  label: string;
  active: boolean;
  completed: boolean;
}> = ({ label, active, completed }) => {
  return (
    <div className={`timeline-item ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>
      <div className="timeline-dot" />
      <div className="timeline-label">{label}</div>
    </div>
  );
};

// Confetti rendering
const renderConfetti = () => {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => i);
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

  return confettiPieces.map(i => (
    <div
      key={i}
      className="confetti-piece"
      style={{
        left: `${Math.random() * 100}%`,
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        animationDelay: `${Math.random() * 0.5}s`,
        animationDuration: `${2 + Math.random() * 1}s`,
      }}
    />
  ));
};

export default DebateVisualization;
