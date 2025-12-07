import React, { useState, useEffect } from 'react';

interface RetryIndicatorProps {
  currentAttempt: number;
  maxAttempts: number;
  lastError: string;
  nextRetryIn: number;
  status: 'retrying' | 'success' | 'exhausted';
}

export const RetryIndicator: React.FC<RetryIndicatorProps> = ({
  currentAttempt,
  maxAttempts,
  lastError,
  nextRetryIn,
  status
}) => {
  const [countdown, setCountdown] = useState(nextRetryIn);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPulsing, setIsPulsing] = useState(true);

  useEffect(() => {
    setCountdown(nextRetryIn);
  }, [nextRetryIn]);

  useEffect(() => {
    if (status === 'retrying' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, countdown]);

  useEffect(() => {
    if (status === 'retrying') {
      const pulseTimer = setInterval(() => {
        setIsPulsing(prev => !prev);
      }, 1000);
      return () => clearInterval(pulseTimer);
    }
  }, [status]);

  const getStatusColor = (): string => {
    switch (status) {
      case 'retrying':
        return '#f59e0b';
      case 'success':
        return '#10b981';
      case 'exhausted':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (): JSX.Element => {
    const color = getStatusColor();

    switch (status) {
      case 'retrying':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            style={{
              animation: 'spin 1s linear infinite'
            }}
          >
            <style>
              {`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}
            </style>
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="28 10"
              strokeLinecap="round"
            />
          </svg>
        );
      case 'success':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M3 8l3 3 7-7"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case 'exhausted':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        );
      default:
        return <></>;
    }
  };

  const truncateError = (error: string, maxLength: number = 80): string => {
    if (error.length <= maxLength) return error;
    return error.substring(0, maxLength) + '...';
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'var(--vscode-editor-background)',
    border: `1px solid ${getStatusColor()}`,
    borderRadius: '6px',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: '13px',
    color: 'var(--vscode-foreground)',
    opacity: status === 'retrying' && isPulsing ? 0.9 : 1,
    transition: 'opacity 0.5s ease-in-out, border-color 0.3s ease',
    boxShadow: `0 0 8px ${getStatusColor()}22`
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: 'space-between'
  };

  const statusRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const circularProgressStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: `3px solid ${getStatusColor()}33`,
    position: 'relative',
    backgroundColor: 'var(--vscode-input-background)'
  };

  const progressFillStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: `conic-gradient(
      ${getStatusColor()} ${(currentAttempt / maxAttempts) * 360}deg,
      transparent ${(currentAttempt / maxAttempts) * 360}deg
    )`,
    mask: 'radial-gradient(circle, transparent 60%, black 61%)',
    WebkitMask: 'radial-gradient(circle, transparent 60%, black 61%)'
  };

  const attemptTextStyle: React.CSSProperties = {
    position: 'relative',
    fontSize: '14px',
    fontWeight: 600,
    color: getStatusColor(),
    zIndex: 1
  };

  const infoSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--vscode-foreground)'
  };

  const errorContainerStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'var(--vscode-input-background)',
    borderLeft: `3px solid ${getStatusColor()}`,
    borderRadius: '4px',
    fontSize: '12px',
    lineHeight: '1.5'
  };

  const errorTextStyle: React.CSSProperties = {
    margin: 0,
    color: 'var(--vscode-errorForeground)',
    fontFamily: 'var(--vscode-editor-font-family)',
    wordBreak: 'break-word'
  };

  const expandButtonStyle: React.CSSProperties = {
    marginTop: '4px',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: `1px solid ${getStatusColor()}66`,
    borderRadius: '3px',
    color: getStatusColor(),
    cursor: 'pointer',
    fontSize: '11px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease'
  };

  const countdownStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: `${getStatusColor()}1a`,
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    color: getStatusColor()
  };

  const getStatusMessage = (): string => {
    switch (status) {
      case 'retrying':
        return `Retrying... (Attempt ${currentAttempt}/${maxAttempts})`;
      case 'success':
        return 'Operation successful';
      case 'exhausted':
        return 'Max retry attempts reached';
      default:
        return '';
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={statusRowStyle}>
          <div style={circularProgressStyle}>
            <div style={progressFillStyle}></div>
            <span style={attemptTextStyle}>
              {currentAttempt}/{maxAttempts}
            </span>
          </div>

          <div style={infoSectionStyle}>
            <div style={labelStyle}>Status</div>
            <div style={valueStyle}>{getStatusMessage()}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {getStatusIcon()}
        </div>
      </div>

      {status === 'retrying' && countdown > 0 && (
        <div style={countdownStyle}>
          <svg width="14" height="14" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              r="7"
              fill="none"
              stroke={getStatusColor()}
              strokeWidth="2"
            />
            <path
              d="M8 4v4l3 2"
              fill="none"
              stroke={getStatusColor()}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>Next retry in {countdown}s</span>
        </div>
      )}

      {lastError && (
        <div style={errorContainerStyle}>
          <div style={labelStyle}>Error Details</div>
          <p style={errorTextStyle}>
            {isExpanded ? lastError : truncateError(lastError)}
          </p>
          {lastError.length > 80 && (
            <button
              style={expandButtonStyle}
              onClick={() => setIsExpanded(!isExpanded)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${getStatusColor()}1a`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RetryIndicator;
