import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

/**
 * esbuild設定 - Records Lambda (Server)
 *
 * CJS出力、完全バンドル、Node.js 22対応
 */

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

await esbuild.build({
  entryPoints: ['src/server/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/server/handler.cjs',
  external: [],
  sourcemap: true,
  minify: false,
  keepNames: true,
  banner: {
    js: `// ${packageJson.name} v${packageJson.version}\n// Built: ${new Date().toISOString()}`,
  },
  logLevel: 'info',
});

console.log('✅ Build complete: dist/server/handler.cjs');
