/**
 * Performance Benchmarks for Tool Event Handler
 *
 * Tests Map operations, circular buffer performance, event listener overhead,
 * and memory growth patterns
 * Based on rev-4's performance requirements
 */

const { performance } = require('perf_hooks');

/**
 * Circular Buffer Implementation
 */
class CircularBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  get(index) {
    if (index >= this.size) return undefined;
    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  toArray() {
    const result = [];
    for (let i = 0; i < this.size; i++) {
      result.push(this.get(i));
    }
    return result;
  }

  clear() {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}

/**
 * Tool Event Handler Implementation
 */
class ToolEventHandler {
  constructor(config = {}) {
    this.useCircularBuffer = config.useCircularBuffer !== false;
    this.bufferCapacity = config.bufferCapacity || 1000;

    this.toolEvents = new Map();
    this.eventListeners = new Map();

    if (this.useCircularBuffer) {
      this.eventHistory = new CircularBuffer(this.bufferCapacity);
    } else {
      this.eventHistory = [];
    }
  }

  recordEvent(toolName, event) {
    const startTime = performance.now();

    // Map operations
    if (!this.toolEvents.has(toolName)) {
      this.toolEvents.set(toolName, []);
    }
    this.toolEvents.get(toolName).push(event);

    // Buffer operations
    if (this.useCircularBuffer) {
      this.eventHistory.push(event);
    } else {
      this.eventHistory.push(event);
      if (this.eventHistory.length > this.bufferCapacity) {
        this.eventHistory.shift();
      }
    }

    const endTime = performance.now();
    return endTime - startTime;
  }

  addEventListener(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
  }

  emitEvent(eventType, data) {
    const startTime = performance.now();

    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(callback => callback(data));

    const endTime = performance.now();
    return endTime - startTime;
  }

  getEventCount(toolName) {
    return this.toolEvents.get(toolName)?.length || 0;
  }

  getHistory() {
    return this.useCircularBuffer ? this.eventHistory.toArray() : this.eventHistory;
  }
}

/**
 * Benchmark Suite for Tool Event Handler Performance
 */
class ToolEventHandlerBenchmark {
  constructor() {
    this.results = {
      mapOperations: [],
      circularBuffer: [],
      unboundedArray: [],
      eventListeners: [],
      memoryGrowth: []
    };
  }

