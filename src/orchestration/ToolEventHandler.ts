import { EventEmitter } from 'events';

/**
 * Represents a tool execution event within the Claude API stream.
 * Tracks the complete lifecycle of tool invocations from request to completion.
 */
export interface ToolEvent {
    /** Unique identifier for this tool execution */
    toolId: string;

    /** Name of the tool being invoked (e.g., 'Read', 'Write', 'Bash') */
    toolName: string;

    /** Input parameters passed to the tool */
    toolInput?: Record<string, any>;

    /** Output/result returned from the tool */
    toolOutput?: string;

    /** Current execution status */
    status: 'pending' | 'running' | 'success' | 'error';

    /** Timestamp when the tool was invoked (ms since epoch) */
    timestamp: number;

    /** Execution duration in milliseconds (only set after completion) */
    duration?: number;

    /** Error message if status is 'error' */
    error?: string;
}

/**
 * Statistics about tool usage patterns.
 */
export interface ToolStatistics {
    /** Total number of tools invoked */
    totalInvocations: number;

    /** Number of successful completions */
    successCount: number;

    /** Number of failed executions */
    errorCount: number;

    /** Number of currently running tools */
    activeCount: number;

    /** Average execution time in milliseconds */
    averageDuration: number;

    /** Most frequently used tools */
    topTools: Map<string, number>;

    /** Tool usage by status */
    byStatus: Record<string, number>;
}

/**
 * Configuration options for ToolEventHandler.
 */
export interface ToolEventHandlerConfig {
    /** Maximum number of events to keep in history */
    maxHistorySize?: number;

    /** Enable detailed logging */
    enableLogging?: boolean;

    /** Enable performance tracking */
    enableMetrics?: boolean;
}

/**
 * Processes and tracks tool_use and tool_result events from Claude API streams.
 *
 * CRITICAL FUNCTIONALITY:
 * - Extracts tool_use blocks from assistant content arrays
 * - Processes tool_result events from the stream
 * - Tracks tool execution lifecycle (pending → running → success/error)
 * - Emits events for real-time monitoring
 * - Maintains execution history for debugging
 * - Calculates performance metrics
 *
 * This class solves the critical gap where SubagentOrchestrator ignores tool events,
 * providing complete visibility into autonomous agent tool usage.
 *
 * @fires tool_invoked - When a tool is first requested
 * @fires tool_started - When a tool begins execution
 * @fires tool_completed - When a tool finishes successfully
 * @fires tool_error - When a tool execution fails
 * @fires statistics_updated - When usage statistics change
 *
 * @example
 * ```typescript
 * const handler = new ToolEventHandler({ enableLogging: true });
 *
 * handler.on('tool_invoked', ({ toolName, toolInput, toolId }) => {
 *   console.log(`Tool ${toolName} invoked with ID ${toolId}`);
 * });
 *
 * handler.on('tool_completed', ({ toolId, output, duration }) => {
 *   console.log(`Tool ${toolId} completed in ${duration}ms`);
 * });
 *
 * // Process assistant content blocks
 * handler.handleAssistantContent(event.message.content);
 *
 * // Process tool results
 * handler.handleToolResult(toolResultEvent);
 * ```
 */
export class ToolEventHandler extends EventEmitter {
    /** Map of active tool executions by toolId */
    private activeTools: Map<string, ToolEvent> = new Map();

    /** Complete history of tool executions */
    private toolHistory: ToolEvent[] = [];

    /** Aggregated statistics about tool usage */
    private statistics: ToolStatistics = {
        totalInvocations: 0,
        successCount: 0,
        errorCount: 0,
        activeCount: 0,
        averageDuration: 0,
        topTools: new Map(),
        byStatus: {}
    };

    /** Configuration options */
    private config: Required<ToolEventHandlerConfig>;

    /** Running sum of durations for average calculation */
    private totalDuration: number = 0;

    /** Count of completed tools for average calculation */
    private completedCount: number = 0;

    constructor(config: ToolEventHandlerConfig = {}) {
        super();
        this.config = {
            maxHistorySize: config.maxHistorySize ?? 1000,
            enableLogging: config.enableLogging ?? false,
            enableMetrics: config.enableMetrics ?? true
        };
    }

