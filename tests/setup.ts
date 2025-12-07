// import '@testing-library/jest-dom'; // Commented out for node environment tests

// Mock window.matchMedia for components that use media queries
if (typeof window !== 'undefined') {
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
}

// Mock VSCode API if needed
(global as any).acquireVsCodeApi = jest.fn(() => ({
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn(),
}));
