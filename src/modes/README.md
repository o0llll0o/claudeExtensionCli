# Mode Dispatcher System

A production-ready mode-based message handling system for the VS Code extension. Enables specialized conversation modes (chat, review, plan, brainstorm) with type-safe handlers and event-driven architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      ModeDispatcher                         │
│  - Registry pattern for handlers                            │
│  - Request routing and validation                           │
│  - Event emission and timeout management                    │
│  - Fallback to chat mode                                    │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐   ┌────────────┐   ┌────────────┐
   │ ChatMode   │   │ ReviewMode │   │  PlanMode  │
   │  Handler   │   │  Handler   │   │  Handler   │
   └────────────┘   └────────────┘   └────────────┘
          │                ▼                ▼
          │         ┌────────────┐   ┌────────────┐
          │         │  Claude    │   │ Subage nt  │
          │         │  Service   │   │Orchestrator│
          │         └────────────┘   └────────────┘
          ▼
   ┌────────────┐
   │Brainstorm  │
   │  Handler   │
   └────────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐  ┌────────┐
│ Claude │  │Subage nt│
│Service │  │ Orch.  │
└────────┘  └────────┘
```

## Quick Start

### 1. Installation

```typescript
import {
  ModeDispatcher,
  ChatModeHandler,
  ReviewModeHandler,
  PlanModeHandler,
  BrainstormModeHandler
} from './modes';
```

### 2. Initialize Dispatcher

```typescript
// Create dispatcher with optional configuration
const dispatcher = new ModeDispatcher({
  defaultMode: 'chat',
  strictValidation: true,
  timeout: 300000, // 5 minutes
  enableLogging: true
});

// Register handlers
dispatcher.registerHandler(new ChatModeHandler(claudeService));
dispatcher.registerHandler(new ReviewModeHandler(claudeService));
dispatcher.registerHandler(new PlanModeHandler(subagentOrchestrator));
dispatcher.registerHandler(
  new BrainstormModeHandler(subagentOrchestrator, claudeService)
);
```

### 3. Dispatch Requests

```typescript
// Option 1: Create request manually
const request = dispatcher.createRequest(
  'chat',
  'Explain async/await in JavaScript',
  {
    workspaceRoot: '/path/to/workspace',
    activeFile: 'index.js',
    conversationHistory: []
  },
  {
    swarmDensity: 3,
    permissionMode: 'ask',
    temperature: 0.7
  }
);

const response = await dispatcher.dispatch(request);

// Option 2: Dispatch directly
const response = await dispatcher.dispatch(
  'review',
  'Review this code for security issues',
  {
    selectedText: codeToReview,
    activeFile: 'auth.ts'
  },
  {
    swarmDensity: 1,
    permissionMode: 'auto'
  }
);
```

### 4. Handle Events

```typescript
dispatcher.addEventListener((event) => {
  switch (event.type) {
    case 'mode:started':
      console.log(`Mode ${event.mode} started for request ${event.requestId}`);
      break;

    case 'mode:progress':
      console.log(`Progress: ${event.message} (${event.progress}%)`);
      updateProgressBar(event.progress);
      break;

    case 'mode:completed':
      console.log('Mode completed:', event.response);
      displayResponse(event.response);
      break;

    case 'mode:error':
      console.error('Mode error:', event.error);
      showError(event.error.message);
      break;

    case 'mode:cancelled':
      console.log(`Request ${event.requestId} was cancelled`);
      break;
  }
});
```

## Mode Handlers

### Chat Mode

Direct conversational AI interaction with Claude.

```typescript
const response = await dispatcher.dispatch(
  'chat',
  'How do I implement a binary search tree?',
  { conversationHistory: [] },
  { permissionMode: 'ask' }
);

// Response type: ChatModeResponse
console.log(response.response); // Claude's text response
console.log(response.tokensUsed); // { input: 123, output: 456 }
```

**Use Cases:**
- General questions and answers
- Code explanations
- Documentation help
- Conversational debugging

### Review Mode

Structured code review with issue detection.

```typescript
const response = await dispatcher.dispatch(
  'review',
  'Check for security vulnerabilities',
  {
    selectedText: sourceCode,
    activeFile: 'payment.ts'
  },
  { permissionMode: 'auto' }
);

