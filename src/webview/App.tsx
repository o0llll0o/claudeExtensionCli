import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

declare const acquireVsCodeApi: () => {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

// ============================================
// SVG ICONS - Verdent-Inspired Design
// ============================================

const LeafLogo = () => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M24 4C24 4 38 12 38 28C38 36 32 44 24 44C16 44 10 36 10 28C10 12 24 4 24 4Z"
            fill="url(#leafGradient)"
            stroke="#10b981"
            strokeWidth="2"
        />
        <path
            d="M24 12V36M24 24C18 24 14 28 14 28M24 18C28 18 32 22 32 22"
            stroke="#0d9668"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <defs>
            <linearGradient id="leafGradient" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" stopOpacity="0.3"/>
                <stop offset="1" stopColor="#10b981" stopOpacity="0.1"/>
            </linearGradient>
        </defs>
    </svg>
);

const AtIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
    </svg>
);

const PaperclipIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
);

const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M12 7v5l4 2"/>
    </svg>
);

const SendIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z"/>
        <path d="M22 2 11 13"/>
    </svg>
);

const BrainIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
        <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
        <path d="M6 18a4 4 0 0 1-1.967-.516"/>
        <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
    </svg>
);

const SparklesIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/>
        <path d="M19 17v4"/>
        <path d="M3 5h4"/>
        <path d="M17 19h4"/>
    </svg>
);

const ChevronDownIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

const StopIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
);

// ============================================
// INTERFACES
// ============================================

interface ToolCall {
    name: string;
    input?: Record<string, unknown>;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    tools?: ToolCall[];
    thoughts?: ThoughtStep[];
}

interface FileContext {
    relativePath: string;
    language: string;
    hasSelection: boolean;
    lineCount: number;
}

interface SlashCommand {
    name: string;
    description: string;
    prompt: string;
}

interface ModelOption {
    id: string;
    name: string;
}

interface PlanStep {
    id: number;
    action: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    files?: string[];
}

interface AgentPlan {
    taskId: string;
    steps: PlanStep[];
}

type AppMode = 'chat' | 'review' | 'plan' | 'brainstorm';
type PermissionMode = 'manual' | 'auto' | 'skip';

interface PlanState {
    currentPlan: AgentPlan | null;
    steps: PlanStep[];
    executionStatus: 'idle' | 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled';
    currentStepIndex: number;
}

interface DiffChange {
    id: string;
    file: string;
    oldContent: string;
    newContent: string;
    status: 'pending' | 'approved' | 'rejected';
    additions: number;
    deletions: number;
    summary: string;
    reasoning: string;
}

interface ReviewState {
    diffChanges: DiffChange[];
    reviewStatus: 'idle' | 'analyzing' | 'ready' | 'applying';
    currentFile: string | null;
}

interface SwarmAgent {
    id: string;
    type: string;
    status: 'idle' | 'working' | 'completed' | 'failed';
    progress: number;
    currentTask: string | null;
}

interface SwarmProgress {
    totalAgents: number;
    activeAgents: number;
    completedAgents: number;
    overallProgress: number;
}

interface SwarmState {
    agents: SwarmAgent[];
    topology: 'mesh' | 'hierarchical' | 'ring';
    progress: SwarmProgress;
    agentOutputs: Map<string, string[]>;
}

interface ThoughtStep {
    id: string;
    type: 'tool' | 'thinking' | 'execution';
    toolName?: string;
    toolInput?: Record<string, unknown>;
    output?: string;
    timestamp: number;
    status: 'pending' | 'running' | 'done' | 'error';
}

interface Attachment {
    id: string;
    name: string;
    mimeType: string;
    data: string;
    size: number;
}

// ============================================
// CONSTANTS
// ============================================

const SLASH_COMMANDS: SlashCommand[] = [
    { name: '/explain', description: 'Explain the code', prompt: 'Explain this code in detail. What does it do and how does it work?' },
    { name: '/fix', description: 'Fix issues in code', prompt: 'Find and fix any bugs or issues in this code. Explain what was wrong and how you fixed it.' },
    { name: '/test', description: 'Generate tests', prompt: 'Write comprehensive unit tests for this code.' },
    { name: '/refactor', description: 'Refactor code', prompt: 'Refactor this code to be cleaner, more efficient, and follow best practices.' },
    { name: '/docs', description: 'Add documentation', prompt: 'Add comprehensive documentation comments to this code.' },
    { name: '/optimize', description: 'Optimize performance', prompt: 'Optimize this code for better performance. Explain the optimizations made.' },
];

const MODELS: ModelOption[] = [
    { id: 'claude-sonnet-4-5', name: 'Sonnet' },
    { id: 'claude-haiku-4-5', name: 'Haiku' },
    { id: 'claude-opus-4-5', name: 'Opus' },
];

// ============================================
// COMPONENTS
// ============================================

function ToolCallBadge({ tool }: { tool: ToolCall }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={styles.toolCall}>
            <div style={styles.toolHeader} onClick={() => setExpanded(!expanded)}>
                <span style={styles.toolIcon}>⚙️</span>
                <span style={styles.toolName}>{tool.name}</span>
                <span style={styles.toolExpand}>{expanded ? '−' : '+'}</span>
            </div>
            {expanded && tool.input && (
                <pre style={styles.toolInput}>{JSON.stringify(tool.input, null, 2)}</pre>
            )}
        </div>
    );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        vscode.postMessage({ type: 'copy', code });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApply = () => {
        vscode.postMessage({ type: 'apply', code, language });
    };

    const handleInsert = () => {
        vscode.postMessage({ type: 'insert', code });
    };

    return (
        <div style={styles.codeBlockWrapper}>
            <div style={styles.codeHeader}>
                <span style={styles.codeLang}>{language || 'code'}</span>
                <div style={styles.codeActions}>
                    <button style={styles.codeButton} onClick={handleCopy} title="Copy to clipboard">
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button style={styles.codeButton} onClick={handleInsert} title="Insert at cursor">
                        Insert
                    </button>
                    <button style={{...styles.codeButton, ...styles.applyButton}} onClick={handleApply} title="Apply code">
                        Apply
                    </button>
                </div>
            </div>
            <pre style={styles.codeBlock}>
                <code>{code}</code>
            </pre>
        </div>
    );
}

