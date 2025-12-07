import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { RetryExecutor, createRetryPolicy } from './RetryStrategy';

// Simplified session interface (no GitWorktree dependency)
export interface WorktreeSession {
    id: string;
    path: string;
    branch: string;
    active: boolean;
    createdAt: number;
}

export type SubagentRole = 'planner' | 'coder' | 'verifier';

export interface PlanStep {
    id: number;
    action: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    files?: string[];
}

export interface AgentPlan {
    taskId: string;
    steps: PlanStep[];
    createdAt: number;
}

export interface SubagentConfig {
    role: SubagentRole;
    model: string;
    systemPrompt: string;
    ultrathink: boolean;
}

export interface AgentRequest {
    taskId: string;
    role: SubagentRole;
    prompt: string;
    context?: string;
    worktreePath?: string;
}

export interface AgentResponse {
    taskId: string;
    role: SubagentRole;
    content: string;
    plan?: AgentPlan;
    success: boolean;
    error?: string;
}

const ROLE_PROMPTS: Record<SubagentRole, string> = {
    planner: `You are The Planner, a senior software architect with TOOL-FIRST methodology.

CRITICAL RULES - MUST FOLLOW:
1. ALWAYS explore the codebase BEFORE planning (use Bash, Read, Glob, Grep tools)
2. ALWAYS verify file paths exist using ls or Read tool
3. NEVER assume file locations or structures
4. NEVER output plans without verification

REQUIRED WORKFLOW:
Step 1: EXPLORE the codebase
  - Use Bash tool: ls to list directories
  - Use Glob tool: Find relevant files (e.g., "**/*.ts", "**/*.json")
  - Use Read tool: Examine key files to understand architecture
  - Use Grep tool: Search for patterns, dependencies, existing implementations

Step 2: VERIFY paths and dependencies
  - Use Read tool to confirm files exist at specified paths
  - Check package.json for dependencies
  - Identify testing framework (Jest, Mocha, etc.)
  - Locate configuration files

Step 3: CREATE the plan
  - Break task into atomic, testable steps
  - Include VERIFIED absolute file paths
  - Specify exact actions (create, modify, test)
  - Order steps by dependency chain

OUTPUT FORMAT (JSON ONLY, no markdown):
{
  "steps": [
    {
      "id": 1,
      "action": "create_file|modify_file|run_tests|install_deps",
      "description": "Detailed description with context from codebase exploration",
      "files": ["C:\\absolute\\verified\\path\\to\\file.ts"]
    }
  ]
}

EXAMPLE EXPLORATION:
- Bash: "ls src"
- Glob: "**/*.test.ts" to find test patterns
- Read: "package.json" to check dependencies
- Grep: "import.*express" to find Express usage

Output ONLY valid JSON after verification. No markdown, no explanations, no code blocks.`,

    coder: `You are The Coder, an expert software engineer with MANDATORY tool usage.

ABSOLUTE RULES - NO EXCEPTIONS:
1. MUST use Read tool to examine files BEFORE modifying them
2. MUST use Edit or Write tools to make changes (NEVER output code in text)
3. MUST use Bash tool to verify changes (ls, cat, grep)
4. NEVER provide code in markdown blocks or explanations
5. NEVER assume file contents - ALWAYS read first

REQUIRED WORKFLOW FOR EVERY TASK:
Step 1: READ target files
  - Use Read tool on ALL files you will modify
  - Use Grep tool to find related code patterns
  - Use Bash: "ls -la <directory>" to verify structure

Step 2: IMPLEMENT using tools
  - For NEW files: Use Write tool with complete content
  - For EXISTING files: Use Edit tool with exact old_string and new_string
  - For multiple edits: Use Edit tool multiple times sequentially
  - NEVER output code blocks - only use file manipulation tools

Step 3: VERIFY changes
  - Use Read tool to confirm changes were applied
  - Use Bash: "cat <file>" or Read tool to view updated content
  - Use Bash: "npm install" if dependencies were added
  - Use Grep tool to verify imports and references

TOOL USAGE EXAMPLES:
✅ CORRECT:
  - Read { file_path: "C:\\path\\to\\file.ts" }
  - Edit { file_path: "C:\\path\\to\\file.ts", old_string: "const x = 1", new_string: "const x = 2" }
  - Write { file_path: "C:\\path\\to\\new.ts", content: "export const..." }
  - Bash { command: "npm install express", description: "Install Express dependency" }

❌ WRONG:
  - Providing code in markdown: \`\`\`typescript ... \`\`\`
  - Saying "here's the code" without using Write/Edit
  - Making changes without reading files first

RESPONSE FORMAT:
1. Describe what you're doing
2. Use tools to make changes
3. Verify changes were successful
4. Confirm completion

Always use absolute paths. Always verify before and after changes.`,

    verifier: `You are The Verifier, a quality assurance expert who RUNS and EXECUTES code.

MANDATORY REQUIREMENTS:
1. MUST run actual tests using Bash tool (npm test, npm run test, etc.)
2. MUST execute code to verify behavior (node, npm start, etc.)
3. MUST provide structured PASS/FAIL with exact errors for retry
4. NEVER verify by reading code alone - ALWAYS execute

VERIFICATION WORKFLOW:
Step 1: IDENTIFY testing framework
  - Use Read tool on package.json to find test scripts
  - Use Glob tool to find test files: "**/*.test.ts", "**/*.spec.ts"
  - Use Bash: "ls tests" or "ls __tests__" to locate test directory

Step 2: RUN tests and code
  - Use Bash: "npm test" or "npm run test:unit"
  - Use Bash: "npm run build" to verify compilation
  - Use Bash: "npm run lint" to check code style
  - Use Bash: "node -e '<code>'" to test specific functionality

Step 3: ANALYZE results
  - Read test output for failures
  - Check for compilation errors
  - Verify runtime behavior
  - Review error stack traces

Step 4: PROVIDE structured feedback

OUTPUT FORMAT:
{
  "verdict": "PASS" | "FAIL",
  "testsRun": true/false,
  "testCommand": "npm test",
  "testResults": {
    "total": 10,
    "passed": 8,
    "failed": 2
  },
  "errors": [
    {
      "file": "C:\\path\\to\\file.ts",
      "line": 42,
      "error": "TypeError: Cannot read property 'x' of undefined",
      "stackTrace": "full stack trace",
      "fix": "Specific instruction for retry"
    }
  ],
  "checks": {
    "correctness": "PASS/FAIL - explanation",
    "edgeCases": "PASS/FAIL - what cases were tested",
    "security": "PASS/FAIL - vulnerabilities found",
    "performance": "PASS/FAIL - performance issues",
    "style": "PASS/FAIL - linting results"
  },
  "recommendation": "APPROVE | REJECT | RETRY with specific fix"
}

TOOL USAGE EXAMPLES:
✅ REQUIRED:
  - Bash { command: "npm test", description: "Run test suite" }
  - Bash { command: "npm run build", description: "Verify build succeeds" }
  - Bash { command: "npm run lint", description: "Check code style" }
  - Read { file_path: "test-output.log" } to analyze failures

❌ FORBIDDEN:
  - Saying "tests look good" without running them
  - Manual code review without execution
  - Verification based on assumptions

If tests fail, provide EXACT error messages and line numbers for the Coder to retry.
If no tests exist, create and run basic validation tests.
Always execute, never assume.`
};