// Response type: ReviewModeResponse
console.log(response.summary); // Overall review
response.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.message}`);
  console.log(`  Suggestion: ${issue.suggestion}`);
});
```

**Use Cases:**
- Security audits
- Code quality checks
- Best practices validation
- Performance analysis

### Plan Mode

Task breakdown and project planning using the planner agent.

```typescript
const response = await dispatcher.dispatch(
  'plan',
  'Add user authentication to the application',
  {
    workspaceRoot: '/my/project',
    activeFile: 'app.ts'
  },
  { swarmDensity: 1, permissionMode: 'ask' }
);

// Response type: PlanModeResponse
console.log(response.planSummary);
response.steps.forEach(step => {
  console.log(`${step.id}: ${step.title}`);
  console.log(`  Complexity: ${step.estimatedComplexity}`);
  console.log(`  Dependencies: ${step.dependencies?.join(', ')}`);
});
```

**Use Cases:**
- Feature planning
- Refactoring strategies
- Migration planning
- Architecture decisions

### Brainstorm Mode

Multi-agent brainstorming with diverse perspectives.

```typescript
const response = await dispatcher.dispatch(
  'brainstorm',
  'Should we use microservices or monolith for this app?',
  { workspaceRoot: '/project' },
  {
    swarmDensity: 5, // Spawn 5 agents with different perspectives
    permissionMode: 'auto'
  }
);

// Response type: BrainstormModeResponse
console.log(response.synthesis); // Synthesized summary

response.agentResponses.forEach(agent => {
  console.log(`\n${agent.role}:`);
  agent.keyPoints.forEach(point => console.log(`  - ${point}`));
});

console.log('\nCommon themes:', response.commonThemes);
console.log('Divergent ideas:', response.divergentIdeas);
```

**Use Cases:**
- Design decisions
- Technology selection
- Problem-solving
- Creative ideation

## Integration with App.tsx

Replace the existing `handleSend` implementation:

```typescript
// In App.tsx

import { ModeDispatcher, /* ... handlers */ } from './modes';

// Initialize dispatcher in component mount/constructor
const dispatcher = new ModeDispatcher({
  defaultMode: 'chat',
  strictValidation: true,
  timeout: 300000
});

// Register handlers
dispatcher.registerHandler(new ChatModeHandler(claudeService));
dispatcher.registerHandler(new ReviewModeHandler(claudeService));
dispatcher.registerHandler(new PlanModeHandler(subagentOrchestrator));
dispatcher.registerHandler(
  new BrainstormModeHandler(subagentOrchestrator, claudeService)
);

// Listen for events
dispatcher.addEventListener((event) => {
  if (event.type === 'mode:progress') {
    setStreamingMessage(event.message);
  } else if (event.type === 'mode:completed') {
    handleModeResponse(event.response);
  } else if (event.type === 'mode:error') {
    setError(event.error.message);
  }
});

// Replace handleSend function
const handleSend = async () => {
  if (!inputValue.trim()) return;

  const message = inputValue.trim();
  setInputValue('');
  setIsLoading(true);

  try {
    // Dispatch based on currentMode
    const response = await dispatcher.dispatch(
      currentMode, // 'chat' | 'review' | 'plan' | 'brainstorm'
      message,
      {
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        activeFile: vscode.window.activeTextEditor?.document.fileName,
        selectedText: vscode.window.activeTextEditor?.document.getText(
          vscode.window.activeTextEditor.selection
        ),
        conversationHistory: messages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }))
      },
      {
        swarmDensity,
        permissionMode,
        temperature: 0.7
      }
    );

    // Handle response based on mode
    handleModeResponse(response);

  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};

// Handle different response types
const handleModeResponse = (response: ModeResponse) => {
  if (!response.success) {
    setError(response.error || 'Unknown error');
    return;
  }

  switch (response.mode) {
    case 'chat':
      addMessage('assistant', response.response);
      break;

    case 'review':
      displayReviewResults(response);
      break;

    case 'plan':
      displayPlan(response);
      break;

    case 'brainstorm':
      displayBrainstormResults(response);
      break;
  }
};
```

