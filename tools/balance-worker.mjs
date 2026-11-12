import { readFile } from 'node:fs/promises';
import { gameRow } from './balance-report.mjs';

process.once('message', async ({ bundle, seedStart, seeds, deadline }) => {
  try {
    const runtime = new Function(`${await readFile(bundle, 'utf8')}; return balance;`)();
    for (let i = 0; i < seeds; i++) {
      for (const bot of runtime.BOTS) {
        if (Date.now() >= deadline) throw new Error('Node 時間預算到達');
        const row = gameRow(runtime.run({ seed: seedStart + i, bot, stopAt: Math.round(600 / runtime.CONFIG.dt) }));
        process.send({ row });
      }
    }
    process.disconnect();
  } catch (error) {
    process.send({ error: error.stack ?? String(error) }); process.exitCode = 1; process.disconnect();
  }
});
