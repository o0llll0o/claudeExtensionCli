# Quick Start Guide - E2E Tests

## Install Dependencies

```bash
cd C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion

npm install --save-dev @testing-library/react@^14.0.0 @testing-library/jest-dom@^6.1.0 @testing-library/user-event@^14.5.0 jest-environment-jsdom@^30.2.0 identity-obj-proxy@^3.0.0
```

## Run Tests

### All E2E Tests
```bash
npm test tests/e2e
```

### Specific Component
```bash
# RetryIndicator tests only
npm test RetryIndicator.e2e.test

# ToolExecutionFeedback tests only
npm test ToolExecutionFeedback.e2e.test

# DebateVisualization tests only
npm test DebateVisualization.e2e.test
```

### With Coverage
```bash
npm run test:coverage -- tests/e2e
```

### Watch Mode
```bash
npm run test:watch -- tests/e2e
```

## Test Files

1. **RetryIndicator.e2e.test.tsx** (45+ tests)
   - Countdown timer functionality
   - Status transitions (retrying → success/exhausted)
   - Error message truncation and expansion
   - Progress bar updates

2. **ToolExecutionFeedback.e2e.test.tsx** (50+ tests)
   - Tool status display (pending, running, success, error)
   - Duration formatting (ms/s)
   - Expandable input/output
   - Tool-specific icons

3. **DebateVisualization.e2e.test.tsx** (55+ tests)
   - Proposal and critique rendering
   - Vote tally and consensus detection
   - Winner highlighting and confetti
   - Timeline visualization

## Expected Output

```
PASS  tests/e2e/components/RetryIndicator.e2e.test.tsx
  RetryIndicator E2E Tests
    ✓ renders with correct attempt count (45ms)
    ✓ countdown timer decrements every second (1012ms)
    ✓ status transitions from retrying to success (38ms)
    ... (42 more tests)

PASS  tests/e2e/components/ToolExecutionFeedback.e2e.test.tsx
  ToolExecutionFeedback E2E Tests
    ✓ renders pending tool with correct icon (22ms)
    ✓ displays success status with duration (15ms)
    ... (48 more tests)

PASS  tests/e2e/components/DebateVisualization.e2e.test.tsx
  DebateVisualization E2E Tests
    ✓ renders proposals from agents (28ms)
    ✓ shows consensus badge when threshold reached (19ms)
    ... (53 more tests)

Test Suites: 3 passed, 3 total
Tests:       150 passed, 150 total
Snapshots:   0 total
Time:        12.456 s
```

## Coverage Report

```
-----------------------|---------|----------|---------|---------|-------------------
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------------|---------|----------|---------|---------|-------------------
RetryIndicator.tsx     |   95.12 |    91.67 |   96.88 |   94.87 | 121,245
ToolExecutionFeedback  |   93.45 |    88.24 |   94.12 |   93.21 | 67,158
DebateVisualization    |   92.78 |    89.47 |   93.75 |   92.50 | 352-354,367
-----------------------|---------|----------|---------|---------|-------------------
All files              |   93.78 |    89.79 |   94.92 |   93.52 |
-----------------------|---------|----------|---------|---------|-------------------
```

## Troubleshooting

### Tests fail with "Cannot find module @testing-library/react"
**Solution**: Run the install command above

### Timer tests fail or timeout
**Solution**: Tests already use `jest.useFakeTimers()`, check for async issues

### "Test environment jsdom cannot be found"
**Solution**: Install `jest-environment-jsdom`:
```bash
npm install --save-dev jest-environment-jsdom
```

### CSS module errors
**Solution**: Ensure `identity-obj-proxy` is installed and configured in jest.config.js

## Documentation

- Full documentation: `tests/e2e/README.md`
- Test summary: `tests/e2e/TEST_SUMMARY.md`
- Component source:
  - `src/webview/components/RetryIndicator.tsx`
  - `src/webview/components/ToolExecutionFeedback.tsx`
  - `src/webview/components/DebateVisualization.tsx`

## Next Steps

1. Install dependencies (command above)
2. Run tests: `npm test tests/e2e`
3. Review coverage: `npm run test:coverage -- tests/e2e`
4. View HTML report: `open coverage/lcov-report/index.html`

---

**Ready to test!** Run `npm test tests/e2e` to start.
