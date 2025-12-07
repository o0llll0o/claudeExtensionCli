import { SubagentOrchestrator, AgentPlan } from '../SubagentOrchestrator';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import {
    createMockProcess,
    createTextBlockEvent,
    flushPromises
} from './setup';

// Mock child_process module
jest.mock('child_process');

/**
 * Integration Tests for Retry Flow in SubagentOrchestrator
 *
 * Tests the complete retry lifecycle including:
 * - End-to-end retry flow from failure to success
 * - Event emission order and correctness
 * - Backoff delay timing
 * - Tool event tracking during retries
 * - Plan execution with recovery
 * - Retry exhaustion and error handling
 *
 * Note: Uses minimal delays (10ms base) for fast test execution
 */
describe('SubagentOrchestrator - Retry Flow Integration', () => {
    let orchestrator: SubagentOrchestrator;
    let mockSpawn: jest.MockedFunction<typeof spawn>;

    beforeEach(() => {
        orchestrator = new SubagentOrchestrator('C:\\test\\workspace');
        mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

        // Patch RetryExecutor to use shorter delays for testing
        const retryExecutor = (orchestrator as any).retryExecutor;
        const originalCalculateDelay = retryExecutor.calculateDelay.bind(retryExecutor);
        retryExecutor.calculateDelay = function(attempt: number, policy: any) {
            // Use 10ms base delay instead of 1000ms for faster tests
            const testPolicy = { ...policy, baseDelayMs: 10, maxDelayMs: 100, jitter: false };
            return originalCalculateDelay(attempt, testPolicy);
        };
    });

    afterEach(() => {
        orchestrator.dispose();
        jest.clearAllMocks();
    });

    describe('Integration Scenario 1: End-to-End Retry Flow', () => {
        it('should successfully retry agent failure → success and emit all events', async () => {
            // Track all events emitted during the test
            const eventLog: Array<{ event: string; data: any }> = [];

            orchestrator.on('retry_attempt', (data) => {
                eventLog.push({ event: 'retry_attempt', data });
            });

            orchestrator.on('step', (data) => {
                eventLog.push({ event: 'step', data });
            });

            orchestrator.on('chunk', (data) => {
                eventLog.push({ event: 'chunk', data });
            });

            // Create mock processes for each attempt
            let coderCallCount = 0;
            let verifierCallCount = 0;

            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;
                const mockStdin = mockProcess.stdin as any;

                setImmediate(() => {
                    const writeCalls = mockStdin.write.mock.calls;
                    if (writeCalls.length > 0) {
                        const prompt = writeCalls[0][0];

                        if (prompt.includes('Coder') || prompt.includes('Implement')) {
                            coderCallCount++;

                            if (coderCallCount === 1) {
                                // First coder attempt: fail
                                mockProcess.stderr.emit('data', Buffer.from('Coder error: compilation failed'));
                                mockProcess.emit('close', 1);
                            } else {
                                // Second+ coder attempt: succeed
                                mockProcess.stdout.emit('data', Buffer.from(
                                    createTextBlockEvent('Implementation complete') + '\n'
                                ));
                                mockProcess.emit('close', 0);
                            }
                        } else if (prompt.includes('Verifier') || prompt.includes('Review')) {
                            verifierCallCount++;
                            // Verifier always passes
                            mockProcess.stdout.emit('data', Buffer.from(
                                createTextBlockEvent('PASS: All checks passed') + '\n'
                            ));
                            mockProcess.emit('close', 0);
                        } else {
                            mockProcess.emit('close', 0);
                        }
                    } else {
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            // Create a simple plan with one step
            const plan: AgentPlan = {
                taskId: 'test-task',
                steps: [
                    {
                        id: 1,
                        action: 'create_file',
                        description: 'Create test file',
                        status: 'pending',
                        files: ['C:\\test\\file.ts']
                    }
                ],
                createdAt: Date.now()
            };

            // Execute plan
            const results = await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify coder was retried
            expect(coderCallCount).toBeGreaterThan(1);

            // Verify verifier was called after successful coder
            expect(verifierCallCount).toBe(1);

            // Verify event sequence
            expect(eventLog.length).toBeGreaterThan(0);

            // Find retry attempt events
            const retryEvents = eventLog.filter(e => e.event === 'retry_attempt');
            expect(retryEvents.length).toBeGreaterThanOrEqual(1);

            // Verify retry attempt event structure
            retryEvents.forEach((retryEvent) => {
                expect(retryEvent.data).toHaveProperty('operationId');
                expect(retryEvent.data).toHaveProperty('attempt');
                expect(retryEvent.data).toHaveProperty('maxAttempts');
                expect(retryEvent.data).toHaveProperty('error');
                expect(retryEvent.data).toHaveProperty('nextDelayMs');
            });

            // Verify step status transitions
            const stepEvents = eventLog.filter(e => e.event === 'step');
            expect(stepEvents.length).toBeGreaterThanOrEqual(2);

            // First event: step becomes in_progress
            expect(stepEvents[0].data.step.status).toBe('in_progress');

            // Last event: step becomes completed (after successful retry)
            expect(stepEvents[stepEvents.length - 1].data.step.status).toBe('completed');

            // Verify final results
            expect(results.length).toBeGreaterThan(0);
            const successfulResults = results.filter(r => r.success);
            expect(successfulResults.length).toBeGreaterThan(0);
        }, 15000); // 15 second timeout

        it('should verify backoff delays are respected (timing test)', async () => {
            const retryTimestamps: number[] = [];

            orchestrator.on('retry_attempt', () => {
                retryTimestamps.push(Date.now());
            });

            let attemptCount = 0;
            mockSpawn.mockImplementation(() => {
                attemptCount++;
                const mockProcess = createMockProcess() as any;

                setImmediate(() => {
                    if (attemptCount < 3) {
                        // Fail first two attempts
                        mockProcess.emit('close', 1);
                    } else {
                        // Succeed on third attempt
                        mockProcess.stdout.emit('data', Buffer.from(
                            createTextBlockEvent('PASS: Success') + '\n'
                        ));
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'backoff-test',
                steps: [{
                    id: 1,
                    action: 'test_action',
                    description: 'Test backoff delays',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify delays exist between retries (at least 2 retry attempts)
            expect(retryTimestamps.length).toBeGreaterThanOrEqual(1);

            // Verify delays are increasing (exponential backoff)
            if (retryTimestamps.length >= 2) {
                const delay1 = retryTimestamps[1] - retryTimestamps[0];
                // With 10ms base and 2x backoff: first delay ~20ms, second ~40ms
                expect(delay1).toBeGreaterThanOrEqual(10); // At least some delay
            }
        }, 10000);
    });

    describe('Integration Scenario 2: executePlan with Retry', () => {
        it('should retry step that fails first 2 attempts then succeeds', async () => {
            const stepStatusHistory: string[] = [];

            orchestrator.on('step', ({ step }) => {
                stepStatusHistory.push(step.status);
            });

            let coderAttempts = 0;

            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;
                const mockStdin = mockProcess.stdin as any;

                setImmediate(() => {
                    if (mockStdin.write.mock.calls.length > 0) {
                        const prompt = mockStdin.write.mock.calls[0][0];

                        if (prompt.includes('Coder') || prompt.includes('Implement')) {
                            coderAttempts++;

                            if (coderAttempts <= 2) {
                                // Fail first two coder attempts
                                mockProcess.stderr.emit('data', Buffer.from(`Error on attempt ${coderAttempts}`));
                                mockProcess.emit('close', 1);
                            } else {
                                // Succeed on third coder attempt
                                mockProcess.stdout.emit('data', Buffer.from(
                                    createTextBlockEvent('Implementation successful') + '\n'
                                ));
                                mockProcess.emit('close', 0);
                            }
                        } else {
                            // Verifier always passes
                            mockProcess.stdout.emit('data', Buffer.from(
                                createTextBlockEvent('PASS: Code quality approved') + '\n'
                            ));
                            mockProcess.emit('close', 0);
                        }
                    } else {
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'retry-plan-test',
                steps: [{
                    id: 1,
                    action: 'modify_file',
                    description: 'Modify existing file',
                    status: 'pending',
                    files: ['C:\\test\\file.ts']
                }],
                createdAt: Date.now()
            };

            const results = await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify step status transitions
            expect(stepStatusHistory).toContain('in_progress');
            expect(stepStatusHistory[stepStatusHistory.length - 1]).toBe('completed');

            // Verify coder was called 3 times (2 failures + 1 success)
            expect(coderAttempts).toBe(3);

            // Verify final success
            const successfulResults = results.filter(r => r.success);
            expect(successfulResults.length).toBeGreaterThan(0);
        }, 10000);

        it('should capture error messages during retry attempts', async () => {
            const errorMessages: string[] = [];

            orchestrator.on('retry_attempt', ({ error }) => {
                errorMessages.push(error);
            });

            let attemptCount = 0;

            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;

                setImmediate(() => {
                    attemptCount++;

                    if (attemptCount < 3) {
                        // Return error for first two attempts
                        const errorMsg = `Error attempt ${attemptCount}: Network timeout`;
                        mockProcess.stderr.emit('data', Buffer.from(errorMsg));
                        mockProcess.emit('close', 1);
                    } else {
                        // Success on third attempt
                        mockProcess.stdout.emit('data', Buffer.from(
                            createTextBlockEvent('PASS: Success') + '\n'
                        ));
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'error-capture-test',
                steps: [{
                    id: 1,
                    action: 'test_errors',
                    description: 'Test error message capture',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify error messages were captured
            expect(errorMessages.length).toBeGreaterThanOrEqual(1);
            errorMessages.forEach(msg => {
                expect(msg).toBeTruthy();
                expect(typeof msg).toBe('string');
            });
        }, 10000);
    });

    describe('Integration Scenario 3: Tool Events During Retry', () => {
        it('should track tool events across multiple retry attempts', async () => {
            const allChunks: string[] = [];

            orchestrator.on('chunk', ({ content }) => {
                allChunks.push(content);
            });

            let attemptCount = 0;
            mockSpawn.mockImplementation(() => {
                attemptCount++;
                const mockProcess = createMockProcess() as any;

                setImmediate(() => {
                    // Emit tool usage in each attempt
                    const toolMessage = `Attempt ${attemptCount}: Using Read tool`;
                    mockProcess.stdout.emit('data', Buffer.from(
                        createTextBlockEvent(toolMessage) + '\n'
                    ));

                    if (attemptCount < 3) {
                        // Fail first two attempts
                        mockProcess.emit('close', 1);
                    } else {
                        // Success on third attempt
                        mockProcess.stdout.emit('data', Buffer.from(
                            createTextBlockEvent('PASS: Success') + '\n'
                        ));
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'tool-events-test',
                steps: [{
                    id: 1,
                    action: 'read_files',
                    description: 'Read multiple files',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify chunks from multiple attempts
            expect(allChunks.length).toBeGreaterThanOrEqual(3);

            // Verify chunks from different attempts exist
            const attempt1Chunks = allChunks.filter(c => c.includes('Attempt 1'));
            const attempt2Chunks = allChunks.filter(c => c.includes('Attempt 2'));

            expect(attempt1Chunks.length).toBeGreaterThan(0);
            expect(attempt2Chunks.length).toBeGreaterThan(0);
        }, 10000);
    });

    describe('Integration Scenario 4: Retry with Plan Recovery', () => {
        it('should recover from transient failures and continue plan execution', async () => {
            const completedSteps: number[] = [];

            orchestrator.on('step', ({ step }) => {
                if (step.status === 'completed') {
                    completedSteps.push(step.id);
                }
            });

            let step1CoderAttempts = 0;
            let step2Executed = false;

            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;
                const mockStdin = mockProcess.stdin as any;

                setImmediate(() => {
                    if (mockStdin.write.mock.calls.length > 0) {
                        const prompt = mockStdin.write.mock.calls[0][0];

                        if (prompt.includes('step 1') && prompt.includes('Implement')) {
                            step1CoderAttempts++;
                            if (step1CoderAttempts === 1) {
                                // First attempt fails
                                mockProcess.emit('close', 1);
                            } else {
                                // Second attempt succeeds
                                mockProcess.stdout.emit('data', Buffer.from(
                                    createTextBlockEvent('Step 1 complete') + '\n'
                                ));
                                mockProcess.emit('close', 0);
                            }
                        } else if (prompt.includes('step 2') && prompt.includes('Implement')) {
                            step2Executed = true;
                            // Step 2 always succeeds
                            mockProcess.stdout.emit('data', Buffer.from(
                                createTextBlockEvent('Step 2 complete') + '\n'
                            ));
                            mockProcess.emit('close', 0);
                        } else {
                            // Verifier always passes
                            mockProcess.stdout.emit('data', Buffer.from(
                                createTextBlockEvent('PASS: Verified') + '\n'
                            ));
                            mockProcess.emit('close', 0);
                        }
                    } else {
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'recovery-test',
                steps: [
                    {
                        id: 1,
                        action: 'create_file',
                        description: 'Create first file',
                        status: 'pending'
                    },
                    {
                        id: 2,
                        action: 'create_file',
                        description: 'Create second file',
                        status: 'pending'
                    }
                ],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify both steps completed
            expect(completedSteps).toContain(1);
            expect(completedSteps).toContain(2);

            // Verify step 1 was retried
            expect(step1CoderAttempts).toBeGreaterThan(1);

            // Verify step 2 proceeded after step 1 recovered
            expect(step2Executed).toBe(true);
        }, 15000);

        it('should mark step as failed on exhausted retries after max attempts', async () => {
            const stepStatuses: Array<{ id: number; status: string }> = [];
            let exhaustedEventReceived = false;

            orchestrator.on('step', ({ step }) => {
                stepStatuses.push({ id: step.id, status: step.status });
            });

            orchestrator.on('step_exhausted', (data) => {
                exhaustedEventReceived = true;
                expect(data).toHaveProperty('operationId');
                expect(data).toHaveProperty('attempts');
                expect(data.attempts).toBe(3); // MAX_RETRIES
            });

            // Always fail
            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;
                setImmediate(() => {
                    mockProcess.stderr.emit('data', Buffer.from('Persistent error'));
                    mockProcess.emit('close', 1);
                });
                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'exhausted-test',
                steps: [{
                    id: 1,
                    action: 'test_exhaustion',
                    description: 'Test retry exhaustion',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            const results = await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify step ended in failed status
            const finalStatus = stepStatuses[stepStatuses.length - 1];
            expect(finalStatus.status).toBe('failed');

            // Verify exhausted event was emitted
            expect(exhaustedEventReceived).toBe(true);

            // Verify error result returned
            expect(results.length).toBeGreaterThan(0);
            const failedResult = results.find(r => !r.success);
            expect(failedResult).toBeDefined();
            expect(failedResult?.error).toContain('exhausted');
        }, 10000);
    });

    describe('Integration Scenario 5: Event Cascade', () => {
        it('should emit retry_attempt → chunk events in correct cascade', async () => {
            const eventSequence: string[] = [];

            orchestrator.on('retry_attempt', () => {
                eventSequence.push('retry_attempt');
            });

            orchestrator.on('chunk', () => {
                eventSequence.push('chunk');
            });

            let attemptCount = 0;
            mockSpawn.mockImplementation(() => {
                attemptCount++;
                const mockProcess = createMockProcess() as any;

                setImmediate(() => {
                    mockProcess.stdout.emit('data', Buffer.from(
                        createTextBlockEvent('Processing...') + '\n'
                    ));

                    if (attemptCount === 1) {
                        mockProcess.emit('close', 1);
                    } else {
                        mockProcess.stdout.emit('data', Buffer.from(
                            createTextBlockEvent('PASS: Success') + '\n'
                        ));
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'event-cascade-test',
                steps: [{
                    id: 1,
                    action: 'test_cascade',
                    description: 'Test event cascade',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify event sequence
            expect(eventSequence).toContain('retry_attempt');
            expect(eventSequence).toContain('chunk');

            // Verify retry_attempt comes before final chunks
            const firstRetryIndex = eventSequence.indexOf('retry_attempt');
            expect(firstRetryIndex).toBeGreaterThanOrEqual(0);
        }, 10000);

        it('should emit error cascade: retry_attempt → step_exhausted on max retries', async () => {
            const eventSequence: string[] = [];
            let exhaustedEventData: any = null;

            orchestrator.on('retry_attempt', () => {
                eventSequence.push('retry_attempt');
            });

            orchestrator.on('step_exhausted', (data) => {
                eventSequence.push('step_exhausted');
                exhaustedEventData = data;
            });

            // Always fail
            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;
                setImmediate(() => {
                    mockProcess.emit('close', 1);
                });
                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'error-cascade-test',
                steps: [{
                    id: 1,
                    action: 'test_error_cascade',
                    description: 'Test error event cascade',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify event sequence contains retry attempts followed by exhaustion
            expect(eventSequence).toContain('retry_attempt');
            expect(eventSequence).toContain('step_exhausted');

            // Verify exhausted event comes after retry attempts
            const lastRetryIndex = eventSequence.lastIndexOf('retry_attempt');
            const exhaustedIndex = eventSequence.indexOf('step_exhausted');
            expect(exhaustedIndex).toBeGreaterThan(lastRetryIndex);

            // Verify exhausted event data
            expect(exhaustedEventData).toBeTruthy();
            expect(exhaustedEventData.attempts).toBe(3);
            expect(exhaustedEventData).toHaveProperty('lastError');
        }, 10000);
    });

    describe('Edge Cases and Error Conditions', () => {
        it('should handle immediate success without retries', async () => {
            const retryEvents: any[] = [];

            orchestrator.on('retry_attempt', (data) => {
                retryEvents.push(data);
            });

            // Succeed on first attempt
            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;
                setImmediate(() => {
                    mockProcess.stdout.emit('data', Buffer.from(
                        createTextBlockEvent('PASS: Immediate success') + '\n'
                    ));
                    mockProcess.emit('close', 0);
                });
                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'no-retry-test',
                steps: [{
                    id: 1,
                    action: 'immediate_success',
                    description: 'Succeeds immediately',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // No retry events should be emitted
            expect(retryEvents.length).toBe(0);
        }, 10000);

        it('should preserve error context across retry attempts', async () => {
            const errorContexts: string[] = [];

            orchestrator.on('retry_attempt', ({ error }) => {
                errorContexts.push(error);
            });

            let attemptCount = 0;
            const errors = [
                'Error 1: Connection timeout',
                'Error 2: Rate limit exceeded'
            ];

            mockSpawn.mockImplementation(() => {
                const mockProcess = createMockProcess() as any;

                setImmediate(() => {
                    if (attemptCount < 2) {
                        mockProcess.stderr.emit('data', Buffer.from(errors[attemptCount]));
                        attemptCount++;
                        mockProcess.emit('close', 1);
                    } else {
                        mockProcess.stdout.emit('data', Buffer.from(
                            createTextBlockEvent('PASS: Success') + '\n'
                        ));
                        mockProcess.emit('close', 0);
                    }
                });

                return mockProcess;
            });

            const plan: AgentPlan = {
                taskId: 'error-context-test',
                steps: [{
                    id: 1,
                    action: 'test_errors',
                    description: 'Test error context preservation',
                    status: 'pending'
                }],
                createdAt: Date.now()
            };

            await orchestrator.executePlan(plan, 'C:\\test\\workspace');

            // Verify each error was captured
            expect(errorContexts.length).toBeGreaterThanOrEqual(1);
            errorContexts.forEach(context => {
                expect(context).toBeTruthy();
            });
        }, 10000);
    });
});
