import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
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
        'src/scripts/**', // CLIスクリプト（実行時のみ使用）
      ],
      // すべてのソースファイルをカバレッジ対象に含める
      all: true,
      // ソースマップを有効化してカバレッジを正確に測定
      reportsDirectory: './coverage',
      // カバレッジの閾値を設定
      // フェーズ1目標: 全体60%
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
  },
});
