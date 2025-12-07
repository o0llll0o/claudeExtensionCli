import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ClaudeMessage {
    type: 'chunk' | 'done' | 'error' | 'tool';
    content: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
}

interface ContentBlock {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    name?: string;
    id?: string;
    input?: Record<string, unknown>;
    content?: string;
}

interface CLIEvent {
    type: 'system' | 'assistant' | 'user' | 'result';
    subtype?: 'init' | 'success' | 'error';
    message?: {
        content: ContentBlock[] | string;
    };
    session_id?: string;
    is_error?: boolean;
}

export interface SendOptions {
    model?: string;
    ultrathink?: boolean;
    sessionId?: string;
    systemPrompt?: string;
    workingDirectory?: string;
}

export class ClaudeService extends EventEmitter {
    private process: ChildProcess | null = null;
    private cwd: string | undefined;
    private buffer: string = '';
    private lineBuffer: string = '';

    constructor(workspaceFolder?: string) {
        super();
        this.cwd = workspaceFolder;
    }

    async initialize(): Promise<void> {
        if (this.process) return;

        try {
            // Spawn a dummy process just to warm up the CLI environment
            // We use --version as a quick check/warmup
            const proc = spawn('claude', ['--version'], {
                cwd: this.cwd || process.cwd(),
                shell: process.platform === 'win32',
                env: { ...process.env, NO_COLOR: '1' }
            });
            
            return new Promise((resolve) => {
                proc.on('close', () => resolve());
                proc.on('error', () => resolve()); // Ignore errors during warmup
            });
        } catch (err) {
            // Ignore init errors
        }
    }

    async sendMessage(prompt: string, options: SendOptions = {}): Promise<void> {
        if (this.process) {
            this.stop();
        }

        this.buffer = '';
        this.lineBuffer = '';

        let finalPrompt = prompt;
        if (options.systemPrompt) {
            finalPrompt = `${options.systemPrompt}\n\n${finalPrompt}`;
        }
        if (options.ultrathink) {
            finalPrompt = `ultrathink\n${finalPrompt}`;
        }

        try {
            const args = [
                '--print',
                '--output-format', 'stream-json',
                '--verbose',
                '--dangerously-skip-permissions'
            ];

            if (options.model) {
                args.push('--model', options.model);
            }

            if (options.sessionId) {
                args.push('--session-id', options.sessionId);
            }

            const workDir = options.workingDirectory || this.cwd || process.cwd();

            this.process = spawn('claude', args, {
                cwd: workDir,
                shell: process.platform === 'win32',
                env: {
                    ...process.env,
                    NO_COLOR: '1'
                }
            });

            if (this.process.stdin) {
                this.process.stdin.write(finalPrompt);
                this.process.stdin.end();
            }

            this.process.stdout?.on('data', (chunk: Buffer) => {
                this.handleChunk(chunk.toString());
            });

            this.process.stderr?.on('data', (chunk: Buffer) => {
                const text = chunk.toString().trim();
                if (text && !text.includes('Streaming') && !text.includes('verbose')) {
                    console.error('[ClaudeCLI stderr]', text);
                }
            });

            this.process.on('close', (code) => {
                if (this.lineBuffer.trim()) {
                    this.parseLine(this.lineBuffer.trim());
                }
                this.process = null;
                this.emit('message', { type: 'done', content: this.buffer } as ClaudeMessage);
            });

            this.process.on('error', (err) => {
                this.emit('message', { 
                    type: 'error', 
                    content: `Failed to start claude: ${err.message}` 
                } as ClaudeMessage);
                this.process = null;
            });

        } catch (err) {
            this.emit('message', { 
                type: 'error', 
                content: 'Failed to spawn claude process' 
            } as ClaudeMessage);
        }
    }

    private handleChunk(chunk: string) {
        this.lineBuffer += chunk;

        let newlineIndex: number;
        while ((newlineIndex = this.lineBuffer.indexOf('\n')) !== -1) {
            const line = this.lineBuffer.substring(0, newlineIndex).trim();
            this.lineBuffer = this.lineBuffer.substring(newlineIndex + 1);

            if (line.length > 0) {
                this.parseLine(line);
            }
        }
    }

    private parseLine(line: string) {
        if (!line.startsWith('{')) {
            return;
        }

        try {
            const event: CLIEvent = JSON.parse(line);
            this.handleEvent(event);
        } catch (e) {
            console.warn('[ClaudeCLI] Failed to parse JSON line:', line.substring(0, 100));
        }
    }

    private handleEvent(event: CLIEvent) {
        if (event.type === 'assistant' && event.message) {
            const content = event.message.content;

            if (typeof content === 'string') {
                this.buffer += content;
                this.emit('message', { type: 'chunk', content } as ClaudeMessage);
            } else if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === 'text' && block.text) {
                        this.buffer += block.text;
                        this.emit('message', { type: 'chunk', content: block.text } as ClaudeMessage);
                    } else if (block.type === 'tool_use') {
                        this.emit('message', {
                            type: 'tool',
                            content: `Using tool: ${block.name}`,
                            toolName: block.name,
                            toolInput: block.input
                        } as ClaudeMessage);
                    }
                }
            }
        } else if (event.type === 'result') {
            if (event.is_error || event.subtype === 'error') {
                const errorContent = event.message?.content;
                let errorText = 'Unknown error';
                if (typeof errorContent === 'string') {
                    errorText = errorContent;
                } else if (Array.isArray(errorContent)) {
                    errorText = errorContent
                        .filter(b => b.type === 'text')
                        .map(b => b.text)
                        .join('');
                }
                this.emit('message', { type: 'error', content: errorText } as ClaudeMessage);
            }
        }
    }

    stop() {
        if (this.process && !this.process.killed) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', this.process.pid!.toString(), '/f', '/t']);
            } else {
                this.process.kill('SIGINT');
            }
            this.process = null;
        }
    }

    createSession() {
        this.stop();
        this.buffer = '';
        this.lineBuffer = '';
    }

    dispose() {
        this.stop();
    }
}