function MessageContent({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
    return (
        <div style={styles.markdown}>
            <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                components={{
                    code({ node, className, children, ...props }) {
                        const isInline = !className;
                        const codeString = String(children).replace(/\n$/, '');
                        const language = className?.replace('language-', '') || '';

                        if (isInline) {
                            return <code style={styles.inlineCode} {...props}>{children}</code>;
                        }
                        return <CodeBlock code={codeString} language={language} />;
                    },
                    p: ({ children }) => <p style={styles.paragraph}>{children}</p>,
                    ul: ({ children }) => <ul style={styles.list}>{children}</ul>,
                    ol: ({ children }) => <ol style={styles.list}>{children}</ol>,
                    li: ({ children }) => <li style={styles.listItem}>{children}</li>
                }}
            >
                {content}
            </ReactMarkdown>
            {isStreaming && <span style={styles.cursor}>|</span>}
        </div>
    );
}

function SlashCommandPicker({
    filter,
    onSelect,
    onClose
}: {
    filter: string;
    onSelect: (cmd: SlashCommand) => void;
    onClose: () => void;
}) {
    const filtered = SLASH_COMMANDS.filter(cmd =>
        cmd.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) return null;

    return (
        <div style={styles.slashPicker}>
            {filtered.map(cmd => (
                <div
                    key={cmd.name}
                    style={styles.slashItem}
                    onClick={() => onSelect(cmd)}
                >
                    <span style={styles.slashName}>{cmd.name}</span>
                    <span style={styles.slashDesc}>{cmd.description}</span>
                </div>
            ))}
        </div>
    );
}

// ============================================
// WELCOME SCREEN - Verdent Style
// ============================================

function WelcomeScreen({ onViewFeatures }: { onViewFeatures: () => void }) {
    return (
        <div style={styles.welcomeContainer}>
            <div style={styles.welcomeContent}>
                <LeafLogo />
                <h1 style={styles.welcomeTitle}>Claude Assistant</h1>
                <p style={styles.welcomeSubtitle}>
                    Transform your concepts into high-quality code. Assemble highly capable
                    coding agents to tackle complex, feature-level tasks.
                </p>
                <button style={styles.viewFeaturesButton} onClick={onViewFeatures}>
                    <SparklesIcon />
                    <span>View Features</span>
                </button>
            </div>
        </div>
    );
}

// ============================================
// MODEL SELECTOR DROPDOWN
// ============================================

function ModelSelector({
    selectedModel,
    onChange
}: {
    selectedModel: string;
    onChange: (model: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const selectedName = MODELS.find(m => m.id === selectedModel)?.name || 'Model';

    return (
        <div style={styles.modelSelectorWrapper}>
            <button
                style={styles.modelSelectorButton}
                onClick={() => setOpen(!open)}
            >
                <span>{selectedName}</span>
                <ChevronDownIcon />
            </button>
            {open && (
                <div style={styles.modelDropdown}>
                    {MODELS.map(m => (
                        <div
                            key={m.id}
                            style={{
                                ...styles.modelOption,
                                ...(m.id === selectedModel ? styles.modelOptionActive : {})
                            }}
                            onClick={() => {
                                onChange(m.id);
                                setOpen(false);
                            }}
                        >
                            {m.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// ULTRATHINK TOGGLE
// ============================================

function UltrathinkToggle({
    enabled,
    onChange
}: {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <button
            style={{
                ...styles.ultrathinkButton,
                ...(enabled ? styles.ultrathinkButtonActive : {})
            }}
            onClick={() => onChange(!enabled)}
            title={enabled ? 'Ultrathink enabled' : 'Enable Ultrathink for deeper reasoning'}
        >
            <BrainIcon />
        </button>
    );
}

// ============================================
// PLANNER VIEW - Plan-First UI
// ============================================

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);

const XIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
);

const LoaderIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

function PlannerView({
    plan,
    onApprove,
    onCancel,
    onEditStep
}: {
    plan: AgentPlan;
    onApprove: () => void;
    onCancel: () => void;
    onEditStep: (stepId: number, newDescription: string) => void;
}) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const getStatusIcon = (status: PlanStep['status']) => {
        switch (status) {
            case 'completed': return <span style={{ color: '#10b981' }}><CheckIcon /></span>;
            case 'failed': return <span style={{ color: '#ef4444' }}><XIcon /></span>;
            case 'in_progress': return <span style={{ color: '#f59e0b' }}><LoaderIcon /></span>;
            default: return <span style={styles.stepNumber}>○</span>;
        }
    };

    const handleSaveEdit = (stepId: number) => {
        onEditStep(stepId, editValue);
        setEditingId(null);
        setEditValue('');
    };

    return (
        <div style={styles.plannerContainer}>
            <div style={styles.plannerHeader}>
                <h3 style={styles.plannerTitle}>Execution Plan</h3>
                <p style={styles.plannerSubtitle}>Review and approve the steps before execution</p>
            </div>

            <div style={styles.stepsList}>
                {plan.steps.map((step, index) => (
                    <div key={step.id} style={styles.stepItem}>
                        <div style={styles.stepLeft}>
                            {getStatusIcon(step.status)}
                            <div style={styles.stepContent}>
                                <div style={styles.stepAction}>{step.action}</div>
                                {editingId === step.id ? (
                                    <div style={styles.stepEditContainer}>
                                        <textarea
                                            style={styles.stepEditTextarea}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            rows={2}
                                        />
                                        <div style={styles.stepEditButtons}>
                                            <button 
                                                style={styles.stepEditSave}
                                                onClick={() => handleSaveEdit(step.id)}
                                            >
                                                Save
                                            </button>
                                            <button 
                                                style={styles.stepEditCancel}
                                                onClick={() => setEditingId(null)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        style={styles.stepDescription}
                                        onClick={() => {
                                            setEditingId(step.id);
                                            setEditValue(step.description);
                                        }}
                                    >
                                        {step.description}
                                    </div>
                                )}
                                {step.files && step.files.length > 0 && (
                                    <div style={styles.stepFiles}>
                                        {step.files.map((f, i) => (
                                            <span key={i} style={styles.stepFile}>{f}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={styles.stepNumber}>{index + 1}</div>
                    </div>
                ))}
            </div>

            <div style={styles.plannerActions}>
                <button style={styles.cancelButton} onClick={onCancel}>
                    Cancel
                </button>
                <button style={styles.approveButton} onClick={onApprove}>
                    <CheckIcon />
                    Approve & Execute
                </button>
            </div>
        </div>
    );
}

// ============================================
// DIFFLENS VIEW - Semantic Diff Review
// ============================================

const FileIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
    </svg>
);

const PlusIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
    </svg>
);

const MinusIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14"/>
    </svg>
);

function DiffLensView({
    changes,
    onAccept,
    onReject,
    onViewDetails
}: {
    changes: DiffChange[];
    onAccept: (ids: string[]) => void;
    onReject: (ids: string[]) => void;
    onViewDetails: (id: string) => void;
}) {
    const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);

    return (
        <div style={styles.diffLensContainer}>
            <div style={styles.diffLensHeader}>
                <h3 style={styles.diffLensTitle}>DiffLens Review</h3>
                <div style={styles.diffStats}>
                    <span style={styles.diffStatAdd}>
                        <PlusIcon /> {totalAdditions}
                    </span>
                    <span style={styles.diffStatRemove}>
                        <MinusIcon /> {totalDeletions}
                    </span>
                </div>
            </div>

            <div style={styles.changesList}>
                {changes.map((change, index) => (
                    <div key={index} style={styles.changeItem}>
                        <div style={styles.changeHeader}>
                            <div style={styles.changeFile}>
                                <FileIcon />
                                <span>{change.file}</span>
                            </div>
                            <div style={styles.changeStats}>
                                <span style={styles.changeAdd}>+{change.additions}</span>
                                <span style={styles.changeRemove}>-{change.deletions}</span>
                            </div>
                        </div>
                        <div style={styles.changeSummary}>{change.summary}</div>
                        <div style={styles.changeReasoning}>
                            <span style={styles.reasoningLabel}>Reasoning:</span> {change.reasoning}
                        </div>
                        <button
                            style={styles.viewDetailsButton}
                            onClick={() => onViewDetails(change.id)}
                        >
                            View Full Diff
                        </button>
                    </div>
                ))}
            </div>

            <div style={styles.diffLensActions}>
                <button style={styles.rejectButton} onClick={() => onReject(changes.map(c => c.id))}>
                    <XIcon />
                    Reject Changes
                </button>
                <button style={styles.acceptButton} onClick={() => onAccept(changes.map(c => c.id))}>
                    <CheckIcon />
                    Accept & Merge
                </button>
            </div>
        </div>
    );
}

// ============================================
// THOUGHT PROCESS - Collapsible Tool Logs
// ============================================

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
        <polyline points="6 9 12 15 18 9"/>
    </svg>
);

const GearIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
);

const ChatIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
);

const ReviewIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
    </svg>
);

const PlanDocIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
);

const SwarmIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <circle cx="5" cy="6" r="2"/>
        <circle cx="19" cy="6" r="2"/>
        <circle cx="5" cy="18" r="2"/>
        <circle cx="19" cy="18" r="2"/>
        <path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3"/>
    </svg>
);

const ImageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
    </svg>
);

const HomeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
);

const DatabaseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
);

const NewSessionIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
);

interface SessionMetadata {
    id: string;
    title: string;
    timestamp: number;
    messageCount: number;
}

function TopNavBar({
    onHome,
    onNewSession,
    onIndex,
    onSettings
}: {
    onHome: () => void;
    onNewSession: () => void;
    onIndex: () => void;
    onSettings: () => void;
}) {
    return (
        <div style={styles.topNavBar}>
            <div style={styles.topNavLeft}>
                <button style={styles.navButton} onClick={onHome} title="Home">
                    <HomeIcon />
                </button>
                <button style={styles.navButton} onClick={onIndex} title="Index (Coming Soon)">
                    <DatabaseIcon />
                </button>
            </div>
            <div style={styles.topNavRight}>
                <button style={styles.navButton} onClick={onNewSession} title="New Session">
                    <NewSessionIcon />
                </button>
                <button style={styles.navButton} onClick={onSettings} title="Settings">
                    <GearIcon />
                </button>
            </div>
        </div>
    );
}

function LoadingOverlay({ progress }: { progress: number }) {
    return (
        <div style={styles.loadingOverlay}>
            <div style={styles.loadingContent}>
                <div style={styles.loadingSpinnerLarge} />
                <span style={styles.loadingText}>Loading up the CLI...</span>
                <span style={styles.loadingProgress}>{progress}%</span>
            </div>
        </div>
    );
}

