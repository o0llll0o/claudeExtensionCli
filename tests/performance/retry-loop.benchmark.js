/**
 * Performance Benchmarks for Retry Loop Mechanisms
 *
 * Tests retry wrapper overhead, backoff strategies, memory usage, and event emissions
 * Based on rev-4's performance requirements
 */

const { performance } = require('perf_hooks');

/**
 * Retry wrapper implementation for benchmarking
 */
class RetryWrapper {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.backoffStrategy = config.backoffStrategy || 'exponential';
    this.baseDelay = config.baseDelay || 100;
    this.maxDelay = config.maxDelay || 5000;
    this.eventListeners = [];
  }

  calculateBackoff(attempt) {
    const startTime = performance.now();
    let delay;

    switch (this.backoffStrategy) {
      case 'exponential':
        delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
        break;
      case 'linear':
        delay = Math.min(this.baseDelay * (attempt + 1), this.maxDelay);
        break;
      case 'fixed':
        delay = this.baseDelay;
        break;
      default:
        delay = this.baseDelay;
    }

    const endTime = performance.now();
    return { delay, computeTime: endTime - startTime };
  }

  emitEvent(eventName, data) {
    const startTime = performance.now();
    this.eventListeners.forEach(listener => {
      if (listener.event === eventName) {
        listener.callback(data);
      }
    });
    const endTime = performance.now();
    return endTime - startTime;
  }

  addEventListener(event, callback) {
    this.eventListeners.push({ event, callback });
  }

  async execute(fn, context = {}) {
    const startTime = performance.now();
    let attempt = 0;
    let lastError;

    while (attempt < this.maxRetries) {
      try {
        this.emitEvent('retry:attempt', { attempt, context });
        const result = await fn();
        this.emitEvent('retry:success', { attempt, context });

        const endTime = performance.now();
        return {
          result,
          totalTime: endTime - startTime,
          attempts: attempt + 1
        };
      } catch (error) {
        lastError = error;
        this.emitEvent('retry:error', { attempt, error, context });

        if (attempt < this.maxRetries - 1) {
          const { delay } = this.calculateBackoff(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        attempt++;
      }
    }

    this.emitEvent('retry:failed', { attempts: attempt, error: lastError, context });
    throw lastError;
  }
}

/**
 * Benchmark Suite for Retry Loop Performance
 */
class RetryLoopBenchmark {
  constructor() {
    this.results = {
      wrapperOverhead: [],
      backoffStrategies: {},
      memoryUsage: [],
      eventEmissions: []
    };
  }

  /**
   * Measure retry wrapper overhead
   * Target: < 10ms per operation
   */
  async benchmarkWrapperOverhead() {
    console.log('\n📊 Benchmarking Retry Wrapper Overhead...');
    const iterations = 1000;
    const wrapper = new RetryWrapper({ maxRetries: 1 });

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      await wrapper.execute(async () => {
        return 'success';
      });

      const endTime = performance.now();
      const overhead = endTime - startTime;
      this.results.wrapperOverhead.push(overhead);
    }

    const avgOverhead = this.results.wrapperOverhead.reduce((a, b) => a + b, 0) / iterations;
    const maxOverhead = Math.max(...this.results.wrapperOverhead);
    const minOverhead = Math.min(...this.results.wrapperOverhead);

    console.log(`  ✓ Average overhead: ${avgOverhead.toFixed(3)}ms`);
    console.log(`  ✓ Min overhead: ${minOverhead.toFixed(3)}ms`);
    console.log(`  ✓ Max overhead: ${maxOverhead.toFixed(3)}ms`);
    console.log(`  ${avgOverhead < 10 ? '✅' : '❌'} Target: < 10ms`);

    return {
      avg: avgOverhead,
      max: maxOverhead,
      min: minOverhead,
      passed: avgOverhead < 10
    };
  }

  /**
   * Benchmark backoff strategy calculation performance
   * Target: < 1ms per calculation
   */
  benchmarkBackoffStrategies() {
    console.log('\n📊 Benchmarking Backoff Strategy Calculation...');
    const strategies = ['exponential', 'linear', 'fixed'];
    const attempts = [0, 1, 2, 5, 10, 20];

    strategies.forEach(strategy => {
      const wrapper = new RetryWrapper({ backoffStrategy: strategy });
      const timings = [];

      attempts.forEach(attempt => {
        const startTime = performance.now();
        for (let i = 0; i < 10000; i++) {
          wrapper.calculateBackoff(attempt);
        }
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 10000;
        timings.push(avgTime);
      });

      const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
      this.results.backoffStrategies[strategy] = {
        avg: avgTiming,
        max: Math.max(...timings),
        passed: avgTiming < 1
      };

      console.log(`  ${strategy}:`);
      console.log(`    ✓ Average: ${avgTiming.toFixed(6)}ms`);
      console.log(`    ${avgTiming < 1 ? '✅' : '❌'} Target: < 1ms`);
    });

    return this.results.backoffStrategies;
  }

  /**
   * Memory profile during multi-retry scenarios
   * Target: < 1KB overhead per retry
   */
  async benchmarkMemoryUsage() {
    console.log('\n📊 Benchmarking Memory Usage During Retries...');

    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;
    const retryScenarios = [10, 50, 100, 500];

    for (const retryCount of retryScenarios) {
      const wrapper = new RetryWrapper({ maxRetries: retryCount });
      const beforeMemory = process.memoryUsage().heapUsed;

      let attempt = 0;
      try {
        await wrapper.execute(async () => {
          attempt++;
          if (attempt < retryCount) {
            throw new Error('Simulated failure');
          }
          return 'success';
        });
      } catch (error) {
        // Expected to fail
      }

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryDelta = afterMemory - beforeMemory;
      const perRetryOverhead = memoryDelta / retryCount;

      this.results.memoryUsage.push({
        retryCount,
        totalMemory: memoryDelta,
        perRetryOverhead,
        passed: perRetryOverhead < 1024 // < 1KB
      });

      console.log(`  ${retryCount} retries:`);
      console.log(`    ✓ Total memory: ${(memoryDelta / 1024).toFixed(2)}KB`);
      console.log(`    ✓ Per retry: ${perRetryOverhead.toFixed(2)}B`);
      console.log(`    ${perRetryOverhead < 1024 ? '✅' : '❌'} Target: < 1KB per retry`);
    }

    return this.results.memoryUsage;
  }

  /**
   * Event emission overhead measurement
   * Target: < 5ms for event emission
   */
  async benchmarkEventEmissions() {
    console.log('\n📊 Benchmarking Event Emission Overhead...');
    const listenerCounts = [1, 10, 50, 100];

    for (const listenerCount of listenerCounts) {
      const wrapper = new RetryWrapper({ maxRetries: 3 });

      // Add listeners
      for (let i = 0; i < listenerCount; i++) {
        wrapper.addEventListener('retry:attempt', () => {
          // Simulate minimal processing
          const x = Math.random();
        });
      }

      const emissionTimes = [];
      for (let i = 0; i < 100; i++) {
        const emitTime = wrapper.emitEvent('retry:attempt', { attempt: i });
        emissionTimes.push(emitTime);
      }

      const avgEmissionTime = emissionTimes.reduce((a, b) => a + b, 0) / emissionTimes.length;
      const maxEmissionTime = Math.max(...emissionTimes);

      this.results.eventEmissions.push({
        listenerCount,
        avg: avgEmissionTime,
        max: maxEmissionTime,
        passed: avgEmissionTime < 5
      });

      console.log(`  ${listenerCount} listeners:`);
      console.log(`    ✓ Average emission: ${avgEmissionTime.toFixed(3)}ms`);
      console.log(`    ✓ Max emission: ${maxEmissionTime.toFixed(3)}ms`);
      console.log(`    ${avgEmissionTime < 5 ? '✅' : '❌'} Target: < 5ms`);
    }

    return this.results.eventEmissions;
  }

  /**
   * Run all benchmarks and generate report
   */
  async runAll() {
    console.log('🚀 Starting Retry Loop Performance Benchmarks\n');
    console.log('=' .repeat(60));

    const overheadResults = await this.benchmarkWrapperOverhead();
    const backoffResults = this.benchmarkBackoffStrategies();
    const memoryResults = await this.benchmarkMemoryUsage();
    const eventResults = await this.benchmarkEventEmissions();

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 BENCHMARK SUMMARY');
    console.log('='.repeat(60));

    const allPassed =
      overheadResults.passed &&
      Object.values(backoffResults).every(r => r.passed) &&
      memoryResults.every(r => r.passed) &&
      eventResults.every(r => r.passed);

    console.log(`\nOverall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\nDetailed Results:');
    console.log(`  Wrapper Overhead: ${overheadResults.passed ? '✅' : '❌'} (${overheadResults.avg.toFixed(3)}ms avg)`);
    console.log(`  Backoff Strategies: ${Object.values(backoffResults).every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Memory Usage: ${memoryResults.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Event Emissions: ${eventResults.every(r => r.passed) ? '✅' : '❌'}`);

    return {
      passed: allPassed,
      results: this.results
    };
  }
}

// Export for use in test runners
module.exports = { RetryLoopBenchmark, RetryWrapper };

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new RetryLoopBenchmark();
  benchmark.runAll()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
