# Performance Benchmark Suite

Comprehensive performance benchmarking for autonomous agent startup components based on rev-4's recommendations.

## Overview

This benchmark suite measures performance across four critical areas:

1. **Retry Loop Performance** - Retry wrapper overhead, backoff strategies, memory usage
2. **Tool Event Handler** - Map operations, circular buffers, event listeners
3. **Debate Coordinator** - Proposal processing, critique evaluation, vote tallying
4. **UI Rendering** - Component render times, FPS measurement

## Requirements

- Node.js 14+
- For accurate memory measurements, run with `--expose-gc` flag

## Running Benchmarks

### Run All Benchmarks
```bash
npm run bench:all
```

### Run Individual Benchmarks
```bash
npm run bench:retry      # Retry loop benchmarks
npm run bench:tools      # Tool event handler benchmarks
npm run bench:debate     # Debate coordinator benchmarks
npm run bench:ui         # UI rendering benchmarks
```

### Run with Garbage Collection Control
```bash
npm run bench:gc
```

## Performance Targets

### Retry Loop
- ✅ Wrapper overhead: < 10ms per operation
- ✅ Backoff calculation: < 1ms
- ✅ Memory overhead: < 1KB per retry
- ✅ Event emission: < 5ms

### Tool Event Handler
- ✅ Map operations: O(1), < 1ms
- ✅ Circular buffer operations: O(1)
- ✅ Event listeners: < 5ms with 100 listeners
- ✅ Memory growth: < 100KB per 1000 events

### Debate Coordinator
- ✅ Proposal submission: < 10ms
- ✅ Critique evaluation: < 5ms per critique
- ✅ Vote tallying: < 20ms for 100+ participants
- ✅ Memory per round: < 500KB

### UI Rendering
- ✅ RetryIndicator: < 16ms (60fps)
- ✅ ToolExecutionFeedback: < 16ms with large outputs
- ✅ DebateVisualization: < 16ms with 50+ proposals

## Output

### Console Output
Real-time benchmark results with pass/fail indicators:
- ✅ Green checkmarks for passing benchmarks
- ❌ Red X marks for failing benchmarks
- Detailed timing and performance metrics

### Generated Files
- `benchmark-results.json` - Complete results in JSON format
- `BENCHMARK_REPORT.md` - Human-readable markdown report

## Example Output

```
🚀 MASTER PERFORMANCE BENCHMARK SUITE
================================================================================

Environment:
  Node.js: v18.17.0
  Platform: win32
  CPUs: 8
  Memory: 16GB
================================================================================


🔄 RETRY LOOP BENCHMARKS
================================================================================

📊 Benchmarking Retry Wrapper Overhead...
  ✓ Average overhead: 2.145ms
  ✓ Min overhead: 1.234ms
  ✓ Max overhead: 8.432ms
  ✅ Target: < 10ms

...

📋 BENCHMARK SUMMARY
================================================================================

🎯 Overall Status: ✅ ALL TESTS PASSED
```

## Architecture

### Benchmark Structure
Each benchmark suite follows a consistent pattern:

1. **Component Implementation** - Reference implementation for testing
2. **Benchmark Class** - Organized test methods
3. **Multiple Scales** - Tests at various load levels
4. **Detailed Metrics** - Average, max, percentiles
5. **Pass/Fail Criteria** - Based on rev-4 requirements

### Key Features
- Isolated benchmark runs
- Multiple scale testing (10, 50, 100, 500+ items)
- Memory profiling with GC control
- Statistical analysis (avg, max, percentiles)
- JSON and Markdown reports

## Integration

These benchmarks can be integrated into CI/CD pipelines:

```bash
# In CI pipeline
node --expose-gc tests/performance/run-all-benchmarks.js
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All benchmarks passed"
else
  echo "❌ Benchmarks failed"
  exit 1
fi
```

## Extending Benchmarks

To add new benchmarks:

1. Create new benchmark file: `[component].benchmark.js`
2. Implement benchmark class following the existing pattern
3. Add to `run-all-benchmarks.js`
4. Update package.json scripts
5. Document performance targets in README

## Performance Optimization

If benchmarks fail:

1. **Review Implementation** - Check for inefficiencies
2. **Analyze Bottlenecks** - Use detailed metrics to identify slow operations
3. **Optimize Algorithms** - Consider better data structures
4. **Reduce Allocations** - Minimize object creation
5. **Use Profilers** - Node.js profiler for deep analysis

## Notes

- Results may vary based on system resources
- Run multiple times for consistent measurements
- Memory benchmarks require `--expose-gc`
- Close other applications for accurate results
- Results reflect single-threaded performance

## Credits

Created by qa-5 (Performance Benchmarking Specialist) based on recommendations from rev-4 (Code Reviewer).
