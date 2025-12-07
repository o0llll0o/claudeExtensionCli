/**
 * Mode Dispatcher Type Definitions
 *
 * Defines all interfaces and types for the mode-based message handling system.
 * This enables different conversation modes (chat, review, plan, brainstorm) with
 * specialized handlers and type-safe request/response patterns.
 */

/**
 * Available application modes
 */
export type AppMode = 'chat' | 'review' | 'plan' | 'brainstorm';

/**
 * Permission modes for agent execution
 */
export type PermissionMode = 'ask' | 'auto';

/**
 * Settings that control mode behavior
 */
export interface ModeSettings {
  /**
   * Controls how many agents to spawn in brainstorm mode
   * Range: 1-10
   */
  swarmDensity: number;

  /**
   * Whether to ask before executing commands or auto-execute
   */
  permissionMode: PermissionMode;

  /**
   * Maximum tokens for response generation
   */
  maxTokens?: number;

  /**
   * Temperature for response generation (0-1)
   */
  temperature?: number;

  /**
   * Custom system prompts per mode
   */
  systemPrompts?: Partial<Record<AppMode, string>>;
}

/**
 * Context information available when processing a mode request
 */
export interface ModeContext {
  /**
   * Current workspace directory
   */
  workspaceRoot?: string;

  /**
   * Active file being edited
   */
  activeFile?: string;

  /**
   * Selected text in the editor
   */
  selectedText?: string;

  /**
   * Conversation history
   */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Request object passed to mode handlers
 */
export interface ModeRequest {
  /**
   * The mode being requested
   */
  mode: AppMode;

  /**
   * User's message or request
   */
  message: string;

  /**
   * Contextual information
   */
  context: ModeContext;

  /**
   * Mode-specific settings
   */
  settings: ModeSettings;

  /**
   * Unique request ID for tracking
   */
  requestId: string;

  /**
   * Timestamp of request
   */
  timestamp: Date;
}

/**
 * Base response structure
 */
export interface BaseModeResponse {
  /**
   * Whether the request was successful
   */
  success: boolean;

  /**
   * Mode that handled this request
   */
  mode: AppMode;

  /**
   * Request ID this response corresponds to
   */
  requestId: string;

  /**
   * Processing time in milliseconds
   */
  processingTime: number;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Metadata about the response
   */
  metadata?: Record<string, unknown>;
}

/**
 * Chat mode response - direct conversation
 */
export interface ChatModeResponse extends BaseModeResponse {
  mode: 'chat';

  /**
   * Claude's response text
   */
  response: string;

  /**
   * Tokens used in this exchange
   */
  tokensUsed?: {
    input: number;
    output: number;
  };
}

/**
 * Review mode response - code review results
 */
export interface ReviewModeResponse extends BaseModeResponse {
  mode: 'review';

  /**
   * Overall review summary
   */
  summary: string;

  /**
   * Specific issues found
   */
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
    line?: number;
    suggestion?: string;
  }>;

  /**
   * Positive findings
   */
  strengths?: string[];

  /**
   * Recommended improvements
   */
  recommendations?: string[];
}

/**
 * Plan mode response - structured planning output
 */
export interface PlanModeResponse extends BaseModeResponse {
  mode: 'plan';

  /**
   * High-level plan description
   */
  planSummary: string;

  /**
   * Ordered list of steps
   */
  steps: Array<{
    id: string;
    title: string;
    description: string;
    dependencies?: string[];
    estimatedComplexity?: 'low' | 'medium' | 'high';
  }>;

  /**
   * Identified risks
   */
  risks?: Array<{
    description: string;
    mitigation: string;
  }>;

  /**
   * Success criteria
   */
  successCriteria?: string[];
}

/**
 * Brainstorm mode response - multiple agent perspectives
 */
export interface BrainstormModeResponse extends BaseModeResponse {
  mode: 'brainstorm';

  /**
   * Synthesized summary from all agents
   */
  synthesis: string;

  /**
   * Individual agent contributions
   */
  agentResponses: Array<{
    agentId: string;
    role: string;
    perspective: string;
    keyPoints: string[];
  }>;

  /**
   * Common themes across agents
   */
  commonThemes?: string[];

  /**
   * Divergent viewpoints
   */
  divergentIdeas?: string[];
}

/**
 * Union type of all possible responses
 */
export type ModeResponse =
  | ChatModeResponse
  | ReviewModeResponse
  | PlanModeResponse
  | BrainstormModeResponse;

/**
 * Events emitted by the mode system
 */
export type ModeEvent =
  | { type: 'mode:started'; mode: AppMode; requestId: string }
  | { type: 'mode:progress'; mode: AppMode; requestId: string; message: string; progress?: number }
  | { type: 'mode:completed'; mode: AppMode; requestId: string; response: ModeResponse }
  | { type: 'mode:error'; mode: AppMode; requestId: string; error: Error }
  | { type: 'mode:cancelled'; mode: AppMode; requestId: string };

/**
 * Handler interface that all mode handlers must implement
 */
export interface ModeHandler {
  /**
   * The mode this handler supports
   */
  readonly mode: AppMode;

  /**
   * Whether this handler can process the given request
   */
  canHandle(request: ModeRequest): boolean;

  /**
   * Process the mode request and return a response
   */
  handle(request: ModeRequest): Promise<ModeResponse>;

  /**
   * Stop any in-progress handling for the given request
   */
  stop(requestId: string): Promise<void>;

  /**
   * Validate that the request is well-formed
   */
  validate(request: ModeRequest): { valid: boolean; errors?: string[] };
}

/**
 * Configuration for mode dispatcher
 */
export interface ModeDispatcherConfig {
  /**
   * Default mode when none specified
   */
  defaultMode: AppMode;

  /**
   * Whether to enable strict validation
   */
  strictValidation: boolean;

  /**
   * Timeout for mode handling in milliseconds
   */
  timeout: number;

  /**
   * Whether to enable detailed logging
   */
  enableLogging: boolean;
}
