/**
 * Subagent Orchestration Layer
 * MoE (Mixture of Experts) system for routing and managing specialized subagents
 */

export type AgentCapability =
  | "code-generation"
  | "code-analysis"
  | "refactoring"
  | "testing"
  | "debugging"
  | "documentation"
  | "git-operations"
  | "file-operations"
  | "search-operations"
  | "performance-optimization"
  | "security-analysis";

export type AgentPriority = "low" | "normal" | "high" | "critical";

export type AgentStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export interface AgentRequest {
  /** Unique request identifier */
  id: string;
  /** Type of task to be performed */
  capability: AgentCapability;
  /** Natural language description of the task */
  task: string;
  /** Structured context for the task */
  context: AgentContext;
  /** Priority level for scheduling */
  priority: AgentPriority;
  /** Maximum execution time in milliseconds */
  timeoutMs?: number;
  /** Request metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp when request was created */
  createdAt: Date;
}

export interface AgentContext {
  /** Working directory or git worktree path */
  workingDirectory: string;
  /** Files relevant to the task */
  targetFiles?: string[];
  /** Git branch context */
  gitBranch?: string;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Tool restrictions (if any) */
  allowedTools?: string[];
  /** Additional contextual data */
  data?: Record<string, unknown>;
}

export interface SubagentConfig {
  /** Unique subagent identifier */
  id: string;
  /** Display name for the subagent */
  name: string;
  /** Capabilities this subagent can handle */
  capabilities: AgentCapability[];
  /** Maximum concurrent tasks this agent can handle */
  maxConcurrentTasks: number;
  /** Whether the subagent is currently enabled */
  enabled: boolean;
  /** Worktree configuration (if isolated execution required) */
  worktreeConfig?: {
    enabled: boolean;
    basePath: string;
    cleanupOnComplete: boolean;
  };
  /** Resource limits */
  resourceLimits?: {
    maxMemoryMb?: number;
    maxCpuPercent?: number;
    maxExecutionTimeMs?: number;
  };
  /** Custom configuration for the subagent */
  customConfig?: Record<string, unknown>;
}

export interface SubagentResult {
  /** Request ID this result corresponds to */
  requestId: string;
  /** Subagent ID that processed the request */
  subagentId: string;
  /** Execution status */
  status: AgentStatus;
  /** Result data (if successful) */
  result?: unknown;
  /** Error information (if failed) */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  /** Files modified during execution */
  modifiedFiles?: string[];
  /** Execution metrics */
  metrics: {
    startTime: Date;
    endTime: Date;
    durationMs: number;
    memoryUsedMb?: number;
    cpuTimeMs?: number;
  };
  /** Output logs */
  logs?: {
    stdout?: string;
    stderr?: string;
  };
}

export interface SubagentPool {
  /** Active subagent configurations */
  agents: Map<string, SubagentConfig>;
  /** Current task assignments */
  assignments: Map<string, string>; // requestId -> subagentId
  /** Task queue organized by capability */
  queues: Map<AgentCapability, AgentRequest[]>;
}

export interface RoutingDecision {
  /** Selected subagent ID */
  subagentId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the selection */
  reasoning?: string;
  /** Whether to use worktree isolation */
  useWorktree: boolean;
  /** Estimated execution time */
  estimatedDurationMs?: number;
}

export interface SubagentOrchestrator {
  /**
   * Register a new subagent with the orchestrator
   */
  registerSubagent(config: SubagentConfig): Promise<void>;

  /**
   * Unregister a subagent
   */
  unregisterSubagent(subagentId: string): Promise<void>;

  /**
   * Submit a request to be routed to appropriate subagent
   */
  submitRequest(request: AgentRequest): Promise<string>;

  /**
   * Route a request to the most suitable subagent
   */
  routeRequest(request: AgentRequest): Promise<RoutingDecision>;

  /**
   * Execute a request using the specified subagent
   */
  executeRequest(
    requestId: string,
    subagentId: string
  ): Promise<SubagentResult>;

  /**
   * Get status of a specific request
   */
  getRequestStatus(requestId: string): Promise<AgentStatus>;

  /**
   * Get result of a completed request
   */
  getResult(requestId: string): Promise<SubagentResult | null>;

  /**
   * Cancel a pending or running request
   */
  cancelRequest(requestId: string): Promise<boolean>;

  /**
   * Get current pool status
   */
  getPoolStatus(): Promise<SubagentPool>;

  /**
   * Get metrics for a specific subagent
   */
  getSubagentMetrics(subagentId: string): Promise<SubagentMetrics>;

  /**
   * Clean up completed/failed requests older than specified age
   */
  cleanupOldRequests(maxAgeMs: number): Promise<number>;
}

export interface SubagentMetrics {
  subagentId: string;
  totalRequestsProcessed: number;
  successCount: number;
  failureCount: number;
  averageDurationMs: number;
  currentLoad: number; // 0-1 representing current capacity usage
  lastActivityAt?: Date;
}

/**
 * Strategy interface for routing decisions
 */
export interface RoutingStrategy {
  /**
   * Determine the best subagent for a given request
   */
  selectSubagent(
    request: AgentRequest,
    availableAgents: SubagentConfig[],
    poolStatus: SubagentPool
  ): Promise<RoutingDecision>;
}

/**
 * Load balancing strategies
 */
export type LoadBalancingStrategy =
  | "round-robin"
  | "least-loaded"
  | "capability-based"
  | "priority-weighted"
  | "adaptive";

export interface OrchestratorConfig {
  /** Maximum number of concurrent requests across all subagents */
  maxConcurrentRequests: number;
  /** Default timeout for requests (ms) */
  defaultTimeoutMs: number;
  /** Routing strategy to use */
  routingStrategy: LoadBalancingStrategy;
  /** Whether to enable worktree isolation by default */
  enableWorktreeIsolation: boolean;
  /** Automatic cleanup interval (ms) */
  cleanupIntervalMs: number;
  /** Maximum age for completed requests before cleanup (ms) */
  maxRequestAgeMs: number;
  /** Git worktree manager instance */
  worktreeManager?: GitWorktreeManager;
}

// Import from git-worktree-manager
interface GitWorktreeManager {
  createWorktree(config: any): Promise<any>;
  removeWorktree(id: string, options?: any): Promise<any>;
  cleanupStaleWorktrees(maxAgeMs?: number): Promise<number>;
}
