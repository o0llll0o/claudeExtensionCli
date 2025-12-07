# Mode Dispatcher Quick Reference

## At a Glance

| Mode | Purpose | Input | Output | Agents Used |
|------|---------|-------|--------|-------------|
| **Chat** | Conversational AI | User message | Text response | 0 (direct Claude) |
| **Review** | Code analysis | Code + context | Structured issues | 0 (direct Claude) |
| **Plan** | Task breakdown | Task description | Ordered steps | 1 (planner) |
| **Brainstorm** | Multi-perspective | Problem statement | Agent perspectives + synthesis | 2-8 (based on swarmDensity) |

## Quick Integration

### 1. Initialize (in App.tsx constructor/mount)

```typescript
import { ModeDispatcher, ChatModeHandler, ReviewModeHandler,
         PlanModeHandler, BrainstormModeHandler } from './modes';

const dispatcher = new ModeDispatcher();
dispatcher.registerHandler(new ChatModeHandler(claudeService));
dispatcher.registerHandler(new ReviewModeHandler(claudeService));
dispatcher.registerHandler(new PlanModeHandler(subagentOrchestrator));
dispatcher.registerHandler(new BrainstormModeHandler(subagentOrchestrator, claudeService));
```

### 2. Replace handleSend()

```typescript
const handleSend = async () => {
  const response = await dispatcher.dispatch(
    currentMode,              // 'chat' | 'review' | 'plan' | 'brainstorm'
    inputValue,               // User's message
    {                         // Context
      workspaceRoot: workspace?.fsPath,
      activeFile: editor?.document.fileName,
      selectedText: editor?.document.getText(selection),
      conversationHistory: messages
    },
    {                         // Settings
      swarmDensity,           // 1-10
      permissionMode,         // 'ask' | 'auto'
      temperature: 0.7
    }
  );

  if (response.success) {
    handleResponse(response);
  }
};
```

### 3. Listen for Events

```typescript
dispatcher.addEventListener((event) => {
  switch (event.type) {
    case 'mode:progress':
      setStreamingMessage(event.message);
      setProgress(event.progress);
      break;

    case 'mode:completed':
      addMessage(formatResponse(event.response));
      break;

    case 'mode:error':
      showError(event.error.message);
      break;
  }
});
```

## Response Types

### Chat Response

```typescript
{
  mode: 'chat',
  success: true,
  response: "Your answer here...",
  tokensUsed: { input: 123, output: 456 }
}
```

### Review Response

```typescript
{
  mode: 'review',
  success: true,
  summary: "Code quality is good but has 3 issues",
  issues: [
    {
      severity: 'error',
      message: 'SQL injection vulnerability',
      file: 'auth.ts',
      line: 42,
      suggestion: 'Use parameterized queries'
    }
  ],
  strengths: ['Good error handling', 'Well documented'],
  recommendations: ['Add input validation', 'Use TypeScript strict mode']
}
```

### Plan Response

```typescript
{
  mode: 'plan',
  success: true,
  planSummary: "5-step authentication implementation plan",
  steps: [
    {
      id: 'step-1',
      title: 'Design database schema',
      description: 'Create users table with bcrypt hashing',
      dependencies: [],
      estimatedComplexity: 'medium'
    },
    // ...
  ],
  risks: [
    {
      description: 'Password reset flow complexity',
      mitigation: 'Use proven library like nodemailer'
    }
  ],
  successCriteria: ['Tests pass', 'Security audit completed']
}
```

### Brainstorm Response

```typescript
{
  mode: 'brainstorm',
  success: true,
  synthesis: "Multiple experts suggest microservices with caveats...",
  agentResponses: [
    {
      agentId: 'agent-1',
      role: 'Critical Analyst',
      perspective: 'Microservices add complexity...',
      keyPoints: [
        'Consider team size',
        'Deployment overhead',
        'Network latency'
      ]
    },
    // ... more agents
  ],
  commonThemes: ['Start simple', 'Plan for scale'],
  divergentIdeas: ['Event-driven architecture', 'Serverless functions']
}
```