## Advanced Features

### Custom System Prompts

```typescript
const response = await dispatcher.dispatch(
  'review',
  'Review this React component',
  { selectedText: componentCode },
  {
    swarmDensity: 1,
    permissionMode: 'auto',
    systemPrompts: {
      review: 'Focus on React best practices and hooks usage'
    }
  }
);
```

### Request Cancellation

```typescript
const request = dispatcher.createRequest(/* ... */);
const promise = dispatcher.dispatch(request);

// Cancel after 10 seconds
setTimeout(() => {
  dispatcher.cancel(request.requestId);
}, 10000);
```

### Monitoring Statistics

```typescript
const stats = dispatcher.getStats();
console.log('Registered modes:', stats.registeredModes);
console.log('Active requests:', stats.activeRequests);
console.log('Pending timeouts:', stats.pendingTimeouts);
```

### Custom Handler Creation

```typescript
class CustomModeHandler extends BaseModeHandler {
  readonly mode: AppMode = 'custom' as AppMode; // Extend AppMode type

  protected async executeHandler(request: ModeRequest): Promise<ModeResponse> {
    // Your custom logic
    return {
      success: true,
      mode: this.mode,
      requestId: request.requestId,
      processingTime: 0,
      // ... custom response fields
    };
  }

  protected customValidate(request: ModeRequest) {
    // Your validation logic
    return { valid: true };
  }
}

dispatcher.registerHandler(new CustomModeHandler());
```

## Type Safety

All responses are fully typed:

```typescript
const response = await dispatcher.dispatch('review', '...', {}, {});

if (response.mode === 'review' && response.success) {
  // TypeScript knows this is ReviewModeResponse
  response.issues.forEach(issue => {
    console.log(issue.severity); // 'error' | 'warning' | 'info'
  });
}

if (response.mode === 'brainstorm' && response.success) {
  // TypeScript knows this is BrainstormModeResponse
  response.agentResponses.forEach(agent => {
    console.log(agent.role);
  });
}
```

## Error Handling

The system provides comprehensive error handling:

1. **Validation Errors**: Caught before handler execution
2. **Handler Errors**: Wrapped in error responses
3. **Timeout Errors**: Automatic timeout management
4. **Fallback Mode**: Automatic fallback to chat mode

```typescript
const response = await dispatcher.dispatch(/* ... */);

if (!response.success) {
  console.error('Error:', response.error);
  console.log('Processing time:', response.processingTime);
  // Still have access to requestId and mode
}
```

## Performance Considerations

1. **Parallel Agent Execution**: Brainstorm mode runs agents in parallel
2. **Timeout Management**: Prevents hanging requests
3. **Event-Driven**: Non-blocking progress updates
4. **Resource Cleanup**: Automatic cleanup on cancellation

## Testing

Example test structure:

```typescript
describe('ModeDispatcher', () => {
  let dispatcher: ModeDispatcher;
  let mockClaudeService: ClaudeService;

  beforeEach(() => {
    mockClaudeService = {
      sendMessage: jest.fn().mockResolvedValue({
        response: 'Test response',
        tokensUsed: { input: 10, output: 20 }
      })
    };

    dispatcher = new ModeDispatcher();
    dispatcher.registerHandler(new ChatModeHandler(mockClaudeService));
  });

  it('should dispatch to chat mode', async () => {
    const response = await dispatcher.dispatch(
      'chat',
      'test message',
      {},
      { swarmDensity: 1, permissionMode: 'ask' }
    );

    expect(response.success).toBe(true);
    expect(response.mode).toBe('chat');
  });
});
```

## License

Part of the VS Code Claude Extension project.
