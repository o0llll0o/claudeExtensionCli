# ThoughtProcess Retry - Quick Reference Card

## 🚀 Quick Start

### 1. Interface Update (3 additions)
```typescript
interface ThoughtStep {
    // ... existing fields ...
    type: 'tool' | 'thinking' | 'execution' | 'retry' | 'retry_success' | 'retry_failed';
    retryAttempt?: number;      // 1-based attempt counter
    maxRetries?: number;        // Total attempts allowed
    retryError?: string;        // Error being addressed
}
```

### 2. Create Retry Steps

```typescript
// Retry in progress
const retry: ThoughtStep = {
    id: 'retry-1',
    type: 'retry',
    status: 'running',
    toolName: 'file_read',
    timestamp: Date.now(),
    retryAttempt: 2,
    maxRetries: 3,
    retryError: 'ENOENT: File not found',
};

// Retry succeeded
const success: ThoughtStep = {
    id: 'retry-2',
    type: 'retry_success',
    status: 'done',
    toolName: 'file_read',
    timestamp: Date.now(),
    retryAttempt: 2,
    maxRetries: 3,
};

// Retry failed
const failed: ThoughtStep = {
    id: 'retry-3',
    type: 'retry_failed',
    status: 'error',
    toolName: 'file_read',
    timestamp: Date.now(),
    retryAttempt: 3,
    maxRetries: 3,
    retryError: 'Permission denied',
};
```

---

## 🎨 Visual Quick Reference

| Type            | Color  | Border   | Badge                      | Icon |
|-----------------|--------|----------|----------------------------|------|
| retry           | Yellow | #fbbf24  | 🔄 Retry 2/3               | ⟳    |
| retry_success   | Green  | #10b981  | ✓ Retry succeeded (2/3)    | ✓    |
| retry_failed    | Red    | #ef4444  | ✗ All retries exhausted... | ✗    |

---

## 📁 Files to Update

### App.tsx Changes

**Lines 201-212**: Interface
```typescript
interface ThoughtStep {
    // Add new type options and fields
}
```

**Lines 890-948**: Component
```typescript
function ThoughtProcess() {
    // Replace with updated version
}
```

**After line 2999**: Styles
```typescript
const styles = {
    // Add 6 new retry styles
};
```

---

## 🔧 Installation Steps

1. **Update Interface** (lines 201-212)
   - Add retry types to `type` union
   - Add `retryAttempt?`, `maxRetries?`, `retryError?`

2. **Replace Component** (lines 890-948)
   - Copy from `ThoughtProcessUpdated.tsx`

3. **Add Styles** (after line 2999)
   - Copy from `retry-styles-snippet.ts`

---

## 💻 Usage Patterns

### Pattern 1: Simple Retry
```typescript
setThoughtSteps(prev => [...prev, {
    id: Date.now().toString(),
    type: 'retry',
    status: 'running',
    toolName: 'api_call',
    timestamp: Date.now(),
    retryAttempt: 1,
    maxRetries: 3,
    retryError: 'Timeout',
}]);
```

### Pattern 2: Update to Success
```typescript
setThoughtSteps(prev => prev.map(step =>
    step.id === retryId
        ? { ...step, type: 'retry_success', status: 'done' }
        : step
));
```

### Pattern 3: Update to Failed
```typescript
setThoughtSteps(prev => prev.map(step =>
    step.id === retryId
        ? { ...step, type: 'retry_failed', status: 'error' }
        : step
));
```

---

## 🎯 Common Use Cases

### Use Case 1: Network Request Retry
```typescript
{
    id: 'net-1',
    type: 'retry',
    status: 'running',
    toolName: 'http_request',
    retryAttempt: 2,
    maxRetries: 5,
    retryError: '503 Service Unavailable',
    toolInput: { url: 'https://api.example.com' },
}
```

### Use Case 2: File Operation Retry
```typescript
{
    id: 'fs-1',
    type: 'retry',
    status: 'running',
    toolName: 'file_write',
    retryAttempt: 1,
    maxRetries: 3,
    retryError: 'EBUSY: Resource locked',
    toolInput: { path: '/config.json' },
}
```

### Use Case 3: Database Query Retry
```typescript
{
    id: 'db-1',
    type: 'retry',
    status: 'running',
    toolName: 'sql_query',
    retryAttempt: 3,
    maxRetries: 3,
    retryError: 'Deadlock detected',
    toolInput: { query: 'UPDATE ...' },
}
```

