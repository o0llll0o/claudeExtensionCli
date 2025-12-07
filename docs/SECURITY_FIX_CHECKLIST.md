# Security Fix Implementation Checklist

**Purpose:** Step-by-step guide for implementing critical security fixes
**Audience:** Development team
**Timeline:** Phase 1 (48 hours), Phase 2 (1 week), Phase 3 (2 weeks)

---

## PHASE 1: CRITICAL FIXES (48 HOURS)

### Task 1.1: Environment Variable Sanitization

**Files to modify:**
- `src/orchestration/SubagentOrchestrator.ts`
- `src/engine/ClaudeService.ts`
- `src/git/GitWorktreeManager.ts`

**Steps:**

1. Create new file: `src/security/EnvironmentSanitizer.ts`
   ```typescript
   export function getSafeEnvironment(): NodeJS.ProcessEnv {
       const SAFE_VARS = ['PATH', 'HOME', 'USER', 'LANG', 'NO_COLOR'];
       const safeEnv: NodeJS.ProcessEnv = {};

       for (const key of SAFE_VARS) {
           if (process.env[key]) {
               safeEnv[key] = process.env[key];
           }
       }

       return safeEnv;
   }
   ```

2. Update SubagentOrchestrator.ts (line 342):
   ```diff
   - env: { ...process.env, NO_COLOR: '1' }
   + env: getSafeEnvironment()
   ```

3. Update ClaudeService.ts (line 107-111):
   ```diff
   - env: {
   -     ...process.env,
   -     NO_COLOR: '1'
   - }
   + env: getSafeEnvironment()
   ```

4. Update GitWorktreeManager.ts (add env parameter):
   ```diff
   + import { getSafeEnvironment } from '../security/EnvironmentSanitizer';

     const proc = spawn(command, args, {
         cwd: cwd || this.rootDir,
   -     shell: process.platform === 'win32'
   +     shell: false,
   +     env: getSafeEnvironment()
     });
   ```

**Test:**
```bash
npm test -- tests/security/environment.test.ts
```

**Verification:**
- [ ] All tests pass
- [ ] No process.env used in spawn() calls
- [ ] Only whitelisted vars in environment
- [ ] Verified with: `grep -r "process.env" src/`

**Estimated Time:** 2 hours

---

### Task 1.2: Disable Shell Execution

**Files to modify:**
- `src/orchestration/SubagentOrchestrator.ts`
- `src/engine/ClaudeService.ts`
- `src/git/GitWorktreeManager.ts`

**Steps:**

1. SubagentOrchestrator.ts (line 341):
   ```diff
   - shell: process.platform === 'win32',
   + shell: false,
   ```

2. ClaudeService.ts (line 106):
   ```diff
   - shell: process.platform === 'win32',
   + shell: false,
   ```

3. ClaudeService.ts (line 57):
   ```diff
   - shell: process.platform === 'win32',
   + shell: false,
   ```

4. GitWorktreeManager.ts (line 32):
   ```diff
   - shell: process.platform === 'win32'
   + shell: false
   ```

**Test:**
```bash
npm test -- tests/security/shell-injection.test.ts
```

**Verification:**
- [ ] Grep shows no shell: true
- [ ] All spawn() calls use shell: false
- [ ] Commands still execute correctly
- [ ] Verified with: `grep -r "shell:" src/`

**Estimated Time:** 1 hour

---

### Task 1.3: Output Sanitization

**Files to create:**
- `src/security/OutputSanitizer.ts`

**Files to modify:**
- `src/orchestration/ToolEventHandler.ts`
- `src/orchestration/SubagentOrchestrator.ts`

**Steps:**

1. Create OutputSanitizer.ts:
   ```typescript
   export interface SanitizationConfig {
       allowHTML: boolean;
       maxLength: number;
       stripANSI: boolean;
       normalizeUnicode: boolean;
   }

   export class OutputSanitizer {
       private static readonly ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
       private static readonly CONTROL_REGEX = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g;

       static sanitize(content: any, config: SanitizationConfig): string {
           let text = this.toString(content);

           // Length validation
           if (text.length > config.maxLength) {
               text = text.substring(0, config.maxLength);
           }

           // Strip ANSI
           if (config.stripANSI) {
               text = text.replace(this.ANSI_REGEX, '');
           }

           // Remove control characters
           text = text.replace(this.CONTROL_REGEX, '');

           // Unicode normalization
           if (config.normalizeUnicode) {
               text = text.normalize('NFKC');
           }

           // HTML escaping
           if (!config.allowHTML) {
               text = text
                   .replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#x27;');
           }

           return text;
       }

       private static toString(content: any): string {
           if (typeof content === 'string') return content;
           if (Array.isArray(content)) {
               return content
                   .filter(b => b?.type === 'text')
                   .map(b => String(b.text || ''))
                   .join('\n');
           }
           if (content?.text) return String(content.text);
           return String(content);
       }
   }
   ```

