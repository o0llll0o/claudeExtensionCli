/**
 * WebviewMessages Type Definitions
 *
 * Defines all message types exchanged between the VS Code extension
 * and the webview UI, including mode-aware message routing.
 *
 * @module WebviewMessages
 * @author AR2 - Service Integration Architect
 * @date 2025-12-07
 */

import { PlanStep, AgentPlan } from '../orchestration/SubagentOrchestrator';

// ============================================
// Core Types
// ============================================

export type AppMode = 'chat' | 'review' | 'plan' | 'brainstorm';
export type PermissionMode = 'manual' | 'auto' | 'skip';

// ============================================
// Extension → Webview Messages
// ============================================

export interface ExtensionToWebviewMessage {
    type: ExtensionMessageType;
    payload?: any;
}

export type ExtensionMessageType =
    | 'claude'              // Claude response chunk
    | 'context'             // File context update
    | 'initProgress'        // CLI initialization progress
    | 'sessionLoaded'       // Session loaded
    | 'sessions'            // Session list
    | 'plan_ready'          // Plan generated, awaiting approval
    | 'step_update'         // Plan step status changed
    | 'swarm_init'          // Swarm initialized
    | 'agent_update'        // Individual agent status
    | 'review_result'       // Code review completed
    | 'error';              // Error occurred

// ============================================
// Plan Mode Messages
// ============================================

export interface PlanReadyPayload {
    taskId: string;
    plan: AgentPlan;
    requiresApproval: boolean;
    estimatedDuration: number; // milliseconds
}

export interface StepUpdatePayload {
    taskId: string;
    step: PlanStep;
    agentRole?: 'planner' | 'coder' | 'verifier';
    output?: string;
}

// ============================================
// Swarm Mode Messages
// ============================================

export interface SwarmInitPayload {
    taskId: string;
    mode: AppMode;
    agents: {
        role: 'planner' | 'coder' | 'verifier';
        status: 'idle' | 'active' | 'completed' | 'failed';
        worktreePath: string;
    }[];
    swarmDensity: number;
}

export interface AgentUpdatePayload {
    taskId: string;
    role: 'planner' | 'coder' | 'verifier';
    status: 'idle' | 'active' | 'completed' | 'failed';
    currentAction?: string;
    progress?: number; // 0-100
    output?: string;
}

// ============================================
// Review Mode Messages
// ============================================

export interface ReviewResultPayload {
    taskId: string;
    verdict: 'PASS' | 'FAIL';
    findings: ReviewFinding[];
    reviewerNotes: string;
}

export interface ReviewFinding {
    category: 'correctness' | 'security' | 'performance' | 'style';
    severity: 'critical' | 'major' | 'minor';
    message: string;
    file?: string;
    line?: number;
}

// ============================================
// Error Messages
// ============================================

export interface ErrorPayload {
    taskId: string;
    type: 'planner_error' | 'coder_error' | 'verifier_error' | 'system_error';
    message: string;
    recoverable: boolean;
    suggestedAction?: string;
}

// ============================================
// Webview → Extension Messages
// ============================================

export interface WebviewToExtensionMessage {
    type: WebviewMessageType;
    [key: string]: any;
}

export type WebviewMessageType =
    // Existing message types
    | 'send'
    | 'stop'
    | 'getContext'
    | 'copy'
    | 'apply'
    | 'insert'
    | 'saveSession'
    | 'loadSession'
    | 'getSessions'
    | 'newSession'
    | 'showInfo'
    | 'webviewReady'
    // New mode-aware message types
    | 'approvePlan'       // User approves plan
    | 'rejectPlan'        // User rejects plan
    | 'retryStep'         // Retry failed step
    | 'cancelTask';       // Cancel ongoing task

// ============================================
// Send Message Payloads
// ============================================

export interface SendMessagePayload {
    type: 'send';
    text: string;
    includeContext: boolean;
    model: string;
    ultrathink: boolean;
    // New mode-aware fields
    mode: AppMode;
    swarmDensity: number;
    permissionMode: PermissionMode;
}

// ============================================
// Plan Control Payloads
// ============================================

export interface ApprovePlanPayload {
    type: 'approvePlan';
    taskId: string;
}

export interface RejectPlanPayload {
    type: 'rejectPlan';
    taskId: string;
    reason?: string;
}

export interface RetryStepPayload {
    type: 'retryStep';
    taskId: string;
    stepId: number;
}

export interface CancelTaskPayload {
    type: 'cancelTask';
    taskId: string;
}
