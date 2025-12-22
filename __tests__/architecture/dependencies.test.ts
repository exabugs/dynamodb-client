/**
 * 依存関係の検証テスト
 * 
 * アーキテクチャの整合性を保つため、以下を検証します：
 * 1. 循環依存がないこと
 * 2. 依存方向が正しいこと（integrations → client → server → shadows → shared）
 * 3. 不正な依存関係がないこと
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * ファイルからimport文を抽出する
 */
function extractImports(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // 相対パスのみを対象とする（外部ライブラリは除外）
    if (importPath.startsWith('.') || importPath.startsWith('../')) {
      imports.push(importPath);
    }
  }

  return imports;
}

/**
 * ディレクトリ内のすべてのTypeScriptファイルを取得する
 */
function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
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
 * ファイルパスから層を判定する
 */
function getLayer(filePath: string): string {
  const relativePath = path.relative(path.join(__dirname, '../../src'), filePath);
  const parts = relativePath.split(path.sep);
  
  if (parts[0] === 'integrations') return 'integrations';
  if (parts[0] === 'client') return 'client';
  if (parts[0] === 'server') return 'server';
  if (parts[0] === 'shadows') return 'shadows';
  if (parts[0] === 'shared') return 'shared';
  
  return 'unknown';
}

/**
 * インポートパスから参照先の層を判定する
 */
function getTargetLayer(importPath: string, currentFilePath: string): string {
  const currentDir = path.dirname(currentFilePath);
  const resolvedPath = path.resolve(currentDir, importPath);
  return getLayer(resolvedPath);
}

/**
 * 層の依存関係が正しいかチェックする
 */
function isValidDependency(fromLayer: string, toLayer: string): boolean {
  const layerOrder = ['shared', 'shadows', 'server', 'client', 'integrations'];
  const fromIndex = layerOrder.indexOf(fromLayer);
  const toIndex = layerOrder.indexOf(toLayer);
  
  // 同じ層内の依存は許可
  if (fromIndex === toIndex) return true;
  
  // 下位層への依存のみ許可
  return fromIndex > toIndex;
}

describe('アーキテクチャ依存関係の検証', () => {
  const srcDir = path.join(__dirname, '../../src');
  
  it('循環依存がないこと', () => {
    // 層レベルでの循環依存チェック
    const allFiles = getAllTsFiles(srcDir);
    const layerDependencies = new Map<string, Set<string>>();
    
    // 層間の依存関係を収集
    for (const file of allFiles) {
      const fromLayer = getLayer(file);
      if (fromLayer === 'unknown') continue;
      
      if (!layerDependencies.has(fromLayer)) {
        layerDependencies.set(fromLayer, new Set());
      }
      
      const imports = extractImports(file);
      for (const importPath of imports) {
        const toLayer = getTargetLayer(importPath, file);
        if (toLayer !== 'unknown' && toLayer !== fromLayer) {
          layerDependencies.get(fromLayer)!.add(toLayer);
        }
      }
    }
    
    // 循環依存をチェック
    function hasCycleDFS(layer: string, visited: Set<string>, recursionStack: Set<string>): boolean {
      if (recursionStack.has(layer)) {
        return true; // 循環依存を発見
      }
      if (visited.has(layer)) {
        return false;
      }
      
      visited.add(layer);
      recursionStack.add(layer);
      
      const dependencies = layerDependencies.get(layer) || new Set();
      for (const dep of dependencies) {
        if (hasCycleDFS(dep, visited, recursionStack)) {
          return true;
        }
      }
      
      recursionStack.delete(layer);
      return false;
    }
    
    const globalVisited = new Set<string>();
    for (const layer of layerDependencies.keys()) {
      if (!globalVisited.has(layer)) {
        const localRecursionStack = new Set<string>();
        const hasCycle = hasCycleDFS(layer, globalVisited, localRecursionStack);
        expect(hasCycle).toBe(false);
      }
    }
    
    // デバッグ情報を出力
    console.log('Layer dependencies:');
    for (const [layer, deps] of layerDependencies.entries()) {
      console.log(`  ${layer} → [${Array.from(deps).join(', ')}]`);
    }
  });
  
  it('依存方向が正しいこと（integrations → client → server → shadows → shared）', () => {
    const allFiles = getAllTsFiles(srcDir);
    const violations: string[] = [];
    
    for (const file of allFiles) {
      const fromLayer = getLayer(file);
      if (fromLayer === 'unknown') continue;
      
      const imports = extractImports(file);
      
      for (const importPath of imports) {
        const toLayer = getTargetLayer(importPath, file);
        if (toLayer === 'unknown') continue;
        
        if (!isValidDependency(fromLayer, toLayer)) {
          violations.push(`${fromLayer} → ${toLayer} (${path.relative(srcDir, file)})`);
        }
      }
    }
    
    if (violations.length > 0) {
      console.error('不正な依存関係が見つかりました:');
      violations.forEach(violation => console.error(`  ${violation}`));
    }
    
    expect(violations).toHaveLength(0);
  });
  
  it('各層が期待される依存関係のみを持つこと', () => {
    const expectedDependencies = {
      'integrations': ['shared', 'client'],
      'client': ['shared'],
      'server': ['shared', 'shadows'],
      'shadows': ['shared'],
      'shared': []
    };
    
    const allFiles = getAllTsFiles(srcDir);
    const actualDependencies = new Map<string, Set<string>>();
    
    // 実際の依存関係を収集
    for (const file of allFiles) {
      const fromLayer = getLayer(file);
      if (fromLayer === 'unknown') continue;
      
      if (!actualDependencies.has(fromLayer)) {
        actualDependencies.set(fromLayer, new Set());
      }
      
      const imports = extractImports(file);
      for (const importPath of imports) {
        const toLayer = getTargetLayer(importPath, file);
        if (toLayer !== 'unknown' && toLayer !== fromLayer) {
          actualDependencies.get(fromLayer)!.add(toLayer);
        }
      }
    }
    
    // 期待される依存関係と比較
    for (const [layer, expectedDeps] of Object.entries(expectedDependencies)) {
      const actualDeps = actualDependencies.get(layer) || new Set();
      const expectedSet = new Set(expectedDeps);
      
      // 予期しない依存関係をチェック
      for (const dep of actualDeps) {
        expect(expectedSet.has(dep)).toBe(true);
      }
    }
  });
  
  it('shared層が他の層に依存していないこと', () => {
    const sharedFiles = getAllTsFiles(path.join(srcDir, 'shared'));
    const violations: string[] = [];
    
    for (const file of sharedFiles) {
      const imports = extractImports(file);
      
      for (const importPath of imports) {
        const targetLayer = getTargetLayer(importPath, file);
        if (targetLayer !== 'unknown' && targetLayer !== 'shared') {
          violations.push(`${path.relative(srcDir, file)} → ${targetLayer}`);
        }
      }
    }
    
    if (violations.length > 0) {
      console.error('shared層からの不正な依存関係が見つかりました:');
      violations.forEach(violation => console.error(`  ${violation}`));
    }
    
    expect(violations).toHaveLength(0);
  });
  
  it('各層のindex.tsが適切にエクスポートしていること', () => {
    const layers = ['shared', 'shadows', 'server', 'client'];
    
    for (const layer of layers) {
      const indexPath = path.join(srcDir, layer, 'index.ts');
      
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf-8');
        
        // export文が存在することを確認
        expect(content).toMatch(/export\s+/);
        
        // 相対パスからのエクスポートがあることを確認
        expect(content).toMatch(/from\s+['"]\.\/.*['"]/);
      }
    }
  });
});