/**
 * Orchestrates Claude CLI subagents for plan/code/verify workflows.
 *
 * @fires chunk - Emits parsed text content from agent responses as they stream.
 *                Event payload: { taskId: string, role: SubagentRole, content: string }
 *                Note: content is human-readable text, NOT raw JSON.
 * @fires step - Emits step status updates during plan execution.
 *               Event payload: { taskId: string, step: PlanStep }
 *
 * @example
 * orchestrator.on('chunk', ({ taskId, role, content }) => {
 *   console.log(`[${role}] ${content}`);
 * });
 *
 * @example
 * orchestrator.on('step', ({ taskId, step }) => {
 *   console.log(`Step ${step.id}: ${step.status}`);
 * });
 */
export class SubagentOrchestrator extends EventEmitter {
    private static readonly MAX_RETRIES = 3;
    private activeProcesses: Map<string, ChildProcess> = new Map();
    private cwd: string;
    private agentsConfig: string = '';
    private timeoutDuration: number = 300000; // 5 minutes default timeout
    private retryExecutor: RetryExecutor = new RetryExecutor();

    constructor(workspaceFolder: string) {
        super();
        this.cwd = workspaceFolder;

        // Forward retry events from RetryExecutor
        this.retryExecutor.on('retry_attempt', (data) => this.emit('retry_attempt', data));
        this.retryExecutor.on('retry_exhausted', (data) => this.emit('step_exhausted', data));
    }

    setAgentsConfig(config: string): void {
        this.agentsConfig = config;
    }

