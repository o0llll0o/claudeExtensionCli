# ToolEventHandler API Documentation

## Overview

The ToolEventHandler module provides comprehensive tracking and monitoring of tool executions in Claude API streams. It processes `tool_use` and `tool_result` events, tracks execution lifecycle, calculates performance metrics, and emits events for real-time monitoring.

**Module**: `src/orchestration/ToolEventHandler.ts`

**Critical Functionality**:
- Extracts tool_use blocks from assistant content arrays
- Processes tool_result events from Claude API streams
- Tracks tool execution lifecycle (pending → running → success/error)
- Maintains execution history for debugging
- Calculates performance statistics
- Provides integration hooks for SubagentOrchestrator

**Solves**: The critical gap where SubagentOrchestrator ignores tool events, providing complete visibility into autonomous agent tool usage.

---

## Interfaces

### ToolEvent

Represents a tool execution event within the Claude API stream. Tracks the complete lifecycle of tool invocations from request to completion.

| Property | Type | Description |
|----------|------|-------------|
| toolId | string | Unique identifier for this tool execution (from Claude API) |
| toolName | string | Name of the tool being invoked (e.g., 'Read', 'Write', 'Bash') |
| toolInput | Record<string, any> (optional) | Input parameters passed to the tool |
| toolOutput | string (optional) | Output/result returned from the tool |
| status | 'pending' \| 'running' \| 'success' \| 'error' | Current execution status |
| timestamp | number | Timestamp when the tool was invoked (ms since epoch) |
| duration | number (optional) | Execution duration in milliseconds (only set after completion) |
| error | string (optional) | Error message if status is 'error' |

**Lifecycle Progression**:
```
pending → running → success/error
```

**Example**:
```typescript
{
  toolId: 'tool_abc123',
  toolName: 'Read',
  toolInput: { file_path: '/path/to/file.ts' },
  toolOutput: 'file contents...',
  status: 'success',
  timestamp: 1701964800000,
  duration: 245
}
```

---

### ToolStatistics

Aggregated statistics about tool usage patterns.

| Property | Type | Description |
|----------|------|-------------|
| totalInvocations | number | Total number of tools invoked |
| successCount | number | Number of successful completions |
| errorCount | number | Number of failed executions |
| activeCount | number | Number of currently running tools |
| averageDuration | number | Average execution time in milliseconds |
| topTools | Map<string, number> | Most frequently used tools (name → count) |
| byStatus | Record<string, number> | Tool usage breakdown by status |

**Example**:
```typescript
{
  totalInvocations: 45,
  successCount: 42,
  errorCount: 3,
  activeCount: 2,
  averageDuration: 312.5,
  topTools: Map {
    'Read' => 15,
    'Write' => 12,
    'Bash' => 10,
    'Edit' => 8
  },
  byStatus: {
    'pending': 2,
    'success': 42,
    'error': 3
  }
}
```

---

### ToolEventHandlerConfig

Configuration options for ToolEventHandler behavior.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| maxHistorySize | number (optional) | 1000 | Maximum number of events to keep in history |
| enableLogging | boolean (optional) | false | Enable detailed console logging |
| enableMetrics | boolean (optional) | true | Enable performance tracking |

**Example**:
```typescript
const config: ToolEventHandlerConfig = {
  maxHistorySize: 500,
  enableLogging: true,
  enableMetrics: true
};
```

---

## Classes

### ToolEventHandler

Processes and tracks tool_use and tool_result events from Claude API streams. Extends EventEmitter for real-time monitoring.

**Constructor**:
```typescript
constructor(config?: ToolEventHandlerConfig)
```

**Parameters**:
- **config**: ToolEventHandlerConfig (optional) - Configuration options

**Example**:
```typescript
const handler = new ToolEventHandler({
  maxHistorySize: 1000,
  enableLogging: true,
  enableMetrics: true
});
```

---

## Methods

### handleAssistantContent

Processes assistant content array to extract `tool_use` blocks.

Claude API returns content as an array that can contain:
- `{ type: 'text', text: string }`
- `{ type: 'tool_use', id: string, name: string, input: object }`

This method finds all tool_use blocks and creates pending ToolEvents.

**Signature**:
```typescript
handleAssistantContent(content: any[]): void
```

**Parameters**:
- **content**: any[] - Array of content blocks from assistant message

**Returns**: void

**Emits**: `tool_invoked` event for each tool_use block found

