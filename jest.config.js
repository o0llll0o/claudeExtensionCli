const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    ...tsJestTransformCfg,
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/__tests__/**",
    "!src/webview/index.tsx", // Entry point, minimal logic
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ["text", "lcov", "html", "text-summary"],
  coverageDirectory: "coverage",
  testMatch: [
    "**/__tests__/**/*.{ts,tsx}",
    "**/*.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/setup\\.ts$",
  ],
};