function HomeView({
    sessions,
    onSelect,
    onNewSession
}: {
    sessions: SessionMetadata[];
    onSelect: (id: string) => void;
    onNewSession: () => void;
}) {
    return (
        <div style={styles.homeView}>
            <div style={styles.homeHeader}>
                <h2 style={styles.homeTitle}>Session History</h2>
            </div>
            <div style={styles.sessionList}>
                {sessions.length === 0 ? (
                    <div style={styles.emptyState}>
                        <p style={styles.emptyText}>No previous sessions</p>
                        <button style={styles.newSessionBtn} onClick={onNewSession}>
                            Start a new conversation
                        </button>
                    </div>
                ) : (
                    sessions.map(session => (
                        <button 
                            key={session.id} 
                            style={styles.sessionItem}
                            onClick={() => onSelect(session.id)}
                        >
                            <span style={styles.sessionTitle}>{session.title}</span>
                            <span style={styles.sessionMeta}>
                                {session.messageCount} messages
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

function ThoughtProcess({
    steps,
    isExpanded,
    onToggle,
    isActive
}: {
    steps: ThoughtStep[];
    isExpanded: boolean;
    onToggle: () => void;
    isActive: boolean;
}) {
    if (steps.length === 0 && !isActive) return null;

    return (
        <div style={styles.thoughtContainer}>
            <button onClick={onToggle} style={styles.thoughtHeader}>
                <div style={styles.thoughtHeaderLeft}>
                    {isActive ? (
                        <div style={styles.thoughtSpinner} />
                    ) : (
                        <CheckIcon />
                    )}
                    <span style={styles.thoughtLabel}>
                        {isActive ? 'Thinking...' : `${steps.length} steps executed`}
                    </span>
                </div>
                <ChevronIcon expanded={isExpanded} />
            </button>
            {isExpanded && (
                <div style={styles.thoughtSteps}>
                    {steps.map((step) => (
                        <div key={step.id} style={styles.thoughtStep}>
                            <div style={styles.thoughtStepHeader}>
                                <span style={styles.thoughtToolBadge}>{step.toolName || step.type}</span>
                                <span style={styles.thoughtStatus}>
                                    {step.status === 'running' && <LoaderIcon />}
                                    {step.status === 'done' && <CheckIcon />}
                                    {step.status === 'error' && <XIcon />}
                                </span>
                            </div>
                            {step.toolInput && (
                                <pre style={styles.thoughtCode}>
                                    {JSON.stringify(step.toolInput, null, 2).substring(0, 200)}
                                    {JSON.stringify(step.toolInput).length > 200 && '...'}
                                </pre>
                            )}
                            {step.output && (
                                <div style={styles.thoughtOutput}>
                                    {step.output.substring(0, 150)}
                                    {step.output.length > 150 && '...'}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// SWARM VIEW COMPONENT
// ============================================

interface SwarmViewProps {
    agents: SwarmAgent[];
    progress: SwarmProgress;
    agentOutputs: Map<string, string[]>;
    onStop: () => void;
}

const SwarmView: React.FC<SwarmViewProps> = ({ agents, progress, agentOutputs, onStop }) => {
    return (
        <div style={swarmStyles.container}>
            <div style={swarmStyles.header}>
                <h3 style={swarmStyles.title}>
                    🐝 Swarm Active ({progress.activeAgents}/{progress.totalAgents} agents)
                </h3>
                <button onClick={onStop} style={swarmStyles.stopButton}>
                    Stop Swarm
                </button>
            </div>

            <div style={swarmStyles.progressBar}>
                <div
                    style={{
                        ...swarmStyles.progressFill,
                        width: `${progress.overallProgress}%`
                    }}
                />
            </div>
            <div style={swarmStyles.progressText}>
                {progress.completedAgents} of {progress.totalAgents} agents completed
            </div>

            <div style={swarmStyles.agentGrid}>
                {agents.map(agent => (
                    <div
                        key={agent.id}
                        style={{
                            ...swarmStyles.agentCard,
                            borderColor: agent.status === 'completed' ? '#10b981' :
                                        agent.status === 'working' ? '#3b82f6' :
                                        agent.status === 'failed' ? '#ef4444' : '#6b7280'
                        }}
                    >
                        <div style={swarmStyles.agentHeader}>
                            <span style={swarmStyles.agentId}>{agent.id}</span>
                            <span style={{
                                ...swarmStyles.agentStatus,
                                color: agent.status === 'completed' ? '#10b981' :
                                       agent.status === 'working' ? '#3b82f6' :
                                       agent.status === 'failed' ? '#ef4444' : '#6b7280'
                            }}>
                                {agent.status === 'working' ? '⏳' :
                                 agent.status === 'completed' ? '✅' :
                                 agent.status === 'failed' ? '❌' : '⏸️'} {agent.status}
                            </span>
                        </div>
                        {agent.currentTask && (
                            <div style={swarmStyles.agentTask}>{agent.currentTask}</div>
                        )}
                        <div style={swarmStyles.agentProgress}>
                            <div style={{
                                ...swarmStyles.agentProgressFill,
                                width: `${agent.progress}%`
                            }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const swarmStyles: Record<string, React.CSSProperties> = {
    container: {
        padding: '16px',
        backgroundColor: 'var(--vscode-editor-background)',
        borderRadius: '8px',
        margin: '16px 0'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    title: {
        margin: 0,
        color: 'var(--vscode-foreground)'
    },
    stopButton: {
        padding: '6px 12px',
        backgroundColor: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    },
    progressBar: {
        height: '8px',
        backgroundColor: 'var(--vscode-progressBar-background)',
        borderRadius: '4px',
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10b981',
        transition: 'width 0.3s ease'
    },
    progressText: {
        textAlign: 'center' as const,
        fontSize: '12px',
        color: 'var(--vscode-descriptionForeground)',
        marginTop: '8px'
    },
    agentGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
        marginTop: '16px'
    },
    agentCard: {
        padding: '12px',
        backgroundColor: 'var(--vscode-input-background)',
        borderRadius: '6px',
        borderLeft: '3px solid'
    },
    agentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px'
    },
    agentId: {
        fontWeight: 'bold',
        fontSize: '12px'
    },
    agentStatus: {
        fontSize: '11px'
    },
    agentTask: {
        fontSize: '11px',
        color: 'var(--vscode-descriptionForeground)',
        marginBottom: '8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const
    },
    agentProgress: {
        height: '4px',
        backgroundColor: 'var(--vscode-progressBar-background)',
        borderRadius: '2px',
        overflow: 'hidden'
    },
    agentProgressFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        transition: 'width 0.3s ease'
    }
};

// ============================================
// MODE SELECTOR - 4 Modes
// ============================================

function ModeSelector({
    mode,
    onChange
}: {
    mode: AppMode;
    onChange: (m: AppMode) => void;
}) {
    const modes: { id: AppMode; icon: React.FC; label: string }[] = [
        { id: 'chat', icon: ChatIcon, label: 'Chat' },
        { id: 'review', icon: ReviewIcon, label: 'Review' },
        { id: 'plan', icon: PlanDocIcon, label: 'Plan' },
        { id: 'brainstorm', icon: SwarmIcon, label: 'Swarm' },
    ];

    return (
        <div style={styles.modeSelector}>
            {modes.map((m) => (
                <button
                    key={m.id}
                    onClick={() => onChange(m.id)}
                    style={mode === m.id ? styles.modeButtonActive : styles.modeButton}
                    title={m.label}
                >
                    <m.icon />
                    <span style={styles.modeLabel}>{m.label}</span>
                </button>
            ))}
        </div>
    );
}

// ============================================
// SETTINGS PANEL
// ============================================

function SettingsPanel({
    swarmDensity,
    onSwarmChange,
    permissionMode,
    onPermissionChange,
    onClose
}: {
    swarmDensity: number;
    onSwarmChange: (n: number) => void;
    permissionMode: PermissionMode;
    onPermissionChange: (m: PermissionMode) => void;
    onClose: () => void;
}) {
    return (
        <div style={styles.settingsOverlay}>
            <div style={styles.settingsPanel}>
                <div style={styles.settingsHeader}>
                    <h4 style={styles.settingsTitle}>Settings</h4>
                    <button onClick={onClose} style={styles.settingsClose}>
                        <XIcon />
                    </button>
                </div>

                <div style={styles.settingsSection}>
                    <label style={styles.settingsLabel}>
                        Swarm Density: <span style={styles.settingsValue}>{swarmDensity}</span>
                    </label>
                    <input
                        type="range"
                        min={1}
                        max={12}
                        value={swarmDensity}
                        onChange={(e) => onSwarmChange(parseInt(e.target.value))}
                        style={styles.settingsSlider}
                    />
                    <p style={styles.settingsHint}>
                        Controls the number of sub-agents in Brainstorm mode
                    </p>
                </div>

                <div style={styles.settingsSection}>
                    <label style={styles.settingsLabel}>Permission Mode</label>
                    <div style={styles.permissionGroup}>
                        {(['manual', 'auto', 'skip'] as PermissionMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => onPermissionChange(m)}
                                style={permissionMode === m ? styles.permissionActive : styles.permissionButton}
                            >
                                {m === 'manual' && 'Manual'}
                                {m === 'auto' && 'Auto (Safe)'}
                                {m === 'skip' && 'Skip (YOLO)'}
                            </button>
                        ))}
                    </div>
                    <p style={styles.settingsHint}>
                        {permissionMode === 'manual' && 'Approve every CLI command manually'}
                        {permissionMode === 'auto' && 'Auto-approve reads, pause for writes'}
                        {permissionMode === 'skip' && 'Fully autonomous - no interruptions'}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============================================
// ATTACHMENT PREVIEW
// ============================================

function AttachmentPreview({
    attachments,
    onRemove
}: {
    attachments: Attachment[];
    onRemove: (id: string) => void;
}) {
    if (attachments.length === 0) return null;

    return (
        <div style={styles.attachmentPreview}>
            {attachments.map((att) => (
                <div key={att.id} style={styles.attachmentItem}>
                    <img
                        src={att.data}
                        alt={att.name}
                        style={styles.attachmentThumb}
                    />
                    <button
                        onClick={() => onRemove(att.id)}
                        style={styles.attachmentRemove}
                    >
                        <XIcon />
                    </button>
                </div>
            ))}
        </div>
    );
}

// ============================================
// MAIN APP COMPONENT
// ============================================

export function App() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [activeTools, setActiveTools] = useState<ToolCall[]>([]);
    const [fileContext, setFileContext] = useState<FileContext | null>(null);
    const [includeContext, setIncludeContext] = useState(true);
    const [showSlashPicker, setShowSlashPicker] = useState(false);
    const [slashFilter, setSlashFilter] = useState('');
    const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-5');
    const [ultrathink, setUltrathink] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [currentMode, setCurrentMode] = useState<AppMode>('chat');
    const [thoughtSteps, setThoughtSteps] = useState<ThoughtStep[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [swarmDensity, setSwarmDensity] = useState(3);
    const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto');

    // Plan mode state
    const [planState, setPlanState] = useState<PlanState>({
        currentPlan: null,
        steps: [],
        executionStatus: 'idle',
        currentStepIndex: 0
    });

    // Review mode state
    const [reviewState, setReviewState] = useState<ReviewState>({
        diffChanges: [],
        reviewStatus: 'idle',
        currentFile: null
    });

    // Swarm mode state
    const [swarmState, setSwarmState] = useState<SwarmState>({
        agents: [],
        topology: 'mesh',
        progress: { totalAgents: 0, activeAgents: 0, completedAgents: 0, overallProgress: 0 },
        agentOutputs: new Map()
    });

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [thoughtsExpanded, setThoughtsExpanded] = useState(false);
    const [currentView, setCurrentView] = useState<'chat' | 'home'>('chat');
    const [sessions, setSessions] = useState<SessionMetadata[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);
    const [initProgress, setInitProgress] = useState(0);
    const [currentSessionId, setCurrentSessionId] = useState<string>(`session-${Date.now()}`);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const streamingRef = useRef('');
    const toolsRef = useRef<ToolCall[]>([]);
    const thoughtStepsRef = useRef<ThoughtStep[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent, scrollToBottom]);

    useEffect(() => {
        streamingRef.current = streamingContent;
    }, [streamingContent]);

    useEffect(() => {
        toolsRef.current = activeTools;
    }, [activeTools]);

    useEffect(() => {
        thoughtStepsRef.current = thoughtSteps;
    }, [thoughtSteps]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            if (message.type === 'claude') {
                const payload = message.payload;
                switch (payload.type) {
                    case 'chunk':
                        setStreamingContent(prev => prev + payload.content);
                        break;
                    case 'tool':
                        const newStep: ThoughtStep = {
                            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            type: 'tool',
                            toolName: payload.toolName,
                            toolInput: payload.toolInput,
                            timestamp: Date.now(),
                            status: 'running'
                        };
                        setThoughtSteps(prev => [...prev, newStep]);
                        setActiveTools(prev => [...prev, { name: payload.toolName, input: payload.toolInput }]);
                        break;
                    case 'done':
                        setIsGenerating(false);
                        const finalContent = streamingRef.current || payload.content;
                        setThoughtSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
                        if (finalContent?.trim()) {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: finalContent,
                                tools: toolsRef.current.length > 0 ? [...toolsRef.current] : undefined,
                                thoughts: thoughtStepsRef.current.length > 0 ? [...thoughtStepsRef.current] : undefined
                            }]);
                        }
                        setStreamingContent('');
                        setActiveTools([]);
                        setThoughtSteps([]);
                        streamingRef.current = '';
                        toolsRef.current = [];
                        thoughtStepsRef.current = [];
                        break;
                    case 'error':
                        setIsGenerating(false);
                        setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${payload.content}` }]);
                        setStreamingContent('');
                        setActiveTools([]);
                        setThoughtSteps([]);
                        streamingRef.current = '';
                        toolsRef.current = [];
                        thoughtStepsRef.current = [];
                        break;
                }
            } else if (message.type === 'context') {
                setFileContext(message.payload);
            } else if (message.type === 'sessions') {
                setSessions(message.payload);
            } else if (message.type === 'sessionLoaded') {
                setMessages(message.payload.messages);
                setShowWelcome(false);
            } else if (message.type === 'initProgress') {
                setInitProgress(message.payload);
                if (message.payload >= 100) {
                    setIsInitializing(false);
                }
            } else if (message.type === 'plan_ready') {
                setPlanState({
                    currentPlan: message.plan,
                    steps: message.steps || message.plan?.steps || [],
                    executionStatus: 'draft',
                    currentStepIndex: 0
                });
            } else if (message.type === 'step_update') {
                setPlanState(prev => ({
                    ...prev,
                    steps: prev.steps.map(step =>
                        step.id === message.stepId
                            ? { ...step, status: message.status }
                            : step
                    ),
                    currentStepIndex: message.stepIndex ?? prev.currentStepIndex
                }));
            } else if (message.type === 'plan_execution_complete') {
                setPlanState(prev => ({
                    ...prev,
                    executionStatus: 'completed'
                }));
            } else if (message.type === 'review_result') {
                setReviewState({
                    diffChanges: message.changes || [],
                    reviewStatus: 'ready',
                    currentFile: message.file || null
                });
            } else if (message.type === 'review_status') {
                setReviewState(prev => ({
                    ...prev,
                    reviewStatus: message.status
                }));
            } else if (message.type === 'swarm_init') {
                const initialAgents: SwarmAgent[] = [];
                for (let i = 0; i < message.agentCount; i++) {
                    initialAgents.push({
                        id: `agent-${i}`,
                        type: 'coder',
                        status: 'idle',
                        progress: 0,
                        currentTask: null
                    });
                }
                setSwarmState({
                    agents: initialAgents,
                    topology: message.topology || 'mesh',
                    progress: {
                        totalAgents: message.agentCount,
                        activeAgents: 0,
                        completedAgents: 0,
                        overallProgress: 0
                    },
                    agentOutputs: new Map()
                });
            } else if (message.type === 'agent_update') {
                setSwarmState(prev => {
                    const updatedAgents = prev.agents.map(agent =>
                        agent.id === message.agentId
                            ? {
                                ...agent,
                                status: message.status || agent.status,
                                progress: message.progress ?? agent.progress,
                                currentTask: message.task ?? agent.currentTask
                            }
                            : agent
                    );

                    const completed = updatedAgents.filter(a => a.status === 'completed').length;
                    const active = updatedAgents.filter(a => a.status === 'working').length;

                    return {
                        ...prev,
                        agents: updatedAgents,
                        progress: {
                            ...prev.progress,
                            activeAgents: active,
                            completedAgents: completed,
                            overallProgress: (completed / prev.progress.totalAgents) * 100
                        }
                    };
                });
            } else if (message.type === 'agent_stream') {
                // Live streaming from CLI - update streaming content for the active agent/task
                const { taskId, role, content } = message;

                // For plan mode - show planner's live output
                if (role === 'planner' || taskId?.startsWith('plan-')) {
                    setStreamingContent(prev => prev + content);
                }

                // For swarm mode - update agent outputs
                if (taskId?.startsWith('swarm-')) {
                    setSwarmState(prev => {
                        const newOutputs = new Map(prev.agentOutputs);
                        const existing = newOutputs.get(taskId) || [];
                        newOutputs.set(taskId, [...existing, content]);
                        return { ...prev, agentOutputs: newOutputs };
                    });
                }

                // For coder/verifier in plan execution
                if (role === 'coder' || role === 'verifier') {
                    setStreamingContent(prev => prev + content);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'getContext' });
        vscode.postMessage({ type: 'webviewReady' });
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Switch from welcome to chat when there are messages
    useEffect(() => {
        if (messages.length > 0 || isGenerating) {
            setShowWelcome(false);
        }
    }, [messages, isGenerating]);

    const handleSlashCommand = (cmd: SlashCommand) => {
        setInput('');
        setShowSlashPicker(false);
        setSlashFilter('');
        setShowWelcome(false);

        const userMessage = `${cmd.name}: ${cmd.prompt}`;
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsGenerating(true);
        setStreamingContent('');
        setActiveTools([]);

        vscode.postMessage({
            type: 'send',
            text: cmd.prompt,
            includeContext: true,
            model: selectedModel,
            ultrathink,
            mode: currentMode,
            swarmDensity,
            permissionMode
        });
    };

    const handleSend = () => {
        if (!input.trim() || isGenerating) return;

        setShowWelcome(false);
        const userMessage = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setIsGenerating(true);
        setStreamingContent('');
        setActiveTools([]);
        setShowSlashPicker(false);

        // Include mode and settings in message
        vscode.postMessage({
            type: 'send',
            text: userMessage,
            includeContext,
            model: selectedModel,
            ultrathink,
            mode: currentMode,           // NEW: pass current mode
            swarmDensity,                // NEW: pass swarm density
            permissionMode               // NEW: pass permission mode
        });
    };

    const handleStop = () => {
        vscode.postMessage({ type: 'stop' });
        setIsGenerating(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInput(value);

        if (value.startsWith('/')) {
            setShowSlashPicker(true);
            setSlashFilter(value);
        } else {
            setShowSlashPicker(false);
            setSlashFilter('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (showSlashPicker) {
                const filtered = SLASH_COMMANDS.filter(cmd =>
                    cmd.name.toLowerCase().includes(slashFilter.toLowerCase())
                );
                if (filtered.length === 1) {
                    handleSlashCommand(filtered[0]);
                    return;
                }
            }
            handleSend();
        } else if (e.key === 'Escape') {
            setShowSlashPicker(false);
        }
    };

    const handleViewFeatures = () => {
        setShowWelcome(false);
        textareaRef.current?.focus();
    };

    const handleContextClick = () => {
        setIncludeContext(!includeContext);
    };

    const handleNewSession = () => {
        if (messages.length > 0) {
            vscode.postMessage({ type: 'saveSession', id: currentSessionId, messages });
        }
        setMessages([]);
        setStreamingContent('');
        setThoughtSteps([]);
        setCurrentSessionId(`session-${Date.now()}`);
        setCurrentView('chat');
        setShowWelcome(true);
        vscode.postMessage({ type: 'newSession' });
    };

    const handleLoadSession = (sessionId: string) => {
        vscode.postMessage({ type: 'loadSession', id: sessionId });
        setCurrentSessionId(sessionId);
        setCurrentView('chat');
    };

    const handleIndex = () => {
        vscode.postMessage({ type: 'showInfo', message: 'Indexing Dashboard: Coming Soon' });
    };

    const handleGoHome = () => {
        vscode.postMessage({ type: 'getSessions' });
        setCurrentView('home');
    };

    return (
        <div style={styles.container}>
            {/* Top Navigation Bar */}
            <TopNavBar
                onHome={handleGoHome}
                onNewSession={handleNewSession}
                onIndex={handleIndex}
                onSettings={() => setShowSettings(true)}
            />

            {/* Loading Overlay */}
            {isInitializing && <LoadingOverlay progress={initProgress} />}

            {/* Main Content Area */}
            <div style={styles.mainContent}>
                {currentView === 'home' ? (
                    <HomeView
                        sessions={sessions}
                        onSelect={handleLoadSession}
                        onNewSession={handleNewSession}
                    />
                ) : currentMode === 'plan' && isGenerating && !planState.currentPlan ? (
                    /* Plan Generation Streaming View */
                    <div style={styles.streamingContainer}>
                        <div style={styles.streamingHeader}>
                            <span style={styles.streamingIcon}>🧠</span>
                            <h3 style={styles.streamingTitle}>Generating Plan...</h3>
                        </div>
                        <div style={styles.streamingContent}>
                            <pre style={styles.streamingPre}>{streamingContent || 'Analyzing task and creating execution plan...'}</pre>
                        </div>
                        <div style={styles.streamingIndicator}>
                            <span style={styles.pulsingDot}></span>
                            <span>Planner agent working</span>
                        </div>
                    </div>
                ) : currentMode === 'plan' && planState.currentPlan ? (
                    <PlannerView
                        plan={planState.currentPlan}
                        onApprove={() => {
                            vscode.postMessage({
                                type: 'plan_approve',
                                planId: planState.currentPlan?.taskId
                            });
                            setPlanState(prev => ({ ...prev, executionStatus: 'approved' }));
                        }}
                        onCancel={() => {
                            vscode.postMessage({
                                type: 'plan_cancel',
                                planId: planState.currentPlan?.taskId
                            });
                            setPlanState(prev => ({
                                ...prev,
                                executionStatus: 'cancelled',
                                currentPlan: null
                            }));
                        }}
                        onEditStep={(stepId, newDescription) => {
                            vscode.postMessage({
                                type: 'plan_edit_step',
                                stepId,
                                description: newDescription
                            });
                            setPlanState(prev => ({
                                ...prev,
                                steps: prev.steps.map(s =>
                                    s.id === stepId ? { ...s, description: newDescription } : s
                                )
                            }));
                        }}
                    />
                ) : currentMode === 'brainstorm' && swarmState.agents.length > 0 ? (
                    <SwarmView
                        agents={swarmState.agents}
                        progress={swarmState.progress}
                        agentOutputs={swarmState.agentOutputs}
                        onStop={() => {
                            vscode.postMessage({ type: 'swarm_stop' });
                            setSwarmState(prev => ({
                                ...prev,
                                agents: prev.agents.map(a => ({ ...a, status: 'idle' as const }))
                            }));
                        }}
                    />
                ) : showWelcome && messages.length === 0 && !isGenerating ? (
                    <WelcomeScreen onViewFeatures={handleViewFeatures} />
                ) : (
                    <div style={styles.messagesContainer}>
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    ...styles.message,
                                    ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage)
                                }}
                            >
                                <div style={styles.messageHeader}>
                                    <span style={styles.messageRole}>{msg.role === 'user' ? 'You' : 'Claude'}</span>
                                </div>
                                {msg.thoughts && msg.thoughts.length > 0 && (
                                    <ThoughtProcess
                                        steps={msg.thoughts}
                                        isExpanded={thoughtsExpanded}
                                        onToggle={() => setThoughtsExpanded(!thoughtsExpanded)}
                                        isActive={false}
                                    />
                                )}
                                {msg.role === 'user' ? (
                                    <div style={styles.userContent}>{msg.content}</div>
                                ) : (
                                    <MessageContent content={msg.content} />
                                )}
                            </div>
                        ))}

                        {isGenerating && (
                            <div style={{ ...styles.message, ...styles.assistantMessage }}>
                                <div style={styles.messageHeader}>
                                    <span style={styles.messageRole}>Claude</span>
                                    <span style={styles.streamingBadge}>Generating...</span>
                                </div>
                                {thoughtSteps.length > 0 && (
                                    <ThoughtProcess
                                        steps={thoughtSteps}
                                        isExpanded={thoughtsExpanded}
                                        onToggle={() => setThoughtsExpanded(!thoughtsExpanded)}
                                        isActive={true}
                                    />
                                )}
                                {streamingContent ? (
                                    <MessageContent content={streamingContent} isStreaming />
                                ) : (
                                    <div style={styles.thinking}>
                                        <div style={styles.thinkingDots}>
                                            <span style={styles.dot}></span>
                                            <span style={{ ...styles.dot, animationDelay: '0.2s' }}></span>
                                            <span style={{ ...styles.dot, animationDelay: '0.4s' }}></span>
                                        </div>
                                        <span>Thinking...</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}

                {/* Review Mode View */}
                {currentMode === 'review' && reviewState.reviewStatus !== 'idle' && (
                    <div style={styles.reviewContainer}>
                        <div style={styles.reviewHeader}>
                            <h3 style={styles.reviewTitle}>Code Review</h3>
                            <span style={styles.reviewStatus}>{reviewState.reviewStatus}</span>
                        </div>
                        {reviewState.diffChanges.length > 0 ? (
                            <DiffLensView
                                changes={reviewState.diffChanges}
                                onAccept={(ids) => {
                                    vscode.postMessage({ type: 'review_accept', changeIds: ids });
                                }}
                                onReject={(ids) => {
                                    setReviewState(prev => ({
                                        ...prev,
                                        diffChanges: prev.diffChanges.filter(c => !ids.includes(c.id))
                                    }));
                                }}
                                onViewDetails={(id) => {
                                    vscode.postMessage({ type: 'review_details', changeId: id });
                                }}
                            />
                        ) : (
                            <div style={styles.noChanges}>No changes to review</div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Input Bar - Only show in chat view */}
            {currentView === 'chat' && (
            <div style={styles.inputBarContainer}>
                {showSlashPicker && (
                    <SlashCommandPicker
                        filter={slashFilter}
                        onSelect={handleSlashCommand}
                        onClose={() => setShowSlashPicker(false)}
                    />
                )}

                {/* Mode Selector Row */}
                <div style={styles.modeSelectorRow}>
                    <ModeSelector mode={currentMode} onChange={setCurrentMode} />
                </div>

                <div style={styles.inputCard}>
                    {/* Attachment Preview */}
                    <AttachmentPreview
                        attachments={attachments}
                        onRemove={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
                    />

                    {/* Top Row - Icons */}
                    <div style={styles.inputTopRow}>
                        <div style={styles.inputTopLeft}>
                            <button
                                style={{
                                    ...styles.topIconButton,
                                    ...(includeContext && fileContext ? styles.topIconButtonActive : {})
                                }}
                                onClick={handleContextClick}
                                title={fileContext ? (includeContext ? 'Context ON' : 'Context OFF') : 'No file open'}
                            >
                                <AtIcon />
                            </button>
                            <button
                                style={styles.topIconButton}
                                title="Attach image"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <PaperclipIcon />
                            </button>
                            <button style={styles.topIconButton} title="History">
                                <HistoryIcon />
                            </button>
                        </div>
                        <button style={styles.slashCommandsButton}>
                            + Commands
                        </button>
                    </div>

                    {/* Hidden File Input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach(file => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    setAttachments(prev => [...prev, {
                                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                        name: file.name,
                                        mimeType: file.type,
                                        data: reader.result as string,
                                        size: file.size
                                    }]);
                                };
                                reader.readAsDataURL(file);
                            });
                            e.target.value = '';
                        }}
                    />

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        style={styles.mainTextarea}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="@ to add context, type / for commands"
                        disabled={isGenerating}
                        rows={2}
                    />

                    {/* Bottom Row - Controls */}
                    <div style={styles.inputBottomRow}>
                        <div style={styles.inputBottomLeft}>
                            {fileContext && includeContext && (
                                <div style={styles.contextPill}>
                                    <span style={styles.contextDot}>●</span>
                                    <span style={styles.contextFileName}>
                                        {fileContext.relativePath.split(/[/\\]/).pop()}
                                    </span>
                                    {fileContext.hasSelection && <span style={styles.selectionTag}>sel</span>}
                                </div>
                            )}
                            <ModelSelector
                                selectedModel={selectedModel}
                                onChange={setSelectedModel}
                            />
                            <UltrathinkToggle
                                enabled={ultrathink}
                                onChange={setUltrathink}
                            />
                        </div>
                        <div style={styles.inputBottomRight}>
                            {isGenerating ? (
                                <button style={styles.stopButton} onClick={handleStop} title="Stop">
                                    <StopIcon />
                                </button>
                            ) : (
                                <button
                                    style={{
                                        ...styles.sendButton,
                                        opacity: input.trim() ? 1 : 0.4
                                    }}
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    title="Send"
                                >
                                    <SendIcon />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Settings Panel Overlay */}
            {showSettings && (
                <SettingsPanel
                    swarmDensity={swarmDensity}
                    onSwarmChange={setSwarmDensity}
                    permissionMode={permissionMode}
                    onPermissionChange={setPermissionMode}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
}

// ============================================
// VERDENT DARK THEME STYLES
// ============================================

const COLORS = {
    // Base
    background: '#121212',
    backgroundLight: '#1a1a1a',
    surface: '#1e1e1e',
    surfaceHover: '#252525',
    border: '#2d2d2d',
    borderLight: '#3d3d3d',

    // Text
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    textMuted: '#666666',

    // Accent - Verdent Green
    accent: '#10b981',
    accentDark: '#0d9668',
    accentLight: '#34d399',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    accentBorder: 'rgba(16, 185, 129, 0.3)',

    // Status
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.1)',
};

const styles: { [key: string]: React.CSSProperties } = {
    // ======== CONTAINER ========
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: COLORS.background,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },

    // ======== MAIN CONTENT ========
    mainContent: {
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
    },

    // ======== WELCOME SCREEN ========
    welcomeContainer: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
    },
    welcomeContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '400px',
    },
    welcomeTitle: {
        fontSize: '28px',
        fontWeight: 700,
        color: COLORS.textPrimary,
        margin: '20px 0 12px 0',
        letterSpacing: '-0.5px',
    },
    welcomeSubtitle: {
        fontSize: '14px',
        lineHeight: '1.6',
        color: COLORS.textSecondary,
        margin: '0 0 32px 0',
    },
    viewFeaturesButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 24px',
        backgroundColor: COLORS.surface,
        color: COLORS.accent,
        border: `1px solid ${COLORS.accentBorder}`,
        borderRadius: '24px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'all 0.2s ease',
    },

    // ======== MESSAGES ========
    messagesContainer: {
        flex: 1,
        overflow: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    message: {
        padding: '14px 16px',
        borderRadius: '12px',
        maxWidth: '100%',
    },
    userMessage: {
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        alignSelf: 'flex-end',
        maxWidth: '85%',
    },
    assistantMessage: {
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        alignSelf: 'flex-start',
    },
    messageHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
    },
    messageRole: {
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: COLORS.textMuted,
    },
    streamingBadge: {
        fontSize: '10px',
        padding: '2px 8px',
        backgroundColor: COLORS.accentBg,
        color: COLORS.accent,
        borderRadius: '4px',
    },
    userContent: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.5,
    },

    // ======== MARKDOWN ========
    markdown: {
        lineHeight: 1.6,
        fontSize: '14px',
        color: COLORS.textPrimary,
    },
    paragraph: {
        margin: '0 0 12px 0',
    },
    list: {
        margin: '0 0 12px 0',
        paddingLeft: '20px',
    },
    listItem: {
        marginBottom: '4px',
    },
    inlineCode: {
        backgroundColor: COLORS.backgroundLight,
        padding: '2px 6px',
        borderRadius: '4px',
        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
        fontSize: '13px',
        color: COLORS.accentLight,
    },

    // ======== CODE BLOCKS ========
    codeBlockWrapper: {
        margin: '12px 0',
        borderRadius: '8px',
        overflow: 'hidden',
        border: `1px solid ${COLORS.border}`,
    },
    codeHeader: {
        padding: '8px 12px',
        backgroundColor: COLORS.backgroundLight,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    codeLang: {
        fontSize: '11px',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
    },
    codeActions: {
        display: 'flex',
        gap: '6px',
    },
    codeButton: {
        padding: '4px 10px',
        fontSize: '11px',
        backgroundColor: 'transparent',
        color: COLORS.textSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    applyButton: {
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        border: 'none',
    },
    codeBlock: {
        margin: 0,
        padding: '14px',
        backgroundColor: COLORS.backgroundLight,
        overflow: 'auto',
        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
        fontSize: '13px',
        lineHeight: 1.5,
        color: COLORS.textSecondary,
    },
    cursor: {
        display: 'inline-block',
        width: '2px',
        height: '1em',
        backgroundColor: COLORS.accent,
        marginLeft: '2px',
        animation: 'blink 1s step-end infinite',
    },

    // ======== TOOLS ========
    toolsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginBottom: '10px',
    },
    toolCall: {
        backgroundColor: COLORS.backgroundLight,
        borderRadius: '6px',
        overflow: 'hidden',
        border: `1px solid ${COLORS.border}`,
    },
    toolHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    toolIcon: {
        fontSize: '12px',
    },
    toolName: {
        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
        color: COLORS.accent,
    },
    toolExpand: {
        marginLeft: 'auto',
        color: COLORS.textMuted,
    },
    toolInput: {
        margin: 0,
        padding: '10px 12px',
        fontSize: '11px',
        backgroundColor: COLORS.background,
        borderTop: `1px solid ${COLORS.border}`,
        overflow: 'auto',
        maxHeight: '150px',
        color: COLORS.textSecondary,
    },

    // ======== THINKING ========
    thinking: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: COLORS.textMuted,
        fontStyle: 'italic',
        fontSize: '13px',
    },
    thinkingDots: {
        display: 'flex',
        gap: '4px',
    },
    dot: {
        width: '6px',
        height: '6px',
        backgroundColor: COLORS.accent,
        borderRadius: '50%',
        animation: 'pulse 1.4s ease-in-out infinite',
    },

    // ======== INPUT BAR - Verdent Style ========
    inputBarContainer: {
        padding: '12px',
        backgroundColor: COLORS.background,
        position: 'relative',
    },
    modeSelectorRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
    },
    settingsButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        backgroundColor: 'transparent',
        color: COLORS.textMuted,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },

    // ======== TOP NAVIGATION BAR ========
    topNavBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: COLORS.background,
        borderBottom: `1px solid ${COLORS.border}`,
    },
    topNavLeft: {
        display: 'flex',
        gap: '4px',
    },
    topNavRight: {
        display: 'flex',
        gap: '4px',
    },
    navButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        backgroundColor: 'transparent',
        color: COLORS.textMuted,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },

    // ======== LOADING OVERLAY ========
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(18, 18, 18, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    loadingContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
    },
    loadingSpinnerLarge: {
        width: '40px',
        height: '40px',
        border: '3px solid transparent',
        borderTop: `3px solid ${COLORS.accent}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    loadingText: {
        color: COLORS.textPrimary,
        fontSize: '16px',
    },
    loadingProgress: {
        color: COLORS.accent,
        fontSize: '24px',
        fontWeight: 600,
    },

    // ======== HOME VIEW ========
    homeView: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        overflow: 'auto',
    },
    homeHeader: {
        marginBottom: '24px',
    },
    homeTitle: {
        fontSize: '24px',
        fontWeight: 600,
        color: COLORS.textPrimary,
        margin: 0,
    },
    sessionList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        gap: '16px',
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: '14px',
        margin: 0,
    },
    newSessionBtn: {
        padding: '12px 24px',
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
    },
    sessionItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
    },
    sessionTitle: {
        color: COLORS.textPrimary,
        fontSize: '14px',
        fontWeight: 500,
    },
    sessionMeta: {
        color: COLORS.textMuted,
        fontSize: '12px',
    },

    inputCard: {
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    inputTopRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputTopLeft: {
        display: 'flex',
        gap: '2px',
    },
    topIconButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        backgroundColor: 'transparent',
        color: COLORS.textMuted,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    topIconButtonActive: {
        color: COLORS.accent,
    },
    slashCommandsButton: {
        padding: '4px 10px',
        fontSize: '12px',
        color: COLORS.textMuted,
        backgroundColor: 'transparent',
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
    },
    mainTextarea: {
        width: '100%',
        resize: 'none',
        border: 'none',
        backgroundColor: 'transparent',
        color: COLORS.textPrimary,
        padding: '4px 0',
        fontFamily: 'inherit',
        fontSize: '14px',
        outline: 'none',
        lineHeight: 1.5,
        minHeight: '44px',
    },
    inputBottomRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '4px',
    },
    inputBottomLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    inputBottomRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    contextPill: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        backgroundColor: COLORS.backgroundLight,
        borderRadius: '6px',
        fontSize: '11px',
        color: COLORS.textSecondary,
    },
    contextFileName: {
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },

    // ======== MODEL SELECTOR ========
    modelSelectorWrapper: {
        position: 'relative',
    },
    modelSelectorButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 10px',
        backgroundColor: COLORS.backgroundLight,
        color: COLORS.textSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    modelDropdown: {
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: '4px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        overflow: 'hidden',
        minWidth: '100px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 100,
    },
    modelOption: {
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '12px',
        color: COLORS.textSecondary,
        transition: 'all 0.15s',
    },
    modelOptionActive: {
        backgroundColor: COLORS.accentBg,
        color: COLORS.accent,
    },

    // ======== ULTRATHINK ========
    ultrathinkButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '34px',
        height: '34px',
        backgroundColor: COLORS.backgroundLight,
        color: COLORS.textMuted,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    ultrathinkButtonActive: {
        backgroundColor: COLORS.accentBg,
        color: COLORS.accent,
        borderColor: COLORS.accentBorder,
    },

    // ======== SEND/STOP BUTTONS ========
    sendButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    stopButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        backgroundColor: COLORS.errorBg,
        color: COLORS.error,
        border: `1px solid ${COLORS.error}`,
        borderRadius: '8px',
        cursor: 'pointer',
    },

    // ======== CONTEXT INDICATORS ========
    contextDot: {
        color: COLORS.accent,
        fontSize: '8px',
    },
    selectionTag: {
        padding: '2px 4px',
        backgroundColor: COLORS.accentBg,
        color: COLORS.accent,
        borderRadius: '3px',
        fontSize: '9px',
    },

    // ======== SLASH PICKER ========
    slashPicker: {
        position: 'absolute',
        bottom: '100%',
        left: '16px',
        right: '16px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '10px',
        marginBottom: '8px',
        maxHeight: '220px',
        overflow: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    },
    slashItem: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 14px',
        cursor: 'pointer',
        borderBottom: `1px solid ${COLORS.border}`,
        transition: 'background-color 0.15s',
    },
    slashName: {
        color: COLORS.accent,
        fontWeight: 500,
        fontSize: '13px',
    },
    slashDesc: {
        color: COLORS.textMuted,
        fontSize: '12px',
    },

    // ======== PLANNER VIEW ========
    plannerContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        overflow: 'auto',
    },
    plannerHeader: {
        marginBottom: '24px',
    },
    plannerTitle: {
        fontSize: '20px',
        fontWeight: 600,
        color: COLORS.textPrimary,
        margin: 0,
    },
    plannerSubtitle: {
        fontSize: '13px',
        color: COLORS.textMuted,
        marginTop: '8px',
    },
    stepsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: 1,
    },
    stepItem: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '16px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '10px',
    },
    stepLeft: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        flex: 1,
    },
    stepContent: {
        flex: 1,
    },
    stepAction: {
        fontSize: '14px',
        fontWeight: 600,
        color: COLORS.textPrimary,
        marginBottom: '4px',
    },
    stepDescription: {
        fontSize: '13px',
        color: COLORS.textSecondary,
        lineHeight: 1.5,
        cursor: 'pointer',
    },
    stepFiles: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginTop: '8px',
    },
    stepFile: {
        padding: '2px 8px',
        fontSize: '11px',
        backgroundColor: COLORS.backgroundLight,
        color: COLORS.textMuted,
        borderRadius: '4px',
        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
    },
    stepNumber: {
        color: COLORS.textMuted,
        fontSize: '12px',
        fontWeight: 500,
    },
    stepEditContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '8px',
    },
    stepEditTextarea: {
        width: '100%',
        padding: '8px',
        backgroundColor: COLORS.backgroundLight,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        color: COLORS.textPrimary,
        fontSize: '13px',
        resize: 'vertical',
        outline: 'none',
    },
    stepEditButtons: {
        display: 'flex',
        gap: '8px',
    },
    stepEditSave: {
        padding: '6px 12px',
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    stepEditCancel: {
        padding: '6px 12px',
        backgroundColor: 'transparent',
        color: COLORS.textMuted,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    plannerActions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: `1px solid ${COLORS.border}`,
    },
    cancelButton: {
        padding: '10px 20px',
        backgroundColor: 'transparent',
        color: COLORS.textSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    approveButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
    },

    // ======== DIFFLENS VIEW ========
    diffLensContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        overflow: 'auto',
    },
    diffLensHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
    },
    diffLensTitle: {
        fontSize: '20px',
        fontWeight: 600,
        color: COLORS.textPrimary,
        margin: 0,
    },
    diffStats: {
        display: 'flex',
        gap: '12px',
    },
    diffStatAdd: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        color: '#10b981',
        fontSize: '13px',
    },
    diffStatRemove: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        color: '#ef4444',
        fontSize: '13px',
    },
    changesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        flex: 1,
    },
    changeItem: {
        padding: '16px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '10px',
    },
    changeHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
    },
    changeFile: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: COLORS.textPrimary,
        fontSize: '14px',
        fontWeight: 500,
    },
    changeStats: {
        display: 'flex',
        gap: '8px',
    },
    changeAdd: {
        color: '#10b981',
        fontSize: '12px',
        fontWeight: 500,
    },
    changeRemove: {
        color: '#ef4444',
        fontSize: '12px',
        fontWeight: 500,
    },
    changeSummary: {
        fontSize: '13px',
        color: COLORS.textPrimary,
        marginBottom: '8px',
        lineHeight: 1.5,
    },
    changeReasoning: {
        fontSize: '12px',
        color: COLORS.textMuted,
        fontStyle: 'italic',
        marginBottom: '12px',
    },
    reasoningLabel: {
        color: COLORS.accent,
        fontWeight: 500,
        fontStyle: 'normal',
    },
    viewDetailsButton: {
        padding: '6px 12px',
        backgroundColor: 'transparent',
        color: COLORS.accent,
        border: `1px solid ${COLORS.accentBorder}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    diffLensActions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: `1px solid ${COLORS.border}`,
    },
    rejectButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        backgroundColor: COLORS.errorBg,
        color: COLORS.error,
        border: `1px solid ${COLORS.error}`,
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    acceptButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        backgroundColor: COLORS.accent,
        color: COLORS.textPrimary,
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
    },

    // ======== THOUGHT PROCESS ========
    thoughtContainer: {
        margin: '8px 0',
        borderRadius: '8px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden',
    },
    thoughtHeader: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: COLORS.textSecondary,
        fontSize: '13px',
        minHeight: '44px',
        lineHeight: 1.4,
    },
    thoughtHeaderLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
    },
    thoughtSpinner: {
        width: '16px',
        height: '16px',
        border: '2px solid transparent',
        borderTop: `2px solid ${COLORS.accent}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        flexShrink: 0,
    },
    thoughtLabel: {
        color: COLORS.textMuted,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
    },
    thoughtSteps: {
        borderTop: `1px solid ${COLORS.border}`,
        padding: '8px',
        maxHeight: '300px',
        overflowY: 'auto',
    },
    thoughtStep: {
        padding: '8px',
        marginBottom: '6px',
        backgroundColor: COLORS.backgroundLight,
        borderRadius: '6px',
    },
    thoughtStepHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
    },
    thoughtToolBadge: {
        padding: '2px 6px',
        fontSize: '10px',
        backgroundColor: COLORS.accentBg,
        color: COLORS.accent,
        borderRadius: '4px',
        fontWeight: 500,
        textTransform: 'uppercase',
    },
    thoughtStatus: {
        color: COLORS.textMuted,
    },
    thoughtCode: {
        fontSize: '11px',
        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
        color: COLORS.textMuted,
        backgroundColor: COLORS.background,
        padding: '6px 8px',
        borderRadius: '4px',
        margin: 0,
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
    },
    thoughtOutput: {
        fontSize: '11px',
        color: COLORS.textSecondary,
        marginTop: '4px',
        fontStyle: 'italic',
    },

    // ======== MODE SELECTOR ========
    modeSelector: {
        display: 'flex',
        gap: '4px',
        padding: '4px',
        backgroundColor: COLORS.backgroundLight,
        borderRadius: '8px',
    },
    modeButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: 'transparent',
        color: COLORS.textMuted,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.15s',
    },
    modeButtonActive: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: COLORS.surface,
        color: COLORS.accent,
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    },
    modeLabel: {
        fontSize: '11px',
    },

    // ======== SETTINGS PANEL ========
    settingsOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    settingsPanel: {
        width: '320px',
        backgroundColor: COLORS.surface,
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    },
    settingsHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
    },
    settingsTitle: {
        margin: 0,
        fontSize: '16px',
        color: COLORS.textPrimary,
        fontWeight: 600,
    },
    settingsClose: {
        padding: '4px',
        backgroundColor: 'transparent',
        color: COLORS.textMuted,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    settingsSection: {
        marginBottom: '20px',
    },
    settingsLabel: {
        display: 'block',
        fontSize: '13px',
        color: COLORS.textPrimary,
        marginBottom: '8px',
    },
    settingsValue: {
        color: COLORS.accent,
        fontWeight: 600,
    },
    settingsSlider: {
        width: '100%',
        height: '4px',
        appearance: 'none',
        backgroundColor: COLORS.border,
        borderRadius: '2px',
        outline: 'none',
        cursor: 'pointer',
    },
    settingsHint: {
        fontSize: '11px',
        color: COLORS.textMuted,
        marginTop: '8px',
        lineHeight: 1.4,
    },
    permissionGroup: {
        display: 'flex',
        gap: '6px',
    },
    permissionButton: {
        flex: 1,
        padding: '8px 10px',
        backgroundColor: COLORS.backgroundLight,
        color: COLORS.textSecondary,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
    },
    permissionActive: {
        flex: 1,
        padding: '8px 10px',
        backgroundColor: COLORS.accentBg,
        color: COLORS.accent,
        border: `1px solid ${COLORS.accentBorder}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 500,
    },

    // ======== REVIEW MODE ========
    reviewContainer: {
        padding: '16px',
        backgroundColor: 'var(--vscode-editor-background)',
        borderRadius: '8px',
        margin: '16px 0'
    },
    reviewHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    reviewTitle: {
        margin: 0,
        color: 'var(--vscode-foreground)'
    },
    reviewStatus: {
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: 'var(--vscode-badge-background)',
        color: 'var(--vscode-badge-foreground)',
        fontSize: '12px'
    },
    noChanges: {
        textAlign: 'center' as const,
        padding: '32px',
        color: 'var(--vscode-descriptionForeground)'
    },

    // ======== STREAMING VIEW ========
    streamingContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        overflow: 'auto',
    },
    streamingHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
    },
    streamingIcon: {
        fontSize: '24px',
    },
    streamingTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: COLORS.textPrimary,
        margin: 0,
    },
    streamingContent: {
        flex: 1,
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '10px',
        padding: '16px',
        overflow: 'auto',
        marginBottom: '16px',
    },
    streamingPre: {
        margin: 0,
        fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
        fontSize: '13px',
        lineHeight: 1.6,
        color: COLORS.textSecondary,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    streamingIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: COLORS.textMuted,
        fontSize: '12px',
    },
    pulsingDot: {
        width: '8px',
        height: '8px',
        backgroundColor: COLORS.accent,
        borderRadius: '50%',
        animation: 'pulse 1.5s ease-in-out infinite',
    },

    // ======== ATTACHMENT PREVIEW ========
    attachmentPreview: {
        display: 'flex',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
        overflowX: 'auto',
    },
    attachmentItem: {
        position: 'relative',
        flexShrink: 0,
    },
    attachmentThumb: {
        width: '48px',
        height: '48px',
        objectFit: 'cover',
        borderRadius: '6px',
        border: `1px solid ${COLORS.border}`,
    },
    attachmentRemove: {
        position: 'absolute',
        top: '-6px',
        right: '-6px',
        width: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.error,
        color: COLORS.textPrimary,
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        padding: 0,
    },

    // ======== DRAG OVERLAY ========
    dragOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        border: `2px dashed ${COLORS.accent}`,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    dragText: {
        fontSize: '16px',
        color: COLORS.accent,
        fontWeight: 500,
    },
};