**Example**:
```typescript
// Claude API event structure
const event = {
  type: 'assistant',
  message: {
    content: [
      { type: 'text', text: 'I will read the file.' },
      {
        type: 'tool_use',
        id: 'tool_123',
        name: 'Read',
        input: { file_path: '/path/to/file' }
      }
    ]
  }
};

// Extract and track tool invocations
handler.handleAssistantContent(event.message.content);

// Emits 'tool_invoked' event with:
// { toolName: 'Read', toolInput: {...}, toolId: 'tool_123' }
```

**Integration Pattern**:
```typescript
proc.stdout?.on('data', (chunk: Buffer) => {
  const line = chunk.toString().trim();
  if (line.startsWith('{')) {
    const event = JSON.parse(line);

    if (event.type === 'assistant' && event.message?.content) {
      handler.handleAssistantContent(event.message.content);
    }
  }
});
```

---

### handleToolResult

Processes a `tool_result` event from the Claude API stream.

Tool results can be:
- **Success**: `{ type: 'tool_result', tool_use_id: string, content: string }`
- **Error**: `{ type: 'tool_result', tool_use_id: string, is_error: true, content: string }`

This method updates the corresponding ToolEvent with results and calculates duration.

**Signature**:
```typescript
handleToolResult(event: any): void
```

**Parameters**:
- **event**: any - Tool result event from Claude API stream

**Returns**: void

**Emits**: `tool_completed` or `tool_error` event

**Example**:
```typescript
// Success result
const successEvent = {
  type: 'tool_result',
  tool_use_id: 'tool_123',
  content: 'File contents here...'
};
handler.handleToolResult(successEvent);
// Emits 'tool_completed'

// Error result
const errorEvent = {
  type: 'tool_result',
  tool_use_id: 'tool_456',
  is_error: true,
  content: 'File not found: /invalid/path'
};
handler.handleToolResult(errorEvent);
// Emits 'tool_error'
```

**Integration Pattern**:
```typescript
proc.stdout?.on('data', (chunk: Buffer) => {
  const line = chunk.toString().trim();
  if (line.startsWith('{')) {
    const event = JSON.parse(line);

    if (event.type === 'tool_result') {
      handler.handleToolResult(event);
    }
  }
});
```

---

### trackToolExecution

Marks a tool as actively running (status: 'running'). Useful for tracking tool execution lifecycle more granularly.

**Signature**:
```typescript
trackToolExecution(toolId: string): ToolEvent | undefined
```

**Parameters**:
- **toolId**: string - Unique identifier of the tool to track

**Returns**: ToolEvent | undefined - The ToolEvent if found and updated, undefined otherwise

**Emits**: `tool_started` event if tool status changes from pending to running

**Example**:
```typescript
const toolEvent = handler.trackToolExecution('tool_123');
if (toolEvent) {
  console.log(`Tool ${toolEvent.toolName} is now running`);
}
```

---

### getActiveTools

Returns a map of all currently active tool executions.

**Signature**:
```typescript
getActiveTools(): Map<string, ToolEvent>
```

**Returns**: Map<string, ToolEvent> - Defensive copy of active tools map

**Example**:
```typescript
const active = handler.getActiveTools();
console.log(`${active.size} tools currently executing`);

active.forEach((tool, toolId) => {
  console.log(`${toolId}: ${tool.toolName} (${tool.status})`);
});
```

---

### getToolHistory

Returns the complete history of tool executions, limited by maxHistorySize configuration.

**Signature**:
```typescript
getToolHistory(): ToolEvent[]
```

**Returns**: ToolEvent[] - Array of all ToolEvents in chronological order (defensive copy)

**Example**:
```typescript
const history = handler.getToolHistory();
console.log(`Total tools executed: ${history.length}`);

// Analyze recent executions
const recent = history.slice(-10);
recent.forEach(tool => {
  console.log(`${tool.toolName}: ${tool.status} (${tool.duration}ms)`);
});
```

---

### getStatistics

Returns aggregated statistics about tool usage.

**Signature**:
```typescript
getStatistics(): ToolStatistics
```

**Returns**: ToolStatistics - Current statistics snapshot (defensive copy)

**Example**:
```typescript
const stats = handler.getStatistics();

console.log(`Total invocations: ${stats.totalInvocations}`);
console.log(`Success rate: ${(stats.successCount / stats.totalInvocations * 100).toFixed(1)}%`);
console.log(`Average duration: ${stats.averageDuration.toFixed(0)}ms`);

console.log('\nTop tools:');
Array.from(stats.topTools.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
```

---

### getToolById

Returns a specific tool event by its unique identifier.

**Signature**:
```typescript
getToolById(toolId: string): ToolEvent | undefined
```

**Parameters**:
- **toolId**: string - Unique identifier of the tool

**Returns**: ToolEvent | undefined - The ToolEvent if found (checks active tools first, then history)

