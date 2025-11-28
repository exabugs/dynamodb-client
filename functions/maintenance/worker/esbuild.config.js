import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Maintenance Worker Lambda ビルド設定
 *
 * - ESM形式で出力（.mjs）
 * - AWS SDK v3を外部化（Lambda実行環境に含まれる）
 * - @ainews/shadowsをバンドル
 * - Node.js 22 ARM64ランタイム向け
 */
await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/handler.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/handler.mjs',
  external: ['@aws-sdk/*'],
  sourcemap: true,
  minify: false,
  banner: {
    js: `
// ESM shim for __dirname and __filename
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`,
  },
});

console.log('✅ Maintenance Worker Lambda built successfully');
