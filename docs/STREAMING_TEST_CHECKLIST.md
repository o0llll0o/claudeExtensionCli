# Plan Mode Streaming - Integration Test Checklist

## Overview
This checklist verifies that Plan mode streaming displays human-readable text progressively in the UI, not raw JSON objects.

---

## 1. Pre-requisites

### Environment Setup
- [ ] VS Code extension compiled successfully
  ```bash
  npm run compile
  # or
  npm run watch
  ```
- [ ] Claude CLI installed globally
  ```bash
  claude --version
  ```
- [ ] Claude CLI authenticated
  ```bash
  claude auth login
  ```
- [ ] VS Code extension activated (F5 or Debug → Start Debugging)
- [ ] Extension Development Host window open

### Verification
- [ ] Open VS Code Output panel (View → Output)
- [ ] Select "Claude Code" from dropdown
- [ ] Confirm no initialization errors

---

## 2. Test: Plan Mode Live Streaming

### Trigger Plan Mode
1. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. **Run Command:** `Claude Code: Start Plan Mode`
3. **Enter Task:** "Create a simple REST API with Express"

### Expected UI Behavior

#### ✅ SUCCESS - Human-Readable Text Streaming
```
Plan Card should show:
┌─────────────────────────────────────────┐
│ Planning: Create a simple REST API...  │
├─────────────────────────────────────────┤
│ I'll help you create a REST API using  │
│ Express. Let me break this down:       │
│                                         │
│ 1. Set up project structure            │
│    - Initialize npm package             │
│    - Install Express and dependencies   │
│                                         │
│ 2. Create server files                 │
│    - app.js - Main server              │
│    - routes/ - API endpoints           │
│                                         │
│ [Text appears progressively as it      │
│  streams, word by word or phrase by    │
│  phrase]                                │
└─────────────────────────────────────────┘
```

#### ❌ FAILURE - Raw JSON Streaming
```
Plan Card showing:
┌─────────────────────────────────────────┐
│ {"type":"text","text":"I'll help"}     │
│ {"type":"text","text":" you"}          │
│ {"type":"text","text":" create"}       │
│ [JSON objects visible instead of text]  │
└─────────────────────────────────────────┘
```

### Checkpoints During Streaming

- [ ] **Initial Response** - First words appear within 2-3 seconds
- [ ] **Progressive Display** - Text accumulates smoothly
- [ ] **No JSON Artifacts** - No `{"type":`, `"text":`, or `}` visible
- [ ] **Formatting Preserved** - Numbered lists, bullets, code blocks render correctly
- [ ] **No Flickering** - UI updates smoothly without flash/reload
- [ ] **Cursor/Loading Indicator** - Optional: blinking cursor or "..." shows active streaming

### Performance Metrics
- [ ] Time to first token: < 3 seconds
- [ ] Streaming feels continuous (no long pauses)
- [ ] UI remains responsive during streaming

---

## 3. Test: Content Accuracy

### After Streaming Completes

#### Verify Final Plan Card
1. **Compare Accumulated Text:**
   - [ ] All streamed content visible in final card
   - [ ] No text missing from beginning/middle/end
   - [ ] No duplicated sentences or phrases

