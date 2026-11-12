import { expect, it } from 'vitest';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
// @ts-expect-error 工具為直接由 Node 執行的 ESM。
import { buildBalanceBundle, mergeConfig, root } from '../tools/balance-config.mjs';
// @ts-expect-error 工具為直接由 Node 執行的 ESM。
import { fromCsv, toCsv, summarize, summaryMarkdown, verifyOutput, gameRow } from '../tools/balance-report.mjs';
import { simulateBoard } from '../tools/board-difficulty-sim';

it('設定於載入規則前注入，未覆蓋值沿用原值，src/config.ts 位元組不變', async () => {
  const path = resolve(root, 'src/config.ts'), before = await readFile(path);
  const built = await buildBalanceBundle({ board: { waveHpGrowth: 321 }, boss: { hp: 23456 } });
  const runtime = new Function(`${built.code}; return balance;`)();
  expect(runtime.CONFIG.board.waveHpGrowth).toBe(321);
  expect(runtime.CONFIG.board.waveEveryTurns).toBe(3);
  expect(runtime.run({ seed: 20261111, bot: 'lazy', stopAt: 1 }).snapshot.boss.hp).toBe(23456);
  expect(await readFile(path)).toEqual(before);
  const defaults = await buildBalanceBundle({});
  expect(defaults.config.board.waveHpGrowth).toBe(300);
  expect(defaults.config.boss.hp).toBe(12000);
});

it('設定拼字、型別及無效 dt 必須明確報錯', () => {
  const base = { dt: 1 / 120, board: { waveHpGrowth: 300 } };
  expect(() => mergeConfig(base, { board: { waveHpGrowht: 301 } })).toThrow();
  expect(() => mergeConfig(base, { board: { waveHpGrowth: '301' } })).toThrow();
  expect(() => mergeConfig(base, { dt: 0 })).toThrow();
  expect(() => mergeConfig(base, JSON.parse('{"__proto__":{}}'))).toThrow();
  expect(base.board.waveHpGrowth).toBe(300);
});

it('新工具沿用 compare-runtimes 驅動器，與既有 Node 模擬器相同 seed 完整快照一致', async () => {
  const built = await buildBalanceBundle({ board: { waveHpGrowth: 300 } });
  const runtime = new Function(`${built.code}; return balance;`)();
  const actual = runtime.run({ seed: 20261111, bot: 'random' });
  expect(actual.snapshot).toEqual(simulateBoard(20261111, 'random').finalSnapshot);
  expect(gameRow(actual).cards).toEqual(actual.snapshot.board.cards);
}, 60000);

it('CSV 包含複雜卡牌內容仍可重算；summary 或勝負被改壞必須失敗', async () => {
  const row = { seed: 1, bot: 'random', won: 1, turns: 4, cards: [{ effect: '逗號, "引號"\n換行' }], status: 'won', ticks: 100, shots: 3, bossHp: 0 };
  const node = [row, { ...row, seed: 2, bot: 'greedy', won: 0, status: 'lost' }];
  const edge = [{ ...row, won: 0, status: 'lost' }];
  expect(fromCsv(toCsv(node))).toEqual(node);
  const summary = summarize(node, edge);
  expect(summary).toMatchObject({ node: { wins: 1, games: 2 }, edge: { wins: 0, games: 1 }, disagreements: 1, pairs: 1 });
  expect(() => fromCsv(toCsv([row, row]))).toThrow();
  expect(() => fromCsv(toCsv([{ ...row, won: 0 }]))).toThrow();
  expect(() => summarize(node, [{ ...row, seed: 3 }])).toThrow();
  const out = await mkdtemp(resolve(tmpdir(), 'resonance-balance-'));
  try {
    await writeFile(resolve(out, 'node.csv'), toCsv(node));
    await writeFile(resolve(out, 'edge.csv'), toCsv(edge));
    await writeFile(resolve(out, 'summary.md'), summaryMarkdown(summary));
    await expect(verifyOutput(out)).resolves.toEqual(summary);
    await writeFile(resolve(out, 'summary.md'), summaryMarkdown(summary).replace('50.0000%', '51.0000%'));
    await expect(verifyOutput(out)).rejects.toThrow('不一致');
  } finally { await rm(out, { recursive: true }); }
});
