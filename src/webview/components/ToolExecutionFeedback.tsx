import React, { useState } from 'react';

interface ToolExecutionFeedbackProps {
  toolId: string;
  toolName: string;
  toolInput: object;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  duration?: number;
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📄',
  Write: '✏️',
  Edit: '🔧',
  Bash: '💻',
  Glob: '🔍',
  Grep: '🔎',
};

const STATUS_COLORS = {
  pending: '#6c757d',
  running: '#0d6efd',
  success: '#198754',
  error: '#dc3545',
};

const STATUS_LABELS = {
  pending: 'Pending',
  running: 'Running',
  success: 'Success',
  error: 'Error',
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const truncateJson = (obj: object, maxLength: number = 100): string => {
  const json = JSON.stringify(obj, null, 2);
  if (json.length <= maxLength) return json;
  return json.substring(0, maxLength) + '...';
};

export const ToolExecutionFeedback: React.FC<ToolExecutionFeedbackProps> = ({
  toolId,
  toolName,
  toolInput,
  status,
  output,
  error,
  duration,
}) => {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const toolIcon = TOOL_ICONS[toolName] || '🔧';
  const statusColor = STATUS_COLORS[status];
  const statusLabel = STATUS_LABELS[status];

  const fullInputJson = JSON.stringify(toolInput, null, 2);
  const previewInputJson = truncateJson(toolInput, 100);
  const hasLongInput = fullInputJson.length > 100;

  const hasOutput = output && output.length > 0;
  const hasError = error && error.length > 0;

  return (
    <div
      style={{
        border: `1px solid ${statusColor}`,
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '12px',
        backgroundColor: '#1e1e1e',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{toolIcon}</span>
        <span
          style={{
            fontWeight: 'bold',
            color: '#d4d4d4',
            backgroundColor: statusColor,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {toolName}
        </span>
        <span
          style={{
            color: statusColor,
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {status === 'running' && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: statusColor,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          {statusLabel}
        </span>
        {duration !== undefined && status !== 'running' && (
          <span
            style={{
              marginLeft: 'auto',
              backgroundColor: '#2d2d2d',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#858585',
            }}
          >
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {/* Tool Input */}
      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
            cursor: hasLongInput ? 'pointer' : 'default',
          }}
          onClick={() => hasLongInput && setInputExpanded(!inputExpanded)}
        >
          {hasLongInput && (
            <span style={{ color: '#858585', fontSize: '11px' }}>
              {inputExpanded ? '▼' : '▶'}
            </span>
          )}
          <span style={{ color: '#858585', fontSize: '11px', fontWeight: 'bold' }}>
            Input:
          </span>
        </div>
        <pre
          style={{
            backgroundColor: '#2d2d2d',
            padding: '8px',
            borderRadius: '4px',
            margin: 0,
            overflow: 'auto',
            maxHeight: inputExpanded ? 'none' : '100px',
            color: '#ce9178',
            fontSize: '11px',
            lineHeight: '1.4',
          }}
        >
          {inputExpanded ? fullInputJson : previewInputJson}
        </pre>
      </div>

      {/* Output */}
      {hasOutput && (
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setOutputExpanded(!outputExpanded)}
          >
            <span style={{ color: '#858585', fontSize: '11px' }}>
              {outputExpanded ? '▼' : '▶'}
            </span>
            <span style={{ color: '#858585', fontSize: '11px', fontWeight: 'bold' }}>
              Output:
            </span>
          </div>
          {outputExpanded && (
            <pre
              style={{
                backgroundColor: '#2d2d2d',
                padding: '8px',
                borderRadius: '4px',
                margin: 0,
                overflow: 'auto',
                maxHeight: '300px',
                color: '#4ec9b0',
                fontSize: '11px',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {output}
            </pre>
          )}
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setOutputExpanded(!outputExpanded)}
          >
            <span style={{ color: '#858585', fontSize: '11px' }}>
              {outputExpanded ? '▼' : '▶'}
            </span>
            <span style={{ color: '#f48771', fontSize: '11px', fontWeight: 'bold' }}>
              Error:
            </span>
          </div>
          {outputExpanded && (
            <pre
              style={{
                backgroundColor: '#2d2d2d',
                padding: '8px',
                borderRadius: '4px',
                margin: 0,
                overflow: 'auto',
                maxHeight: '300px',
                color: '#f48771',
                fontSize: '11px',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error}
            </pre>
          )}
        </div>
      )}

      {/* CSS Animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
        `}
      </style>
    </div>
  );
};