2. **Formatting Integrity:**
   - [ ] Markdown rendered correctly (if supported):
     - Headers (`#`, `##`, `###`)
     - Lists (numbered, bulleted)
     - Code blocks (` ``` `)
     - Bold/italic formatting
   - [ ] Line breaks preserved
   - [ ] Indentation correct

3. **Action Buttons:**
   - [ ] "Execute Plan" button appears
   - [ ] "Edit Plan" button appears (if implemented)
   - [ ] Buttons are clickable and functional

#### Content Validation Test
**Before:** During streaming, copy first paragraph
**After:** Verify same paragraph exists verbatim in final card

---

## 4. Test: Regression - Other Modes Still Work

### Chat Mode
- [ ] **Trigger:** Ask a simple question in chat
  - Example: "What is TypeScript?"
- [ ] **Expected:** Response streams as readable text
- [ ] **Verify:** No JSON leakage in chat messages

### Swarm Mode (If Applicable)
- [ ] **Trigger:** Run swarm task
  ```
  Claude Code: Run Swarm Task
  Task: "Analyze codebase for errors"
  ```
- [ ] **Expected:** Agent outputs appear as readable logs
- [ ] **Verify:** Each agent's response is human-readable

### Coder/Verifier During Plan Execution
1. **Execute a Plan** (from previous test)
2. **Monitor Execution Panel:**
   - [ ] Coder agent output readable
   - [ ] Verifier agent output readable
   - [ ] Code snippets formatted correctly
   - [ ] No raw JSON in execution logs

### File Operations
- [ ] **Trigger:** Ask Claude to create/edit a file
  - Example: "Create a package.json file"
- [ ] **Expected:** File content preview shows actual JSON/code
- [ ] **Verify:** No streaming artifacts in file previews

---

## 5. Common Failure Patterns

### Failure Pattern 1: JSON Leakage in UI
**Symptom:**
```
Plan card shows:
{"type":"text","text":"Step 1"}{"type":"text","text":": Initialize"}
```

**Root Cause:**
- `content.text` not extracted from ContentBlock
- Raw `event.delta` object rendered instead of `.delta.text`

**Fix Location:**
- Check `PlanExecutor.ts` or streaming handler
- Ensure: `message += delta.text` not `message += JSON.stringify(delta)`

---

### Failure Pattern 2: Text Duplication
**Symptom:**
```
I'll help you create
I'll help you create a REST API
I'll help you create a REST API with Express
[Each line repeats previous content]
```

**Root Cause:**
- Appending entire `message` instead of just `delta.text`

**Fix:**
```typescript
// ❌ Wrong
planCard.update(fullMessage);

// ✅ Correct
planCard.appendDelta(delta.text);
```

---

### Failure Pattern 3: Missing Text Chunks
**Symptom:**
- Final plan card missing sentences that appeared during streaming

**Root Cause:**
- Race condition in state updates
- Text not persisted before card re-render

**Fix:**
- Ensure state synchronization between streaming buffer and final render

---

### Failure Pattern 4: No Streaming (Full Response at End)
**Symptom:**
- UI shows loading spinner
- Entire plan appears at once after 10-15 seconds

**Root Cause:**
- Event stream not connected to UI update
- Buffering entire response before display

**Check:**
- Verify `stream: true` in API request
- Ensure event handlers call UI update on each delta

---

## 6. Success Criteria Summary

### Visual Indicators of Correct Streaming
```
✅ Text appears word-by-word or phrase-by-phrase
✅ Smooth accumulation (like ChatGPT interface)
✅ No visible JSON syntax
✅ Formatting renders correctly
✅ Final card matches streamed content exactly
```

### Code-Level Indicators
```typescript
// ✅ Correct streaming code pattern
messageStream.on('delta', (delta) => {
  if (delta.type === 'text') {
    accumulatedText += delta.text;
    planCardUI.update(accumulatedText);
  }
});

// ❌ Incorrect (renders JSON)
messageStream.on('delta', (delta) => {
  planCardUI.update(delta); // Shows {"type":"text",...}
});
```

---

## 7. Debugging Tips

### Check Developer Tools Console

1. **Open DevTools in Extension Development Host:**
   - `Help → Toggle Developer Tools`

2. **Monitor Console for:**
   - [ ] Streaming event logs
   - [ ] Error messages during stream
   - [ ] Network requests to Claude API

3. **Useful Console Filters:**
   ```
   Filter: "stream"  - Shows streaming-related logs
   Filter: "plan"    - Shows plan mode logs
   Filter: "error"   - Shows errors
   ```

### Streaming Event Logging

**Enable Verbose Logging:**
```typescript
// In PlanExecutor.ts or streaming handler
console.log('[STREAM] Delta received:', delta.type, delta.text?.substring(0, 50));
console.log('[STREAM] Accumulated length:', accumulatedText.length);
console.log('[STREAM] UI updated with:', delta.text);
```

**Expected Log Pattern:**
```
[STREAM] Delta received: text "I'll help you"
[STREAM] Accumulated length: 13
[STREAM] UI updated with: I'll help you
[STREAM] Delta received: text " create a"
[STREAM] Accumulated length: 23
[STREAM] UI updated with:  create a
```

### Network Inspection

1. **Open Network Tab** in DevTools
2. **Locate Claude API Request:**
   - Look for `/messages` or `/stream` endpoint
3. **Verify Request Headers:**
   - [ ] `anthropic-version: 2023-06-01`
   - [ ] `stream: true`
4. **Check Response:**
   - [ ] Status: 200 OK
   - [ ] Content-Type: `text/event-stream`

### UI State Inspection

**Add Debug Panel (Optional):**
```typescript
// Temporary debug output in UI
const debugInfo = {
  streamActive: isStreaming,
  chunkCount: deltaCount,
  textLength: accumulatedText.length,
  lastDelta: lastDeltaText
};
console.table(debugInfo);
```

### Common Debug Commands

```bash
# Check extension logs
code --extensionDevelopmentPath=. --log debug

# Monitor file changes (if watching)
npm run watch

# Clear extension cache
rm -rf ~/.vscode/extensions/claude-code-*
```

---

## 8. Test Execution Record

### Test Run Template

**Date:** _________________
**Tester:** _________________
**Extension Version:** _________________
**VS Code Version:** _________________

| Test Case | Status | Notes |
|-----------|--------|-------|
| Pre-requisites | ☐ Pass ☐ Fail | |
| Plan Mode Streaming | ☐ Pass ☐ Fail | |
| Content Accuracy | ☐ Pass ☐ Fail | |
| Chat Mode Regression | ☐ Pass ☐ Fail | |
| Swarm Mode Regression | ☐ Pass ☐ Fail | |
| Coder/Verifier Output | ☐ Pass ☐ Fail | |
| No JSON Leakage | ☐ Pass ☐ Fail | |
| No Text Duplication | ☐ Pass ☐ Fail | |

**Overall Result:** ☐ PASS ☐ FAIL

**Issues Found:**
```
[Describe any issues or unexpected behavior]
```

**Screenshots:**
- [ ] Attached screenshot of successful streaming
- [ ] Attached screenshot of any failures

---

## 9. Acceptance Criteria

### Minimum Requirements for Release

- [x] Plan mode streams text progressively (not JSON)
- [x] Final plan card contains complete, accurate content
- [x] No regression in chat/swarm/execution modes
- [x] No JSON artifacts visible in any UI component
- [x] Streaming performance acceptable (< 3s to first token)

### Nice-to-Have Enhancements

- [ ] Visual streaming indicator (typing animation)
- [ ] Ability to pause/resume streaming
- [ ] Retry failed streams automatically
- [ ] Stream progress percentage

---

## 10. Troubleshooting Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| JSON in UI | Not extracting `.text` from delta | Add `.text` extraction |
| No streaming | `stream: false` in API call | Set `stream: true` |
| Duplicated text | Appending full message | Append only `delta.text` |
| Missing chunks | State race condition | Synchronize buffer updates |
| Slow streaming | Network/API throttling | Check network tab, verify API key |
| Extension crashes | Memory leak in stream handler | Add proper cleanup in `dispose()` |

---

## Notes

- This checklist should be run before each release
- Automated tests should cover critical paths (streaming, content accuracy)
- Manual testing required for UI/UX validation
- Record all test runs in version control (test-results/ directory)

---

**Last Updated:** 2025-12-07
**Checklist Version:** 1.0