**Example**:
```typescript
const tool = handler.getToolById('tool_abc123');
if (tool) {
  console.log(`Tool: ${tool.toolName}`);
  console.log(`Status: ${tool.status}`);
  if (tool.duration) {
    console.log(`Duration: ${tool.duration}ms`);
  }
}
```

---

### getToolsByName

Returns all events for a specific tool by name. Useful for analyzing patterns in tool usage.

**Signature**:
```typescript
getToolsByName(toolName: string): ToolEvent[]
```

**Parameters**:
- **toolName**: string - Name of the tool (e.g., 'Read', 'Write', 'Bash')

**Returns**: ToolEvent[] - Array of ToolEvents for that tool

**Example**:
```typescript
const readOps = handler.getToolsByName('Read');
console.log(`Total Read operations: ${readOps.length}`);

const avgDuration = readOps
  .filter(t => t.duration)
  .reduce((sum, t) => sum + t.duration!, 0) / readOps.length;
console.log(`Average Read duration: ${avgDuration.toFixed(0)}ms`);

const errors = readOps.filter(t => t.status === 'error');
console.log(`Read errors: ${errors.length}`);
```

---

### reset

Clears all tracking data and resets statistics. Useful for starting fresh between test runs.

**Signature**:
```typescript
reset(): void
```

**Returns**: void

**Example**:
```typescript
// Clear all data between test runs
afterEach(() => {
  handler.reset();
});

// Or manually reset
handler.reset();
console.log('Handler reset - all data cleared');
```

---

## Events

The ToolEventHandler class emits the following events:

### tool_invoked

Emitted when a tool is first requested (tool_use block detected in assistant content).

**Payload**:
```typescript
{
  toolName: string;         // Name of the tool
  toolInput: Record<string, any>;  // Input parameters
  toolId: string;           // Unique tool identifier
}
```

**Example**:
```typescript
handler.on('tool_invoked', ({ toolName, toolInput, toolId }) => {
  console.log(`[${toolId}] Tool invoked: ${toolName}`);
  console.log('Input:', JSON.stringify(toolInput, null, 2));
});
```

---

### tool_started

Emitted when a tool begins execution (status changes from pending to running).

**Payload**:
```typescript
{
  toolId: string;           // Unique tool identifier
  toolName: string;         // Name of the tool
  toolInput: Record<string, any>;  // Input parameters
}
```

**Example**:
```typescript
handler.on('tool_started', ({ toolId, toolName }) => {
  console.log(`[${toolId}] Tool started: ${toolName}`);
});
```

---

### tool_completed

Emitted when a tool finishes successfully.

**Payload**:
```typescript
{
  toolId: string;           // Unique tool identifier
  toolName: string;         // Name of the tool
  output: string;           // Tool output/result
  duration: number;         // Execution duration in ms
}
```

**Example**:
```typescript
handler.on('tool_completed', ({ toolId, toolName, output, duration }) => {
  console.log(`[${toolId}] ${toolName} completed in ${duration}ms`);
  console.log('Output length:', output.length, 'characters');
});
```

---

### tool_error

Emitted when a tool execution fails.

**Payload**:
```typescript
{
  toolId: string;           // Unique tool identifier
  toolName: string;         // Name of the tool
  error: string;            // Error message
}
```

**Example**:
```typescript
handler.on('tool_error', ({ toolId, toolName, error }) => {
  console.error(`[${toolId}] ${toolName} failed: ${error}`);
});
```

---

### statistics_updated

Emitted when usage statistics change (after each tool invocation or completion).

**Payload**: ToolStatistics (complete statistics object)

**Example**:
```typescript
handler.on('statistics_updated', (stats) => {
  console.log(`Stats: ${stats.successCount}/${stats.totalInvocations} success`);
  console.log(`Average duration: ${stats.averageDuration.toFixed(0)}ms`);
});
```

---

## Tool Event Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ TOOL EXECUTION LIFECYCLE                                    │
└─────────────────────────────────────────────────────────────┘

1. INVOCATION
   ↓
   [Assistant Content Block]
   type: 'tool_use'
   id: 'tool_123'
   name: 'Read'
   input: { file_path: '/file.ts' }
   ↓
   handleAssistantContent()
   ↓
   [ToolEvent Created]
   status: 'pending'
   timestamp: 1701964800000
   ↓
   emit('tool_invoked')

2. EXECUTION (Optional Manual Tracking)
   ↓
   trackToolExecution('tool_123')
   ↓
   [ToolEvent Updated]
   status: 'running'
   ↓
   emit('tool_started')

