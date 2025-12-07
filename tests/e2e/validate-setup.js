#!/usr/bin/env node

/**
 * Validation script for E2E test setup
 * Checks that all required files and dependencies are in place
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

let hasErrors = false;

function check(condition, message) {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    return true;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    hasErrors = true;
    return false;
  }
}

function warn(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

console.log('\n=== E2E Test Setup Validation ===\n');

// Check test files
console.log('Test Files:');
check(
  fs.existsSync(path.join(ROOT, 'tests/e2e/components/RetryIndicator.e2e.test.tsx')),
  'RetryIndicator.e2e.test.tsx exists'
);
check(
  fs.existsSync(path.join(ROOT, 'tests/e2e/components/ToolExecutionFeedback.e2e.test.tsx')),
  'ToolExecutionFeedback.e2e.test.tsx exists'
);
check(
  fs.existsSync(path.join(ROOT, 'tests/e2e/components/DebateVisualization.e2e.test.tsx')),
  'DebateVisualization.e2e.test.tsx exists'
);

// Check configuration files
console.log('\nConfiguration:');
check(
  fs.existsSync(path.join(ROOT, 'jest.config.js')),
  'jest.config.js exists'
);
check(
  fs.existsSync(path.join(ROOT, 'tests/setup.ts')),
  'tests/setup.ts exists'
);

// Check Jest config content
const jestConfigPath = path.join(ROOT, 'jest.config.js');
if (fs.existsSync(jestConfigPath)) {
  const jestConfig = fs.readFileSync(jestConfigPath, 'utf8');
  check(
    jestConfig.includes('jsdom'),
    'Jest configured with jsdom environment'
  );
  check(
    jestConfig.includes('setupFilesAfterEnv'),
    'Jest setup files configured'
  );
  check(
    jestConfig.includes('moduleNameMapper'),
    'CSS module mapping configured'
  );
}

// Check component files
console.log('\nComponent Files:');
check(
  fs.existsSync(path.join(ROOT, 'src/webview/components/RetryIndicator.tsx')),
  'RetryIndicator.tsx exists'
);
check(
  fs.existsSync(path.join(ROOT, 'src/webview/components/ToolExecutionFeedback.tsx')),
  'ToolExecutionFeedback.tsx exists'
);
check(
  fs.existsSync(path.join(ROOT, 'src/webview/components/DebateVisualization.tsx')),
  'DebateVisualization.tsx exists'
);

// Check package.json for dependencies
console.log('\nDependencies:');
const packageJsonPath = path.join(ROOT, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const devDeps = packageJson.devDependencies || {};

  check(
    devDeps.jest !== undefined,
    'jest installed'
  );
  check(
    devDeps['ts-jest'] !== undefined,
    'ts-jest installed'
  );

  const testingLibReact = devDeps['@testing-library/react'];
  if (testingLibReact) {
    check(true, '@testing-library/react installed');
  } else {
    warn('@testing-library/react not installed - run: npm install --save-dev @testing-library/react@^14.0.0');
  }

  const testingLibJestDom = devDeps['@testing-library/jest-dom'];
  if (testingLibJestDom) {
    check(true, '@testing-library/jest-dom installed');
  } else {
    warn('@testing-library/jest-dom not installed - run: npm install --save-dev @testing-library/jest-dom@^6.1.0');
  }

  const jestEnvJsdom = devDeps['jest-environment-jsdom'];
  if (jestEnvJsdom) {
    check(true, 'jest-environment-jsdom installed');
  } else {
    warn('jest-environment-jsdom not installed - run: npm install --save-dev jest-environment-jsdom@^30.2.0');
  }

  const identityObjProxy = devDeps['identity-obj-proxy'];
  if (identityObjProxy) {
    check(true, 'identity-obj-proxy installed');
  } else {
    warn('identity-obj-proxy not installed - run: npm install --save-dev identity-obj-proxy@^3.0.0');
  }
}

// Check documentation
console.log('\nDocumentation:');
check(
  fs.existsSync(path.join(ROOT, 'tests/e2e/README.md')),
  'README.md exists'
);
check(
  fs.existsSync(path.join(ROOT, 'tests/e2e/TEST_SUMMARY.md')),
  'TEST_SUMMARY.md exists'
);
check(
  fs.existsSync(path.join(ROOT, 'tests/e2e/QUICK_START.md')),
  'QUICK_START.md exists'
);

// Summary
console.log('\n' + '='.repeat(40));
if (hasErrors) {
  console.log(`${colors.red}Validation failed - please fix errors above${colors.reset}`);
  process.exit(1);
} else {
  console.log(`${colors.green}All checks passed!${colors.reset}`);
  console.log('\nNext steps:');
  console.log('  1. Install missing dependencies (if any warnings shown)');
  console.log('  2. Run tests: npm test tests/e2e');
  console.log('  3. View coverage: npm run test:coverage -- tests/e2e');
  process.exit(0);
}
