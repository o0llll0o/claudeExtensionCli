import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToolExecutionFeedback } from '../../../src/webview/components/ToolExecutionFeedback';

/**
 * E2E Tests for ToolExecutionFeedback Component
 *
 * Test Scenarios:
 * 1. Renders pending tool with icon
 * 2. Shows running spinner animation
 * 3. Displays success with duration
 * 4. Shows error with error message
 * 5. Expandable/collapsible details
 * 6. Input JSON formatted correctly
 * 7. Output truncated for long content
 */

describe('ToolExecutionFeedback E2E Tests', () => {
  const mockToolInput = {
    file_path: '/path/to/file.ts',
    pattern: 'searchTerm',
    recursive: true,
  };

  describe('Rendering with Different Statuses', () => {
    test('renders pending tool with correct icon and status', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-1"
          toolName="Read"
          toolInput={mockToolInput}
          status="pending"
        />
      );

      expect(screen.getByText('📄')).toBeInTheDocument();
      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('renders with correct icons for different tools', () => {
      const tools = [
        { name: 'Read', icon: '📄' },
        { name: 'Write', icon: '✏️' },
        { name: 'Edit', icon: '🔧' },
        { name: 'Bash', icon: '💻' },
        { name: 'Glob', icon: '🔍' },
        { name: 'Grep', icon: '🔎' },
      ];

      tools.forEach((tool) => {
        const { unmount } = render(
          <ToolExecutionFeedback
            toolId={`tool-${tool.name}`}
            toolName={tool.name}
            toolInput={{}}
            status="pending"
          />
        );

        expect(screen.getByText(tool.icon)).toBeInTheDocument();
        unmount();
      });
    });

    test('uses default icon for unknown tools', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-unknown"
          toolName="UnknownTool"
          toolInput={{}}
          status="pending"
        />
      );

      expect(screen.getByText('🔧')).toBeInTheDocument();
    });
  });

  describe('Running Status with Animation', () => {
    test('shows running status with pulsing indicator', () => {
      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-2"
          toolName="Bash"
          toolInput={{ command: 'npm test' }}
          status="running"
        />
      );

      expect(screen.getByText('Running')).toBeInTheDocument();

      // Check for pulse animation element
      const pulsingDot = container.querySelector('[style*="pulse"]');
      expect(pulsingDot).toBeInTheDocument();
    });

    test('does not show duration while running', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-3"
          toolName="Write"
          toolInput={{ file: 'test.ts' }}
          status="running"
          duration={1500}
        />
      );

      expect(screen.queryByText(/ms|s/)).not.toBeInTheDocument();
    });
  });

  describe('Success Status with Duration', () => {
    test('displays success status with duration in milliseconds', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-4"
          toolName="Read"
          toolInput={mockToolInput}
          status="success"
          output="File content here"
          duration={450}
        />
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('450ms')).toBeInTheDocument();
    });

    test('displays success status with duration in seconds', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-5"
          toolName="Bash"
          toolInput={{ command: 'npm build' }}
          status="success"
          duration={3500}
        />
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('3.50s')).toBeInTheDocument();
    });

    test('formats duration correctly for exact seconds', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-6"
          toolName="Write"
          toolInput={{}}
          status="success"
          duration={1000}
        />
      );

      expect(screen.getByText('1.00s')).toBeInTheDocument();
    });
  });

  describe('Error Status Display', () => {
    test('shows error status with error message', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-7"
          toolName="Bash"
          toolInput={{ command: 'invalid-command' }}
          status="error"
          error="Command not found: invalid-command"
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Error:')).toBeInTheDocument();
    });

    test('error message starts collapsed', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-8"
          toolName="Read"
          toolInput={{}}
          status="error"
          error="File not found: /missing/file.txt"
        />
      );

      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.queryByText(/File not found/)).not.toBeInTheDocument();
    });

    test('displays error message when expanded', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-9"
          toolName="Write"
          toolInput={{}}
          status="error"
          error="Permission denied: /protected/file.txt"
        />
      );

      const errorHeader = screen.getByText('Error:');
      fireEvent.click(errorHeader.parentElement!);

      expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
    });
  });

  describe('Input JSON Formatting', () => {
    test('displays formatted JSON input', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-10"
          toolName="Grep"
          toolInput={mockToolInput}
          status="pending"
        />
      );

      expect(screen.getByText('Input:')).toBeInTheDocument();

      const preElement = screen.getByText(/file_path/i).parentElement;
      expect(preElement).toHaveStyle({ backgroundColor: '#2d2d2d' });
    });

    test('truncates long JSON input with ellipsis', () => {
      const longInput = {
        field1: 'A'.repeat(50),
        field2: 'B'.repeat(50),
        field3: 'C'.repeat(50),
      };

      render(
        <ToolExecutionFeedback
          toolId="tool-11"
          toolName="Edit"
          toolInput={longInput}
          status="pending"
        />
      );

      const inputText = screen.getByText(/\.\.\./);
      expect(inputText).toBeInTheDocument();
    });

    test('expands and collapses long JSON input', () => {
      const longInput = {
        data: 'X'.repeat(200),
        metadata: { key1: 'value1', key2: 'value2' },
      };

      render(
        <ToolExecutionFeedback
          toolId="tool-12"
          toolName="Bash"
          toolInput={longInput}
          status="pending"
        />
      );

      const inputHeader = screen.getByText('Input:');

      // Click to expand
      fireEvent.click(inputHeader.parentElement!);

      // Should show full JSON
      waitFor(() => {
        expect(screen.getByText(/"data": "XXXX/)).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(inputHeader.parentElement!);
    });

    test('does not show expand arrow for short input', () => {
      const shortInput = { file: 'test.ts' };

      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-13"
          toolName="Read"
          toolInput={shortInput}
          status="pending"
        />
      );

      // Should not have expand arrow
      expect(container.textContent).not.toContain('▼');
      expect(container.textContent).not.toContain('▶');
    });
  });

  describe('Output Display and Truncation', () => {
    test('output section is collapsed by default', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-14"
          toolName="Read"
          toolInput={{}}
          status="success"
          output="File contents go here"
        />
      );

      expect(screen.getByText('Output:')).toBeInTheDocument();
      expect(screen.queryByText('File contents go here')).not.toBeInTheDocument();
    });

    test('expands output when clicked', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-15"
          toolName="Bash"
          toolInput={{}}
          status="success"
          output="Command executed successfully\nExit code: 0"
        />
      );

      const outputHeader = screen.getByText('Output:');
      fireEvent.click(outputHeader.parentElement!);

      expect(screen.getByText(/Command executed successfully/)).toBeInTheDocument();
    });

    test('handles long output with max height', () => {
      const longOutput = 'Line\n'.repeat(100);

      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-16"
          toolName="Grep"
          toolInput={{}}
          status="success"
          output={longOutput}
        />
      );

      const outputHeader = screen.getByText('Output:');
      fireEvent.click(outputHeader.parentElement!);

      const outputElement = container.querySelector('pre');
      expect(outputElement).toHaveStyle({ maxHeight: '300px' });
    });

    test('does not show output section when output is empty', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-17"
          toolName="Write"
          toolInput={{}}
          status="success"
          output=""
        />
      );

      expect(screen.queryByText('Output:')).not.toBeInTheDocument();
    });

    test('preserves whitespace and line breaks in output', () => {
      const formattedOutput = 'Line 1\n  Indented Line 2\n    More Indented Line 3';

      render(
        <ToolExecutionFeedback
          toolId="tool-18"
          toolName="Bash"
          toolInput={{}}
          status="success"
          output={formattedOutput}
        />
      );

      const outputHeader = screen.getByText('Output:');
      fireEvent.click(outputHeader.parentElement!);

      const outputPre = screen.getByText(/Line 1/).parentElement;
      expect(outputPre).toHaveStyle({ whiteSpace: 'pre-wrap' });
    });
  });

  describe('Expandable/Collapsible Behavior', () => {
    test('toggles input expansion with arrow indicator', () => {
      const longInput = { data: 'Y'.repeat(150) };

      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-19"
          toolName="Edit"
          toolInput={longInput}
          status="pending"
        />
      );

      expect(container.textContent).toContain('▶');

      const inputHeader = screen.getByText('Input:');
      fireEvent.click(inputHeader.parentElement!);

      waitFor(() => {
        expect(container.textContent).toContain('▼');
      });
    });

    test('toggles output expansion with arrow indicator', () => {
      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-20"
          toolName="Read"
          toolInput={{}}
          status="success"
          output="Output data"
        />
      );

      const outputHeader = screen.getByText('Output:');

      // Starts collapsed with right arrow
      expect(container.textContent).toContain('▶');

      fireEvent.click(outputHeader.parentElement!);

      // Expands with down arrow
      waitFor(() => {
        expect(container.textContent).toContain('▼');
      });
    });

    test('input and output expand independently', () => {
      const longInput = { field: 'Z'.repeat(150) };

      render(
        <ToolExecutionFeedback
          toolId="tool-21"
          toolName="Bash"
          toolInput={longInput}
          status="success"
          output="Command output"
        />
      );

      const inputHeader = screen.getByText('Input:');
      const outputHeader = screen.getByText('Output:');

      // Expand only input
      fireEvent.click(inputHeader.parentElement!);
      expect(screen.queryByText(/Command output/)).not.toBeInTheDocument();

      // Expand output
      fireEvent.click(outputHeader.parentElement!);
      expect(screen.getByText(/Command output/)).toBeInTheDocument();
    });
  });

  describe('Status Color Coding', () => {
    test('applies correct border color for each status', () => {
      const statuses: Array<'pending' | 'running' | 'success' | 'error'> = [
        'pending',
        'running',
        'success',
        'error',
      ];
      const expectedColors = {
        pending: '#6c757d',
        running: '#0d6efd',
        success: '#198754',
        error: '#dc3545',
      };

      statuses.forEach((status) => {
        const { container, unmount } = render(
          <ToolExecutionFeedback
            toolId={`tool-${status}`}
            toolName="Read"
            toolInput={{}}
            status={status}
          />
        );

        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveStyle({ border: `1px solid ${expectedColors[status]}` });

        unmount();
      });
    });

    test('applies correct badge background color', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-22"
          toolName="Write"
          toolInput={{}}
          status="success"
        />
      );

      const badge = screen.getByText('Write');
      expect(badge).toHaveStyle({ backgroundColor: '#198754' });
    });
  });

  describe('Integration and Multiple Tools', () => {
    test('multiple tool feedbacks render independently', () => {
      render(
        <div>
          <ToolExecutionFeedback
            toolId="tool-a"
            toolName="Read"
            toolInput={{ file: 'a.ts' }}
            status="success"
            duration={100}
          />
          <ToolExecutionFeedback
            toolId="tool-b"
            toolName="Write"
            toolInput={{ file: 'b.ts' }}
            status="running"
          />
          <ToolExecutionFeedback
            toolId="tool-c"
            toolName="Bash"
            toolInput={{ command: 'test' }}
            status="error"
            error="Failed"
          />
        </div>
      );

      expect(screen.getByText('Read')).toBeInTheDocument();
      expect(screen.getByText('Write')).toBeInTheDocument();
      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText('100ms')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getAllByText('Error:')).toHaveLength(1);
    });

    test('real-time tool execution simulation', async () => {
      const { rerender } = render(
        <ToolExecutionFeedback
          toolId="tool-sim"
          toolName="Bash"
          toolInput={{ command: 'npm test' }}
          status="pending"
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();

      // Start running
      rerender(
        <ToolExecutionFeedback
          toolId="tool-sim"
          toolName="Bash"
          toolInput={{ command: 'npm test' }}
          status="running"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument();
      });

      // Complete successfully
      rerender(
        <ToolExecutionFeedback
          toolId="tool-sim"
          toolName="Bash"
          toolInput={{ command: 'npm test' }}
          status="success"
          output="All tests passed"
          duration={2500}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('2.50s')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty tool input object', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-empty"
          toolName="Read"
          toolInput={{}}
          status="pending"
        />
      );

      expect(screen.getByText('Input:')).toBeInTheDocument();
    });

    test('handles undefined output and error', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-undef"
          toolName="Write"
          toolInput={{}}
          status="success"
        />
      );

      expect(screen.queryByText('Output:')).not.toBeInTheDocument();
      expect(screen.queryByText('Error:')).not.toBeInTheDocument();
    });

    test('handles zero duration', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-zero"
          toolName="Read"
          toolInput={{}}
          status="success"
          duration={0}
        />
      );

      expect(screen.getByText('0ms')).toBeInTheDocument();
    });

    test('handles very large duration', () => {
      render(
        <ToolExecutionFeedback
          toolId="tool-large"
          toolName="Bash"
          toolInput={{}}
          status="success"
          duration={125000}
        />
      );

      expect(screen.getByText('125.00s')).toBeInTheDocument();
    });

    test('properly escapes special characters in output', () => {
      const specialOutput = '<script>alert("XSS")</script>';

      render(
        <ToolExecutionFeedback
          toolId="tool-xss"
          toolName="Read"
          toolInput={{}}
          status="success"
          output={specialOutput}
        />
      );

      const outputHeader = screen.getByText('Output:');
      fireEvent.click(outputHeader.parentElement!);

      const outputElement = screen.getByText(specialOutput);
      expect(outputElement.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('Accessibility', () => {
    test('clickable areas have pointer cursor', () => {
      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-cursor"
          toolName="Read"
          toolInput={{ data: 'X'.repeat(150) }}
          status="success"
          output="Output data"
        />
      );

      const inputHeader = screen.getByText('Input:').parentElement;
      expect(inputHeader).toHaveStyle({ cursor: 'pointer' });

      const outputHeader = screen.getByText('Output:').parentElement;
      expect(outputHeader).toHaveStyle({ cursor: 'pointer' });
    });

    test('non-expandable input has default cursor', () => {
      const { container } = render(
        <ToolExecutionFeedback
          toolId="tool-default"
          toolName="Write"
          toolInput={{ short: 'input' }}
          status="pending"
        />
      );

      const inputHeader = screen.getByText('Input:').parentElement;
      expect(inputHeader).toHaveStyle({ cursor: 'default' });
    });
  });
});