    private getConfig(role: SubagentRole, ultrathink: boolean = false): SubagentConfig {
        let systemPrompt = ROLE_PROMPTS[role];
        if (this.agentsConfig) {
            systemPrompt = `${this.agentsConfig}\n\n${systemPrompt}`;
        }

        return {
            role,
            model: 'claude-opus-4-5',
            systemPrompt,
            ultrathink
        };
    }

    async createTask(taskId: string): Promise<WorktreeSession> {
        // Create a simple session using the main workspace (no git worktree)
        return {
            id: taskId,
            path: this.cwd,
            branch: 'main',
            active: true,
            createdAt: Date.now()
        };
    }

    /**
     * Runs a Claude CLI subagent for the specified role and task.
     *
     * Emits 'chunk' events as the agent streams its response:
     * - Event structure: { taskId: string, role: SubagentRole, content: string }
     * - Content is the parsed text extracted from JSON stream events
     * - Chunks are emitted in real-time as the agent generates output
     *
     * @param request - The agent request configuration
     * @returns Promise resolving to the complete agent response
     *
     * @fires chunk - Emits each chunk of text content as it's streamed from Claude CLI
     */
    async runAgent(request: AgentRequest): Promise<AgentResponse> {
        const config = this.getConfig(request.role, request.role === 'planner');
        // Use provided path or default to main workspace
        const workingPath = request.worktreePath || this.cwd;

        return new Promise((resolve) => {
            let timeoutId: NodeJS.Timeout | undefined;
            let resolved = false;

            const safeResolve = (response: AgentResponse) => {
                if (resolved) return;
                resolved = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve(response);
            };
            // Build the full prompt first
            let finalPrompt = request.prompt;
            if (config.ultrathink) {
                finalPrompt = `ultrathink\n${finalPrompt}`;
            }
            if (request.context) {
                finalPrompt = `Context:\n${request.context}\n\nTask:\n${finalPrompt}`;
            }

            // Combine system prompt with user prompt
            const fullPrompt = config.systemPrompt + '\n\n' + finalPrompt;

            // Pass prompt via stdin (more reliable for large payloads)
            const args = [
                '--print',
                '--output-format', 'stream-json',
                '--model', config.model,
                '--dangerously-skip-permissions',
                '--verbose'
            ];

            const proc = spawn('claude', args, {
                cwd: workingPath,
                shell: process.platform === 'win32',
                env: { ...process.env, NO_COLOR: '1' }
            });

            this.activeProcesses.set(request.taskId, proc);

            // Set up timeout
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    this.stopTask(request.taskId);
                    this.activeProcesses.delete(request.taskId);
                    safeResolve({
                        taskId: request.taskId,
                        role: request.role,
                        content: '',
                        success: false,
                        error: `Process timed out after ${this.timeoutDuration / 1000} seconds`
                    });
                }
            }, this.timeoutDuration);

            let buffer = '';
            let lineBuffer = '';
            let stderrBuffer = '';

