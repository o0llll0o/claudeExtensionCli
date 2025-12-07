import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

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
    planner: `You are The Planner, a senior software architect.
Your role is to analyze user requests and break them into atomic, testable implementation steps.
Output a JSON object with this structure:
{
  "steps": [
    { "id": 1, "action": "action_name", "description": "detailed description", "files": ["file1.ts"] },
    ...
  ]
}
Be thorough. Consider edge cases, dependencies, and testing requirements.
Output ONLY valid JSON, no markdown or explanation.`,

    coder: `You are The Coder, an expert software engineer.
Your role is to implement code changes based on specific step instructions.
Follow best practices, write clean code, and ensure compatibility with existing codebase.
Always provide complete, working implementations.`,

    verifier: `You are The Verifier, a quality assurance expert.
Your role is to review code changes, run tests, and validate implementations.
Check for:
- Correctness: Does the code do what it should?
- Edge cases: Are all scenarios handled?
- Security: Are there any vulnerabilities?
- Performance: Are there obvious inefficiencies?
- Style: Does it match the codebase conventions?
Provide a structured review with PASS/FAIL verdict and actionable feedback.`
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
    private activeProcesses: Map<string, ChildProcess> = new Map();
    private cwd: string;
    private agentsConfig: string = '';

    constructor(workspaceFolder: string) {
        super();
        this.cwd = workspaceFolder;
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

            // Pass prompt via -p flag (--print mode ignores stdin)
            const args = [
                '--print',
                '--output-format', 'stream-json',
                '--model', config.model,
                '--dangerously-skip-permissions',
                '-p', fullPrompt
            ];

            const proc = spawn('claude', args, {
                cwd: workingPath,
                shell: process.platform === 'win32',
                env: { ...process.env, NO_COLOR: '1' }
            });

            this.activeProcesses.set(request.taskId, proc);

            let buffer = '';
            let lineBuffer = '';

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
                    console.error(`[${request.role}]`, text);
                }
            });

            proc.on('close', () => {
                this.activeProcesses.delete(request.taskId);
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

                resolve({
                    taskId: request.taskId,
                    role: request.role,
                    content: buffer,
                    plan,
                    success: true
                });
            });

            proc.on('error', (err) => {
                this.activeProcesses.delete(request.taskId);
                resolve({
                    taskId: request.taskId,
                    role: request.role,
                    content: '',
                    success: false,
                    error: err.message
                });
            });
        });
    }

    async executePlan(plan: AgentPlan, worktreePath: string): Promise<AgentResponse[]> {
        const results: AgentResponse[] = [];

        for (const step of plan.steps) {
            step.status = 'in_progress';
            this.emit('step', { taskId: plan.taskId, step });

            const coderResponse = await this.runAgent({
                taskId: `${plan.taskId}-step-${step.id}`,
                role: 'coder',
                prompt: `Implement step ${step.id}: ${step.action}\n\nDescription: ${step.description}`,
                worktreePath
            });

            results.push(coderResponse);

            if (coderResponse.success) {
                const verifyResponse = await this.runAgent({
                    taskId: `${plan.taskId}-verify-${step.id}`,
                    role: 'verifier',
                    prompt: `Review the implementation of step ${step.id}: ${step.action}\n\nCode output:\n${coderResponse.content}`,
                    worktreePath
                });

                results.push(verifyResponse);
                step.status = verifyResponse.content.includes('PASS') ? 'completed' : 'failed';
            } else {
                step.status = 'failed';
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
}
