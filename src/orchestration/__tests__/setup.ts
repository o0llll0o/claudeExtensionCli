import { EventEmitter } from 'events';

/**
 * Test Setup Utilities for Orchestration Components
 *
 * Provides mock factories and utilities for testing orchestration infrastructure.
 */

export interface MockStream {
    write: jest.Mock;
    end: jest.Mock;
    on: jest.Mock;
}

export interface MockProcess {
    stdin: MockStream;
    stdout: EventEmitter;
    stderr: EventEmitter;
    pid?: number;
    killed: boolean;
    kill: jest.Mock;
    on: jest.Mock;
    emit: (event: string | symbol, ...args: any[]) => boolean;
}

/**
 * Creates a mock child process for testing agent orchestration.
 *
 * @param options - Optional configuration for the mock process
 * @returns A fully mocked process instance
 */
export function createMockProcess(options: {
    pid?: number;
    exitCode?: number;
    killed?: boolean;
} = {}): MockProcess {
    const mockStdin: MockStream = {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn()
    };

    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    const processEmitter = new EventEmitter();

    const mockProcess: MockProcess = {
        stdin: mockStdin,
        stdout: mockStdout,
        stderr: mockStderr,
        pid: options.pid ?? 12345,
        killed: options.killed ?? false,
        kill: jest.fn((signal?: any) => {
            mockProcess.killed = true;
            // Simulate process being killed
            setImmediate(() => {
                processEmitter.emit('close', options.exitCode ?? 0);
            });
            return true;
        }),
        on: jest.fn((event: string, listener: (...args: any[]) => void) => {
            processEmitter.on(event, listener);
            return mockProcess as any;
        }),
        emit: (event: string | symbol, ...args: any[]) => {
            return processEmitter.emit(event, ...args);
        }
    };

    return mockProcess;
}

/**
 * Creates a mock event payload for testing event handlers.
 *
 * @param type - Event type (e.g., 'assistant', 'system', 'tool')
 * @param content - Content payload (string or content blocks)
 * @returns JSON string representing a Claude CLI event
 */
export function createMockEvent(
    type: 'assistant' | 'system' | 'tool',
    content: string | Array<{ type: string; text?: string; [key: string]: any }>
): string {
    const event = {
        type,
        message: {
            content
        }
    };
    return JSON.stringify(event);
}

/**
 * Creates a mock text block event from Claude CLI.
 *
 * @param text - The text content to include
 * @returns JSON string representing an assistant event with text block
 */
export function createTextBlockEvent(text: string): string {
    return createMockEvent('assistant', [{ type: 'text', text }]);
}

/**
 * Creates a mock event with direct string content.
 *
 * @param text - The text content
 * @returns JSON string representing an assistant event with string content
 */
export function createStringContentEvent(text: string): string {
    return createMockEvent('assistant', text);
}

/**
 * Waits for a specific event to be emitted from an EventEmitter.
 *
 * @param emitter - The EventEmitter to listen to
 * @param eventName - The name of the event to wait for
 * @param timeout - Optional timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with the event data
 */
export function waitForEvent<T = any>(
    emitter: EventEmitter,
    eventName: string,
    timeout: number = 5000
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for event: ${eventName}`));
        }, timeout);

        emitter.once(eventName, (data: T) => {
            clearTimeout(timeoutId);
            resolve(data);
        });
    });
}

/**
 * Simulates a timeout/delay in async operations.
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function simulateTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Collects all events of a specific type from an EventEmitter.
 *
 * @param emitter - The EventEmitter to listen to
 * @param eventName - The name of the event to collect
 * @returns Object with collected events and a stop function
 */
export function collectEvents<T = any>(
    emitter: EventEmitter,
    eventName: string
): { events: T[]; stop: () => void } {
    const events: T[] = [];

    const listener = (data: T) => {
        events.push(data);
    };

    emitter.on(eventName, listener);

    return {
        events,
        stop: () => emitter.removeListener(eventName, listener)
    };
}

/**
 * Simulates streaming data in chunks with configurable delays.
 *
 * @param mockStdout - The mock stdout EventEmitter
 * @param chunks - Array of data chunks to emit
 * @param delayMs - Delay between chunks in milliseconds (default: 10)
 * @returns Promise that resolves when all chunks are emitted
 */
export async function streamChunks(
    mockStdout: EventEmitter,
    chunks: string[],
    delayMs: number = 10
): Promise<void> {
    for (const chunk of chunks) {
        await simulateTimeout(delayMs);
        mockStdout.emit('data', Buffer.from(chunk));
    }
}

/**
 * Creates a mock error for testing error handling.
 *
 * @param message - Error message
 * @param code - Optional error code
 * @returns Error object with optional code property
 */
export function createMockError(message: string, code?: string): Error & { code?: string } {
    const error = new Error(message);
    if (code) {
        (error as any).code = code;
    }
    return error;
}

/**
 * Sets up common test fixtures for orchestrator tests.
 *
 * @returns Object containing common test fixtures
 */
export function setupOrchestrationFixtures() {
    const mockProcess = createMockProcess();
    const workspace = 'C:\\test\\workspace';

    return {
        mockProcess,
        workspace,
        taskId: 'test-task-123',
        role: 'coder' as const,
        prompt: 'Test prompt'
    };
}

/**
 * Advances all timers and promises to simulate async execution.
 * Useful for testing with fake timers.
 */
export async function flushPromises(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Creates a mock retry context for testing retry strategies.
 */
export interface MockRetryContext {
    attemptNumber: number;
    error: Error;
    startTime: number;
    totalDuration: number;
}

export function createMockRetryContext(overrides: Partial<MockRetryContext> = {}): MockRetryContext {
    return {
        attemptNumber: 1,
        error: new Error('Test error'),
        startTime: Date.now(),
        totalDuration: 0,
        ...overrides
    };
}

/**
 * Asserts that a function throws an error matching the expected pattern.
 *
 * @param fn - Function to test
 * @param errorPattern - Expected error message pattern (string or regex)
 */
export async function expectAsyncError(
    fn: () => Promise<any>,
    errorPattern: string | RegExp
): Promise<void> {
    let error: Error | null = null;
    try {
        await fn();
    } catch (e) {
        error = e as Error;
    }

    expect(error).toBeTruthy();
    if (typeof errorPattern === 'string') {
        expect(error?.message).toContain(errorPattern);
    } else {
        expect(error?.message).toMatch(errorPattern);
    }
}
