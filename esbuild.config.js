import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

/**
 * esbuild設定 - Records Lambda (Server)
 *
 * CJS出力、完全バンドル、Node.js 22対応
 */

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = {
  js: `// ${packageJson.name} v${packageJson.version}\n// Built: ${new Date().toISOString()}`,
};
const define = {
  'process.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
};

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
  define,
  banner,
  logLevel: 'info',
});

console.log('✅ Build complete: dist/server/handler.cjs');

// メディア機能のLambdaハンドラー（sharpはLambda Layer経由で提供するためバンドルから除外）
const mediaHandlers = [
  { entry: 'src/server/media/process-handler.ts', out: 'dist/server/media-process-handler.cjs' },
  {
    entry: 'src/server/media/process-handler-dlq.ts',
    out: 'dist/server/media-process-handler-dlq.cjs',
  },
  { entry: 'src/server/media/media-handler.ts', out: 'dist/server/media-handler.cjs' },
];

for (const { entry, out } of mediaHandlers) {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: out,
    external: ['sharp'],
    sourcemap: true,
    minify: false,
    keepNames: true,
    define,
    banner,
    logLevel: 'info',
  });
  console.log(`✅ Build complete: ${out}`);
}