2. Update ToolEventHandler.ts (line 391-408):
   ```diff
   + import { OutputSanitizer } from '../security/OutputSanitizer';

     private extractContent(content: any): string {
   -     if (typeof content === 'string') {
   -         return content;
   -     }
   -     // ... rest of old logic
   +     return OutputSanitizer.sanitize(content, {
   +         allowHTML: false,
   +         maxLength: 1_000_000,
   +         stripANSI: true,
   +         normalizeUnicode: true
   +     });
     }
   ```

3. Update SubagentOrchestrator.ts (line 380, 385):
   ```diff
   + import { OutputSanitizer } from '../security/OutputSanitizer';

     if (typeof content === 'string') {
   -     textDelta = content;
   -     buffer += content;
   +     const sanitized = OutputSanitizer.sanitize(content, {
   +         allowHTML: false,
   +         maxLength: 10_000_000,
   +         stripANSI: true,
   +         normalizeUnicode: true
   +     });
   +     textDelta = sanitized;
   +     buffer += sanitized;
     }
   ```

**Test:**
```bash
npm test -- tests/security/output-sanitization.test.ts
```

**Verification:**
- [ ] XSS test passes (HTML escaped)
- [ ] ANSI codes stripped
- [ ] Control characters removed
- [ ] Unicode normalized

**Estimated Time:** 3 hours

---

### Task 1.4: Buffer Size Limits

**Files to modify:**
- `src/orchestration/SubagentOrchestrator.ts`

**Steps:**

1. Add constants at top of file:
   ```typescript
   private static readonly MAX_BUFFER_SIZE = 10 * 1024 * 1024;  // 10MB
   ```

2. Update stdout handler (line 366):
   ```diff
     let buffer = '';
     let lineBuffer = '';
     let stderrBuffer = '';
   + let totalSize = 0;

     proc.stdout?.on('data', (chunk: Buffer) => {
   +     const chunkStr = chunk.toString();
   +     totalSize += chunkStr.length;
   +
   +     if (totalSize > SubagentOrchestrator.MAX_BUFFER_SIZE) {
   +         this.stopTask(request.taskId);
   +         safeResolve({
   +             taskId: request.taskId,
   +             role: request.role,
   +             content: buffer,
   +             success: false,
   +             error: 'Output exceeded maximum buffer size (10MB)'
   +         });
   +         return;
   +     }
   +
   -     lineBuffer += chunk.toString();
   +     lineBuffer += chunkStr;
         // ... rest
     });
   ```

**Test:**
```bash
npm test -- tests/security/buffer-overflow.test.ts
```

**Verification:**
- [ ] Large output triggers error
- [ ] Process terminates
- [ ] Error message correct

**Estimated Time:** 2 hours

---

### Task 1.5: Remove --dangerously-skip-permissions

**Files to modify:**
- `src/orchestration/SubagentOrchestrator.ts`
- `src/engine/ClaudeService.ts`

**Steps:**

1. SubagentOrchestrator.ts (line 335):
   ```diff
     const args = [
         '--print',
         '--output-format', 'stream-json',
         '--model', config.model,
   -     '--dangerously-skip-permissions',
         '--verbose'
     ];
   ```

2. ClaudeService.ts (line 91):
   ```diff
     const args = [
         '--print',
         '--output-format', 'stream-json',
         '--verbose',
   -     '--dangerously-skip-permissions'
     ];
   ```

**Test:**
```bash
npm test
```

**Verification:**
- [ ] All tests pass
- [ ] Flag removed from both files
- [ ] Grep confirms: `grep -r "dangerously-skip-permissions" src/`
- [ ] Manual test: Agent prompts for permissions

**Estimated Time:** 1 hour

---

## PHASE 1 COMPLETION CHECKLIST

Before moving to Phase 2:

- [ ] All Task 1.1-1.5 completed
- [ ] All tests passing
- [ ] Code review by 2+ developers
- [ ] Security team review
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Git commit with message: "fix(security): Phase 1 critical security fixes"

**Total Phase 1 Time:** 9-16 hours

---

## PHASE 2: SECURITY INFRASTRUCTURE (1 WEEK)

### Task 2.1: Security Logger

**Create files:**
- `src/logging/SecurityLogger.ts`
- `tests/logging/SecurityLogger.test.ts`

**Implementation:**
```typescript
// See SECURITY_AUDIT_UPDATE_DEC_2025.md Section 4.1
```

**Integration points:**
- SubagentOrchestrator.runAgent() - log all agent executions
- ToolEventHandler.handleToolResult() - log all tool results
- Permission checks - log all permission decisions

