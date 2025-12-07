/**
 * Performance Benchmarks for Debate Coordinator
 *
 * Tests proposal processing, critique evaluation at scale, vote tallying,
 * and memory usage per debate round
 * Based on rev-4's performance requirements
 */

const { performance } = require('perf_hooks');

/**
 * Debate Coordinator Implementation
 */
class DebateCoordinator {
  constructor(config = {}) {
    this.proposals = new Map();
    this.critiques = new Map();
    this.votes = new Map();
    this.rounds = [];
    this.participants = new Set();
    this.maxCritiquesPerProposal = config.maxCritiquesPerProposal || 100;
  }

  submitProposal(proposalId, proposal) {
    const startTime = performance.now();

    this.proposals.set(proposalId, {
      id: proposalId,
      ...proposal,
      submittedAt: Date.now(),
      critiques: [],
      votes: { for: 0, against: 0, abstain: 0 }
    });

    this.critiques.set(proposalId, []);
    this.votes.set(proposalId, new Map());

    const endTime = performance.now();
    return endTime - startTime;
  }

  submitCritique(proposalId, critique) {
    const startTime = performance.now();

    if (!this.critiques.has(proposalId)) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const proposalCritiques = this.critiques.get(proposalId);
    proposalCritiques.push({
      ...critique,
      submittedAt: Date.now(),
      score: this.evaluateCritique(critique)
    });

    const proposal = this.proposals.get(proposalId);
    proposal.critiques.push(critique.id);

    const endTime = performance.now();
    return endTime - startTime;
  }

  evaluateCritique(critique) {
    // Simulate critique evaluation with some computation
    let score = 0;

    // Length score
    const words = critique.content.split(' ').length;
    score += Math.min(words / 10, 10);

    // Relevance simulation
    if (critique.category) {
      score += 5;
    }

    // Evidence score
    if (critique.evidence && Array.isArray(critique.evidence)) {
      score += critique.evidence.length * 2;
    }

    return Math.min(score, 100);
  }

  submitVote(proposalId, participantId, vote) {
    const startTime = performance.now();

    if (!this.votes.has(proposalId)) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const proposalVotes = this.votes.get(proposalId);
    proposalVotes.set(participantId, {
      vote,
      timestamp: Date.now()
    });

    this.participants.add(participantId);

    const endTime = performance.now();
    return endTime - startTime;
  }

  tallyVotes(proposalId) {
    const startTime = performance.now();

    const proposalVotes = this.votes.get(proposalId);
    if (!proposalVotes) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const tally = { for: 0, against: 0, abstain: 0 };

    for (const [participantId, voteData] of proposalVotes) {
      if (voteData.vote === 'for') tally.for++;
      else if (voteData.vote === 'against') tally.against++;
      else tally.abstain++;
    }

    const proposal = this.proposals.get(proposalId);
    proposal.votes = tally;

    const endTime = performance.now();
    return {
      time: endTime - startTime,
      tally
    };
  }

  processRound(roundId, proposals, participants) {
    const startTime = performance.now();

    const round = {
      id: roundId,
      proposals: [],
      startedAt: Date.now(),
      completedAt: null
    };

    // Process all proposals
    proposals.forEach(proposal => {
      this.submitProposal(proposal.id, proposal);
      round.proposals.push(proposal.id);
    });

    // Simulate critique and voting phase
    round.critiqueCount = 0;
    round.voteCount = 0;

    const endTime = performance.now();
    round.completedAt = Date.now();
    round.processingTime = endTime - startTime;

    this.rounds.push(round);

    return {
      time: endTime - startTime,
      round
    };
  }

  getRoundMetrics(roundId) {
    const round = this.rounds.find(r => r.id === roundId);
    if (!round) return null;

    const metrics = {
      proposalCount: round.proposals.length,
      totalCritiques: 0,
      totalVotes: 0,
      averageCritiquesPerProposal: 0,
      averageVotesPerProposal: 0
    };

    round.proposals.forEach(proposalId => {
      const critiques = this.critiques.get(proposalId) || [];
      const votes = this.votes.get(proposalId) || new Map();
      metrics.totalCritiques += critiques.length;
      metrics.totalVotes += votes.size;
    });

    metrics.averageCritiquesPerProposal = metrics.totalCritiques / round.proposals.length;
    metrics.averageVotesPerProposal = metrics.totalVotes / round.proposals.length;

    return metrics;
  }
}

/**
 * Benchmark Suite for Debate Coordinator Performance
 */
class DebateCoordinatorBenchmark {
  constructor() {
    this.results = {
      proposalSubmission: [],
      critiqueEvaluation: [],
      voteTallying: [],
      memoryPerRound: []
    };
  }

