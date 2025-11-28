import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

/**
 * esbuild設定 - Fetch Lambda
 *
 * CommonJS出力、完全バンドル、Node.js 22対応
 */

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

await esbuild.build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/handler.cjs',
  external: [],
  sourcemap: true,
  minify: false,
  keepNames: true,
  banner: {
    js: `// ${packageJson.name} v${packageJson.version}\n// Built: ${new Date().toISOString()}`,
  },
  logLevel: 'info',
});

console.log('✅ Build complete: dist/handler.cjs');