3. COMPLETION
   ↓
   [Tool Result Event]
   type: 'tool_result'
   tool_use_id: 'tool_123'
   content: 'File contents...'
   is_error: false
   ↓
   handleToolResult()
   ↓
   [ToolEvent Updated]
   status: 'success'
   duration: 245ms
   toolOutput: 'File contents...'
   ↓
   emit('tool_completed')
   ↓
   [Statistics Updated]
   successCount++
   averageDuration recalculated
   ↓
   emit('statistics_updated')

4. ERROR PATH (Alternative to Completion)
   ↓
   [Tool Result Event]
   type: 'tool_result'
   tool_use_id: 'tool_123'
   is_error: true
   content: 'Error message'
   ↓
   handleToolResult()
   ↓
   [ToolEvent Updated]
   status: 'error'
   duration: 180ms
   error: 'Error message'
   ↓
   emit('tool_error')
   ↓
   [Statistics Updated]
   errorCount++
   ↓
   emit('statistics_updated')
```

---

## Integration Functions

### patchToolEventHandler

Integration function to patch ToolEventHandler into SubagentOrchestrator.

This function provides a clean integration point to add tool tracking to the existing event handling logic in SubagentOrchestrator.

**Signature**:
```typescript
function patchToolEventHandler(
  orchestrator: any,
  config?: ToolEventHandlerConfig
): ToolEventHandler
```

**Parameters**:
- **orchestrator**: any - SubagentOrchestrator instance to patch
- **config**: ToolEventHandlerConfig (optional) - Configuration for the handler

**Returns**: ToolEventHandler - The created handler instance

**Integration Strategy**:
1. Creates ToolEventHandler instance
2. Forwards events from handler to orchestrator
3. Re-emits handler events with taskId context
4. Exposes handler methods through orchestrator

**Example**:
```typescript
import { SubagentOrchestrator } from './SubagentOrchestrator';
import { patchToolEventHandler } from './ToolEventHandler';

const orchestrator = new SubagentOrchestrator('/workspace');
const toolHandler = patchToolEventHandler(orchestrator, {
  enableLogging: true,
  enableMetrics: true
});

// Now tool events are tracked automatically
orchestrator.on('tool_completed', ({ taskId, toolName, duration }) => {
  console.log(`Task ${taskId}: ${toolName} completed in ${duration}ms`);
});

await orchestrator.runAgent({...});
```

**Methods Added to Orchestrator**:
```typescript
orchestrator.getToolEventHandler() => ToolEventHandler
orchestrator.getActiveTools() => Map<string, ToolEvent>
orchestrator.getToolStatistics() => ToolStatistics
orchestrator.getToolHistory() => ToolEvent[]
```

---

## Complete Usage Examples

### Basic Tool Tracking

```typescript
import { ToolEventHandler } from './ToolEventHandler';

const handler = new ToolEventHandler({
  enableLogging: true,
  enableMetrics: true
});

// Set up event listeners
handler.on('tool_invoked', ({ toolName, toolId }) => {
  console.log(`📋 Tool invoked: ${toolName} (${toolId})`);
});

handler.on('tool_completed', ({ toolName, duration }) => {
  console.log(`✅ ${toolName} completed in ${duration}ms`);
});

handler.on('tool_error', ({ toolName, error }) => {
  console.error(`❌ ${toolName} failed: ${error}`);
});

// Process Claude API events
const assistantContent = [
  { type: 'text', text: 'I will read the configuration file.' },
  {
    type: 'tool_use',
    id: 'tool_1',
    name: 'Read',
    input: { file_path: '/config.json' }
  }
];
handler.handleAssistantContent(assistantContent);

// Later, process the result
const toolResult = {
  type: 'tool_result',
  tool_use_id: 'tool_1',
  content: '{ "version": "1.0.0" }'
};
handler.handleToolResult(toolResult);
```

---

### Performance Monitoring

```typescript
import { ToolEventHandler } from './ToolEventHandler';

const handler = new ToolEventHandler({ enableMetrics: true });

// Monitor statistics changes
handler.on('statistics_updated', (stats) => {
  const successRate = (stats.successCount / stats.totalInvocations * 100).toFixed(1);

  console.log(`
📊 Tool Statistics:
  Total: ${stats.totalInvocations}
  Success: ${stats.successCount} (${successRate}%)
  Errors: ${stats.errorCount}
  Active: ${stats.activeCount}
  Avg Duration: ${stats.averageDuration.toFixed(0)}ms
  `);

  // Alert on high error rate
  if (stats.errorCount / stats.totalInvocations > 0.1) {
    console.warn('⚠️ High error rate detected!');
  }
});

