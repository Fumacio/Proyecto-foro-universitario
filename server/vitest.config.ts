import { defineConfig } from 'vitest/config';

export const TEST_DATABASE_URL = 'file:./test.db';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    // Una sola base SQLite compartida: los archivos corren uno por uno.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef',
      FRONTEND_URL: 'http://localhost:5173',
      SMTP_HOST: '',
    },
  },
});