  /**
   * Benchmark Map operations (get/set/delete) at scale
   * Target: < 1ms for operations, O(1) complexity
   */
  benchmarkMapOperations() {
    console.log('\n📊 Benchmarking Map Operations at Scale...');
    const scales = [100, 1000, 10000, 50000];

    scales.forEach(scale => {
      const handler = new ToolEventHandler();
      const setTimes = [];
      const getTimes = [];
      const deleteTimes = [];

      // SET operations
      for (let i = 0; i < scale; i++) {
        const startTime = performance.now();
        handler.toolEvents.set(`tool_${i}`, { id: i, data: 'test' });
        const endTime = performance.now();
        setTimes.push(endTime - startTime);
      }

      // GET operations
      for (let i = 0; i < scale; i++) {
        const startTime = performance.now();
        handler.toolEvents.get(`tool_${i}`);
        const endTime = performance.now();
        getTimes.push(endTime - startTime);
      }

      // DELETE operations
      for (let i = 0; i < scale; i++) {
        const startTime = performance.now();
        handler.toolEvents.delete(`tool_${i}`);
        const endTime = performance.now();
        deleteTimes.push(endTime - startTime);
      }

      const avgSet = setTimes.reduce((a, b) => a + b, 0) / setTimes.length;
      const avgGet = getTimes.reduce((a, b) => a + b, 0) / getTimes.length;
      const avgDelete = deleteTimes.reduce((a, b) => a + b, 0) / deleteTimes.length;

      const result = {
        scale,
        set: { avg: avgSet, max: Math.max(...setTimes) },
        get: { avg: avgGet, max: Math.max(...getTimes) },
        delete: { avg: avgDelete, max: Math.max(...deleteTimes) },
        passed: avgSet < 1 && avgGet < 1 && avgDelete < 1
      };

      this.results.mapOperations.push(result);

      console.log(`  ${scale} entries:`);
      console.log(`    SET - avg: ${avgSet.toFixed(6)}ms, max: ${Math.max(...setTimes).toFixed(6)}ms`);
      console.log(`    GET - avg: ${avgGet.toFixed(6)}ms, max: ${Math.max(...getTimes).toFixed(6)}ms`);
      console.log(`    DELETE - avg: ${avgDelete.toFixed(6)}ms, max: ${Math.max(...deleteTimes).toFixed(6)}ms`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 1ms`);
    });

    return this.results.mapOperations;
  }

  /**
   * Benchmark circular buffer vs unbounded array performance
   * Target: O(1) operations for circular buffer
   */
  benchmarkBufferPerformance() {
    console.log('\n📊 Benchmarking Circular Buffer vs Unbounded Array...');
    const eventCounts = [1000, 5000, 10000, 50000];

    eventCounts.forEach(eventCount => {
      // Circular Buffer Test
      const circularHandler = new ToolEventHandler({ useCircularBuffer: true, bufferCapacity: 1000 });
      const circularTimes = [];

      for (let i = 0; i < eventCount; i++) {
        const recordTime = circularHandler.recordEvent(`tool_${i % 100}`, {
          id: i,
          timestamp: Date.now(),
          data: { value: Math.random() }
        });
        circularTimes.push(recordTime);
      }

      const circularAvg = circularTimes.reduce((a, b) => a + b, 0) / circularTimes.length;
      const circularMax = Math.max(...circularTimes);

      // Unbounded Array Test
      const arrayHandler = new ToolEventHandler({ useCircularBuffer: false, bufferCapacity: 1000 });
      const arrayTimes = [];

      for (let i = 0; i < eventCount; i++) {
        const recordTime = arrayHandler.recordEvent(`tool_${i % 100}`, {
          id: i,
          timestamp: Date.now(),
          data: { value: Math.random() }
        });
        arrayTimes.push(recordTime);
      }

      const arrayAvg = arrayTimes.reduce((a, b) => a + b, 0) / arrayTimes.length;
      const arrayMax = Math.max(...arrayTimes);

      this.results.circularBuffer.push({
        eventCount,
        avg: circularAvg,
        max: circularMax,
        passed: circularAvg < 1
      });

      this.results.unboundedArray.push({
        eventCount,
        avg: arrayAvg,
        max: arrayMax,
        passed: arrayAvg < 1
      });

      console.log(`  ${eventCount} events:`);
      console.log(`    Circular Buffer - avg: ${circularAvg.toFixed(3)}ms, max: ${circularMax.toFixed(3)}ms ${circularAvg < 1 ? '✅' : '❌'}`);
      console.log(`    Unbounded Array - avg: ${arrayAvg.toFixed(3)}ms, max: ${arrayMax.toFixed(3)}ms ${arrayAvg < 1 ? '✅' : '❌'}`);
      console.log(`    Performance gain: ${((arrayAvg - circularAvg) / arrayAvg * 100).toFixed(1)}%`);
    });

    return {
      circular: this.results.circularBuffer,
      unbounded: this.results.unboundedArray
    };
  }

  /**
   * Event listener overhead with many listeners
   * Target: < 5ms with 100 listeners
   */
  benchmarkEventListeners() {
    console.log('\n📊 Benchmarking Event Listener Overhead...');
    const listenerCounts = [10, 50, 100, 500];

    listenerCounts.forEach(listenerCount => {
      const handler = new ToolEventHandler();

      // Add listeners
      for (let i = 0; i < listenerCount; i++) {
        handler.addEventListener('tool:executed', (data) => {
          // Simulate minimal processing
          const result = data.id * 2;
        });
      }

      // Measure emission time
      const emissionTimes = [];
      for (let i = 0; i < 100; i++) {
        const emitTime = handler.emitEvent('tool:executed', { id: i, data: 'test' });
        emissionTimes.push(emitTime);
      }

      const avgEmission = emissionTimes.reduce((a, b) => a + b, 0) / emissionTimes.length;
      const maxEmission = Math.max(...emissionTimes);

      const result = {
        listenerCount,
        avg: avgEmission,
        max: maxEmission,
        passed: avgEmission < 5
      };

      this.results.eventListeners.push(result);

      console.log(`  ${listenerCount} listeners:`);
      console.log(`    ✓ Average emission: ${avgEmission.toFixed(3)}ms`);
      console.log(`    ✓ Max emission: ${maxEmission.toFixed(3)}ms`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 5ms`);
    });

    return this.results.eventListeners;
  }

