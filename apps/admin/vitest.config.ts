import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**'],
      exclude: ['node_modules/**', 'dist/**', '**/*.config.ts', '**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, '../../config'),
      '@ainews/api-types': path.resolve(__dirname, '../../packages/api-types/src'),
    },
  },
});
