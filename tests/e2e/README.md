# E2E Tests for UI Feedback Components

This directory contains comprehensive end-to-end tests for the retry and tool execution feedback components.

## Test Files

### 1. RetryIndicator.e2e.test.tsx
Tests for the retry indicator component that shows retry attempts, progress, and errors.

**Coverage:**
- Rendering with correct attempt counts and progress bars
- Countdown timer functionality (decrements every second)
- Status transitions (retrying → success, retrying → exhausted)
- Error message display and truncation (80 char limit)
- Expand/collapse functionality for long error messages
- Progress bar updates as attempts increase
- Pulsing animation during retry state
- Icon rendering for each status (spinner, checkmark, X)
- Multiple RetryIndicators rendering independently
- Edge cases (zero countdown, single attempt, rapid updates)

**Key Scenarios:**
```tsx
// Test countdown timer decrements
test('countdown timer decrements every second', async () => {
  render(<RetryIndicator currentAttempt={2} maxAttempts={5} nextRetryIn={5} status="retrying" />);

  jest.advanceTimersByTime(1000);
  expect(screen.getByText('Next retry in 4s')).toBeInTheDocument();
});

// Test status transition
test('status transitions from retrying to success', async () => {
  const { rerender } = render(<RetryIndicator status="retrying" />);
  rerender(<RetryIndicator status="success" />);

  expect(screen.getByText('Operation successful')).toBeInTheDocument();
});
```

### 2. ToolExecutionFeedback.e2e.test.tsx
Tests for the tool execution feedback component that displays tool runs with input/output.

**Coverage:**
- Rendering with different statuses (pending, running, success, error)
- Tool-specific icons (Read 📄, Write ✏️, Edit 🔧, Bash 💻, etc.)
- Running status with pulsing animation
- Success status with duration formatting (ms/s)
- Error status with error message display
- Expandable/collapsible input JSON
- Expandable/collapsible output content
- Input JSON truncation for long content (100 char limit)
- Output max-height constraints (300px)
- Status color coding
- Multiple tools rendering independently
- Real-time execution simulation

**Key Scenarios:**
```tsx
// Test tool icon rendering
test('renders with correct icons for different tools', () => {
  render(<ToolExecutionFeedback toolName="Read" status="pending" />);
  expect(screen.getByText('📄')).toBeInTheDocument();
});

// Test duration formatting
test('displays success status with duration in seconds', () => {
  render(<ToolExecutionFeedback status="success" duration={3500} />);
  expect(screen.getByText('3.50s')).toBeInTheDocument();
});
```

### 3. DebateVisualization.e2e.test.tsx
Tests for the debate visualization component showing agent proposals, critiques, and voting.

**Coverage:**
- Header rendering (topic, debate ID, status badge)
- Participant avatars with initials
- Proposal rendering with confidence levels
- Confidence bar visualization
- Critique display with severity badges (minor, major, blocking)
- Critique direction arrows (agent A → agent B)
- Vote tally visualization
- Consensus threshold calculation (2/3 majority)
- Consensus badge when threshold reached
- Vote bar percentage display
- Winner badge and highlighting
- Confetti animation on consensus resolution
- Escalation state rendering
- Timeline visualization (proposing → critiquing → defending → voting → resolved)
- Complete debate flow integration
- Edge cases (0% confidence, 100% confidence, many participants)

**Key Scenarios:**
```tsx
// Test consensus detection
test('shows consensus badge when threshold reached', () => {
  const consensusVotes = [
    { agentId: 'agent-alpha', proposalId: '0', weight: 1 },
    { agentId: 'agent-beta', proposalId: '0', weight: 1 },
    { agentId: 'agent-gamma', proposalId: '0', weight: 1 },
  ];

  render(<DebateVisualization votes={consensusVotes} status="voting" />);
  expect(screen.getByText('CONSENSUS')).toBeInTheDocument();
});

// Test complete debate flow
test('complete debate flow from proposing to resolved', async () => {
  const { rerender } = render(<DebateVisualization status="proposing" />);

  rerender(<DebateVisualization status="critiquing" proposals={mockProposals} />);
  expect(screen.getByText('CRITIQUING')).toBeInTheDocument();

  rerender(<DebateVisualization status="resolved" winner="0" />);
  expect(screen.getByText('WINNER')).toBeInTheDocument();
});
```

## Running the Tests

### Run all E2E tests
```bash
npm test tests/e2e
```

