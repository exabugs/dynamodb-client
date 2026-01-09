import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.ts',
        '**/types.ts',
        '**/__tests__/**',
        '**/index.ts', // re-export only files
      ],
      // すべてのソースファイルをカバレッジ対象に含める
      all: true,
      // ソースマップを有効化してカバレッジを正確に測定
      reportsDirectory: './coverage',
      // カバレッジの閾値を設定（警告のみ、失敗はしない）
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
});
