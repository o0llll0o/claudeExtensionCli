#!/bin/bash

# Install E2E testing dependencies for React components

echo "Installing E2E testing dependencies..."

npm install --save-dev \
  @testing-library/react@^14.0.0 \
  @testing-library/jest-dom@^6.1.0 \
  @testing-library/user-event@^14.5.0 \
  jest-environment-jsdom@^30.2.0 \
  identity-obj-proxy@^3.0.0

echo "Dependencies installed successfully!"
echo ""
echo "Run tests with:"
echo "  npm test tests/e2e"
echo ""
echo "Run with coverage:"
echo "  npm run test:coverage -- tests/e2e"