    /**
     * Processes assistant content array to extract tool_use blocks.
     *
     * Claude API returns content as an array that can contain:
     * - { type: 'text', text: string }
     * - { type: 'tool_use', id: string, name: string, input: object }
     *
     * This method finds all tool_use blocks and creates pending ToolEvents.
     *
     * @param content - Array of content blocks from assistant message
     *
     * @example
     * ```typescript
     * const content = [
     *   { type: 'text', text: 'I will read the file.' },
     *   { type: 'tool_use', id: 'tool_123', name: 'Read', input: { file_path: '/path/to/file' } }
     * ];
     * handler.handleAssistantContent(content);
     * // Emits 'tool_invoked' event
     * ```
     */
    handleAssistantContent(content: any[]): void {
        if (!Array.isArray(content)) {
            return;
        }

        for (const block of content) {
            if (block.type === 'tool_use') {
                const toolEvent: ToolEvent = {
                    toolId: block.id,
                    toolName: block.name,
                    toolInput: block.input,
                    status: 'pending',
                    timestamp: Date.now()
                };

                this.activeTools.set(toolEvent.toolId, toolEvent);
                this.addToHistory(toolEvent);
                this.updateStatistics('pending');

                if (this.config.enableLogging) {
                    console.log(`[ToolEventHandler] Tool invoked: ${toolEvent.toolName} (${toolEvent.toolId})`);
                }

                this.emit('tool_invoked', {
                    toolName: toolEvent.toolName,
                    toolInput: toolEvent.toolInput,
                    toolId: toolEvent.toolId
                });
            }
        }
    }

    /**
     * Processes a tool_result event from the Claude API stream.
     *
     * Tool results can be:
     * - Success: { type: 'tool_result', tool_use_id: string, content: string }
     * - Error: { type: 'tool_result', tool_use_id: string, is_error: true, content: string }
     *
     * This method updates the corresponding ToolEvent with results and calculates duration.
     *
     * @param event - Tool result event from Claude API stream
     *
     * @example
     * ```typescript
     * const resultEvent = {
     *   type: 'tool_result',
     *   tool_use_id: 'tool_123',
     *   content: 'File contents here...'
     * };
     * handler.handleToolResult(resultEvent);
     * // Emits 'tool_completed' event
     * ```
     */
    handleToolResult(event: any): void {
        if (event.type !== 'tool_result') {
            return;
        }

        const toolId = event.tool_use_id;
        const toolEvent = this.activeTools.get(toolId);

        if (!toolEvent) {
            if (this.config.enableLogging) {
                console.warn(`[ToolEventHandler] Received result for unknown tool: ${toolId}`);
            }
            return;
        }

        const isError = event.is_error === true;
        const content = this.extractContent(event.content);

        toolEvent.toolOutput = content;
        toolEvent.status = isError ? 'error' : 'success';
        toolEvent.duration = Date.now() - toolEvent.timestamp;

        if (isError) {
            toolEvent.error = content;
        }

        this.updateStatistics(toolEvent.status, toolEvent.duration);

        if (this.config.enableLogging) {
            console.log(`[ToolEventHandler] Tool ${toolEvent.status}: ${toolEvent.toolName} (${toolId}) - ${toolEvent.duration}ms`);
        }

        if (isError) {
            this.emit('tool_error', {
                toolId: toolEvent.toolId,
                toolName: toolEvent.toolName,
                error: toolEvent.error
            });
        } else {
            this.emit('tool_completed', {
                toolId: toolEvent.toolId,
                toolName: toolEvent.toolName,
                output: toolEvent.toolOutput,
                duration: toolEvent.duration
            });
        }

        // Keep completed/errored tools in history but remove from active
        this.activeTools.delete(toolId);
    }

    /**
     * Marks a tool as actively running (status: 'running').
     * Useful when tracking tool execution lifecycle more granularly.
     *
     * @param toolId - Unique identifier of the tool to track
     * @returns The ToolEvent if found, undefined otherwise
     */
    trackToolExecution(toolId: string): ToolEvent | undefined {
        const toolEvent = this.activeTools.get(toolId);

        if (toolEvent && toolEvent.status === 'pending') {
            toolEvent.status = 'running';

            if (this.config.enableLogging) {
                console.log(`[ToolEventHandler] Tool started: ${toolEvent.toolName} (${toolId})`);
            }

            this.emit('tool_started', {
                toolId: toolEvent.toolId,
                toolName: toolEvent.toolName,
                toolInput: toolEvent.toolInput
            });
        }

        return toolEvent;
    }