  /**
   * Memory growth over 1000+ tool events
   * Target: Linear memory growth, < 100KB per 1000 events
   */
  async benchmarkMemoryGrowth() {
    console.log('\n📊 Benchmarking Memory Growth Over Tool Events...');

    if (global.gc) {
      global.gc();
    }

    const eventBatches = [1000, 2000, 5000, 10000];
    const circularHandler = new ToolEventHandler({ useCircularBuffer: true, bufferCapacity: 1000 });
    const arrayHandler = new ToolEventHandler({ useCircularBuffer: false, bufferCapacity: 1000 });

    for (const batchSize of eventBatches) {
      // Circular buffer memory test
      if (global.gc) global.gc();
      const circularBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < batchSize; i++) {
        circularHandler.recordEvent(`tool_${i % 100}`, {
          id: i,
          timestamp: Date.now(),
          data: { value: Math.random(), payload: 'x'.repeat(100) }
        });
      }

      const circularAfter = process.memoryUsage().heapUsed;
      const circularDelta = circularAfter - circularBefore;

      // Array buffer memory test
      if (global.gc) global.gc();
      const arrayBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < batchSize; i++) {
        arrayHandler.recordEvent(`tool_${i % 100}`, {
          id: i,
          timestamp: Date.now(),
          data: { value: Math.random(), payload: 'x'.repeat(100) }
        });
      }

      const arrayAfter = process.memoryUsage().heapUsed;
      const arrayDelta = arrayAfter - arrayBefore;

      const result = {
        eventCount: batchSize,
        circularMemory: circularDelta,
        arrayMemory: arrayDelta,
        circularPer1000: (circularDelta / batchSize) * 1000,
        arrayPer1000: (arrayDelta / batchSize) * 1000,
        passed: (circularDelta / batchSize) * 1000 < 100 * 1024 // < 100KB per 1000 events
      };

      this.results.memoryGrowth.push(result);

      console.log(`  ${batchSize} events:`);
      console.log(`    Circular Buffer: ${(circularDelta / 1024).toFixed(2)}KB (${(result.circularPer1000 / 1024).toFixed(2)}KB/1000 events)`);
      console.log(`    Unbounded Array: ${(arrayDelta / 1024).toFixed(2)}KB (${(result.arrayPer1000 / 1024).toFixed(2)}KB/1000 events)`);
      console.log(`    Memory saved: ${((arrayDelta - circularDelta) / 1024).toFixed(2)}KB`);
      console.log(`    ${result.passed ? '✅' : '❌'} Target: < 100KB per 1000 events`);
    }

    return this.results.memoryGrowth;
  }

  /**
   * Run all benchmarks and generate report
   */
  async runAll() {
    console.log('🚀 Starting Tool Event Handler Performance Benchmarks\n');
    console.log('='.repeat(60));

    const mapResults = this.benchmarkMapOperations();
    const bufferResults = this.benchmarkBufferPerformance();
    const listenerResults = this.benchmarkEventListeners();
    const memoryResults = await this.benchmarkMemoryGrowth();

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 BENCHMARK SUMMARY');
    console.log('='.repeat(60));

    const allPassed =
      mapResults.every(r => r.passed) &&
      bufferResults.circular.every(r => r.passed) &&
      listenerResults.every(r => r.passed) &&
      memoryResults.every(r => r.passed);

    console.log(`\nOverall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\nDetailed Results:');
    console.log(`  Map Operations: ${mapResults.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Circular Buffer: ${bufferResults.circular.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Event Listeners: ${listenerResults.every(r => r.passed) ? '✅' : '❌'}`);
    console.log(`  Memory Growth: ${memoryResults.every(r => r.passed) ? '✅' : '❌'}`);

    return {
      passed: allPassed,
      results: this.results
    };
  }
}

// Export for use in test runners
module.exports = { ToolEventHandlerBenchmark, ToolEventHandler, CircularBuffer };

// Run benchmarks if executed directly
if (require.main === module) {
  const benchmark = new ToolEventHandlerBenchmark();
  benchmark.runAll()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
