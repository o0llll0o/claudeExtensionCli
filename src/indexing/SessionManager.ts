import * as fs from 'fs';
import * as path from 'path';

export interface SessionMetadata {
    id: string;
    title: string;
    timestamp: number;
    messageCount: number;
}

export class SessionManager {
    private sessionsDir: string;
    private indexPath: string;

    constructor(workspaceRoot: string) {
        this.sessionsDir = path.join(workspaceRoot, '.claudeprint', 'sessions');
        this.indexPath = path.join(this.sessionsDir, 'index.json');
        this.ensureDir();
    }

    private ensureDir(): void {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    async save(id: string, messages: any[]): Promise<void> {
        const sessionPath = path.join(this.sessionsDir, `${id}.json`);
        fs.writeFileSync(sessionPath, JSON.stringify(messages, null, 2));
        await this.updateIndex(id, messages);
    }

    private async updateIndex(id: string, messages: any[]): Promise<void> {
        const index = this.loadIndex();
        const firstUserMsg = messages.find(m => m.role === 'user');
        const title = firstUserMsg?.content?.substring(0, 50) || 'New Session';
        
        const existing = index.findIndex(s => s.id === id);
        const metadata: SessionMetadata = {
            id,
            title,
            timestamp: Date.now(),
            messageCount: messages.length
        };
        
        if (existing >= 0) {
            index[existing] = metadata;
        } else {
            index.unshift(metadata);
        }
        
        fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    }

    private loadIndex(): SessionMetadata[] {
        if (fs.existsSync(this.indexPath)) {
            try {
                return JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
            } catch {
                return [];
            }
        }
        return [];
    }

    async list(): Promise<SessionMetadata[]> {
        return this.loadIndex();
    }

    async load(id: string): Promise<any[]> {
        const sessionPath = path.join(this.sessionsDir, `${id}.json`);
        if (fs.existsSync(sessionPath)) {
            try {
                return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
            } catch {
                return [];
            }
        }
        return [];
    }

    async delete(id: string): Promise<void> {
        const sessionPath = path.join(this.sessionsDir, `${id}.json`);
        if (fs.existsSync(sessionPath)) {
            fs.unlinkSync(sessionPath);
        }
        
        const index = this.loadIndex().filter(s => s.id !== id);
        fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    }
}