**Checklist:**
- [ ] SecurityLogger class implemented
- [ ] Log rotation configured (100MB files, 365 days retention)
- [ ] Structured JSON logging
- [ ] Security event schema defined
- [ ] Integration in all spawn() calls
- [ ] Integration in all tool handlers
- [ ] Tests passing

**Estimated Time:** 8 hours

---

### Task 2.2: Permission Manager

**Create files:**
- `src/config/PermissionManager.ts`
- `tests/config/PermissionManager.test.ts`

**Implementation:**
```typescript
// See SECURITY_AUDIT_UPDATE_DEC_2025.md Section 3.1
```

**Integration:**
- Read VSCode setting: `claudeAssistant.executionPermission`
- Hook into tool execution flow
- Show permission prompts for risky operations

**Checklist:**
- [ ] PermissionManager class implemented
- [ ] VSCode settings integration
- [ ] Risk assessment logic
- [ ] Permission prompts (Allow/Deny/Allow All)
- [ ] Tests passing
- [ ] Manual test: Change setting, verify behavior

**Estimated Time:** 16 hours

---

### Task 2.3: Process Lifecycle Manager

**Files to modify:**
- `src/orchestration/SubagentOrchestrator.ts`

**Implementation:**
```typescript
// See SECURITY_AUDIT_UPDATE_DEC_2025.md Section 1.3
```

**Changes:**
- Improve stopTask() method
- Add SIGTERM → SIGKILL escalation
- Add process exit verification
- Add waitForExit() helper

**Checklist:**
- [ ] SIGTERM sent first
- [ ] 3 second grace period
- [ ] SIGKILL escalation
- [ ] Exit verification
- [ ] Critical logging if kill fails
- [ ] Tests passing

**Estimated Time:** 12 hours

---

### Task 2.4: Path Validator

**Create files:**
- `src/security/PathValidator.ts`
- `tests/security/PathValidator.test.ts`

**Implementation:**
```typescript
export class PathValidator {
    private workspaceRoot: string;
    private allowedDirectories: string[];
    private blockedPatterns: RegExp[];

    constructor(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.allowedDirectories = [
            path.join(this.workspaceRoot, 'src'),
            path.join(this.workspaceRoot, 'tests'),
            path.join(this.workspaceRoot, 'docs'),
            path.join(this.workspaceRoot, '.claude')
        ];

        this.blockedPatterns = [
            /\.\.\//,  // Path traversal
            /\.env/,   // Sensitive files
            /\.ssh\//,
            /\.aws\//,
            /node_modules\//,
            /\.git\//
        ];
    }

    validate(targetPath: string): { valid: boolean; reason?: string } {
        // Normalize and resolve
        const normalized = path.normalize(targetPath);
        const resolved = path.resolve(this.workspaceRoot, normalized);

        // Must be within workspace
        if (!resolved.startsWith(this.workspaceRoot)) {
            return { valid: false, reason: 'Path outside workspace' };
        }

        // Check blocked patterns
        for (const pattern of this.blockedPatterns) {
            if (pattern.test(resolved)) {
                return { valid: false, reason: 'Blocked pattern detected' };
            }
        }

        // Check allowed directories
        const inAllowedDir = this.allowedDirectories.some(
            dir => resolved.startsWith(dir)
        );

        if (!inAllowedDir) {
            return { valid: false, reason: 'Not in allowed directory' };
        }

        return { valid: true };
    }
}
```

**Integration:**
- All file operations (Read, Write, Edit)
- Tool execution
- Git operations

**Checklist:**
- [ ] PathValidator class implemented
- [ ] Workspace root enforcement
- [ ] Path traversal detection
- [ ] Sensitive file blocking
- [ ] Directory whitelist
- [ ] Tests passing (100% coverage)

**Estimated Time:** 8 hours

---

## PHASE 2 COMPLETION CHECKLIST

- [ ] All Task 2.1-2.4 completed
- [ ] All tests passing (unit + integration)
- [ ] Security logging operational
- [ ] Permission prompts working
- [ ] Path validation enforced
- [ ] Process termination reliable
- [ ] Code review completed
- [ ] Security team sign-off
- [ ] Documentation updated

**Total Phase 2 Time:** 44 hours

---

## PHASE 3: HARDENING (2 WEEKS)

### Task 3.1: JSON Schema Validation

**Dependencies:**
```bash
npm install ajv
npm install --save-dev @types/ajv
```

**Create files:**
- `src/validation/EventSchemas.ts`
- `tests/validation/EventValidation.test.ts`

**Checklist:**
- [ ] Ajv installed
- [ ] Event schemas defined
- [ ] Validation in JSON.parse() calls
- [ ] Tests passing

**Estimated Time:** 8 hours

---

### Task 3.2: Command Whitelisting

**Create files:**
- `src/security/CommandValidator.ts`
- `tests/security/CommandValidator.test.ts`

