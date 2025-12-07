import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DebateVisualization from '../../../src/webview/components/DebateVisualization';

/**
 * E2E Tests for DebateVisualization Component
 *
 * Test Scenarios:
 * 1. Renders proposals from agents
 * 2. Shows critiques with severity badges
 * 3. Displays defense responses
 * 4. Vote tally visualization
 * 5. Consensus highlight animation
 * 6. Escalation state rendering
 */

describe('DebateVisualization E2E Tests', () => {
  const mockParticipants = ['agent-alpha', 'agent-beta', 'agent-gamma'];

  const mockProposals = [
    {
      agentId: 'agent-alpha',
      solution: 'Use microservices architecture for scalability',
      confidence: 0.85,
    },
    {
      agentId: 'agent-beta',
      solution: 'Implement monolithic architecture for simplicity',
      confidence: 0.72,
    },
  ];

  const mockCritiques = [
    {
      fromAgent: 'agent-beta',
      toAgent: 'agent-alpha',
      criticism: 'Microservices add unnecessary complexity',
      severity: 'major' as const,
    },
    {
      fromAgent: 'agent-gamma',
      toAgent: 'agent-beta',
      criticism: 'Monolithic architecture limits future scalability',
      severity: 'minor' as const,
    },
  ];

  const mockVotes = [
    { agentId: 'agent-alpha', proposalId: '0', weight: 1 },
    { agentId: 'agent-beta', proposalId: '0', weight: 1 },
    { agentId: 'agent-gamma', proposalId: '1', weight: 1 },
  ];

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Header and Basic Rendering', () => {
    test('renders debate topic and ID', () => {
      render(
        <DebateVisualization
          debateId="debate-001"
          topic="Choose architecture pattern"
          participants={mockParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Choose architecture pattern')).toBeInTheDocument();
      expect(screen.getByText('#debate-001')).toBeInTheDocument();
    });

    test('displays status badge with correct status', () => {
      const { rerender } = render(
        <DebateVisualization
          debateId="debate-002"
          topic="Test topic"
          participants={mockParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('PROPOSING')).toBeInTheDocument();

      rerender(
        <DebateVisualization
          debateId="debate-002"
          topic="Test topic"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="critiquing"
        />
      );

      expect(screen.getByText('CRITIQUING')).toBeInTheDocument();
    });

    test('renders all participants with avatars', () => {
      render(
        <DebateVisualization
          debateId="debate-003"
          topic="Test"
          participants={mockParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Participants (3)')).toBeInTheDocument();
      expect(screen.getByText('AA')).toBeInTheDocument(); // agent-alpha initials
      expect(screen.getByText('AB')).toBeInTheDocument(); // agent-beta initials
      expect(screen.getByText('AG')).toBeInTheDocument(); // agent-gamma initials
    });
  });

  describe('Proposal Rendering', () => {
    test('renders proposals from agents', () => {
      render(
        <DebateVisualization
          debateId="debate-004"
          topic="Architecture decision"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="critiquing"
        />
      );

      expect(screen.getByText('Proposals (2)')).toBeInTheDocument();
      expect(screen.getByText('Use microservices architecture for scalability')).toBeInTheDocument();
      expect(screen.getByText('Implement monolithic architecture for simplicity')).toBeInTheDocument();
    });

    test('displays confidence levels correctly', () => {
      render(
        <DebateVisualization
          debateId="debate-005"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Confidence: 85%')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 72%')).toBeInTheDocument();
    });

    test('renders confidence bars with correct width', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-006"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      const confidenceBars = container.querySelectorAll('.confidence-bar');
      expect(confidenceBars[0]).toHaveStyle({ width: '85%' });
      expect(confidenceBars[1]).toHaveStyle({ width: '72%' });
    });

    test('shows agent initials and names on proposals', () => {
      render(
        <DebateVisualization
          debateId="debate-007"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('agent-alpha')).toBeInTheDocument();
      expect(screen.getByText('agent-beta')).toBeInTheDocument();
    });

    test('proposal cards have slide-in animation', async () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-008"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      jest.advanceTimersByTime(150);

      await waitFor(() => {
        const proposalCards = container.querySelectorAll('.proposal-card');
        proposalCards.forEach((card) => {
          expect(card).toHaveClass('slide-in');
        });
      });
    });
  });

  describe('Critique Display with Severity', () => {
    test('renders critiques with correct severity badges', () => {
      render(
        <DebateVisualization
          debateId="debate-009"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={[]}
          status="critiquing"
        />
      );

      expect(screen.getByText('Critiques (2)')).toBeInTheDocument();
      expect(screen.getByText('MAJOR')).toBeInTheDocument();
      expect(screen.getByText('MINOR')).toBeInTheDocument();
    });

    test('displays critique messages', () => {
      render(
        <DebateVisualization
          debateId="debate-010"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={[]}
          status="critiquing"
        />
      );

      expect(screen.getByText('Microservices add unnecessary complexity')).toBeInTheDocument();
      expect(screen.getByText('Monolithic architecture limits future scalability')).toBeInTheDocument();
    });

    test('shows critique direction with agent avatars', () => {
      render(
        <DebateVisualization
          debateId="debate-011"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={[]}
          status="critiquing"
        />
      );

      const arrows = screen.getAllByText('→');
      expect(arrows.length).toBeGreaterThan(0);
    });

    test('applies correct severity colors', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-012"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[
            { fromAgent: 'agent-alpha', toAgent: 'agent-beta', criticism: 'Minor issue', severity: 'minor' as const },
            { fromAgent: 'agent-beta', toAgent: 'agent-gamma', criticism: 'Major issue', severity: 'major' as const },
            { fromAgent: 'agent-gamma', toAgent: 'agent-alpha', criticism: 'Blocking issue', severity: 'blocking' as const },
          ]}
          votes={[]}
          status="critiquing"
        />
      );

      const minorBadge = screen.getByText('MINOR');
      expect(minorBadge).toHaveStyle({ backgroundColor: '#3b82f6' });

      const majorBadge = screen.getByText('MAJOR');
      expect(majorBadge).toHaveStyle({ backgroundColor: '#f97316' });

      const blockingBadge = screen.getByText('BLOCKING');
      expect(blockingBadge).toHaveStyle({ backgroundColor: '#ef4444' });
    });

    test('critique cards have slide-in animation', async () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-013"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={[]}
          status="critiquing"
        />
      );

      jest.advanceTimersByTime(150);

      await waitFor(() => {
        const critiqueCards = container.querySelectorAll('.critique-card');
        critiqueCards.forEach((card) => {
          expect(card).toHaveClass('slide-in');
        });
      });
    });
  });

  describe('Voting and Consensus', () => {
    test('displays vote tallies for proposals', () => {
      render(
        <DebateVisualization
          debateId="debate-014"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="voting"
        />
      );

      expect(screen.getByText('2 votes')).toBeInTheDocument();
      expect(screen.getByText('1 votes')).toBeInTheDocument();
    });

    test('shows consensus badge when threshold reached', () => {
      const consensusVotes = [
        { agentId: 'agent-alpha', proposalId: '0', weight: 1 },
        { agentId: 'agent-beta', proposalId: '0', weight: 1 },
        { agentId: 'agent-gamma', proposalId: '0', weight: 1 },
      ];

      render(
        <DebateVisualization
          debateId="debate-015"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={consensusVotes}
          status="voting"
        />
      );

      expect(screen.getByText('CONSENSUS')).toBeInTheDocument();
    });

    test('displays consensus threshold indicator', () => {
      render(
        <DebateVisualization
          debateId="debate-016"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="voting"
        />
      );

      expect(screen.getByText(/Consensus Threshold: 2 \/ 3 votes/)).toBeInTheDocument();
      expect(screen.getByText(/Total Votes Cast: 3/)).toBeInTheDocument();
    });

    test('renders vote bar with correct percentage', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-017"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="voting"
        />
      );

      const voteBars = container.querySelectorAll('.vote-bar');
      // 2 votes out of 3 participants = 66.67%
      expect(voteBars[0]).toHaveStyle({ width: /66\./ });
    });

    test('vote animation triggers on new votes', async () => {
      const { container, rerender } = render(
        <DebateVisualization
          debateId="debate-018"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="voting"
        />
      );

      rerender(
        <DebateVisualization
          debateId="debate-018"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="voting"
        />
      );

      jest.advanceTimersByTime(100);

      await waitFor(() => {
        const animatedVotes = container.querySelectorAll('.vote-animate');
        expect(animatedVotes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Resolved State and Winner', () => {
    test('displays winner badge on winning proposal', () => {
      render(
        <DebateVisualization
          debateId="debate-019"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="resolved"
          winner="0"
        />
      );

      expect(screen.getByText('WINNER')).toBeInTheDocument();
    });

    test('winner proposal has special styling', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-020"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="resolved"
          winner="0"
        />
      );

      const winnerCard = container.querySelector('.proposal-card.winner');
      expect(winnerCard).toBeInTheDocument();
    });

    test('shows confetti animation on consensus resolution', async () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-021"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="resolved"
          winner="0"
        />
      );

      await waitFor(() => {
        const confetti = container.querySelector('.confetti-container');
        expect(confetti).toBeInTheDocument();
      });

      // Confetti disappears after 3 seconds
      jest.advanceTimersByTime(3100);

      await waitFor(() => {
        const confetti = container.querySelector('.confetti-container');
        expect(confetti).toBeEmptyDOMElement();
      });
    });

    test('confetti pieces have random positions and colors', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-022"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={mockVotes}
          status="resolved"
          winner="0"
        />
      );

      const confettiPieces = container.querySelectorAll('.confetti-piece');
      expect(confettiPieces.length).toBe(50);

      // Check random properties
      confettiPieces.forEach((piece) => {
        const style = (piece as HTMLElement).style;
        expect(style.left).toBeTruthy();
        expect(style.backgroundColor).toBeTruthy();
      });
    });
  });

  describe('Escalation State', () => {
    test('displays escalated status badge', () => {
      render(
        <DebateVisualization
          debateId="debate-023"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={[]}
          status="escalated"
        />
      );

      expect(screen.getByText('ESCALATED')).toBeInTheDocument();
    });

    test('escalated status has correct color', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-024"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="escalated"
        />
      );

      const statusBadge = screen.getByText('ESCALATED');
      expect(statusBadge).toHaveStyle({ backgroundColor: '#ef4444' });
    });

    test('no confetti shown for escalated state', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-025"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="escalated"
        />
      );

      const confetti = container.querySelector('.confetti-container');
      expect(confetti).not.toBeInTheDocument();
    });
  });

  describe('Timeline Visualization', () => {
    test('renders all timeline phases', () => {
      render(
        <DebateVisualization
          debateId="debate-026"
          topic="Test"
          participants={mockParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Debate Timeline')).toBeInTheDocument();
      expect(screen.getByText('Proposing')).toBeInTheDocument();
      expect(screen.getByText('Critiquing')).toBeInTheDocument();
      expect(screen.getByText('Defending')).toBeInTheDocument();
      expect(screen.getByText('Voting')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    test('marks active timeline phase', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-027"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="critiquing"
        />
      );

      const timelineItems = container.querySelectorAll('.timeline-item');
      const critiqueItem = Array.from(timelineItems).find((item) =>
        item.textContent?.includes('Critiquing')
      );

      expect(critiqueItem).toHaveClass('active');
    });

    test('marks completed timeline phases', () => {
      const { container } = render(
        <DebateVisualization
          debateId="debate-028"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="voting"
        />
      );

      const timelineItems = container.querySelectorAll('.timeline-item');
      const proposingItem = Array.from(timelineItems).find((item) =>
        item.textContent?.includes('Proposing')
      );

      expect(proposingItem).toHaveClass('completed');
    });

    test('shows Escalated label when escalated', () => {
      render(
        <DebateVisualization
          debateId="debate-029"
          topic="Test"
          participants={mockParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="escalated"
        />
      );

      expect(screen.getByText('Escalated')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('complete debate flow from proposing to resolved', async () => {
      const { rerender } = render(
        <DebateVisualization
          debateId="debate-030"
          topic="Architecture decision"
          participants={mockParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('PROPOSING')).toBeInTheDocument();

      // Add proposals
      rerender(
        <DebateVisualization
          debateId="debate-030"
          topic="Architecture decision"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="critiquing"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('CRITIQUING')).toBeInTheDocument();
        expect(screen.getByText('Proposals (2)')).toBeInTheDocument();
      });

      // Add critiques
      rerender(
        <DebateVisualization
          debateId="debate-030"
          topic="Architecture decision"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={[]}
          status="defending"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('DEFENDING')).toBeInTheDocument();
        expect(screen.getByText('Critiques (2)')).toBeInTheDocument();
      });

      // Add votes
      rerender(
        <DebateVisualization
          debateId="debate-030"
          topic="Architecture decision"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={mockVotes}
          status="voting"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('VOTING')).toBeInTheDocument();
        expect(screen.getByText(/Total Votes Cast:/)).toBeInTheDocument();
      });

      // Resolve with winner
      rerender(
        <DebateVisualization
          debateId="debate-030"
          topic="Architecture decision"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={mockCritiques}
          votes={mockVotes}
          status="resolved"
          winner="0"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('RESOLVED')).toBeInTheDocument();
        expect(screen.getByText('WINNER')).toBeInTheDocument();
      });
    });

    test('handles empty states gracefully', () => {
      render(
        <DebateVisualization
          debateId="debate-031"
          topic="Empty debate"
          participants={[]}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Participants (0)')).toBeInTheDocument();
      expect(screen.queryByText('Proposals')).not.toBeInTheDocument();
      expect(screen.queryByText('Critiques')).not.toBeInTheDocument();
    });

    test('renders with many participants', () => {
      const manyParticipants = Array.from({ length: 10 }, (_, i) => `agent-${i}`);

      render(
        <DebateVisualization
          debateId="debate-032"
          topic="Large debate"
          participants={manyParticipants}
          proposals={[]}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Participants (10)')).toBeInTheDocument();
    });

    test('calculates consensus threshold correctly for different participant counts', () => {
      const fiveParticipants = ['a1', 'a2', 'a3', 'a4', 'a5'];

      render(
        <DebateVisualization
          debateId="debate-033"
          topic="Test"
          participants={fiveParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={[]}
          status="voting"
        />
      );

      // 2/3 of 5 = 3.33, ceil = 4
      expect(screen.getByText(/Consensus Threshold: 4 \/ 5 votes/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles proposals with 0% confidence', () => {
      const lowConfidenceProposal = [
        { agentId: 'agent-alpha', solution: 'Uncertain solution', confidence: 0 },
      ];

      render(
        <DebateVisualization
          debateId="debate-034"
          topic="Test"
          participants={['agent-alpha']}
          proposals={lowConfidenceProposal}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Confidence: 0%')).toBeInTheDocument();
    });

    test('handles proposals with 100% confidence', () => {
      const highConfidenceProposal = [
        { agentId: 'agent-alpha', solution: 'Certain solution', confidence: 1 },
      ];

      render(
        <DebateVisualization
          debateId="debate-035"
          topic="Test"
          participants={['agent-alpha']}
          proposals={highConfidenceProposal}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText('Confidence: 100%')).toBeInTheDocument();
    });

    test('handles votes with fractional weights', () => {
      const fractionalVotes = [
        { agentId: 'agent-alpha', proposalId: '0', weight: 0.5 },
        { agentId: 'agent-beta', proposalId: '0', weight: 1.5 },
      ];

      render(
        <DebateVisualization
          debateId="debate-036"
          topic="Test"
          participants={mockParticipants}
          proposals={mockProposals}
          critiques={[]}
          votes={fractionalVotes}
          status="voting"
        />
      );

      expect(screen.getByText('2 votes')).toBeInTheDocument();
    });

    test('handles very long proposal text', () => {
      const longProposal = [
        {
          agentId: 'agent-alpha',
          solution: 'A'.repeat(500),
          confidence: 0.8,
        },
      ];

      render(
        <DebateVisualization
          debateId="debate-037"
          topic="Test"
          participants={['agent-alpha']}
          proposals={longProposal}
          critiques={[]}
          votes={[]}
          status="proposing"
        />
      );

      expect(screen.getByText(/A{100,}/)).toBeInTheDocument();
    });
  });
});