---

## 🎨 Style Reference

### Badge Styles
```typescript
retryBadgeWarning: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',  // Yellow
    color: '#fbbf24',
}

retryBadgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',  // Green
    color: '#10b981',
}

retryBadgeFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',   // Red
    color: '#ef4444',
}
```

### Step Backgrounds
```typescript
// Retry
backgroundColor: 'rgba(251, 191, 36, 0.1)',  // Light yellow
borderLeft: '3px solid #fbbf24',

// Success
backgroundColor: 'rgba(16, 185, 129, 0.1)',  // Light green
borderLeft: '3px solid #10b981',

// Failed
backgroundColor: 'rgba(239, 68, 68, 0.1)',   // Light red
borderLeft: '3px solid #ef4444',
```

---

## 🔄 State Transitions

```
Initial Attempt (type: 'tool', status: 'error')
                    ↓
         Retry #1 (type: 'retry', status: 'running')
                    ↓
               ┌────┴────┐
               ↓         ↓
          Success       Fail
               ↓         ↓
    (retry_success)  Retry #2
                         ↓
                    ┌────┴────┐
                    ↓         ↓
               Success       Fail
                    ↓         ↓
         (retry_success)  Retry #3
                              ↓
                         ┌────┴────┐
                         ↓         ↓
                    Success    All Failed
                         ↓         ↓
              (retry_success) (retry_failed)
```

---

## 🧪 Testing Checklist

- [ ] Retry badge shows correct numbers
- [ ] Error message displays
- [ ] Yellow styling for retry
- [ ] Green styling for success
- [ ] Red styling for failed
- [ ] Spinner animates
- [ ] Checkmark shows on success
- [ ] X shows on failure
- [ ] Tool input displays
- [ ] Output displays
- [ ] Multiple retries in sequence work

---

## 📚 Documentation Files

| File                                  | Purpose                          |
|---------------------------------------|----------------------------------|
| `ThoughtProcessUpdated.tsx`           | Complete updated component       |
| `retry-styles-snippet.ts`             | Styles to add                    |
| `ThoughtProcess_Retry_Implementation.md` | Full technical documentation  |
| `retry-usage-examples.ts`             | Code examples                    |
| `RETRY_VISUAL_REFERENCE.md`           | Visual mockups                   |
| `BEFORE_AFTER_COMPARISON.md`          | Comparison of old vs new         |
| `RETRY_IMPLEMENTATION_SUMMARY.md`     | Complete summary                 |
| `RETRY_QUICK_REFERENCE.md`            | This file                        |

---

## ⚡ One-Liner Examples

```typescript
// Retry in progress
{ type: 'retry', status: 'running', retryAttempt: 2, maxRetries: 3, retryError: 'Timeout' }

// Retry success
{ type: 'retry_success', status: 'done', retryAttempt: 2, maxRetries: 3 }

// Retry failed
{ type: 'retry_failed', status: 'error', retryAttempt: 3, maxRetries: 3, retryError: 'Failed' }
```

---

## 🚨 Common Mistakes

### ❌ Wrong
```typescript
// Missing attempt/max
{ type: 'retry', status: 'running' }

// Wrong attempt number (0-based)
{ type: 'retry', retryAttempt: 0, maxRetries: 3 }

// Success with error status
{ type: 'retry_success', status: 'error' }
```

### ✅ Correct
```typescript
// Include all fields
{ type: 'retry', status: 'running', retryAttempt: 1, maxRetries: 3, retryError: '...' }

// 1-based attempts
{ type: 'retry', retryAttempt: 1, maxRetries: 3 }

// Success with done status
{ type: 'retry_success', status: 'done' }
```

---

## 📞 Help

**Visual not matching?** Check color values match reference
**Badge not showing?** Verify retryAttempt and maxRetries are set
**Animation not working?** Check retrySpinner style is added
**Error not displaying?** Ensure retryError field is populated

**All documentation**: `C:\Users\kirtc\OneDrive\Desktop\ClaudeCLIExtenstion\docs\`

---

## ✨ Key Takeaways

1. **3 new types**: retry, retry_success, retry_failed
2. **3 new fields**: retryAttempt, maxRetries, retryError
3. **3 color themes**: Yellow (retry), Green (success), Red (failed)
4. **100% backwards compatible** with existing code
5. **Easy integration** - just copy and add styles

---

**Ready to implement?** Start with the interface update, then component, then styles!
