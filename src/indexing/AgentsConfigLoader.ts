import * as fs from 'fs';
import * as path from 'path';

export interface AgentsConfig {
    content: string;
    rules: string[];
    preferences: Record<string, string>;
    loadedFrom: string | null;
}

const CONFIG_FILES = ['AGENTS.md', 'CLAUDE.md', '.claude/config.md'];

export class AgentsConfigLoader {
    private rootDir: string;
    private config: AgentsConfig | null = null;

    constructor(rootDir: string) {
        this.rootDir = rootDir;
    }

    load(): AgentsConfig {
        for (const fileName of CONFIG_FILES) {
            const filePath = path.join(this.rootDir, fileName);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    this.config = this.parseConfig(content, filePath);
                    return this.config;
                } catch {}
            }
        }

        this.config = {
            content: '',
            rules: [],
            preferences: {},
            loadedFrom: null
        };
        return this.config;
    }

    private parseConfig(content: string, filePath: string): AgentsConfig {
        const rules: string[] = [];
        const preferences: Record<string, string> = {};

        const lines = content.split('\n');
        let inRulesSection = false;
        let inPreferencesSection = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.toLowerCase().includes('# rules') || trimmed.toLowerCase().includes('## rules')) {
                inRulesSection = true;
                inPreferencesSection = false;
                continue;
            }

            if (trimmed.toLowerCase().includes('# preferences') || trimmed.toLowerCase().includes('## preferences')) {
                inRulesSection = false;
                inPreferencesSection = true;
                continue;
            }

            if (trimmed.startsWith('#')) {
                inRulesSection = false;
                inPreferencesSection = false;
                continue;
            }

            if (inRulesSection && trimmed.startsWith('-')) {
                rules.push(trimmed.substring(1).trim());
            }

            if (inPreferencesSection && trimmed.includes(':')) {
                const [key, ...valueParts] = trimmed.split(':');
                const value = valueParts.join(':').trim();
                if (key && value) {
                    preferences[key.replace(/^-\s*/, '').trim().toLowerCase()] = value;
                }
            }
        }

        return {
            content,
            rules,
            preferences,
            loadedFrom: filePath
        };
    }

    getSystemPromptInjection(): string {
        if (!this.config || !this.config.content) {
            return '';
        }

        const parts: string[] = [];

        if (this.config.rules.length > 0) {
            parts.push('Project Rules (MUST follow):');
            for (const rule of this.config.rules) {
                parts.push(`- ${rule}`);
            }
        }

        if (Object.keys(this.config.preferences).length > 0) {
            parts.push('\nProject Preferences:');
            for (const [key, value] of Object.entries(this.config.preferences)) {
                parts.push(`- ${key}: ${value}`);
            }
        }

        if (parts.length === 0) {
            return this.config.content;
        }

        return parts.join('\n');
    }

    reload(): AgentsConfig {
        this.config = null;
        return this.load();
    }

    getConfig(): AgentsConfig | null {
        return this.config;
    }

    hasConfig(): boolean {
        if (!this.config) this.load();
        return this.config?.loadedFrom !== null;
    }
}