    /**
     * Returns a map of all currently active tool executions.
     *
     * @returns Map of toolId to ToolEvent for all pending/running tools
     */
    getActiveTools(): Map<string, ToolEvent> {
        return new Map(this.activeTools);
    }

    /**
     * Returns the complete history of tool executions.
     * Limited by maxHistorySize configuration.
     *
     * @returns Array of all ToolEvents in chronological order
     */
    getToolHistory(): ToolEvent[] {
        return [...this.toolHistory];
    }

    /**
     * Returns aggregated statistics about tool usage.
     *
     * @returns Current ToolStatistics snapshot
     */
    getStatistics(): ToolStatistics {
        return {
            ...this.statistics,
            topTools: new Map(this.statistics.topTools),
            byStatus: { ...this.statistics.byStatus }
        };
    }

    /**
     * Returns all events for a specific tool by ID.
     * Useful for debugging individual tool executions.
     *
     * @param toolId - Unique identifier of the tool
     * @returns ToolEvent if found, undefined otherwise
     */
    getToolById(toolId: string): ToolEvent | undefined {
        // Check active tools first
        const active = this.activeTools.get(toolId);
        if (active) return active;

        // Search history
        return this.toolHistory.find(t => t.toolId === toolId);
    }

    /**
     * Returns all events for a specific tool by name.
     * Useful for analyzing patterns in tool usage.
     *
     * @param toolName - Name of the tool (e.g., 'Read', 'Write')
     * @returns Array of ToolEvents for that tool
     */
    getToolsByName(toolName: string): ToolEvent[] {
        return this.toolHistory.filter(t => t.toolName === toolName);
    }

    /**
     * Clears all tracking data and resets statistics.
     * Useful for starting fresh between test runs.
     */
    reset(): void {
        this.activeTools.clear();
        this.toolHistory = [];
        this.statistics = {
            totalInvocations: 0,
            successCount: 0,
            errorCount: 0,
            activeCount: 0,
            averageDuration: 0,
            topTools: new Map(),
            byStatus: {}
        };
        this.totalDuration = 0;
        this.completedCount = 0;

        if (this.config.enableLogging) {
            console.log('[ToolEventHandler] Reset complete');
        }
    }

    /**
     * Extracts text content from various content formats.
     * Handles both string and array formats from Claude API.
     *
     * @param content - Content to extract (string, array, or object)
     * @returns Extracted text content
     */
    private extractContent(content: any): string {
        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            return content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('\n');
        }

        if (content?.text) {
            return content.text;
        }

        return String(content);
    }

    /**
     * Adds a tool event to history with size management.
     * Enforces maxHistorySize by removing oldest entries.
     *
     * @param toolEvent - ToolEvent to add to history
     */
    private addToHistory(toolEvent: ToolEvent): void {
        this.toolHistory.push(toolEvent);

        // Enforce history size limit
        if (this.toolHistory.length > this.config.maxHistorySize) {
            this.toolHistory.shift();
        }
    }

    /**
     * Updates aggregated statistics when tool status changes.
     * Tracks counts, durations, and tool popularity.
     *
     * @param status - New status of the tool
     * @param duration - Execution duration (if completed)
     */
    private updateStatistics(status: string, duration?: number): void {
        if (!this.config.enableMetrics) {
            return;
        }

        // Update counts
        if (status === 'pending') {
            this.statistics.totalInvocations++;
        } else if (status === 'success') {
            this.statistics.successCount++;
        } else if (status === 'error') {
            this.statistics.errorCount++;
        }

        // Update active count
        this.statistics.activeCount = this.activeTools.size;

        // Update status breakdown
        this.statistics.byStatus[status] = (this.statistics.byStatus[status] || 0) + 1;

        // Update duration metrics
        if (duration !== undefined && (status === 'success' || status === 'error')) {
            this.totalDuration += duration;
            this.completedCount++;
            this.statistics.averageDuration = this.totalDuration / this.completedCount;
        }

        // Update top tools (track by name from active tools)
        this.activeTools.forEach(tool => {
            const count = this.statistics.topTools.get(tool.toolName) || 0;
            this.statistics.topTools.set(tool.toolName, count + 1);
        });

        this.emit('statistics_updated', this.getStatistics());
    }
}

