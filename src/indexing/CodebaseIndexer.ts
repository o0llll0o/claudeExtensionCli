import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CodeChunk {
    filePath: string;
    relativePath: string;
    startLine: number;
    endLine: number;
    signature: string;
    keywords: string[];
    content: string;
    hash: string;
}

export interface IndexEntry {
    filePath: string;
    relativePath: string;
    language: string;
    chunks: CodeChunk[];
    lastModified: number;
    fileHash: string;
}

export interface CodebaseIndex {
    version: number;
    rootDir: string;
    entries: Record<string, IndexEntry>;
    invertedIndex: Record<string, string[]>;
    createdAt: number;
    updatedAt: number;
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.rb': 'ruby',
    '.php': 'php'
};

const IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    '.worktrees',
    'dist',
    'build',
    'out',
    '.next',
    '__pycache__',
    'venv',
    '.venv'
];

export class CodebaseIndexer {
    private rootDir: string;
    private indexPath: string;
    private index: CodebaseIndex | null = null;
    private maxChunkLines = 50;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
        this.indexPath = path.join(rootDir, '.vscode', 'claude-index.json');
    }

    async initialize(): Promise<void> {
        const vscodeDir = path.join(this.rootDir, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
        await this.loadIndex();
    }

    private async loadIndex(): Promise<void> {
        try {
            if (fs.existsSync(this.indexPath)) {
                const content = fs.readFileSync(this.indexPath, 'utf-8');
                this.index = JSON.parse(content);
            }
        } catch {
            this.index = null;
        }

        if (!this.index) {
            this.index = {
                version: 1,
                rootDir: this.rootDir,
                entries: {},
                invertedIndex: {},
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
        }
    }

    private saveIndex(): void {
        if (!this.index) return;
        this.index.updatedAt = Date.now();
        fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
    }

    private shouldIgnore(filePath: string): boolean {
        return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
    }

    private getLanguage(filePath: string): string | null {
        const ext = path.extname(filePath).toLowerCase();
        return LANGUAGE_EXTENSIONS[ext] || null;
    }

    private computeHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    private extractKeywords(content: string): string[] {
        const words = content
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && w.length < 50)
            .map(w => w.toLowerCase());
        return [...new Set(words)];
    }

    private chunkFile(content: string, filePath: string, relativePath: string): CodeChunk[] {
        const lines = content.split('\n');
        const chunks: CodeChunk[] = [];
        
        const functionPatterns = [
            /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
            /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
            /^(?:export\s+)?class\s+(\w+)/,
            /^\s*(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/,
            /^def\s+(\w+)\s*\(/,
            /^class\s+(\w+)/,
            /^func\s+(\w+)/
        ];

        let currentChunk: { start: number; lines: string[]; signature: string } | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let matched = false;

            for (const pattern of functionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    if (currentChunk && currentChunk.lines.length > 0) {
                        const chunkContent = currentChunk.lines.join('\n');
                        chunks.push({
                            filePath,
                            relativePath,
                            startLine: currentChunk.start + 1,
                            endLine: i,
                            signature: currentChunk.signature,
                            keywords: this.extractKeywords(chunkContent),
                            content: chunkContent,
                            hash: this.computeHash(chunkContent)
                        });
                    }
                    currentChunk = {
                        start: i,
                        lines: [line],
                        signature: match[1] || line.trim().substring(0, 50)
                    };
                    matched = true;
                    break;
                }
            }

            if (!matched && currentChunk) {
                currentChunk.lines.push(line);
                if (currentChunk.lines.length >= this.maxChunkLines) {
                    const chunkContent = currentChunk.lines.join('\n');
                    chunks.push({
                        filePath,
                        relativePath,
                        startLine: currentChunk.start + 1,
                        endLine: i + 1,
                        signature: currentChunk.signature,
                        keywords: this.extractKeywords(chunkContent),
                        content: chunkContent,
                        hash: this.computeHash(chunkContent)
                    });
                    currentChunk = null;
                }
            }
        }

        if (currentChunk && currentChunk.lines.length > 0) {
            const chunkContent = currentChunk.lines.join('\n');
            chunks.push({
                filePath,
                relativePath,
                startLine: currentChunk.start + 1,
                endLine: lines.length,
                signature: currentChunk.signature,
                keywords: this.extractKeywords(chunkContent),
                content: chunkContent,
                hash: this.computeHash(chunkContent)
            });
        }

        if (chunks.length === 0 && lines.length > 0) {
            for (let i = 0; i < lines.length; i += this.maxChunkLines) {
                const chunkLines = lines.slice(i, i + this.maxChunkLines);
                const chunkContent = chunkLines.join('\n');
                chunks.push({
                    filePath,
                    relativePath,
                    startLine: i + 1,
                    endLine: Math.min(i + this.maxChunkLines, lines.length),
                    signature: `lines ${i + 1}-${Math.min(i + this.maxChunkLines, lines.length)}`,
                    keywords: this.extractKeywords(chunkContent),
                    content: chunkContent,
                    hash: this.computeHash(chunkContent)
                });
            }
        }

        return chunks;
    }

    async indexFile(filePath: string): Promise<void> {
        if (!this.index) await this.loadIndex();
        if (this.shouldIgnore(filePath)) return;

        const language = this.getLanguage(filePath);
        if (!language) return;

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const stats = fs.statSync(filePath);
            const fileHash = this.computeHash(content);
            const relativePath = path.relative(this.rootDir, filePath);

            const existing = this.index!.entries[filePath];
            if (existing && existing.fileHash === fileHash) {
                return;
            }

            if (existing) {
                for (const chunk of existing.chunks) {
                    for (const keyword of chunk.keywords) {
                        const files = this.index!.invertedIndex[keyword];
                        if (files) {
                            const idx = files.indexOf(filePath);
                            if (idx > -1) files.splice(idx, 1);
                        }
                    }
                }
            }

            const chunks = this.chunkFile(content, filePath, relativePath);

            this.index!.entries[filePath] = {
                filePath,
                relativePath,
                language,
                chunks,
                lastModified: stats.mtimeMs,
                fileHash
            };

            for (const chunk of chunks) {
                for (const keyword of chunk.keywords) {
                    if (!this.index!.invertedIndex[keyword]) {
                        this.index!.invertedIndex[keyword] = [];
                    }
                    if (!this.index!.invertedIndex[keyword].includes(filePath)) {
                        this.index!.invertedIndex[keyword].push(filePath);
                    }
                }
            }
        } catch {}
    }

    async indexDirectory(dirPath: string = this.rootDir): Promise<void> {
        if (!this.index) await this.loadIndex();

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (this.shouldIgnore(fullPath)) continue;

            if (entry.isDirectory()) {
                await this.indexDirectory(fullPath);
            } else if (entry.isFile()) {
                await this.indexFile(fullPath);
            }
        }

        if (dirPath === this.rootDir) {
            this.saveIndex();
        }
    }

    search(query: string, topK: number = 5): CodeChunk[] {
        if (!this.index) return [];

        const queryKeywords = this.extractKeywords(query);
        const scores: Map<string, { chunk: CodeChunk; score: number }> = new Map();

        for (const keyword of queryKeywords) {
            const files = this.index.invertedIndex[keyword] || [];
            for (const filePath of files) {
                const entry = this.index.entries[filePath];
                if (!entry) continue;

                for (const chunk of entry.chunks) {
                    const key = `${chunk.filePath}:${chunk.startLine}`;
                    const existing = scores.get(key);
                    const matchCount = chunk.keywords.filter(k => queryKeywords.includes(k)).length;
                    const score = matchCount / Math.sqrt(chunk.keywords.length);

                    if (!existing || score > existing.score) {
                        scores.set(key, { chunk, score });
                    }
                }
            }
        }

        return Array.from(scores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(s => s.chunk);
    }

    getStats(): { files: number; chunks: number; keywords: number } {
        if (!this.index) return { files: 0, chunks: 0, keywords: 0 };

        const files = Object.keys(this.index.entries).length;
        const chunks = Object.values(this.index.entries).reduce((sum, e) => sum + e.chunks.length, 0);
        const keywords = Object.keys(this.index.invertedIndex).length;

        return { files, chunks, keywords };
    }

    dispose(): void {
        this.index = null;
    }
}
