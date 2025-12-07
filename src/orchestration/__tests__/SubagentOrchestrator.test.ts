import { SubagentOrchestrator, AgentRequest } from '../SubagentOrchestrator';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

describe('SubagentOrchestrator - Chunk Emission', () => {
    let orchestrator: SubagentOrchestrator;
    let mockProcess: any;
    let mockStdin: any;
    let mockStdout: EventEmitter;
    let mockStderr: EventEmitter;

    beforeEach(() => {
        // Create mock stdin
        mockStdin = {
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn()
        };

        // Create mock stdout and stderr as EventEmitters
        mockStdout = new EventEmitter();
        mockStderr = new EventEmitter();

        // Create mock child process
        mockProcess = new EventEmitter();
        mockProcess.stdin = mockStdin;
        mockProcess.stdout = mockStdout;
        mockProcess.stderr = mockStderr;
        mockProcess.pid = 12345;
        mockProcess.killed = false;
        mockProcess.kill = jest.fn();

        // Mock spawn to return our mock process
        (spawn as jest.Mock).mockReturnValue(mockProcess);

        // Create orchestrator instance
        orchestrator = new SubagentOrchestrator('C:\\test\\workspace');
    });

    afterEach(() => {
        jest.clearAllMocks();
        orchestrator.dispose();
    });

    describe('Test 1: chunk events contain PARSED text (not raw JSON)', () => {
        it('should emit plain text only from assistant message with text blocks', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-1',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const chunks: string[] = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data.content);
            });

            const promise = orchestrator.runAgent(request);

            // Simulate Claude CLI stream-json output with text block
            const jsonOutput = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Hello world' }
                    ]
                }
            });

            setImmediate(() => {
                mockStdout.emit('data', Buffer.from(jsonOutput + '\n'));

                setImmediate(() => {
                    mockProcess.emit('close', 0);

                    promise.then(() => {
                        // FIXED: Chunks should contain PARSED text, NOT raw JSON
                        expect(chunks.length).toBe(1);
                        expect(chunks[0]).toBe('Hello world');
                        // Should NOT contain JSON artifacts
                        expect(chunks[0]).not.toContain('"type"');
                        expect(chunks[0]).not.toContain('"assistant"');
                        expect(chunks[0]).not.toContain('{');
                        done();
                    });
                });
            });
        });

        it('should emit plain text from assistant message with direct string content', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-2',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const chunks: string[] = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data.content);
            });

            const promise = orchestrator.runAgent(request);

            // Simulate Claude CLI stream-json output with direct string content
            const jsonOutput = JSON.stringify({
                type: 'assistant',
                message: {
                    content: 'Direct string content'
                }
            });

            setImmediate(() => {
                mockStdout.emit('data', Buffer.from(jsonOutput + '\n'));

                setImmediate(() => {
                    mockProcess.emit('close', 0);

                    promise.then(() => {
                        // FIXED: Should emit parsed text only
                        expect(chunks.length).toBe(1);
                        expect(chunks[0]).toBe('Direct string content');
                        expect(chunks[0]).not.toContain('"assistant"');
                        done();
                    });
                });
            });
        });
    });

    describe('Test 2: chunk events emit incrementally', () => {
        it('should emit multiple chunk events for multiple JSON lines', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-3',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const chunks: Array<{ taskId: string; role: string; content: string }> = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data);
            });

            const promise = orchestrator.runAgent(request);

            // Prepare multiple JSON lines
            const line1 = JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'text', text: 'First chunk' }] }
            });

            const line2 = JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'text', text: 'Second chunk' }] }
            });

            const line3 = JSON.stringify({
                type: 'assistant',
                message: { content: 'Third chunk as string' }
            });

            setImmediate(() => {
                mockStdout.emit('data', Buffer.from(line1 + '\n'));

                setImmediate(() => {
                    mockStdout.emit('data', Buffer.from(line2 + '\n'));

                    setImmediate(() => {
                        mockStdout.emit('data', Buffer.from(line3 + '\n'));

                        setImmediate(() => {
                            mockProcess.emit('close', 0);

                            promise.then(() => {
                                // Verify we received 3 chunk events
                                expect(chunks.length).toBe(3);

                                // Verify each chunk has correct metadata
                                chunks.forEach((chunk) => {
                                    expect(chunk.taskId).toBe('test-task-3');
                                    expect(chunk.role).toBe('coder');
                                    expect(chunk.content).toBeTruthy();
                                });

                                // Verify PARSED content from each chunk
                                expect(chunks[0].content).toBe('First chunk');
                                expect(chunks[1].content).toBe('Second chunk');
                                expect(chunks[2].content).toBe('Third chunk as string');

                                done();
                            });
                        });
                    });
                });
            });
        });

        it('should buffer partial JSON and emit when complete', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-4',
                role: 'planner',
                prompt: 'Test prompt'
            };

            const chunks: string[] = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data.content);
            });

            const promise = orchestrator.runAgent(request);

            const fullJson = JSON.stringify({
                type: 'assistant',
                message: { content: 'Complete message' }
            }) + '\n';

            // Split the JSON into parts (no newline until end)
            const part1 = fullJson.substring(0, 30);
            const part2 = fullJson.substring(30);

            setImmediate(() => {
                // Emit first part (incomplete JSON - no newline)
                mockStdout.emit('data', Buffer.from(part1));

                setImmediate(() => {
                    // Emit second part (completes the JSON with newline)
                    mockStdout.emit('data', Buffer.from(part2));

                    setImmediate(() => {
                        mockProcess.emit('close', 0);

                        promise.then(() => {
                            // FIXED: Should only emit ONE chunk when JSON is complete
                            expect(chunks.length).toBe(1);
                            expect(chunks[0]).toBe('Complete message');

                            done();
                        });
                    });
                });
            });
        });
    });

    describe('Test 3: Only assistant events emit chunks', () => {
        it('should ONLY emit chunks for assistant events (not system/tool)', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-5',
                role: 'verifier',
                prompt: 'Test prompt'
            };

            const chunks: Array<{ taskId: string; role: string; content: string }> = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data);
            });

            const promise = orchestrator.runAgent(request);

            // Simulate different event types
            const systemEvent = JSON.stringify({
                type: 'system',
                message: 'System notification'
            });

            const toolEvent = JSON.stringify({
                type: 'tool',
                message: 'Tool execution'
            });

            const assistantEvent = JSON.stringify({
                type: 'assistant',
                message: { content: 'Assistant response' }
            });

            setImmediate(() => {
                // Emit system event
                mockStdout.emit('data', Buffer.from(systemEvent + '\n'));

                setImmediate(() => {
                    // Emit tool event
                    mockStdout.emit('data', Buffer.from(toolEvent + '\n'));

                    setImmediate(() => {
                        // Emit assistant event
                        mockStdout.emit('data', Buffer.from(assistantEvent + '\n'));

                        setImmediate(() => {
                            mockProcess.emit('close', 0);

                            promise.then(() => {
                                // FIXED: Only assistant events emit chunks
                                expect(chunks.length).toBe(1);
                                expect(chunks[0].content).toBe('Assistant response');

                                // Verify metadata
                                expect(chunks[0].taskId).toBe('test-task-5');
                                expect(chunks[0].role).toBe('verifier');

                                done();
                            });
                        });
                    });
                });
            });
        });

        it('should not include non-assistant content in final buffer', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-6',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const promise = orchestrator.runAgent(request);

            const systemEvent = JSON.stringify({
                type: 'system',
                message: 'System message should not appear in buffer'
            });

            const assistantEvent = JSON.stringify({
                type: 'assistant',
                message: { content: 'Only this should be in buffer' }
            });

            setImmediate(() => {
                mockStdout.emit('data', Buffer.from(systemEvent + '\n'));
                mockStdout.emit('data', Buffer.from(assistantEvent + '\n'));

                setImmediate(() => {
                    mockProcess.emit('close', 0);

                    promise.then((response) => {
                        // Final buffer should only contain assistant content
                        expect(response.content).toBe('Only this should be in buffer');
                        expect(response.content).not.toContain('System message');
                        expect(response.success).toBe(true);

                        done();
                    });
                });
            });
        });
    });

    describe('Edge cases and error handling', () => {
        it('should handle malformed JSON gracefully (no chunk emitted)', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-7',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const chunks: string[] = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data.content);
            });

            const promise = orchestrator.runAgent(request);

            const malformedJson = '{ "type": "assistant", "message": { "content": "incomplete...';
            const validJson = JSON.stringify({
                type: 'assistant',
                message: { content: 'Valid content' }
            });

            setImmediate(() => {
                // Emit malformed JSON
                mockStdout.emit('data', Buffer.from(malformedJson + '\n'));

                // Emit valid JSON
                mockStdout.emit('data', Buffer.from(validJson + '\n'));

                setImmediate(() => {
                    mockProcess.emit('close', 0);

                    promise.then((response) => {
                        // FIXED: Only valid JSON emits a chunk
                        expect(chunks.length).toBe(1);
                        expect(chunks[0]).toBe('Valid content');

                        // Final buffer should only contain valid parsed content
                        expect(response.content).toBe('Valid content');

                        done();
                    });
                });
            });
        });

        it('should handle empty content blocks (no chunk emitted)', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-8',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const chunks: string[] = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data.content);
            });

            const promise = orchestrator.runAgent(request);

            const emptyBlockEvent = JSON.stringify({
                type: 'assistant',
                message: { content: [] }
            });

            const emptyStringEvent = JSON.stringify({
                type: 'assistant',
                message: { content: '' }
            });

            setImmediate(() => {
                mockStdout.emit('data', Buffer.from(emptyBlockEvent + '\n'));
                mockStdout.emit('data', Buffer.from(emptyStringEvent + '\n'));

                setImmediate(() => {
                    mockProcess.emit('close', 0);

                    promise.then((response) => {
                        // FIXED: Empty content doesn't emit chunks
                        expect(chunks.length).toBe(0);

                        // Buffer should be empty
                        expect(response.content).toBe('');
                        expect(response.success).toBe(true);

                        done();
                    });
                });
            });
        });

        it('should handle mixed content block types (extract only text)', (done) => {
            const request: AgentRequest = {
                taskId: 'test-task-9',
                role: 'coder',
                prompt: 'Test prompt'
            };

            const chunks: string[] = [];

            orchestrator.on('chunk', (data) => {
                chunks.push(data.content);
            });

            const promise = orchestrator.runAgent(request);

            const mixedContent = JSON.stringify({
                type: 'assistant',
                message: {
                    content: [
                        { type: 'text', text: 'Text block 1' },
                        { type: 'tool_use', name: 'some_tool' }, // Non-text block
                        { type: 'text', text: 'Text block 2' },
                        { type: 'image', data: 'base64...' } // Non-text block
                    ]
                }
            });

            setImmediate(() => {
                mockStdout.emit('data', Buffer.from(mixedContent + '\n'));

                setImmediate(() => {
                    mockProcess.emit('close', 0);

                    promise.then((response) => {
                        // FIXED: Should emit ONE chunk with combined text
                        expect(chunks.length).toBe(1);
                        expect(chunks[0]).toBe('Text block 1Text block 2');

                        // Should only extract text blocks
                        expect(response.content).toBe('Text block 1Text block 2');
                        expect(response.content).not.toContain('tool_use');
                        expect(response.content).not.toContain('image');

                        done();
                    });
                });
            });
        });
    });
});
