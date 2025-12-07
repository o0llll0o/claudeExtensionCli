import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RetryIndicator } from '../../../src/webview/components/RetryIndicator';

/**
 * E2E Tests for RetryIndicator Component
 *
 * Test Scenarios:
 * 1. Renders with correct attempt count
 * 2. Progress bar updates percentage
 * 3. Countdown timer decrements
 * 4. Status transitions: retrying → success
 * 5. Status transitions: retrying → exhausted
 * 6. Error message displays truncated
 * 7. Cancel/expand functionality
 */

describe('RetryIndicator E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering and Initial State', () => {
    test('renders with correct attempt count', () => {
      render(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={5}
          lastError="Connection timeout"
          nextRetryIn={30}
          status="retrying"
        />
      );

      expect(screen.getByText('2/5')).toBeInTheDocument();
      expect(screen.getByText(/Retrying... \(Attempt 2\/5\)/)).toBeInTheDocument();
    });

    test('renders with different status colors', () => {
      const { rerender, container } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={10}
          status="retrying"
        />
      );

      // Retrying - orange border
      let containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({ border: '1px solid #f59e0b' });

      // Success - green border
      rerender(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={0}
          status="success"
        />
      );
      containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({ border: '1px solid #10b981' });

      // Exhausted - red border
      rerender(
        <RetryIndicator
          currentAttempt={3}
          maxAttempts={3}
          lastError="Failed"
          nextRetryIn={0}
          status="exhausted"
        />
      );
      containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({ border: '1px solid #ef4444' });
    });
  });

  describe('Progress Bar Updates', () => {
    test('progress bar shows correct percentage for attempts', () => {
      const { rerender, container } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={5}
          lastError=""
          nextRetryIn={10}
          status="retrying"
        />
      );

      // 1/5 = 20% = 72deg (360 * 0.2)
      let progressFill = container.querySelector('[style*="conic-gradient"]') as HTMLElement;
      expect(progressFill).toBeTruthy();

      // Update to 3/5 = 60% = 216deg
      rerender(
        <RetryIndicator
          currentAttempt={3}
          maxAttempts={5}
          lastError=""
          nextRetryIn={10}
          status="retrying"
        />
      );

      expect(screen.getByText('3/5')).toBeInTheDocument();
    });

    test('progress bar fills completely at max attempts', () => {
      render(
        <RetryIndicator
          currentAttempt={5}
          maxAttempts={5}
          lastError="Final attempt failed"
          nextRetryIn={0}
          status="exhausted"
        />
      );

      expect(screen.getByText('5/5')).toBeInTheDocument();
      expect(screen.getByText('Max retry attempts reached')).toBeInTheDocument();
    });
  });

  describe('Countdown Timer Functionality', () => {
    test('countdown timer decrements every second', async () => {
      render(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={5}
          lastError="Timeout error"
          nextRetryIn={5}
          status="retrying"
        />
      );

      expect(screen.getByText('Next retry in 5s')).toBeInTheDocument();

      // Advance timer by 1 second
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('Next retry in 4s')).toBeInTheDocument();
      });

      // Advance timer by 2 more seconds
      jest.advanceTimersByTime(2000);
      await waitFor(() => {
        expect(screen.getByText('Next retry in 2s')).toBeInTheDocument();
      });

      // Advance to 0
      jest.advanceTimersByTime(2000);
      await waitFor(() => {
        expect(screen.getByText('Next retry in 0s')).toBeInTheDocument();
      });
    });

    test('countdown does not go below zero', async () => {
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError="Error"
          nextRetryIn={2}
          status="retrying"
        />
      );

      // Advance beyond initial countdown
      jest.advanceTimersByTime(5000);
      await waitFor(() => {
        expect(screen.getByText('Next retry in 0s')).toBeInTheDocument();
      });
    });

    test('countdown resets when nextRetryIn prop changes', async () => {
      const { rerender } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={10}
          status="retrying"
        />
      );

      expect(screen.getByText('Next retry in 10s')).toBeInTheDocument();

      // Update nextRetryIn
      rerender(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={3}
          lastError=""
          nextRetryIn={15}
          status="retrying"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Next retry in 15s')).toBeInTheDocument();
      });
    });

    test('countdown does not display when status is not retrying', () => {
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={10}
          status="success"
        />
      );

      expect(screen.queryByText(/Next retry in/)).not.toBeInTheDocument();
    });
  });

  describe('Status Transitions', () => {
    test('status transitions from retrying to success', async () => {
      const { rerender } = render(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={5}
          lastError="Temporary failure"
          nextRetryIn={5}
          status="retrying"
        />
      );

      expect(screen.getByText(/Retrying.../)).toBeInTheDocument();
      expect(screen.getByText('Next retry in 5s')).toBeInTheDocument();

      // Transition to success
      rerender(
        <RetryIndicator
          currentAttempt={3}
          maxAttempts={5}
          lastError=""
          nextRetryIn={0}
          status="success"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Operation successful')).toBeInTheDocument();
        expect(screen.queryByText(/Next retry in/)).not.toBeInTheDocument();
      });
    });

    test('status transitions from retrying to exhausted', async () => {
      const { rerender } = render(
        <RetryIndicator
          currentAttempt={4}
          maxAttempts={5}
          lastError="Connection refused"
          nextRetryIn={3}
          status="retrying"
        />
      );

      expect(screen.getByText(/Retrying... \(Attempt 4\/5\)/)).toBeInTheDocument();

      // Transition to exhausted
      rerender(
        <RetryIndicator
          currentAttempt={5}
          maxAttempts={5}
          lastError="Final attempt failed: Connection refused"
          nextRetryIn={0}
          status="exhausted"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Max retry attempts reached')).toBeInTheDocument();
        expect(screen.queryByText(/Next retry in/)).not.toBeInTheDocument();
      });
    });

    test('pulsing animation only active during retrying status', async () => {
      const { rerender, container } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={5}
          status="retrying"
        />
      );

      // Wait for pulse animation
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        const containerDiv = container.firstChild as HTMLElement;
        expect(containerDiv).toBeTruthy();
      });

      // Change to success
      rerender(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={0}
          status="success"
        />
      );

      const containerDiv = container.firstChild as HTMLElement;
      expect(containerDiv).toHaveStyle({ opacity: 1 });
    });
  });

  describe('Error Message Display', () => {
    test('displays short error message in full', () => {
      const shortError = 'Connection timeout';
      render(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={5}
          lastError={shortError}
          nextRetryIn={10}
          status="retrying"
        />
      );

      expect(screen.getByText('Error Details')).toBeInTheDocument();
      expect(screen.getByText(shortError)).toBeInTheDocument();
      expect(screen.queryByText('Show more')).not.toBeInTheDocument();
    });

    test('truncates long error messages with ellipsis', () => {
      const longError = 'A'.repeat(150);
      const truncatedError = longError.substring(0, 80) + '...';

      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError={longError}
          nextRetryIn={5}
          status="retrying"
        />
      );

      expect(screen.getByText(truncatedError)).toBeInTheDocument();
      expect(screen.getByText('Show more')).toBeInTheDocument();
    });

    test('expands and collapses error message on button click', () => {
      const longError = 'B'.repeat(150);

      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError={longError}
          nextRetryIn={10}
          status="retrying"
        />
      );

      const expandButton = screen.getByText('Show more');
      expect(expandButton).toBeInTheDocument();

      // Click to expand
      fireEvent.click(expandButton);
      expect(screen.getByText(longError)).toBeInTheDocument();
      expect(screen.getByText('Show less')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByText('Show less'));
      expect(screen.getByText(/B{80}\.\.\./)).toBeInTheDocument();
    });

    test('does not show error section when lastError is empty', () => {
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={5}
          status="retrying"
        />
      );

      expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
    });

    test('error message properly escapes HTML characters', () => {
      const htmlError = '<script>alert("XSS")</script>';
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError={htmlError}
          nextRetryIn={5}
          status="retrying"
        />
      );

      // Should render as text, not execute script
      expect(screen.getByText(htmlError)).toBeInTheDocument();
      const errorElement = screen.getByText(htmlError);
      expect(errorElement.innerHTML).toBe(htmlError);
    });
  });

  describe('Icon Rendering', () => {
    test('displays spinning icon for retrying status', () => {
      const { container } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={5}
          status="retrying"
        />
      );

      const spinner = container.querySelector('[style*="spin"]');
      expect(spinner).toBeInTheDocument();
    });

    test('displays checkmark icon for success status', () => {
      const { container } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError=""
          nextRetryIn={0}
          status="success"
        />
      );

      const successIcon = container.querySelector('svg path[d*="M3 8l3 3 7-7"]');
      expect(successIcon).toBeInTheDocument();
    });

    test('displays X icon for exhausted status', () => {
      const { container } = render(
        <RetryIndicator
          currentAttempt={3}
          maxAttempts={3}
          lastError="Failed"
          nextRetryIn={0}
          status="exhausted"
        />
      );

      const errorIcon = container.querySelector('svg path[d*="M4 4l8 8"]');
      expect(errorIcon).toBeInTheDocument();
    });
  });

  describe('Integration and Edge Cases', () => {
    test('handles rapid status changes correctly', async () => {
      const { rerender } = render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={5}
          lastError="Error 1"
          nextRetryIn={10}
          status="retrying"
        />
      );

      // Rapid updates
      rerender(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={5}
          lastError="Error 2"
          nextRetryIn={8}
          status="retrying"
        />
      );

      rerender(
        <RetryIndicator
          currentAttempt={3}
          maxAttempts={5}
          lastError="Error 3"
          nextRetryIn={6}
          status="retrying"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('3/5')).toBeInTheDocument();
        expect(screen.getByText(/Error 3/)).toBeInTheDocument();
      });
    });

    test('multiple RetryIndicators render independently', () => {
      const { container } = render(
        <div>
          <RetryIndicator
            currentAttempt={1}
            maxAttempts={3}
            lastError="Error A"
            nextRetryIn={5}
            status="retrying"
          />
          <RetryIndicator
            currentAttempt={2}
            maxAttempts={4}
            lastError="Error B"
            nextRetryIn={10}
            status="retrying"
          />
          <RetryIndicator
            currentAttempt={5}
            maxAttempts={5}
            lastError="Error C"
            nextRetryIn={0}
            status="exhausted"
          />
        </div>
      );

      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(screen.getByText('2/4')).toBeInTheDocument();
      expect(screen.getByText('5/5')).toBeInTheDocument();
      expect(screen.getByText(/Error A/)).toBeInTheDocument();
      expect(screen.getByText(/Error B/)).toBeInTheDocument();
      expect(screen.getByText(/Error C/)).toBeInTheDocument();
    });

    test('handles zero nextRetryIn gracefully', () => {
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError="Error"
          nextRetryIn={0}
          status="retrying"
        />
      );

      expect(screen.getByText('Next retry in 0s')).toBeInTheDocument();
    });

    test('handles single attempt scenario', () => {
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={1}
          lastError="Only one attempt allowed"
          nextRetryIn={0}
          status="exhausted"
        />
      );

      expect(screen.getByText('1/1')).toBeInTheDocument();
      expect(screen.getByText('Max retry attempts reached')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('component is keyboard accessible', () => {
      const longError = 'C'.repeat(150);
      render(
        <RetryIndicator
          currentAttempt={1}
          maxAttempts={3}
          lastError={longError}
          nextRetryIn={5}
          status="retrying"
        />
      );

      const expandButton = screen.getByText('Show more');
      expandButton.focus();
      expect(expandButton).toHaveFocus();
    });

    test('proper semantic HTML structure', () => {
      const { container } = render(
        <RetryIndicator
          currentAttempt={2}
          maxAttempts={5}
          lastError="Test error"
          nextRetryIn={10}
          status="retrying"
        />
      );

      expect(container.querySelector('button')).toBeInTheDocument();
      expect(container.querySelector('p')).toBeInTheDocument();
    });
  });
});