**Features:**
- Whitelist of allowed commands
- Argument validation
- Metadata sanitization

**Checklist:**
- [ ] CommandValidator implemented
- [ ] Git commands whitelisted
- [ ] NPM commands whitelisted
- [ ] File operations whitelisted
- [ ] Dangerous commands blocked
- [ ] Tests passing

**Estimated Time:** 16 hours

---

### Task 3.3: Resource Limits

**Implementation:**
- CPU limits (cgroups on Linux)
- Memory limits
- Process count limits
- Timeout enforcement

**Checklist:**
- [ ] CPU limit: 50%
- [ ] Memory limit: 512MB
- [ ] Max processes: 5 concurrent
- [ ] Timeout: 5 minutes
- [ ] Tests passing

**Estimated Time:** 20 hours

---

### Task 3.4: Enhanced ToolEventHandler

**Files to modify:**
- `src/orchestration/ToolEventHandler.ts`

**Add features:**
- Security analysis
- Pattern detection
- Policy enforcement
- Real-time monitoring

**Checklist:**
- [ ] Security flags added
- [ ] Suspicious pattern detection
- [ ] Policy violations logged
- [ ] Tests passing

**Estimated Time:** 12 hours

---

## TESTING STRATEGY

### Unit Tests (Required)

```bash
# Environment security
npm test -- tests/security/environment.test.ts

# Shell injection prevention
npm test -- tests/security/shell-injection.test.ts

# Output sanitization
npm test -- tests/security/output-sanitization.test.ts

# Path traversal prevention
npm test -- tests/security/path-traversal.test.ts

# Buffer overflow protection
npm test -- tests/security/buffer-overflow.test.ts

# Permission enforcement
npm test -- tests/config/PermissionManager.test.ts
```

### Integration Tests

```bash
# Full security suite
npm test -- tests/integration/security-integration.test.ts
```

### Manual Testing Checklist

- [ ] Create agent with restricted permissions
- [ ] Attempt to read .env → should block
- [ ] Attempt path traversal → should block
- [ ] Attempt shell injection → should block
- [ ] Check security logs → all events logged
- [ ] Test permission prompts → working correctly
- [ ] Test large output → buffer limit enforced
- [ ] Test process termination → reliably kills process

### Penetration Testing

Run after all fixes:
```bash
npm run test:penetration
```

Expected results:
- 0 critical vulnerabilities
- 0 high vulnerabilities
- < 5 medium vulnerabilities

---

## CODE REVIEW CHECKLIST

For each pull request implementing security fixes:

### Code Quality
- [ ] No shell: true in spawn() calls
- [ ] No process.env spreading
- [ ] All output sanitized
- [ ] All paths validated
- [ ] All commands validated
- [ ] Error messages don't leak secrets

### Testing
- [ ] Unit tests included
- [ ] Integration tests passing
- [ ] Security tests passing
- [ ] Code coverage > 80%

### Documentation
- [ ] Code comments added
- [ ] Security implications documented
- [ ] README updated
- [ ] CHANGELOG updated

### Security Review
- [ ] Reviewed by 2+ developers
- [ ] Reviewed by security team
- [ ] Penetration tests passing
- [ ] No new vulnerabilities introduced

---

## DEPLOYMENT CHECKLIST

Before deploying to production:

### Prerequisites
- [ ] All Phase 1 fixes deployed
- [ ] All Phase 2 fixes deployed
- [ ] All tests passing
- [ ] Security audit completed
- [ ] External penetration test passed

### Configuration
- [ ] Permission mode set correctly
- [ ] Security logging enabled
- [ ] Log rotation configured
- [ ] Monitoring alerts configured

### Documentation
- [ ] Security runbook created
- [ ] Incident response plan updated
- [ ] User documentation updated
- [ ] Admin guide updated

### Approvals
- [ ] Security team sign-off
- [ ] Engineering lead sign-off
- [ ] CISO sign-off
- [ ] Legal/compliance sign-off

---

## ROLLBACK PLAN

If issues found in production:

1. **Immediate:** Disable agent feature flag
2. **Within 1 hour:** Revert to previous version
3. **Within 4 hours:** Root cause analysis
4. **Within 24 hours:** Hotfix deployed
5. **Within 1 week:** Post-mortem completed

---

## SUPPORT & ESCALATION

### Development Questions
- Slack: #security-fixes
- Email: dev-team@company.com

### Security Issues
- Slack: #security-alerts
- Email: security@company.com
- Emergency: 1-800-SECURITY

### Escalation Path
1. Team Lead → CTO
2. Security Engineer → CISO
3. On-call Developer → VP Engineering

---

**This checklist is a living document. Update after each phase completion.**

**Last Updated:** 2025-12-07
**Next Review:** After Phase 1 completion
