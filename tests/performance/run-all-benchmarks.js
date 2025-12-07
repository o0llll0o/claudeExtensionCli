/**
 * Master Benchmark Runner
 *
 * Executes all performance benchmarks and generates comprehensive report
 */

const { RetryLoopBenchmark } = require('./retry-loop.benchmark');
const { ToolEventHandlerBenchmark } = require('./tool-event-handler.benchmark');
const { DebateCoordinatorBenchmark } = require('./debate-coordinator.benchmark');
const { UIRenderingBenchmark } = require('./ui-rendering.benchmark');
const fs = require('fs');
const path = require('path');

class MasterBenchmarkRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        memory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) + 'GB'
      },
      benchmarks: {}
    };
  }

  async runAllBenchmarks() {
    console.log('🚀 MASTER PERFORMANCE BENCHMARK SUITE');
    console.log('=' .repeat(80));
    console.log('\nEnvironment:');
    console.log(`  Node.js: ${this.results.environment.node}`);
    console.log(`  Platform: ${this.results.environment.platform}`);
    console.log(`  CPUs: ${this.results.environment.cpus}`);
    console.log(`  Memory: ${this.results.environment.memory}`);
    console.log('=' .repeat(80));

    try {
      // 1. Retry Loop Benchmarks
      console.log('\n\n🔄 RETRY LOOP BENCHMARKS');
      console.log('=' .repeat(80));
      const retryBenchmark = new RetryLoopBenchmark();
      const retryResults = await retryBenchmark.runAll();
      this.results.benchmarks.retryLoop = retryResults;

      // 2. Tool Event Handler Benchmarks
      console.log('\n\n🛠️  TOOL EVENT HANDLER BENCHMARKS');
      console.log('=' .repeat(80));
      const toolBenchmark = new ToolEventHandlerBenchmark();
      const toolResults = await toolBenchmark.runAll();
      this.results.benchmarks.toolEventHandler = toolResults;

      // 3. Debate Coordinator Benchmarks
      console.log('\n\n💬 DEBATE COORDINATOR BENCHMARKS');
      console.log('=' .repeat(80));
      const debateBenchmark = new DebateCoordinatorBenchmark();
      const debateResults = await debateBenchmark.runAll();
      this.results.benchmarks.debateCoordinator = debateResults;

      // 4. UI Rendering Benchmarks
      console.log('\n\n🎨 UI RENDERING BENCHMARKS');
      console.log('=' .repeat(80));
      const uiBenchmark = new UIRenderingBenchmark();
      const uiResults = await uiBenchmark.runAll();
      this.results.benchmarks.uiRendering = uiResults;

      // Generate final report
      this.generateReport();

      return this.results;

    } catch (error) {
      console.error('\n❌ Benchmark suite failed:', error);
      throw error;
    }
  }

  generateReport() {
    console.log('\n\n' + '=' .repeat(80));
    console.log('📊 COMPREHENSIVE BENCHMARK REPORT');
    console.log('=' .repeat(80));

    const allPassed = Object.values(this.results.benchmarks).every(b => b.passed);

    console.log(`\n🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

    // Individual component status
    console.log('Component Status:');
    Object.entries(this.results.benchmarks).forEach(([name, result]) => {
      const icon = result.passed ? '✅' : '❌';
      const formattedName = name.replace(/([A-Z])/g, ' $1').trim();
      console.log(`  ${icon} ${formattedName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
    });

    // Performance highlights
    console.log('\n📈 Performance Highlights:');

    if (this.results.benchmarks.retryLoop) {
      const avgOverhead = this.results.benchmarks.retryLoop.results.wrapperOverhead
        .reduce((a, b) => a + b, 0) / this.results.benchmarks.retryLoop.results.wrapperOverhead.length;
      console.log(`  • Retry wrapper overhead: ${avgOverhead.toFixed(3)}ms avg`);
    }

    if (this.results.benchmarks.toolEventHandler) {
      const mapOps = this.results.benchmarks.toolEventHandler.results.mapOperations;
      if (mapOps && mapOps.length > 0) {
        const largestScale = mapOps[mapOps.length - 1];
        console.log(`  • Map operations at ${largestScale.scale} entries: ${largestScale.get.avg.toFixed(6)}ms avg`);
      }
    }

    if (this.results.benchmarks.debateCoordinator) {
      const proposals = this.results.benchmarks.debateCoordinator.results.proposalSubmission;
      if (proposals && proposals.length > 0) {
        const avgProposal = proposals.reduce((sum, r) => sum + r.avg, 0) / proposals.length;
        console.log(`  • Proposal submission: ${avgProposal.toFixed(3)}ms avg`);
      }
    }

    if (this.results.benchmarks.uiRendering) {
      const retryUI = this.results.benchmarks.uiRendering.results.retryIndicator;
      if (retryUI && retryUI.length > 0) {
        const avgFPS = retryUI.reduce((sum, r) => sum + r.fps, 0) / retryUI.length;
        console.log(`  • UI rendering FPS: ${avgFPS.toFixed(1)} avg`);
      }
    }

    // Save to file
    const reportPath = path.join(__dirname, 'benchmark-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed results saved to: ${reportPath}`);

    // Generate markdown report
    this.generateMarkdownReport();

    console.log('\n' + '=' .repeat(80));
  }

  generateMarkdownReport() {
    const md = [];

    md.push('# Performance Benchmark Report\n');
    md.push(`**Generated:** ${this.results.timestamp}\n`);
    md.push('## Environment\n');
    md.push('```');
    md.push(`Node.js: ${this.results.environment.node}`);
    md.push(`Platform: ${this.results.environment.platform}`);
    md.push(`CPUs: ${this.results.environment.cpus}`);
    md.push(`Memory: ${this.results.environment.memory}`);
    md.push('```\n');

    md.push('## Overall Results\n');
    md.push('| Component | Status |');
    md.push('|-----------|--------|');
    Object.entries(this.results.benchmarks).forEach(([name, result]) => {
      const formattedName = name.replace(/([A-Z])/g, ' $1').trim();
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      md.push(`| ${formattedName} | ${status} |`);
    });
    md.push('');

    md.push('## Detailed Results\n');

    // Retry Loop
    if (this.results.benchmarks.retryLoop) {
      md.push('### Retry Loop Performance\n');
      const results = this.results.benchmarks.retryLoop.results;

      if (results.wrapperOverhead.length > 0) {
        const avg = results.wrapperOverhead.reduce((a, b) => a + b, 0) / results.wrapperOverhead.length;
        md.push(`- **Wrapper Overhead:** ${avg.toFixed(3)}ms average`);
      }

      md.push('');
    }

    // Tool Event Handler
    if (this.results.benchmarks.toolEventHandler) {
      md.push('### Tool Event Handler Performance\n');
      const results = this.results.benchmarks.toolEventHandler.results;

      if (results.mapOperations.length > 0) {
        md.push('**Map Operations:**');
        results.mapOperations.forEach(r => {
          md.push(`- ${r.scale} entries: GET ${r.get.avg.toFixed(6)}ms, SET ${r.set.avg.toFixed(6)}ms`);
        });
      }
      md.push('');
    }

    // Debate Coordinator
    if (this.results.benchmarks.debateCoordinator) {
      md.push('### Debate Coordinator Performance\n');
      const results = this.results.benchmarks.debateCoordinator.results;

      if (results.proposalSubmission.length > 0) {
        md.push('**Proposal Submission:**');
        results.proposalSubmission.forEach(r => {
          md.push(`- ${r.proposalCount} proposals: ${r.avg.toFixed(3)}ms average`);
        });
      }
      md.push('');
    }

    // UI Rendering
    if (this.results.benchmarks.uiRendering) {
      md.push('### UI Rendering Performance\n');
      const results = this.results.benchmarks.uiRendering.results;

      if (results.retryIndicator.length > 0) {
        md.push('**RetryIndicator:**');
        results.retryIndicator.forEach(r => {
          md.push(`- ${r.scenario}: ${r.avg.toFixed(3)}ms (${r.fps.toFixed(1)} FPS)`);
        });
      }
      md.push('');
    }

    const reportPath = path.join(__dirname, 'BENCHMARK_REPORT.md');
    fs.writeFileSync(reportPath, md.join('\n'));
    console.log(`📄 Markdown report saved to: ${reportPath}`);
  }
}

// Run if executed directly
if (require.main === module) {
  const runner = new MasterBenchmarkRunner();
  runner.runAllBenchmarks()
    .then(results => {
      const allPassed = Object.values(results.benchmarks).every(b => b.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { MasterBenchmarkRunner };