## Common Patterns

### Type-Safe Response Handling

```typescript
const response = await dispatcher.dispatch(/* ... */);

if (response.mode === 'review' && response.success) {
  // TypeScript knows this is ReviewModeResponse
  response.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.message}`);
  });
}
```

### Cancellation

```typescript
const request = dispatcher.createRequest(/* ... */);
const promise = dispatcher.dispatch(request);

// Cancel after 10 seconds
setTimeout(() => dispatcher.cancel(request.requestId), 10000);
```

### Error Handling

```typescript
const response = await dispatcher.dispatch(/* ... */);

if (!response.success) {
  console.error(response.error);
  console.log(`Failed after ${response.processingTime}ms`);
}
```

### Custom System Prompts

```typescript
await dispatcher.dispatch(mode, message, context, {
  swarmDensity: 3,
  permissionMode: 'ask',
  systemPrompts: {
    review: 'Focus on React hooks and performance',
    plan: 'Prioritize security and scalability'
  }
});
```

## Performance Tips

1. **Parallel Handlers**: Brainstorm mode runs agents in parallel automatically
2. **Timeouts**: Default 5 minutes, configurable in dispatcher constructor
3. **Shared Services**: Reuse ClaudeService instance across handlers
4. **Event Listeners**: Keep lightweight, avoid heavy processing

## Testing

### Mock Handler

```typescript
class MockChatHandler extends BaseModeHandler {
  readonly mode = 'chat' as const;

  protected async executeHandler(request: ModeRequest) {
    return {
      success: true,
      mode: 'chat',
      requestId: request.requestId,
      processingTime: 0,
      response: 'Mock response'
    };
  }
}

dispatcher.registerHandler(new MockChatHandler());
```

### Test Dispatch

```typescript
const response = await dispatcher.dispatch(
  'chat',
  'test message',
  {},
  { swarmDensity: 1, permissionMode: 'ask' }
);

expect(response.success).toBe(true);
expect(response.mode).toBe('chat');
```

## Troubleshooting

### "No handler found for mode"
- Check handler is registered: `dispatcher.hasHandler('chat')`
- Verify handler construction succeeded
- Check dispatcher logs if `enableLogging: true`

### "Request validation failed"
- Ensure all required fields present (message, mode, requestId)
- Check swarmDensity is 1-10
- Verify temperature is 0-1 if provided

### "Request timed out"
- Increase timeout in dispatcher config
- Check network/API connectivity
- Verify agent orchestrator is responding

### Response type not recognized
- Use type guards: `response.mode === 'chat'`
- Check response.success before accessing mode-specific fields
- Ensure handler returns correct response type

## File Locations

```
src/modes/
├── types.ts                    - All TypeScript interfaces
├── ModeDispatcher.ts          - Main dispatcher class
├── index.ts                   - Public exports
├── handlers/
│   ├── BaseModeHandler.ts     - Abstract base
│   ├── ChatModeHandler.ts     - Chat implementation
│   ├── ReviewModeHandler.ts   - Review implementation
│   ├── PlanModeHandler.ts     - Plan implementation
│   └── BrainstormModeHandler.ts - Brainstorm implementation
└── integration-example.ts     - Full integration example
```

## Next Steps

1. Read [README.md](../src/modes/README.md) for detailed documentation
2. Review [integration-example.ts](../src/modes/integration-example.ts) for complete implementation
3. Check [ADR-001](./ADR-001-ModeDispatcher-Architecture.md) for architecture decisions
4. Integrate dispatcher into App.tsx handleSend()
5. Test with each mode and verify UI updates

## Support

- Architecture questions: See ADR-001
- Implementation help: See integration-example.ts
- Type issues: Check types.ts with your IDE's Go to Definition
- Runtime errors: Enable `enableLogging: true` in dispatcher config
