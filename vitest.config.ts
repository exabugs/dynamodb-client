import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/src/**'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.config.ts',
        '**/*.config.js',
        '**/types/**',
        '**/__tests__/**',
      ],
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '.kiro'],
  },
});
