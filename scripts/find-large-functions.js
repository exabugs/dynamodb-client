#!/usr/bin/env node

/**
 * 50行を超える関数を特定するスクリプト
 *
 * TypeScriptファイルを解析して、50行を超える関数をリストアップします。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ディレクトリ内のすべてのTypeScriptファイルを取得
 */
function getAllTsFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * ファイル内の関数を解析して行数を計算
 */
function analyzeFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const functions = [];

  // 関数の開始パターンを検索
  const functionPatterns = [
    /^export\s+(async\s+)?function\s+(\w+)/, // export function
    /^(async\s+)?function\s+(\w+)/, // function
    /^(\w+)\s*=\s*(async\s*)?\(/, // arrow function assignment
    /^export\s+const\s+(\w+)\s*=\s*(async\s*)?\(/, // export const func =
  ];

  let currentFunction = null;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 関数の開始を検出
    if (!currentFunction) {
      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const functionName = match[2] || match[1]; // パターンによって位置が異なる
          currentFunction = {
            name: functionName,
            startLine: i + 1,
            endLine: null,
            lineCount: 0,
          };
          braceCount = 0;
          break;
        }
      }
    }

    // 関数内の処理
    if (currentFunction) {
      // 中括弧をカウント
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceCount += openBraces - closeBraces;

      // 関数の終了を検出
      if (braceCount <= 0 && line.includes('}')) {
        currentFunction.endLine = i + 1;
        currentFunction.lineCount = currentFunction.endLine - currentFunction.startLine + 1;

        // 50行を超える関数のみ記録
        if (currentFunction.lineCount > 50) {
          functions.push(currentFunction);
        }

        currentFunction = null;
      }
    }
  }

  return functions;
}

/**
 * メイン処理
 */
function main() {
  const srcDir = path.join(__dirname, '../src');
  const allFiles = getAllTsFiles(srcDir);

  console.log('🔍 50行を超える関数を検索中...\n');

  const largeFunctions = [];

  for (const file of allFiles) {
    const functions = analyzeFunctions(file);
    if (functions.length > 0) {
      const relativePath = path.relative(srcDir, file);
      largeFunctions.push({
        file: relativePath,
        functions,
      });
    }
  }

  // 結果の表示
  if (largeFunctions.length === 0) {
    console.log('✅ 50行を超える関数は見つかりませんでした。');
    return;
  }

  console.log(`⚠️  ${largeFunctions.length}個のファイルで50行を超える関数が見つかりました:\n`);

  let totalLargeFunctions = 0;

  for (const { file, functions } of largeFunctions) {
    console.log(`📁 ${file}`);

    for (const func of functions) {
      console.log(`  📏 ${func.name}(): ${func.lineCount}行 (${func.startLine}-${func.endLine})`);
      totalLargeFunctions++;
    }

    console.log('');
  }

  console.log(`📊 合計: ${totalLargeFunctions}個の大きな関数`);
  console.log('\n💡 これらの関数は単一責任の原則に従って分割することを推奨します。');
}

main();