// Periodic reporting
setInterval(() => {
  const stats = handler.getStatistics();
  const topTools = Array.from(stats.topTools.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log('Top 3 tools:', topTools.map(([name, count]) =>
    `${name} (${count})`
  ).join(', '));
}, 10000);
```

---

### Debugging Tool Executions

```typescript
import { ToolEventHandler } from './ToolEventHandler';

const handler = new ToolEventHandler({
  maxHistorySize: 100,
  enableLogging: true
});

// Track slow operations
handler.on('tool_completed', ({ toolName, duration, toolId }) => {
  if (duration > 1000) {
    console.warn(`⚠️ Slow tool execution: ${toolName} took ${duration}ms`);

    const tool = handler.getToolById(toolId);
    if (tool) {
      console.log('Input:', tool.toolInput);
      console.log('Output length:', tool.toolOutput?.length);
    }
  }
});

// Analyze tool usage patterns
function analyzeToolUsage() {
  const history = handler.getToolHistory();

  // Find most error-prone tools
  const errorsByTool = new Map<string, number>();
  history.filter(t => t.status === 'error').forEach(t => {
    errorsByTool.set(t.toolName, (errorsByTool.get(t.toolName) || 0) + 1);
  });

  console.log('Error-prone tools:');
  Array.from(errorsByTool.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} errors`);
    });

  // Find slowest tools
  const durationsByTool = new Map<string, number[]>();
  history.filter(t => t.duration).forEach(t => {
    if (!durationsByTool.has(t.toolName)) {
      durationsByTool.set(t.toolName, []);
    }
    durationsByTool.get(t.toolName)!.push(t.duration!);
  });

  console.log('\nAverage durations:');
  Array.from(durationsByTool.entries()).forEach(([tool, durations]) => {
    const avg = durations.reduce((a, b) => a + b) / durations.length;
    console.log(`  ${tool}: ${avg.toFixed(0)}ms`);
  });
}

// Run analysis every minute
setInterval(analyzeToolUsage, 60000);
```

---

### Integration with SubagentOrchestrator

```typescript
import { SubagentOrchestrator } from './SubagentOrchestrator';
import { patchToolEventHandler } from './ToolEventHandler';

// Create orchestrator and patch tool tracking
const orchestrator = new SubagentOrchestrator('/workspace');
const toolHandler = patchToolEventHandler(orchestrator, {
  enableLogging: true,
  maxHistorySize: 500
});

// Listen to orchestrator events (now includes tool events)
orchestrator.on('tool_completed', ({ toolName, duration }) => {
  console.log(`Tool ${toolName} completed in ${duration}ms`);
});

orchestrator.on('tool_error', ({ toolName, error }) => {
  console.error(`Tool ${toolName} error: ${error}`);
});

// Run agent task
await orchestrator.runAgent({
  taskId: 'task-1',
  prompt: 'Analyze the codebase and create a report',
  timeout: 300000
});

// Get tool usage report
const stats = orchestrator.getToolStatistics();
console.log('Task tool usage:', stats);

const history = orchestrator.getToolHistory();
console.log('Total tools used:', history.length);
```

---

## Best Practices

1. **Always Enable Metrics in Production**:
   ```typescript
   const handler = new ToolEventHandler({ enableMetrics: true });
   ```

2. **Set Appropriate History Size**:
   - Development: 1000+ for debugging
   - Production: 100-500 to limit memory usage

3. **Monitor Error Rates**:
   ```typescript
   handler.on('statistics_updated', (stats) => {
     const errorRate = stats.errorCount / stats.totalInvocations;
     if (errorRate > 0.1) {
       alert('High tool error rate detected');
     }
   });
   ```

4. **Track Performance Degradation**:
   ```typescript
   let baselineDuration = 0;
   handler.on('tool_completed', ({ toolName, duration }) => {
     if (!baselineDuration) baselineDuration = duration;
     if (duration > baselineDuration * 2) {
       console.warn(`${toolName} is 2x slower than baseline`);
     }
   });
   ```

5. **Clean Up Event Listeners**:
   ```typescript
   // When done with handler
   handler.removeAllListeners();
   handler.reset();
   ```

6. **Use Logging Carefully**:
   - Enable logging in development
   - Disable in production (use events instead)

---

## TypeScript Types Export

```typescript
export interface ToolEvent { /* ... */ }
export interface ToolStatistics { /* ... */ }
export interface ToolEventHandlerConfig { /* ... */ }
export class ToolEventHandler extends EventEmitter { /* ... */ }
export function patchToolEventHandler(
  orchestrator: any,
  config?: ToolEventHandlerConfig
): ToolEventHandler;
```