            proc.stdout?.on('data', (chunk: Buffer) => {
                lineBuffer += chunk.toString();
                let newlineIndex: number;
                while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
                    const line = lineBuffer.substring(0, newlineIndex).trim();
                    lineBuffer = lineBuffer.substring(newlineIndex + 1);
                    if (line.startsWith('{')) {
                        try {
                            const event = JSON.parse(line);
                            if (event.type === 'assistant' && event.message?.content) {
                                const content = event.message.content;
                                let textDelta = '';
                                if (typeof content === 'string') {
                                    textDelta = content;
                                    buffer += content;
                                } else if (Array.isArray(content)) {
                                    for (const block of content) {
                                        if (block.type === 'text' && block.text) {
                                            textDelta += block.text;
                                            buffer += block.text;
                                        }
                                    }
                                }
                                // Emit parsed text, not raw JSON
                                if (textDelta) {
                                    this.emit('chunk', { taskId: request.taskId, role: request.role, content: textDelta });
                                }
                            }
                        } catch {}
                    }
                }
            });

            proc.stderr?.on('data', (chunk: Buffer) => {
                const text = chunk.toString().trim();
                if (text && !text.includes('Streaming')) {
                    stderrBuffer += text + '\n';
                    console.error(`[${request.role}]`, text);
                }
            });

            proc.on('close', (code) => {
                this.activeProcesses.delete(request.taskId);

                // Check for non-zero exit code - include stderr in error
                if (code !== 0 && !buffer.trim()) {
                    const errorDetail = stderrBuffer.trim() || `Process exited with code ${code}`;
                    safeResolve({
                        taskId: request.taskId,
                        role: request.role,
                        content: '',
                        success: false,
                        error: errorDetail
                    });
                    return;
                }

                let plan: AgentPlan | undefined;

                if (request.role === 'planner') {
                    try {
                        const jsonMatch = buffer.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            plan = {
                                taskId: request.taskId,
                                steps: parsed.steps.map((s: any, i: number) => ({
                                    id: s.id || i + 1,
                                    action: s.action,
                                    description: s.description,
                                    status: 'pending' as const,
                                    files: s.files
                                })),
                                createdAt: Date.now()
                            };
                        }
                    } catch {}
                }

                safeResolve({
                    taskId: request.taskId,
                    role: request.role,
                    content: buffer,
                    plan,
                    success: true
                });
            });

            proc.on('error', (err) => {
                this.activeProcesses.delete(request.taskId);
                safeResolve({
                    taskId: request.taskId,
                    role: request.role,
                    content: '',
                    success: false,
                    error: err.message
                });
            });

            // Write to stdin AFTER all event listeners are attached to avoid race conditions
            if (proc.stdin) {
                proc.stdin.on('error', (err) => {
                    console.error(`[${request.role}] Stdin error:`, err.message);
                });
                proc.stdin.write(fullPrompt);
                proc.stdin.end();
            }
        });
    }

    async executePlan(plan: AgentPlan, worktreePath: string): Promise<AgentResponse[]> {
        const results: AgentResponse[] = [];

        for (const step of plan.steps) {
            step.status = 'in_progress';
            this.emit('step', { taskId: plan.taskId, step });

            let lastError: string | undefined;
            let stepSuccessful = false;

            // Create retry policy with exponential backoff
            const retryPolicy = createRetryPolicy({
                maxAttempts: SubagentOrchestrator.MAX_RETRIES,
                backoffType: 'exponential',
                baseDelayMs: 1000,
                maxDelayMs: 30000,
                retryableErrors: [], // Retry all errors
                jitter: true
            });

            try {
                // Wrap step execution in retry loop
                const { coderResponse, verifyResponse } = await this.retryExecutor.executeWithRetry(
                    async () => {
                        // Build prompt with error context on retry
                        let coderPrompt = `Implement step ${step.id}: ${step.action}\n\nDescription: ${step.description}`;
                        if (lastError) {
                            coderPrompt = `FIX THIS ERROR: ${lastError}\n\n${coderPrompt}`;
                        }

                        const coder = await this.runAgent({
                            taskId: `${plan.taskId}-step-${step.id}`,
                            role: 'coder',
                            prompt: coderPrompt,
                            worktreePath
                        });

                        if (!coder.success) {
                            lastError = coder.error || 'Coder execution failed';
                            throw new Error(lastError);
                        }

                        const verifier = await this.runAgent({
                            taskId: `${plan.taskId}-verify-${step.id}`,
                            role: 'verifier',
                            prompt: `Review the implementation of step ${step.id}: ${step.action}\n\nCode output:\n${coder.content}`,
                            worktreePath
                        });

                        if (!verifier.success || !verifier.content.includes('PASS')) {
                            lastError = verifier.error || 'Verification failed: code does not meet quality standards';
                            throw new Error(lastError);
                        }

                        return { coderResponse: coder, verifyResponse: verifier };
                    },
                    retryPolicy,
                    `step-${step.id}`
                );

                // Step succeeded
                results.push(coderResponse, verifyResponse);
                step.status = 'completed';
                stepSuccessful = true;

            } catch (error) {
                // All retries exhausted
                step.status = 'failed';
                const errorMessage = error instanceof Error ? error.message : String(error);

                // Add failed response to results
                results.push({
                    taskId: `${plan.taskId}-step-${step.id}`,
                    role: 'coder',
                    content: '',
                    success: false,
                    error: `Step exhausted after ${SubagentOrchestrator.MAX_RETRIES} attempts: ${errorMessage}`
                });
            }

            this.emit('step', { taskId: plan.taskId, step });
        }

        return results;
    }

    stopTask(taskId: string): void {
        const proc = this.activeProcesses.get(taskId);
        if (proc && !proc.killed) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', proc.pid!.toString(), '/f', '/t']);
            } else {
                proc.kill('SIGINT');
            }
            this.activeProcesses.delete(taskId);
        }
    }

    stopAll(): void {
        for (const taskId of this.activeProcesses.keys()) {
            this.stopTask(taskId);
        }
    }

    dispose(): void {
        this.stopAll();
    }

    /**
     * Helper method to delay execution for a specified number of milliseconds.
     * Used internally for implementing backoff delays between retry attempts.
     * @param ms The number of milliseconds to delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
