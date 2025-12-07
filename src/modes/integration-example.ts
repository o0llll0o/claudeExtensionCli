/**
 * Integration Example
 *
 * Complete example showing how to integrate the ModeDispatcher system
 * into the VS Code extension's App.tsx component.
 */

import {
  ModeDispatcher,
  ChatModeHandler,
  ReviewModeHandler,
  PlanModeHandler,
  BrainstormModeHandler,
  ModeResponse,
  ModeEvent,
  AppMode,
  ModeSettings
} from './index';

// Mock service interfaces (replace with actual implementations)
interface ClaudeService {
  sendMessage(
    message: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<{ response: string; tokensUsed?: { input: number; output: number } }>;
}

interface SubagentOrchestrator {
  runAgent(
    agentType: 'planner' | 'coder' | 'verifier',
    task: string,
    context?: Record<string, unknown>
  ): Promise<{ result: string; metadata?: Record<string, unknown> }>;
}

/**
 * Example integration class showing how to use ModeDispatcher in a React component
 */
export class ModeDispatcherIntegration {
  private dispatcher: ModeDispatcher;
  private currentRequestId?: string;

  constructor(
    private claudeService: ClaudeService,
    private subagentOrchestrator: SubagentOrchestrator,
    private onProgress: (message: string, progress?: number) => void,
    private onComplete: (response: ModeResponse) => void,
    private onError: (error: string) => void
  ) {
    // Initialize dispatcher with configuration
    this.dispatcher = new ModeDispatcher({
      defaultMode: 'chat',
      strictValidation: true,
      timeout: 300000, // 5 minutes
      enableLogging: process.env.NODE_ENV === 'development'
    });

    // Register all handlers
    this.registerHandlers();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Register all mode handlers
   */
  private registerHandlers(): void {
    // Chat mode - direct Claude interaction
    this.dispatcher.registerHandler(
      new ChatModeHandler(this.claudeService)
    );

    // Review mode - code review with structured analysis
    this.dispatcher.registerHandler(
      new ReviewModeHandler(this.claudeService)
    );

    // Plan mode - task breakdown using planner agent
    this.dispatcher.registerHandler(
      new PlanModeHandler(this.subagentOrchestrator)
    );

    // Brainstorm mode - multi-agent perspectives
    this.dispatcher.registerHandler(
      new BrainstormModeHandler(
        this.subagentOrchestrator,
        this.claudeService
      )
    );
  }

  /**
   * Set up event listeners for dispatcher events
   */
  private setupEventListeners(): void {
    this.dispatcher.addEventListener((event: ModeEvent) => {
      switch (event.type) {
        case 'mode:started':
          this.handleModeStarted(event);
          break;

        case 'mode:progress':
          this.handleModeProgress(event);
          break;

        case 'mode:completed':
          this.handleModeCompleted(event);
          break;

        case 'mode:error':
          this.handleModeError(event);
          break;

        case 'mode:cancelled':
          this.handleModeCancelled(event);
          break;
      }
    });
  }

  /**
   * Main method to send a message in a specific mode
   */
  public async sendMessage(
    mode: AppMode,
    message: string,
    context: {
      workspaceRoot?: string;
      activeFile?: string;
      selectedText?: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
    settings: ModeSettings
  ): Promise<ModeResponse> {
    try {
      // Create request
      const request = this.dispatcher.createRequest(
        mode,
        message,
        context,
        settings
      );

      // Store request ID for potential cancellation
      this.currentRequestId = request.requestId;

      // Dispatch request
      const response = await this.dispatcher.dispatch(request);

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.onError(errorMessage);

      throw error;
    } finally {
      this.currentRequestId = undefined;
    }
  }

  /**
   * Cancel the current request
   */
  public async cancel(): Promise<void> {
    if (this.currentRequestId) {
      await this.dispatcher.cancel(this.currentRequestId);
      this.currentRequestId = undefined;
    }
  }

  /**
   * Check if currently processing a request
   */
  public isProcessing(): boolean {
    return this.currentRequestId !== undefined;
  }

  /**
   * Get dispatcher statistics
   */
  public getStats() {
    return this.dispatcher.getStats();
  }

  /**
   * Handle mode started event
   */
  private handleModeStarted(event: Extract<ModeEvent, { type: 'mode:started' }>): void {
    console.log(`Mode '${event.mode}' started for request ${event.requestId}`);
    this.onProgress(`Starting ${event.mode} mode...`, 0);
  }

  /**
   * Handle mode progress event
   */
  private handleModeProgress(event: Extract<ModeEvent, { type: 'mode:progress' }>): void {
    this.onProgress(event.message, event.progress);
  }

  /**
   * Handle mode completed event
   */
  private handleModeCompleted(event: Extract<ModeEvent, { type: 'mode:completed' }>): void {
    console.log(`Mode '${event.mode}' completed in ${event.response.processingTime}ms`);
    this.onComplete(event.response);
  }

  /**
   * Handle mode error event
   */
  private handleModeError(event: Extract<ModeEvent, { type: 'mode:error' }>): void {
    console.error(`Mode '${event.mode}' error:`, event.error);
    this.onError(event.error.message);
  }

  /**
   * Handle mode cancelled event
   */
  private handleModeCancelled(event: Extract<ModeEvent, { type: 'mode:cancelled' }>): void {
    console.log(`Mode '${event.mode}' cancelled for request ${event.requestId}`);
    this.onProgress('Operation cancelled', 0);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.dispatcher.dispose();
  }
}

/**
 * Example usage in a React component
 */
export class AppComponent {
  private modeIntegration: ModeDispatcherIntegration;

  constructor(
    private currentMode: AppMode,
    private swarmDensity: number,
    private permissionMode: 'ask' | 'auto'
  ) {
    // Initialize with your actual service implementations
    const claudeService: ClaudeService = {
      sendMessage: async (message, history, systemPrompt) => {
        // Your Claude API implementation
        return { response: 'Response from Claude', tokensUsed: { input: 10, output: 20 } };
      }
    };

    const subagentOrchestrator: SubagentOrchestrator = {
      runAgent: async (agentType, task, context) => {
        // Your orchestrator implementation
        return { result: 'Agent result' };
      }
    };

    this.modeIntegration = new ModeDispatcherIntegration(
      claudeService,
      subagentOrchestrator,
      this.handleProgress.bind(this),
      this.handleComplete.bind(this),
      this.handleError.bind(this)
    );
  }

  /**
   * Replace your existing handleSend function with this
   */
  public async handleSend(message: string): Promise<void> {
    if (!message.trim()) return;

    try {
      // Get VS Code context
      const context = {
        workspaceRoot: this.getWorkspaceRoot(),
        activeFile: this.getActiveFile(),
        selectedText: this.getSelectedText(),
        conversationHistory: this.getConversationHistory()
      };

      // Build settings from UI state
      const settings: ModeSettings = {
        swarmDensity: this.swarmDensity,
        permissionMode: this.permissionMode,
        temperature: 0.7
      };

      // Send message using current mode
      const response = await this.modeIntegration.sendMessage(
        this.currentMode,
        message,
        context,
        settings
      );

      // Response is already handled by event listeners
      // But you can do additional processing here if needed

    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * Cancel current operation
   */
  public async handleCancel(): Promise<void> {
    await this.modeIntegration.cancel();
  }

  /**
   * Handle progress updates
   */
  private handleProgress(message: string, progress?: number): void {
    // Update your UI with progress
    console.log(`Progress: ${message} (${progress ?? '?'}%)`);
    // this.setState({ streamingMessage: message, progress });
  }

  /**
   * Handle completed responses
   */
  private handleComplete(response: ModeResponse): void {
    if (!response.success) {
      this.handleError(response.error || 'Unknown error');
      return;
    }

    // Handle different response types
    switch (response.mode) {
      case 'chat':
        this.handleChatResponse(response);
        break;

      case 'review':
        this.handleReviewResponse(response);
        break;

      case 'plan':
        this.handlePlanResponse(response);
        break;

      case 'brainstorm':
        this.handleBrainstormResponse(response);
        break;
    }
  }

  /**
   * Handle chat mode response
   */
  private handleChatResponse(response: Extract<ModeResponse, { mode: 'chat' }>): void {
    // Add message to conversation
    console.log('Chat response:', response.response);
    console.log('Tokens used:', response.tokensUsed);

    // Update UI
    // this.addMessage('assistant', response.response);
  }

  /**
   * Handle review mode response
   */
  private handleReviewResponse(response: Extract<ModeResponse, { mode: 'review' }>): void {
    console.log('Review summary:', response.summary);

    // Display issues
    response.issues.forEach(issue => {
      console.log(`[${issue.severity}] ${issue.message}`);
      if (issue.suggestion) {
        console.log(`  Suggestion: ${issue.suggestion}`);
      }
    });

    // Display in UI as formatted review
    // this.displayReviewPanel(response);
  }

  /**
   * Handle plan mode response
   */
  private handlePlanResponse(response: Extract<ModeResponse, { mode: 'plan' }>): void {
    console.log('Plan summary:', response.planSummary);

    // Display steps
    response.steps.forEach(step => {
      console.log(`${step.id}: ${step.title} [${step.estimatedComplexity}]`);
      console.log(`  ${step.description}`);
    });

    // Display in UI as interactive plan
    // this.displayPlanPanel(response);
  }

  /**
   * Handle brainstorm mode response
   */
  private handleBrainstormResponse(response: Extract<ModeResponse, { mode: 'brainstorm' }>): void {
    console.log('Brainstorm synthesis:', response.synthesis);

    // Display agent perspectives
    response.agentResponses.forEach(agent => {
      console.log(`\n${agent.role}:`);
      agent.keyPoints.forEach(point => console.log(`  - ${point}`));
    });

    // Display themes
    if (response.commonThemes) {
      console.log('\nCommon themes:', response.commonThemes);
    }

    // Display in UI as multi-perspective view
    // this.displayBrainstormPanel(response);
  }

  /**
   * Handle errors
   */
  private handleError(error: string): void {
    console.error('Error:', error);
    // this.setState({ error });
  }

  // Helper methods (implement based on your VS Code extension API)
  private getWorkspaceRoot(): string | undefined {
    return undefined; // vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private getActiveFile(): string | undefined {
    return undefined; // vscode.window.activeTextEditor?.document.fileName;
  }

  private getSelectedText(): string | undefined {
    return undefined; // vscode.window.activeTextEditor?.document.getText(selection);
  }

  private getConversationHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return []; // Map from your messages state
  }

  /**
   * Clean up on component unmount
   */
  public dispose(): void {
    this.modeIntegration.dispose();
  }
}
