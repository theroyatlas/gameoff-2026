import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { Game } from '../src/game';

// 直接讀取不可變 commit 的規則，避免用改過的程式重新產生預期值。
const baseline = '84d6550ea25a710cb8a65ee8a1a13f4ff3ab5b94';
function loadBaseline(path: string, config?: unknown) {
  const source = execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8', windowsHide: true });
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(code, { exports, require: (name: string) => {
    if (name !== './config') throw new Error(`Unexpected import: ${name}`);
    return config;
  } });
  return exports;
}

it('固定 seed 即時模式每個檢查點與 3d/smooth 84d6550 的完整狀態完全相同', () => {
  const Original = loadBaseline('src/game.ts', loadBaseline('src/config.ts')).Game;
  const original = new Original(20261111), current = new Game(20261111);
  original.start(); current.start();
  for (let tick = 0; tick < 24000; tick++) {
    if (tick % 137 === 0) {
      const angle = -Math.PI / 2 + Math.sin(tick / 137) * 1.1;
      expect(current.fire(angle)).toBe(original.fire(angle));
    }
    original.step(); current.step();
    if (tick % 1200 === 0 || tick === 23999) expect(JSON.stringify(current.snapshot())).toBe(JSON.stringify(original.snapshot()));
  }
  expect(current.events.length).toBeGreaterThan(0);
  expect(current.wave).toBeGreaterThan(0);
  expect(current.shifts.some(s => s.kind === 'release')).toBe(true);
}, 60000);
