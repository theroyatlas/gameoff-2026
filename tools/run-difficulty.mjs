import { createServer } from 'vite';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
// 僅在記憶體載入 TypeScript；不監聽網路、不輸出 dist。
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const { run } = await server.ssrLoadModule('/tools/difficulty-sim.ts');
  await run(process.argv.slice(2));
} finally {
  await server.close();
}
if (!process.argv.includes('--no-plot')) {
  const plot = spawnSync('python', ['tools/plot-difficulty.py'], { stdio: 'inherit', timeout: 60000 });
  if (plot.status !== 0) console.warn('PNG 未產生；完整 CSV 已保留。', plot.error?.message ?? '需要本機 Matplotlib');
}
