import { spawnSync } from 'node:child_process';

const composeFile = 'docker-compose.test.yml';
const testDatabaseUrl = 'postgresql://docscan_test:docscan_test_only@127.0.0.1:55432/docscan_integration_test';
const childEnvironment = {
  ...process.env,
  TEST_DATABASE_URL: testDatabaseUrl,
  DATABASE_URL: testDatabaseUrl,
  JWT_SECRET: process.env.JWT_SECRET || 'integration-test-jwt-secret',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'integration-test-gemini-key',
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: childEnvironment,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} falhou com status ${result.status ?? 'desconhecido'}.`);
  }
}

try {
  run('docker', ['compose', '-f', composeFile, 'down', '--volumes', '--remove-orphans']);
  run('docker', ['compose', '-f', composeFile, 'up', '--detach', '--wait']);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'validate']);
  run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts']);
} finally {
  run('docker', ['compose', '-f', composeFile, 'down', '--volumes', '--remove-orphans']);
}