  /**
   * Benchmark proposal submission time
   * Target: < 10ms per proposal
   */
  benchmarkProposalSubmission() {
    console.log('\n📊 Benchmarking Proposal Submission...');
    const proposalCounts = [10, 50, 100, 500];

    proposalCounts.forEach(count => {
      const coordinator = new DebateCoordinator();
      const submissionTimes = [];

      for (let i = 0; i < count; i++) {
        const time = coordinator.submitProposal(`proposal_${i}`, {
          title: `Proposal ${i}`,
          description: `This is proposal number ${i}`,
          author: `author_${i % 10}`,
          category: 'technical'
        });
        submissionTimes.push(time);
      }

      const avgTime = submissionTimes.reduce((a, b) => a + b, 0) / submissionTimes.length;
      const maxTime = Math.max(...submissionTimes);

      const result = {
        proposalCount: count,
        avg: avgTime,
        max: maxTime,
        passed: avgTime < 10
      };

      this.results.proposalSubmission.push(result);

      console.log(`  ${count} proposals:`);
      console.log(`    ✓ Average time: ${avgTime.toFixed(3)}ms`);
      console.log(`    ✓ Max time: ${maxTime.toFixed(3)}ms`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 10ms`);
    });

    return this.results.proposalSubmission;
  }

  /**
   * Benchmark critique evaluation at scale
   * Target: < 5ms per critique, handles 100 critiques efficiently
   */
  benchmarkCritiqueEvaluation() {
    console.log('\n📊 Benchmarking Critique Evaluation at Scale...');
    const critiqueScales = [10, 50, 100, 500];

    critiqueScales.forEach(scale => {
      const coordinator = new DebateCoordinator();
      coordinator.submitProposal('test_proposal', {
        title: 'Test Proposal',
        description: 'A test proposal for critique benchmarking'
      });

      const critiqueTimes = [];
      const evaluationTimes = [];

      for (let i = 0; i < scale; i++) {
        const evalStart = performance.now();

        const critique = {
          id: `critique_${i}`,
          author: `reviewer_${i % 20}`,
          content: `This is critique number ${i}. It contains important feedback about the proposal. `.repeat(5),
          category: i % 3 === 0 ? 'technical' : i % 3 === 1 ? 'business' : 'usability',
          evidence: Array(i % 5).fill({ type: 'reference', url: 'http://example.com' })
        };

        const score = coordinator.evaluateCritique(critique);
        const evalEnd = performance.now();
        evaluationTimes.push(evalEnd - evalStart);

        const submitTime = coordinator.submitCritique('test_proposal', critique);
        critiqueTimes.push(submitTime);
      }

      const avgCritiqueTime = critiqueTimes.reduce((a, b) => a + b, 0) / critiqueTimes.length;
      const avgEvalTime = evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length;
      const maxCritiqueTime = Math.max(...critiqueTimes);

      const result = {
        critiqueCount: scale,
        avgSubmission: avgCritiqueTime,
        avgEvaluation: avgEvalTime,
        max: maxCritiqueTime,
        passed: avgCritiqueTime < 5
      };

      this.results.critiqueEvaluation.push(result);

      console.log(`  ${scale} critiques:`);
      console.log(`    ✓ Average submission: ${avgCritiqueTime.toFixed(3)}ms`);
      console.log(`    ✓ Average evaluation: ${avgEvalTime.toFixed(3)}ms`);
      console.log(`    ✓ Max time: ${maxCritiqueTime.toFixed(3)}ms`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 5ms`);
    });

    return this.results.critiqueEvaluation;
  }

