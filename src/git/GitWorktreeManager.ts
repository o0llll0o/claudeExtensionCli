import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface WorktreeSession {
    id: string;
    path: string;
    branch: string;
    active: boolean;
    createdAt: number;
}

export interface WorktreeManagerConfig {
    rootDir: string;
    worktreeDir?: string;
}

export class GitWorktreeManager {
    private rootDir: string;
    private worktreeRoot: string;
    private sessions: Map<string, WorktreeSession> = new Map();

    constructor(config: WorktreeManagerConfig) {
        this.rootDir = config.rootDir;
        this.worktreeRoot = config.worktreeDir || path.join(this.rootDir, '.worktrees');
    }

    private async exec(command: string, args: string[], cwd?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                cwd: cwd || this.rootDir,
                shell: process.platform === 'win32'
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data) => { stdout += data.toString(); });
            proc.stderr?.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Command failed: ${stderr || stdout}`));
                }
            });

            proc.on('error', reject);
        });
    }

    async initialize(): Promise<void> {
        if (!fs.existsSync(this.worktreeRoot)) {
            fs.mkdirSync(this.worktreeRoot, { recursive: true });
        }
        await this.loadExistingWorktrees();
    }

    private async loadExistingWorktrees(): Promise<void> {
        try {
            const output = await this.exec('git', ['worktree', 'list', '--porcelain']);
            const lines = output.split('\n');
            let currentWorktree: Partial<WorktreeSession> = {};

            for (const line of lines) {
                if (line.startsWith('worktree ')) {
                    currentWorktree.path = line.replace('worktree ', '');
                } else if (line.startsWith('branch ')) {
                    currentWorktree.branch = line.replace('branch refs/heads/', '');
                } else if (line === '') {
                    if (currentWorktree.path && currentWorktree.path.includes('.worktrees')) {
                        const id = path.basename(currentWorktree.path);
                        this.sessions.set(id, {
                            id,
                            path: currentWorktree.path,
                            branch: currentWorktree.branch || 'unknown',
                            active: true,
                            createdAt: Date.now()
                        });
                    }
                    currentWorktree = {};
                }
            }
        } catch {
            // No existing worktrees
        }
    }

    async create(taskId: string): Promise<WorktreeSession> {
        const sanitizedId = taskId.replace(/[^a-zA-Z0-9-_]/g, '-');
        const branchName = `task/${sanitizedId}`;
        const worktreePath = path.join(this.worktreeRoot, sanitizedId);

        if (this.sessions.has(sanitizedId)) {
            return this.sessions.get(sanitizedId)!;
        }

        // Clean up any existing worktree path
        if (fs.existsSync(worktreePath)) {
            fs.rmSync(worktreePath, { recursive: true, force: true });
        }

        // Try to delete the branch if it already exists
        try {
            await this.exec('git', ['branch', '-D', branchName]);
        } catch {
            // Branch doesn't exist, that's fine
        }

        // Prune any stale worktree references
        try {
            await this.exec('git', ['worktree', 'prune']);
        } catch {
            // Ignore prune errors
        }

        // Create worktree with new branch based on HEAD
        try {
            await this.exec('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD']);
        } catch (err) {
            // If branch creation fails, try detached worktree as fallback
            try {
                await this.exec('git', ['worktree', 'add', '--detach', worktreePath, 'HEAD']);
            } catch {
                // If git worktree fails entirely, just use the main directory
                // This allows Plan mode to work even without git
                return {
                    id: sanitizedId,
                    path: this.rootDir,
                    branch: 'main',
                    active: true,
                    createdAt: Date.now()
                };
            }
        }

        const session: WorktreeSession = {
            id: sanitizedId,
            path: worktreePath,
            branch: branchName,
            active: true,
            createdAt: Date.now()
        };

        this.sessions.set(sanitizedId, session);
        return session;
    }

    async cleanup(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        try {
            await this.exec('git', ['worktree', 'remove', session.path, '--force']);
        } catch {
            if (fs.existsSync(session.path)) {
                fs.rmSync(session.path, { recursive: true, force: true });
            }
        }

        try {
            await this.exec('git', ['branch', '-D', session.branch]);
        } catch {
            // Branch may already be deleted
        }

        this.sessions.delete(sessionId);
    }

    async mergeToMain(sessionId: string, mainBranch: string = 'main'): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);

        await this.exec('git', ['checkout', mainBranch]);
        await this.exec('git', ['merge', '--squash', session.branch]);
        await this.exec('git', ['commit', '-m', `Merge task: ${sessionId}`]);
        await this.cleanup(sessionId);
    }

    async syncContext(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);

        await this.exec('git', ['fetch', 'origin'], session.path);
        await this.exec('git', ['rebase', 'origin/main'], session.path);
    }

    getSession(sessionId: string): WorktreeSession | undefined {
        return this.sessions.get(sessionId);
    }

    getAllSessions(): WorktreeSession[] {
        return Array.from(this.sessions.values());
    }

    async pruneStale(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now - session.createdAt > maxAgeMs) {
                await this.cleanup(id);
            }
        }
        await this.exec('git', ['worktree', 'prune']);
    }

    dispose(): void {
        this.sessions.clear();
    }
}