/**
 * Integration function to patch ToolEventHandler into SubagentOrchestrator.
 *
 * This function provides a clean integration point to add tool tracking
 * to the existing event handling logic in SubagentOrchestrator.
 *
 * INTEGRATION STRATEGY:
 * 1. Create ToolEventHandler instance
 * 2. Forward events from orchestrator to handler
 * 3. Re-emit handler events with taskId context
 * 4. Expose handler methods through orchestrator
 *
 * @param orchestrator - SubagentOrchestrator instance to patch
 * @param config - Optional configuration for ToolEventHandler
 * @returns The created ToolEventHandler instance
 *
 * @example
 * ```typescript
 * import { SubagentOrchestrator } from './SubagentOrchestrator';
 * import { patchToolEventHandler } from './ToolEventHandler';
 *
 * const orchestrator = new SubagentOrchestrator('/workspace');
 * const toolHandler = patchToolEventHandler(orchestrator, { enableLogging: true });
 *
 * orchestrator.on('tool_completed', ({ taskId, toolName, duration }) => {
 *   console.log(`Task ${taskId}: ${toolName} completed in ${duration}ms`);
 * });
 *
 * // Now tool events will be tracked automatically
 * await orchestrator.runAgent({...});
 * ```
 */
export function patchToolEventHandler(
    orchestrator: any,
    config: ToolEventHandlerConfig = {}
): ToolEventHandler {
    const handler = new ToolEventHandler(config);

    // Store handler reference on orchestrator
    (orchestrator as any).toolEventHandler = handler;

    // Forward tool events from handler to orchestrator with taskId context
    handler.on('tool_invoked', (data) => {
        orchestrator.emit('tool_invoked', data);
    });

    handler.on('tool_started', (data) => {
        orchestrator.emit('tool_started', data);
    });

    handler.on('tool_completed', (data) => {
        orchestrator.emit('tool_completed', data);
    });

    handler.on('tool_error', (data) => {
        orchestrator.emit('tool_error', data);
    });

    handler.on('statistics_updated', (stats) => {
        orchestrator.emit('tool_statistics', stats);
    });

    // Expose handler methods on orchestrator
    (orchestrator as any).getToolEventHandler = () => handler;
    (orchestrator as any).getActiveTools = () => handler.getActiveTools();
    (orchestrator as any).getToolStatistics = () => handler.getStatistics();
    (orchestrator as any).getToolHistory = () => handler.getToolHistory();

    return handler;
}

/**
 * INTEGRATION NOTES FOR SUBAGENT ORCHESTRATOR:
 *
 * To integrate this handler into SubagentOrchestrator.ts, modify the stdout data handler
 * (around line 219) to process tool events:
 *
 * ```typescript
 * proc.stdout?.on('data', (chunk: Buffer) => {
 *     lineBuffer += chunk.toString();
 *     let newlineIndex: number;
 *     while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
 *         const line = lineBuffer.substring(0, newlineIndex).trim();
 *         lineBuffer = lineBuffer.substring(newlineIndex + 1);
 *         if (line.startsWith('{')) {
 *             try {
 *                 const event = JSON.parse(line);
 *
 *                 // EXISTING: Handle text content
 *                 if (event.type === 'assistant' && event.message?.content) {
 *                     const content = event.message.content;
 *
 *                     // NEW: Extract tool_use blocks
 *                     if (this.toolEventHandler) {
 *                         this.toolEventHandler.handleAssistantContent(content);
 *                     }
 *
 *                     // ... existing text extraction logic ...
 *                 }
 *
 *                 // NEW: Handle tool results
 *                 if (event.type === 'tool_result' && this.toolEventHandler) {
 *                     this.toolEventHandler.handleToolResult(event);
 *                 }
 *             } catch {}
 *         }
 *     }
 * });
 * ```
 *
 * Constructor initialization:
 * ```typescript
 * constructor(workspaceFolder: string) {
 *     super();
 *     this.cwd = workspaceFolder;
 *     patchToolEventHandler(this, { enableLogging: true });
 * }
 * ```
 */