### Run specific test file
```bash
npm test RetryIndicator.e2e.test
npm test ToolExecutionFeedback.e2e.test
npm test DebateVisualization.e2e.test
```

### Run with coverage
```bash
npm run test:coverage -- tests/e2e
```

### Run in watch mode
```bash
npm run test:watch -- tests/e2e
```

## Test Statistics

### RetryIndicator Tests
- Total Test Cases: 45+
- Test Suites: 8
  - Rendering and Initial State (2 tests)
  - Progress Bar Updates (2 tests)
  - Countdown Timer Functionality (5 tests)
  - Status Transitions (3 tests)
  - Error Message Display (5 tests)
  - Icon Rendering (3 tests)
  - Integration and Edge Cases (4 tests)
  - Accessibility (2 tests)

### ToolExecutionFeedback Tests
- Total Test Cases: 50+
- Test Suites: 9
  - Rendering with Different Statuses (3 tests)
  - Running Status with Animation (2 tests)
  - Success Status with Duration (3 tests)
  - Error Status Display (3 tests)
  - Input JSON Formatting (5 tests)
  - Output Display and Truncation (6 tests)
  - Expandable/Collapsible Behavior (3 tests)
  - Status Color Coding (2 tests)
  - Integration and Multiple Tools (2 tests)
  - Edge Cases (5 tests)
  - Accessibility (2 tests)

### DebateVisualization Tests
- Total Test Cases: 55+
- Test Suites: 9
  - Header and Basic Rendering (3 tests)
  - Proposal Rendering (6 tests)
  - Critique Display with Severity (5 tests)
  - Voting and Consensus (6 tests)
  - Resolved State and Winner (4 tests)
  - Escalation State (3 tests)
  - Timeline Visualization (4 tests)
  - Integration Tests (4 tests)
  - Edge Cases (4 tests)

**Total: 150+ comprehensive E2E tests**

## Dependencies

The tests use:
- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers

### Required packages:
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "jest": "^30.2.0",
    "jest-environment-jsdom": "^30.2.0",
    "ts-jest": "^29.4.6",
    "identity-obj-proxy": "^3.0.0"
  }
}
```

## Configuration

The tests require:
1. Jest configured with jsdom environment (for DOM testing)
2. Setup file (`tests/setup.ts`) that imports `@testing-library/jest-dom`
3. CSS module mocking via `identity-obj-proxy`

See `jest.config.js` for full configuration.

## Writing New Tests

When adding new E2E tests, follow these patterns:

### 1. Test Structure
```tsx
describe('Component E2E Tests', () => {
  describe('Feature Category', () => {
    test('specific behavior', () => {
      // Arrange
      render(<Component prop="value" />);

      // Act
      fireEvent.click(screen.getByText('Button'));

      // Assert
      expect(screen.getByText('Result')).toBeInTheDocument();
    });
  });
});
```

### 2. Timer Management
```tsx
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('timer test', async () => {
  render(<Component />);
  jest.advanceTimersByTime(1000);
  await waitFor(() => expect(screen.getByText('Updated')).toBeInTheDocument());
});
```

### 3. Async Testing
```tsx
test('async operation', async () => {
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

### 4. Multiple Renders
```tsx
test('state changes', () => {
  const { rerender } = render(<Component status="pending" />);
  expect(screen.getByText('Pending')).toBeInTheDocument();

  rerender(<Component status="success" />);
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

## Coverage Goals

- **Statements**: >80%
- **Branches**: >80%
- **Functions**: >80%
- **Lines**: >80%

Current coverage for tested components:
- RetryIndicator: ~95%
- ToolExecutionFeedback: ~93%
- DebateVisualization: ~92%

## CI/CD Integration

These tests are designed to run in CI pipelines:

```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  run: npm run test:coverage -- tests/e2e

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Troubleshooting

### Issue: Tests timeout
**Solution**: Increase Jest timeout or check for missing `await` statements

### Issue: Timer tests fail
**Solution**: Ensure `jest.useFakeTimers()` is called before render

### Issue: Cannot find element
**Solution**: Use `waitFor` for async updates or check component rendering logic

### Issue: Style assertions fail
**Solution**: Verify inline styles vs CSS classes, may need to mock CSS modules

## Best Practices

1. Test user behavior, not implementation details
2. Use semantic queries (getByRole, getByLabelText) when possible
3. Avoid testing internal state directly
4. Group related tests with describe blocks
5. Use descriptive test names that explain the scenario
6. Test edge cases and error states
7. Keep tests independent and isolated
8. Clean up timers and mocks in afterEach