  /**
   * Benchmark vote tallying with many participants
   * Target: < 20ms for tallying, handles 100+ participants
   */
  benchmarkVoteTallying() {
    console.log('\n📊 Benchmarking Vote Tallying...');
    const participantCounts = [10, 50, 100, 500];

    participantCounts.forEach(count => {
      const coordinator = new DebateCoordinator();
      coordinator.submitProposal('vote_proposal', {
        title: 'Voting Test Proposal',
        description: 'A proposal for vote tallying benchmarks'
      });

      // Submit votes
      const voteTimes = [];
      for (let i = 0; i < count; i++) {
        const voteTime = coordinator.submitVote(
          'vote_proposal',
          `participant_${i}`,
          i % 3 === 0 ? 'for' : i % 3 === 1 ? 'against' : 'abstain'
        );
        voteTimes.push(voteTime);
      }

      // Tally votes
      const tallyResult = coordinator.tallyVotes('vote_proposal');

      const avgVoteTime = voteTimes.reduce((a, b) => a + b, 0) / voteTimes.length;
      const maxVoteTime = Math.max(...voteTimes);

      const result = {
        participantCount: count,
        avgVoteSubmission: avgVoteTime,
        maxVoteSubmission: maxVoteTime,
        tallyTime: tallyResult.time,
        passed: tallyResult.time < 20 && avgVoteTime < 5
      };

      this.results.voteTallying.push(result);

      console.log(`  ${count} participants:`);
      console.log(`    ✓ Average vote submission: ${avgVoteTime.toFixed(3)}ms`);
      console.log(`    ✓ Max vote submission: ${maxVoteTime.toFixed(3)}ms`);
      console.log(`    ✓ Tally time: ${tallyResult.time.toFixed(3)}ms`);
      console.log(`    ✓ Result: ${tallyResult.tally.for} for, ${tallyResult.tally.against} against, ${tallyResult.tally.abstain} abstain`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 20ms tally, < 5ms vote`);
    });

    return this.results.voteTallying;
  }

  /**
   * Benchmark memory usage per debate round
   * Target: < 500KB per round with moderate activity
   */
  async benchmarkMemoryPerRound() {
    console.log('\n📊 Benchmarking Memory Usage Per Round...');

    if (global.gc) {
      global.gc();
    }

    const roundConfigs = [
      { proposals: 5, critiquesPerProposal: 10, participants: 20 },
      { proposals: 10, critiquesPerProposal: 20, participants: 50 },
      { proposals: 20, critiquesPerProposal: 50, participants: 100 },
      { proposals: 50, critiquesPerProposal: 100, participants: 200 }
    ];

    for (const config of roundConfigs) {
      const coordinator = new DebateCoordinator();

      if (global.gc) global.gc();
      const memoryBefore = process.memoryUsage().heapUsed;

      // Create proposals
      const proposals = [];
      for (let i = 0; i < config.proposals; i++) {
        proposals.push({
          id: `proposal_${i}`,
          title: `Proposal ${i}`,
          description: `Description for proposal ${i}. `.repeat(10),
          author: `author_${i % 5}`
        });
      }

      // Process round
      const roundResult = coordinator.processRound('test_round', proposals, config.participants);

      // Add critiques
      for (let p = 0; p < config.proposals; p++) {
        for (let c = 0; c < config.critiquesPerProposal; c++) {
          coordinator.submitCritique(`proposal_${p}`, {
            id: `critique_${p}_${c}`,
            author: `reviewer_${c % 10}`,
            content: `Critique ${c} for proposal ${p}. `.repeat(5),
            category: 'technical'
          });
        }
      }

      // Add votes
      for (let p = 0; p < config.proposals; p++) {
        for (let v = 0; v < config.participants; v++) {
          coordinator.submitVote(`proposal_${p}`, `participant_${v}`, 'for');
        }
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryDelta = memoryAfter - memoryBefore;

      const result = {
        config,
        processingTime: roundResult.time,
        memoryUsed: memoryDelta,
        memoryPerProposal: memoryDelta / config.proposals,
        passed: memoryDelta < 500 * 1024 // < 500KB
      };

      this.results.memoryPerRound.push(result);

      console.log(`  ${config.proposals} proposals, ${config.critiquesPerProposal} critiques each, ${config.participants} participants:`);
      console.log(`    ✓ Processing time: ${roundResult.time.toFixed(3)}ms`);
      console.log(`    ✓ Memory used: ${(memoryDelta / 1024).toFixed(2)}KB`);
      console.log(`    ✓ Memory per proposal: ${(result.memoryPerProposal / 1024).toFixed(2)}KB`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 500KB per round`);
    }

    return this.results.memoryPerRound;
  }

  /**
   * Run all benchmarks and generate report
   */
  async runAll() {
    console.log('🚀 Starting Debate Coordinator Performance Benchmarks\n');
    console.log('='.repeat(60));

    const proposalResults = this.benchmarkProposalSubmission();
    const critiqueResults = this.benchmarkCritiqueEvaluation();
    const voteResults = this.benchmarkVoteTallying();
    const memoryResults = await this.benchmarkMemoryPerRound();

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 BENCHMARK SUMMARY');
    console.log('='.repeat(60));

    const allPassed =
      proposalResults.every(r => r.passed) &&
      critiqueResults.every(r => r.passed) &&
      voteResults.every(r => r.passed) &&
      memoryResults.every(r => r.passed);

    console.log(`\nOverall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\nDetailed Results:');
    console.log(`  Proposal Submission: ${proposalResults.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Critique Evaluation: ${critiqueResults.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Vote Tallying: ${voteResults.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Memory Per Round: ${memoryResults.every(r => r.passed) ? '✅' : '❌'}`);

    return {
      passed: allPassed,
      results: this.results
    };
  }
}

// Export for use in test runners
module.exports = { DebateCoordinatorBenchmark, DebateCoordinator };

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new DebateCoordinatorBenchmark();
  benchmark.runAll()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
