import * as vscode from 'vscode';
import { ClaudeService, ClaudeMessage, SendOptions } from '../engine/ClaudeService';
import { DiffManager } from '../diff/DiffManager';
import { SessionManager } from '../indexing/SessionManager';
import { SubagentOrchestrator } from '../orchestration/SubagentOrchestrator';
import * as path from 'path';

interface FileContext {
    fileName: string;
    relativePath: string;
    language: string;
    content: string;
    selection?: string;
    lineCount: number;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private disposables: vscode.Disposable[] = [];
    private diffManager: DiffManager;
    private sessionManager: SessionManager;
    private workspaceFolder: string;
    private cliInitialized: boolean = false;
    private orchestrator: SubagentOrchestrator;
    
    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly claudeService: ClaudeService,
        workspaceFolder?: string
    ) {
        this.workspaceFolder = workspaceFolder || '';
        this.diffManager = new DiffManager();
        this.sessionManager = new SessionManager(this.workspaceFolder);
        this.claudeService.on('message', (msg: ClaudeMessage) => {
            this.postMessage({ type: 'claude', payload: msg });
        });
    }

    private simulateCliInit() {
        if (this.cliInitialized) {
            this.postMessage({ type: 'initProgress', payload: 100 });
            return;
        }
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 20) + 10;
            if (progress >= 100) {
                progress = 100;
                this.cliInitialized = true;
                clearInterval(interval);
            }
            this.postMessage({ type: 'initProgress', payload: progress });
        }, 200);
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        // Initialize orchestration components (no GitWorktree dependency)
        this.orchestrator = new SubagentOrchestrator(this.workspaceFolder);

        // Listen for streaming chunks from orchestrator and forward to UI
        this.orchestrator.on('chunk', (data: { taskId: string; role: string; content: string }) => {
            this.postMessage({
                type: 'agent_stream',
                taskId: data.taskId,
                role: data.role,
                content: data.content
            });
        });

        // Listen for step updates during plan execution
        this.orchestrator.on('step', (data: { taskId: string; step: any }) => {
            this.postMessage({
                type: 'step_update',
                taskId: data.taskId,
                stepId: data.step.id,
                status: data.step.status
            });
        });

        webviewView.webview.onDidReceiveMessage((message) => {
            this.handleMessage(message);
        });

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                this.sendActiveFileContext();
            })
        );

        this.disposables.push(
            vscode.window.onDidChangeTextEditorSelection((e) => {
                if (e.textEditor === vscode.window.activeTextEditor) {
                    this.sendActiveFileContext();
                }
            })
        );

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.sendActiveFileContext();
                this.simulateCliInit();
            }
        });

        this.sendActiveFileContext();
        this.simulateCliInit();
    }

    private handleMessage(message: any) {
        switch (message.type) {
            case 'send':
                this.handleSend(message.text, message.includeContext, {
                    model: message.model,
                    ultrathink: message.ultrathink,
                    mode: message.mode || 'chat',
                    swarmDensity: message.swarmDensity || 3,
                    permissionMode: message.permissionMode || 'auto'
                });
                break;
            case 'stop':
                this.claudeService.stop();
                break;
            case 'getContext':
                this.sendActiveFileContext();
                break;
            case 'copy':
                this.handleCopy(message.code);
                break;
            case 'apply':
                this.handleApply(message.code, message.language, message.filePath);
                break;
            case 'insert':
                this.handleInsert(message.code);
                break;
            case 'saveSession':
                this.sessionManager.save(message.id, message.messages);
                break;
            case 'loadSession':
                this.handleLoadSession(message.id);
                break;
            case 'getSessions':
                this.handleGetSessions();
                break;
            case 'newSession':
                this.claudeService.createSession();
                break;
            case 'showInfo':
                vscode.window.showInformationMessage(message.message);
                break;
            case 'webviewReady':
                this.simulateCliInit();
                this.claudeService.initialize();
                break;
            // Plan mode handlers
            case 'plan_approve':
                this.handlePlanApprove(message.planId);
                break;
            case 'plan_cancel':
                this.handlePlanCancel(message.planId);
                break;
            case 'plan_edit_step':
                this.handlePlanEditStep(message.stepId, message.description);
                break;
            // Review mode handlers
            case 'review_accept':
                this.handleReviewAccept(message.changeIds);
                break;
            case 'review_details':
                this.handleReviewDetails(message.changeId);
                break;
            // Swarm mode handler
            case 'swarm_stop':
                this.handleSwarmStop();
                break;
        }
    }

    private async handleLoadSession(sessionId: string) {
        const messages = await this.sessionManager.load(sessionId);
        this.postMessage({ type: 'sessionLoaded', payload: { messages } });
    }

    private async handleGetSessions() {
        const sessions = await this.sessionManager.list();
        this.postMessage({ type: 'sessions', payload: sessions });
    }

    private async handleCopy(code: string) {
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage('Copied to clipboard');
    }

    private async handleApply(code: string, language: string, filePath?: string) {
        const editor = vscode.window.activeTextEditor;
        
        if (filePath) {
            await this.diffManager.applyChange(filePath, code);
        } else if (editor) {
            const options = ['Replace Selection', 'Insert at Cursor', 'Save as New File'];
            const choice = await vscode.window.showQuickPick(options, {
                placeHolder: 'How would you like to apply this code?'
            });

            switch (choice) {
                case 'Replace Selection':
                    await this.diffManager.replaceSelection(code);
                    break;
                case 'Insert at Cursor':
                    await this.diffManager.insertAtCursor(code);
                    break;
                case 'Save as New File':
                    await this.promptAndSaveNewFile(code, language);
                    break;
            }
        } else {
            await this.promptAndSaveNewFile(code, language);
        }
    }

    private async handleInsert(code: string) {
        await this.diffManager.insertAtCursor(code);
    }

    private async promptAndSaveNewFile(code: string, language: string) {
        const ext = this.getExtensionForLanguage(language);
        const defaultName = `new-file${ext}`;
        
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name',
            value: defaultName
        });

        if (fileName) {
            await this.diffManager.applyChange(fileName, code);
        }
    }

    private getExtensionForLanguage(language: string): string {
        const map: Record<string, string> = {
            'javascript': '.js',
            'typescript': '.ts',
            'python': '.py',
            'java': '.java',
            'csharp': '.cs',
            'cpp': '.cpp',
            'c': '.c',
            'go': '.go',
            'rust': '.rs',
            'ruby': '.rb',
            'php': '.php',
            'html': '.html',
            'css': '.css',
            'json': '.json',
            'yaml': '.yaml',
            'xml': '.xml',
            'markdown': '.md',
            'sql': '.sql',
            'shell': '.sh',
            'bash': '.sh',
            'powershell': '.ps1'
        };
        return map[language.toLowerCase()] || '.txt';
    }

    private async handleSend(
        text: string,
        includeContext: boolean,
        options: {
            model: string;
            ultrathink: boolean;
            mode: 'chat' | 'review' | 'plan' | 'brainstorm';
            swarmDensity: number;
            permissionMode: 'manual' | 'auto' | 'skip';
        }
    ) {
        const context = includeContext ? await this.buildContext() : '';

        switch (options.mode) {
            case 'chat':
                await this.handleChatMode(text, context, options);
                break;
            case 'review':
                await this.handleReviewMode(text, context, options);
                break;
            case 'plan':
                await this.handlePlanMode(text, context, options);
                break;
            case 'brainstorm':
                await this.handleSwarmMode(text, context, options);
                break;
            default:
                await this.handleChatMode(text, context, options);
        }
    }

    private async buildContext(): Promise<string> {
        const fileContext = this.getActiveFileContext();
        if (!fileContext) {
            return '';
        }
        return this.buildContextualPrompt('', fileContext);
    }

    private async handleChatMode(text: string, context: string, options: any) {
        // Current behavior - direct to ClaudeService
        const fullPrompt = context ? `${context}\n\n${text}` : text;
        await this.claudeService.sendMessage(fullPrompt, {
            model: options.model,
            ultrathink: options.ultrathink
        });
    }

    private async handleReviewMode(text: string, context: string, options: any) {
        const reviewPrompt = `You are performing a code review. Analyze the following code and provide:
1. Summary of what the code does
2. Potential bugs or issues
3. Security concerns
4. Performance suggestions
5. Code style improvements

${context ? `Code context:\n${context}\n\n` : ''}User request: ${text}`;

        await this.claudeService.sendMessage(reviewPrompt, {
            model: options.model,
            ultrathink: options.ultrathink
        });
    }

    private async handlePlanMode(text: string, context: string, options: any) {
        // Use SubagentOrchestrator's planner role
        const taskId = `plan-${Date.now()}`;

        try {
            const response = await this.orchestrator.runAgent({
                taskId,
                role: 'planner',
                prompt: text,
                context
            });

            if (response.plan) {
                this.currentPlan = response.plan;  // Store plan for later execution
                this.postMessage({
                    type: 'plan_ready',
                    plan: response.plan,
                    steps: response.plan.steps
                });
            }
        } catch (error) {
            this.postMessage({
                type: 'claude',
                payload: { type: 'error', content: `Plan generation failed: ${error}` }
            });
        }
    }

    private async handleSwarmMode(text: string, context: string, options: any) {
        const agentCount = options.swarmDensity;
        const taskId = `swarm-${Date.now()}`;

        // Initialize swarm in UI
        this.postMessage({
            type: 'swarm_init',
            taskId,
            agentCount,
            topology: 'mesh'
        });

        // Spawn multiple agents
        const agentPromises = [];
        for (let i = 0; i < agentCount; i++) {
            const agentId = `agent-${i}`;
            this.postMessage({
                type: 'agent_update',
                agentId,
                status: 'working',
                progress: 0
            });

            agentPromises.push(
                this.orchestrator.runAgent({
                    taskId: `${taskId}-${agentId}`,
                    role: 'coder',
                    prompt: `As agent ${i+1} of ${agentCount}, analyze: ${text}`,
                    context
                }).then(response => {
                    this.postMessage({
                        type: 'agent_update',
                        agentId,
                        status: 'completed',
                        progress: 100,
                        output: response.content
                    });
                    return response;
                })
            );
        }

        // Wait for all agents
        const results = await Promise.all(agentPromises);

        // Aggregate results
        const aggregated = results.map(r => r.content).join('\n\n---\n\n');
        this.postMessage({
            type: 'claude',
            payload: { type: 'done', content: `## Swarm Results (${agentCount} agents)\n\n${aggregated}` }
        });
    }

    // Plan mode handlers
    private currentPlan: any = null;

    private async handlePlanApprove(planId: string) {
        if (!this.currentPlan || this.currentPlan.taskId !== planId) {
            this.postMessage({ type: 'claude', payload: { type: 'error', content: 'No plan to approve' } });
            return;
        }

        try {
            // Listen for step updates
            this.orchestrator.on('step', (data: any) => {
                this.postMessage({
                    type: 'step_update',
                    stepId: data.step.id,
                    status: data.step.status,
                    stepIndex: data.step.id - 1
                });
            });

            // Execute the plan in main workspace (no GitWorktree)
            const results = await this.orchestrator.executePlan(this.currentPlan, this.workspaceFolder);

            this.postMessage({ type: 'plan_execution_complete' });

            // Aggregate results
            const summary = results.map((r, i) => `Step ${i+1}: ${r.success ? 'Success' : 'Failed'}`).join('\n');
            this.postMessage({
                type: 'claude',
                payload: { type: 'done', content: `## Plan Execution Complete\n\n${summary}` }
            });
        } catch (error) {
            this.postMessage({
                type: 'claude',
                payload: { type: 'error', content: `Plan execution failed: ${error}` }
            });
        }
    }

    private handlePlanCancel(planId: string) {
        this.currentPlan = null;
        this.orchestrator.stopTask(planId);
        this.postMessage({
            type: 'claude',
            payload: { type: 'done', content: 'Plan cancelled.' }
        });
    }

    private handlePlanEditStep(stepId: number, description: string) {
        if (this.currentPlan) {
            const step = this.currentPlan.steps.find((s: any) => s.id === stepId);
            if (step) {
                step.description = description;
            }
        }
    }

    // Review mode handlers
    private async handleReviewAccept(changeIds: string[]) {
        // Apply the accepted changes
        this.postMessage({
            type: 'claude',
            payload: { type: 'done', content: `Applied ${changeIds.length} changes.` }
        });
    }

    private async handleReviewDetails(changeId: string) {
        // Show details for a specific change
        this.postMessage({
            type: 'claude',
            payload: { type: 'done', content: `Details for change ${changeId}` }
        });
    }

    // Swarm mode handler
    private handleSwarmStop() {
        this.orchestrator.stopAll();
        this.postMessage({
            type: 'claude',
            payload: { type: 'done', content: 'Swarm stopped.' }
        });
    }

    private buildContextualPrompt(userMessage: string, context: FileContext): string {
        const parts: string[] = [];

        parts.push(`I'm working on a file: ${context.relativePath}`);
        parts.push(`Language: ${context.language}`);
        parts.push(`Total lines: ${context.lineCount}`);
        parts.push('');

        if (context.selection && context.selection.trim()) {
            parts.push('Selected code:');
            parts.push('```' + context.language);
            parts.push(context.selection);
            parts.push('```');
            parts.push('');
        }

        if (context.content.length < 10000) {
            parts.push('Full file content:');
            parts.push('```' + context.language);
            parts.push(context.content);
            parts.push('```');
            parts.push('');
        } else {
            parts.push('(File is large, showing first 200 lines)');
            const lines = context.content.split('\n').slice(0, 200);
            parts.push('```' + context.language);
            parts.push(lines.join('\n'));
            parts.push('```');
            parts.push('');
        }

        parts.push('User request:');
        parts.push(userMessage);

        return parts.join('\n');
    }

    private getActiveFileContext(): FileContext | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const doc = editor.document;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const relativePath = workspaceFolder 
            ? path.relative(workspaceFolder, doc.fileName)
            : path.basename(doc.fileName);

        const selection = editor.selection;
        const selectedText = !selection.isEmpty 
            ? doc.getText(selection)
            : undefined;

        return {
            fileName: doc.fileName,
            relativePath,
            language: doc.languageId,
            content: doc.getText(),
            selection: selectedText,
            lineCount: doc.lineCount
        };
    }

    private sendActiveFileContext() {
        const context = this.getActiveFileContext();
        
        this.postMessage({
            type: 'context',
            payload: context ? {
                fileName: context.fileName,
                relativePath: context.relativePath,
                language: context.language,
                hasSelection: !!context.selection,
                lineCount: context.lineCount
            } : null
        });
    }

    private postMessage(message: any) {
        this.view?.webview.postMessage(message);
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
        );

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
    <title>Claude Assistant</title>
    <style>
        /* Verdent Dark Theme - Global Styles */
        :root {
            --verdent-bg: #121212;
            --verdent-bg-light: #1a1a1a;
            --verdent-surface: #1e1e1e;
            --verdent-border: #2d2d2d;
            --verdent-text: #ffffff;
            --verdent-text-muted: #666666;
            --verdent-accent: #10b981;
            --verdent-accent-light: #34d399;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        html, body, #root {
            height: 100%;
            overflow: hidden;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            color: var(--verdent-text);
            background: var(--verdent-bg);
        }
        @keyframes pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
        }
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        /* Verdent-themed syntax highlighting */
        pre code.hljs {
            display: block;
            overflow-x: auto;
            padding: 0;
            background: transparent;
        }
        .hljs-keyword, .hljs-selector-tag, .hljs-title, .hljs-section, .hljs-doctag, .hljs-name, .hljs-strong {
            color: #c792ea;
        }
        .hljs-string, .hljs-title.class_, .hljs-class .hljs-title {
            color: #c3e88d;
        }
        .hljs-comment, .hljs-quote {
            color: #546e7a;
            font-style: italic;
        }
        .hljs-number, .hljs-literal {
            color: #f78c6c;
        }
        .hljs-function, .hljs-params {
            color: #82aaff;
        }
        .hljs-variable, .hljs-attr {
            color: var(--verdent-accent-light);
        }
        .hljs-built_in {
            color: #ffcb6b;
        }
        .hljs-type {
            color: var(--verdent-accent);
        }
        /* Verdent scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        /* Button hover states */
        button:hover {
            filter: brightness(1.1);
        }
        button:active {
            transform: scale(0.98);
        }
        /* Focus states with Verdent accent */
        textarea:focus, input:focus, button:focus {
            outline: none;
        }
        /* Selection color */
        ::selection {
            background: rgba(16, 185, 129, 0.3);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return text;
    }
}
